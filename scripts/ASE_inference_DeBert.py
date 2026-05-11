
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from transformers import AutoTokenizer, DebertaV2Model
from transformers.modeling_outputs import SequenceClassifierOutput
import os

# 1. Định nghĩa Model (Bắt buộc khớp 100% với Training)
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

    def forward(self, input_ids=None, attention_mask=None, token_type_ids=None, **kwargs):
        outputs = self.deberta(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids)
        pooled_output = self.pooling(outputs.last_hidden_state, attention_mask)
        pooled_output = self.layer_norm(pooled_output)
        pooled_output = self.dropout(pooled_output)
        logits = self.classifier(pooled_output)
        logits = self.sigmoid(logits)
        return SequenceClassifierOutput(logits=logits)

# 2. Cấu hình đường dẫn
# Thay đổi model_path nếu bạn lưu ở chỗ khác
model_path = "/content/drive/MyDrive/data/ASE/ASE_model/best_model"
csv_path = "/content/drive/MyDrive/data/ASE/ielts_writing_dataset1.csv"

# 3. Load Model và Tokenizer
print("🚀 Đang khởi tạo Model và tải trọng số...")
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

try:
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = DebertaV3ForIELTS(model_path, num_labels=5)
    
    # Load state dict
    state_dict = torch.load(os.path.join(model_path, "pytorch_model.bin"), map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    print("✅ Model đã sẵn sàng!")
except Exception as e:
    print(f"❌ Lỗi khi load model: {e}")
    print("Gợi ý: Hãy đảm bảo bạn đã chạy đúng mã nguồn training mới nhất và model_path chính xác.")

# 4. Chạy thử nghiệm trên dữ liệu CSV
print("-" * 50)
if os.path.exists(csv_path):
    df = pd.read_csv(csv_path)
    # Lấy mẫu thử nghiệm: mỗi thang điểm (class) lấy ngẫu nhiên 3 mẫu để test
    test_samples = df.groupby('Overall').apply(lambda x: x.sample(min(len(x), 3))).reset_index(drop=True)
    
    print(f"🔍 Đang chạy dự đoán cho {len(test_samples)} mẫu trên tất cả các mức điểm...")
    
    for index, row in test_samples.iterrows():
        task_type = int(row.get('Task_Type', 2))
        question = str(row['Question'])
        essay = str(row['Essay'])
        ground_truth = row['Overall']

        # Format prompt đúng chuẩn [TASK X]
        prompt = f"[TASK {task_type}] Question: {question}"
        
        inputs = tokenizer(
            prompt,
            essay,
            return_tensors="pt",
            truncation=True,
            padding="max_length",
            max_length=512
        ).to(device)

        with torch.no_grad():
            outputs = model(**inputs)
            # Chuyển logits (0-1) về band điểm (0-9)
            raw_scores = outputs.logits[0].cpu().numpy() * 9.0
            
        # Làm tròn về 0.5
        rounded_scores = np.round(raw_scores * 2) / 2
        
        print(f"Mẫu {index+1} | Task {task_type} | Điểm thật: {ground_truth}")
        print(f"  -> Dự đoán Overall: {rounded_scores[-1]} (Raw: {raw_scores[-1]:.2f})")
        print(f"  -> Chi tiết (TR, CC, LR, GRA): {rounded_scores[:-1]}")
        print("-" * 20)
else:
    print(f"⚠️ Không tìm thấy file CSV tại {csv_path}. Bạn hãy kiểm tra lại đường dẫn.")