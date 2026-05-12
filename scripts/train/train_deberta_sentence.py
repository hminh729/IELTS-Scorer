import shutil
import os
import torch
import torch.nn as nn
import numpy as np
from datasets import load_from_disk
from transformers import (
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
    DebertaV2Model,
    DebertaV2Config
)
from transformers.modeling_outputs import SequenceClassifierOutput
from sklearn.metrics import mean_absolute_error, mean_squared_error

# --- 1. Định nghĩa Kiến trúc Model ---
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
    def __init__(self, model_name_or_path, num_labels=1):
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
        pooled_output = self.pooling(outputs.last_hidden_state, attention_mask)
        pooled_output = self.layer_norm(pooled_output)
        pooled_output = self.dropout(pooled_output)
        logits = self.classifier(pooled_output)
        logits = self.sigmoid(logits)

        loss = None
        if labels is not None:
            y_pred = logits.view(-1)
            if labels.dim() > 1:
                y_true = labels[:, 0].float() if labels.size(1) > 0 else labels.view(-1).float()
            else:
                y_true = labels.view(-1).float()

            if y_true.size(0) != y_pred.size(0):
                y_true = y_true[:y_pred.size(0)]

            band_scores = y_true * 9.0
            weights = torch.ones_like(band_scores)
            weights[(band_scores < 4.0) | (band_scores > 8.0)] = 2.5

            loss_fct = nn.MSELoss(reduction='none')
            mse_loss = loss_fct(y_pred, y_true)
            loss = (mse_loss * weights).mean()

        return SequenceClassifierOutput(loss=loss, logits=logits)

# --- 2. Cấu hình đường dẫn ---
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_PATH = os.path.join(base_dir, "data/Deberta_Sentence_Processed")
PRETRAINED_MODEL_PATH = os.path.join(base_dir, "models/DeBert/best_model")
OUTPUT_DIR = os.path.join(base_dir, "models/DeBert/DeBERTa_Sentence_Scorer_V2")

# --- 3. Load Dữ liệu & Tokenizer ---
print("📂 Loading dataset...")
dataset = load_from_disk(DATA_PATH)
tokenizer = AutoTokenizer.from_pretrained(PRETRAINED_MODEL_PATH)

# --- 4. Khởi tạo Model & Load Trọng số ---
print(f"🔄 Initializing Model from {PRETRAINED_MODEL_PATH}...")
model = DebertaV3ForIELTS(PRETRAINED_MODEL_PATH, num_labels=1)

state_dict_path = os.path.join(PRETRAINED_MODEL_PATH, "pytorch_model.bin")
if os.path.exists(state_dict_path):
    print("🎯 Loading weights from existing model (Backbone)...")
    state_dict = torch.load(state_dict_path, map_location="cpu")
    keys_to_remove = ["classifier.weight", "classifier.bias"]
    for key in keys_to_remove:
        if key in state_dict:
            print(f"🗑️ Removing {key} from state_dict to avoid size mismatch...")
            del state_dict[key]
    print("🎯 Loading weights into the model...")
    model.load_state_dict(state_dict, strict=False)

# --- 5. Hàm tính Metrics ---
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    if labels.ndim > 1:
        actuals = labels[:, 0] * 9.0
    else:
        actuals = labels.flatten() * 9.0

    preds = logits.flatten() * 9.0
    min_size = min(len(actuals), len(preds))
    actuals = actuals[:min_size]
    preds = preds[:min_size]

    mse = mean_squared_error(actuals, preds)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(actuals, preds)

    return {
        "rmse": rmse,
        "mae": mae,
        "mse": mse
    }

# --- 6. Cấu hình Training ---
training_args = TrainingArguments(
    output_dir="./tmp_checkpoints",
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate=2e-5,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    num_train_epochs=50,
    weight_decay=0.05,
    load_best_model_at_end=True,
    metric_for_best_model="rmse",
    greater_is_better=False,
    logging_steps=100,
    save_total_limit=2,
    fp16=torch.cuda.is_available(),
    report_to="none"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
)

# --- 7. Bắt đầu Huấn luyện ---
print("🚀 Starting Fine-tuning...")
trainer.train()

# --- 8. Đánh giá cuối cùng và Lưu mô hình ---
print("\n🔍 Đánh giá trên tập Test...")
test_results = trainer.evaluate(dataset["test"])
print(f"Test RMSE: {test_results['eval_rmse']:.4f}, MAE: {test_results['eval_mae']:.4f}")

print(f"💾 Saving final model to {OUTPUT_DIR}...")
os.makedirs(OUTPUT_DIR, exist_ok=True)

torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, "pytorch_model.bin"))
tokenizer.save_pretrained(OUTPUT_DIR)
model.config.save_pretrained(OUTPUT_DIR)

print(f"✅ Hoàn tất! Mô hình đã được lưu tại {OUTPUT_DIR}")
