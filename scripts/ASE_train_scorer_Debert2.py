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
        # Load backbone từ path có sẵn
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
        # Sử dụng Sigmoid để giới hạn output trong [0, 1]
        logits = self.sigmoid(logits)

        loss = None
        if labels is not None:
            # 🛡️ BẢO VỆ: Đảm bảo logits và labels đều ở dạng 1D phẳng (batch_size,)
            # Trainer đôi khi pad labels thành (batch, seq_len) -> (16, 128) = 2048
            y_pred = logits.view(-1)

            # Nếu labels có nhiều hơn 1 chiều (ví dụ 16x128), ta chỉ lấy giá trị đầu tiên của mỗi row
            # 🛡️ CHÚ Ý: Ép kiểu sang .float() để tránh lỗi "Found dtype Long but expected Float"
            if labels.dim() > 1:
                y_true = labels[:, 0].float() if labels.size(1) > 0 else labels.view(-1).float()
            else:
                y_true = labels.view(-1).float()

            # Kiểm tra lại để chắc chắn 2 tensor cùng size (16)
            if y_true.size(0) != y_pred.size(0):
                # Fallback: ép về cùng size của pred nếu vẫn lệch
                y_true = y_true[:y_pred.size(0)]

            # --- Weighted MSE Loss ---
            # Scale ngược lại để kiểm tra dải điểm thực tế
            band_scores = y_true * 9.0

            # Khởi tạo trọng số (mặc định là 1.0)
            weights = torch.ones_like(band_scores)
            # Tăng trọng số phạt cho các dải điểm cực biên (< 4.0 và > 8.0)
            weights[(band_scores < 4.0) | (band_scores > 8.0)] = 2.5

            # Tính MSE từng mẫu (không reduction)
            loss_fct = nn.MSELoss(reduction='none')
            mse_loss = loss_fct(y_pred, y_true)

            # Áp dụng trọng số và lấy trung bình
            loss = (mse_loss * weights).mean()

        return SequenceClassifierOutput(loss=loss, logits=logits)

# --- 2. Cấu hình đường dẫn ---
DRIVE_DATA_PATH = "/content/drive/MyDrive/data/ASE/Deberta_Sentence_Processed"
LOCAL_DATA_PATH = "/content/Deberta_Sentence_Processed"
# CẬP NHẬT: Load tiếp từ mô hình đã training trước đó để tinh chỉnh
PRETRAINED_MODEL_PATH = "/content/drive/MyDrive/data/ASE/DeBert/best_model"
OUTPUT_DIR = "/content/drive/MyDrive/data/ASE/DeBert/DeBERTa_Sentence_Scorer_V2"

# Tự động copy data từ Drive vào máy ảo nếu chưa có (Giải quyết nghẽn I/O đọc)
if not os.path.exists(LOCAL_DATA_PATH) and os.path.exists(DRIVE_DATA_PATH):
    print("🚚 Đang copy dữ liệu vào local máy ảo để tăng tốc đọc...")
    shutil.copytree(DRIVE_DATA_PATH, LOCAL_DATA_PATH)
    print("✅ Copy hoàn tất!")
elif not os.path.exists(DRIVE_DATA_PATH) and not os.path.exists(LOCAL_DATA_PATH):
    # Fallback cho chạy local trên máy tính cá nhân
    LOCAL_DATA_PATH = "e:/Learning/IELTS-Scorer/data/Deberta_Sentence_Processed"
    PRETRAINED_MODEL_PATH = "e:/Learning/IELTS-Scorer/models/DeBert/best_model"
    OUTPUT_DIR = "e:/Learning/IELTS-Scorer/models/DeBERTa_Sentence_Scorer"

DATA_PATH = LOCAL_DATA_PATH

# --- 3. Load Dữ liệu & Tokenizer ---
print("📂 Loading dataset...")
dataset = load_from_disk(DATA_PATH)
tokenizer = AutoTokenizer.from_pretrained(PRETRAINED_MODEL_PATH)

# --- 4. Khởi tạo Model & Load Trọng số ---
print(f"🔄 Initializing Model from {PRETRAINED_MODEL_PATH}...")
model = DebertaV3ForIELTS(PRETRAINED_MODEL_PATH, num_labels=1)

# Load trọng số từ essay model hiện có (chỉ lấy phần backbone)
state_dict_path = os.path.join(PRETRAINED_MODEL_PATH, "pytorch_model.bin")
if os.path.exists(state_dict_path):
    print("🎯 Loading weights from existing model (Backbone)...")
    state_dict = torch.load(state_dict_path, map_location="cpu")
    
    # 🛠️ GIẢI PHÁP TRIỆT ĐỂ: Xóa các key không khớp kích thước trước khi nạp
    # Điều này ngăn PyTorch so khớp lớp Classifier cũ (5 lớp) vào model mới (1 lớp)
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

    # 🛡️ BẢO VỆ: Xử lý lỗi không khớp kích thước (ví dụ 318592 vs 2489)
    # Nếu labels bị pad thành (N, 128), ta chỉ lấy giá trị thực đầu tiên của mỗi mẫu
    if labels.ndim > 1:
        # Lấy cột đầu tiên nếu có nhiều cột (padding)
        actuals = labels[:, 0] * 9.0
    else:
        actuals = labels.flatten() * 9.0

    preds = logits.flatten() * 9.0

    # Đảm bảo số lượng mẫu khớp nhau (phòng trường hợp Trainer gom nhóm lẻ)
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

# Lưu mô hình (State dict) và Tokenizer
torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, "pytorch_model.bin"))
tokenizer.save_pretrained(OUTPUT_DIR)

# Lưu config của model để dễ load sau này
model.config.save_pretrained(OUTPUT_DIR)

print(f"✅ Hoàn tất! Mô hình đã được lưu tại {OUTPUT_DIR}")
