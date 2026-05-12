import os
import torch
import torch.nn as nn
import numpy as np
import argparse
from datasets import load_from_disk
from sklearn.metrics import mean_absolute_error, mean_squared_error
from transformers import (
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
    DebertaV2Model,
    DebertaV2Config,
    TrainerCallback
)
from transformers.modeling_outputs import SequenceClassifierOutput
import pandas as pd

# ==========================================
# 1. Định nghĩa Model với Mean Pooling
# ==========================================
class MeanPooling(nn.Module):
    def __init__(self):
        super(MeanPooling, self).__init__()
        
    def forward(self, last_hidden_state, attention_mask):
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
        sum_embeddings = torch.sum(last_hidden_state * input_mask_expanded, 1)
        sum_mask = input_mask_expanded.sum(1)
        sum_mask = torch.clamp(sum_mask, min=1e-9)
        return sum_embeddings / sum_mask

class DebertaV3ForIELTS(nn.Module):
    def __init__(self, model_name_or_path, num_labels=5):
        super(DebertaV3ForIELTS, self).__init__()
        self.deberta = DebertaV2Model.from_pretrained(model_name_or_path)
        self.config = self.deberta.config
        
        self.pooling = MeanPooling()
        self.layer_norm = nn.LayerNorm(self.config.hidden_size)
        self.dropout = nn.Dropout(0.1)
        self.classifier = nn.Linear(self.config.hidden_size, num_labels)
        self.sigmoid = nn.Sigmoid()

    def forward(self, input_ids=None, attention_mask=None, token_type_ids=None, labels=None, **kwargs):
        outputs = self.deberta(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids)
        
        # Sử dụng Mean Pooling thay vì [CLS]
        pooled_output = self.pooling(outputs.last_hidden_state, attention_mask)
        pooled_output = self.layer_norm(pooled_output)
        pooled_output = self.dropout(pooled_output)
        
        logits = self.classifier(pooled_output)
        logits = self.sigmoid(logits)

        loss = None
        if labels is not None:
            loss_fct = nn.MSELoss()
            loss = loss_fct(logits, labels.float())

        return SequenceClassifierOutput(
            loss=loss,
            logits=logits,
            hidden_states=outputs.hidden_states,
            attentions=outputs.attentions,
        )

    def save_pretrained(self, save_directory):
        if not os.path.exists(save_directory):
            os.makedirs(save_directory, exist_ok=True)
        self.deberta.save_pretrained(save_directory)
        self.config.save_pretrained(save_directory)
        torch.save(self.state_dict(), os.path.join(save_directory, "pytorch_model.bin"))

# ==========================================
# 2. Custom Trainer & Callback
# ==========================================
class SaveModelCallback(TrainerCallback):
    def __init__(self, output_dir, tokenizer):
        self.output_dir = output_dir
        self.tokenizer = tokenizer
        self.best_loss = float('inf')

    def on_evaluate(self, args, state, control, metrics, **kwargs):
        current_loss = metrics.get("eval_loss")
        model = kwargs.get("model")
        trainer = kwargs.get("trainer")

        if current_loss is not None:
            last_path = os.path.join(self.output_dir, "last_model")
            model.save_pretrained(last_path)
            self.tokenizer.save_pretrained(last_path)
            
            trainer.save_optimizer_and_scheduler(last_path)
            trainer.state.save_to_json(os.path.join(last_path, "trainer_state.json"))
            
            print(f"\n[Callback] 🔄 Đã cập nhật Last Model (Full State). Loss: {current_loss:.4f}")

            if current_loss < self.best_loss:
                self.best_loss = current_loss
                best_path = os.path.join(self.output_dir, "best_model")
                model.save_pretrained(best_path)
                self.tokenizer.save_pretrained(best_path)
                print(f"🌟 [Callback] 🏆 Đã lưu Best Model mới! (Loss tốt nhất: {self.best_loss:.4f})")

class WeightedTrainer(Trainer):
    def __init__(self, weights=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.weights = weights

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.get("labels")
        outputs = model(**inputs)
        logits = outputs.get("logits")
        
        if labels is not None and self.weights is not None:
            loss_fct = nn.MSELoss(reduction='none')
            loss = loss_fct(logits, labels.float())
            overall_scores = labels[:, -1] * 9.0
            sample_weights = torch.ones_like(overall_scores)
            for i, score in enumerate(overall_scores):
                s = round(float(score) * 2) / 2
                sample_weights[i] = self.weights.get(s, 1.0)
            loss = (loss.mean(dim=1) * sample_weights).mean()
        else:
            loss = outputs.loss

        return (loss, outputs) if return_outputs else loss

# ==========================================
# 3. Utilities
# ==========================================
def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    rmse = np.sqrt(mean_squared_error(labels, predictions))
    mae = mean_absolute_error(labels, predictions)
    return {"rmse": rmse, "mae": mae}

def get_args():
    # base_dir is 3 levels up from scripts/train/
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_name", type=str, default="microsoft/deberta-v3-base")
    parser.add_argument("--data_path", type=str, default=os.path.join(base_dir, "data/ASE/processed_ielts_dataset"))
    parser.add_argument("--output_dir", type=str, default=os.path.join(base_dir, "models/ASE/ASE_model"))
    parser.add_argument("--tensorboard_log", type=str, default=os.path.join(base_dir, "models/ASE/tensorboard"))

    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--warmup_steps", type=int, default=200)
    parser.add_argument("--weight_decay", type=float, default=0.01)
    parser.add_argument("--eval_steps", type=int, default=50)
    parser.add_argument("--patience", type=int, default=3)
    return parser.parse_args()

# ==========================================
# 4. Huấn luyện
# ==========================================
def train_model():
    args = get_args()
    os.makedirs(args.output_dir, exist_ok=True)
    
    last_model_path = os.path.join(args.output_dir, "last_model")

    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    dataset = load_from_disk(args.data_path)
    
    overall_counts = pd.Series([round(float(x[-1]) * 9 * 2) / 2 for x in dataset['train']['labels']]).value_counts()
    max_count = overall_counts.max()
    weights_dict = {score: min(max_count / count, 10.0) for score, count in overall_counts.items()}
    print(f"📊 Trọng số Loss thiết lập: {weights_dict}")

    model = DebertaV3ForIELTS(args.model_name, num_labels=5)

    if torch.cuda.is_available():
        for param in model.parameters():
            if param.requires_grad:
                param.data = param.data.to(torch.float32)

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        eval_strategy="epoch",
        save_strategy="no",
        learning_rate=args.lr,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=4, 
        num_train_epochs=args.epochs,
        weight_decay=args.weight_decay,
        warmup_steps=args.warmup_steps,
        load_best_model_at_end=True,
        metric_for_best_model="loss",
        greater_is_better=False,
        fp16=torch.cuda.is_available(),
        logging_dir=args.tensorboard_log,
        report_to="tensorboard",
        logging_steps=50,
        remove_unused_columns=False
    )

    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        compute_metrics=compute_metrics,
        weights=weights_dict, 
        callbacks=[
            EarlyStoppingCallback(early_stopping_patience=args.patience),
            SaveModelCallback(args.output_dir, tokenizer)
        ]
    )

    print("🚀 Bắt đầu huấn luyện...")
    
    resume_from_checkpoint = None
    if os.path.exists(last_model_path) and os.listdir(last_model_path):
        if os.path.exists(os.path.join(last_model_path, "optimizer.pt")):
            resume_from_checkpoint = last_model_path
            print(f"--> Phát hiện Full State tại {last_model_path}. Đang nạp để train tiếp...")
    
    trainer.train(resume_from_checkpoint=resume_from_checkpoint)

    try:
        os.sync()
    except:
        pass

    print(f"✅ Hoàn tất!")


if __name__ == "__main__":
    train_model()
