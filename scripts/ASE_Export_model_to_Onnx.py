import torch
import torch.nn as nn
import os
from transformers import DebertaV2Model, AutoTokenizer
from transformers.modeling_outputs import SequenceClassifierOutput

# copy lại các class Pooling và Model
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

# Load Model
model_path = r"./models/DeBert/best_model"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = DebertaV3ForIELTS(model_path)
state_dict = torch.load(os.path.join(model_path, "pytorch_model.bin"), map_location="cpu")
model.load_state_dict(state_dict)
model.eval()

# Wrapper đơn giản hơn để hỗ trợ Quantization
class ONNXWrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask, token_type_ids):
        # Gọi trực tiếp các thành phần để tránh tạo ra SequenceClassifierOutput
        # Việc này giúp đồ thị ONNX "sạch" hơn, không bị lỗi khi Quantize
        
        # 1. Chạy qua backbone DeBERTa
        outputs = self.model.deberta(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids
        )
        last_hidden_state = outputs.last_hidden_state
        
        # 2. Pooling
        pooled_output = self.model.pooling(last_hidden_state, attention_mask)
        
        # 3. LayerNorm & Dropout (identity in eval)
        pooled_output = self.model.layer_norm(pooled_output)
        
        # 4. Classifier
        logits = self.model.classifier(pooled_output)
        
        # CHÚ Ý: Không dùng Sigmoid ở đây để giữ độ chính xác cao nhất khi Quantize.
        # Chúng ta sẽ tính Sigmoid bằng code Python/Numpy khi Inference.
        
        return logits

onnx_model = ONNXWrapper(model)
onnx_model.eval()

# Chuẩn bị input mẫu
text = "This is a sample IELTS essay for ONNX export."
inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=512)

# Cấu hình đường dẫn xuất
output_dir = r"./models/DeBert/best_model_onnx"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "ASE_model.onnx")

print(f"🚀 Đang Export mô hình sang: {output_path}...")

# Export
torch.onnx.export(
    onnx_model,
    (inputs["input_ids"], inputs["attention_mask"], inputs["token_type_ids"]),
    output_path,
    input_names=["input_ids", "attention_mask", "token_type_ids"],
    output_names=["logits"],
    dynamic_axes={
        "input_ids": {0: "batch_size", 1: "seq_len"},
        "attention_mask": {0: "batch_size", 1: "seq_len"},
        "token_type_ids": {0: "batch_size", 1: "seq_len"},
        "logits": {0: "batch_size"}
    },
    opset_version=17, # Thử với 17 trước cho ổn định
)

print("✅ Export thành công!")

# Test thử file ONNX vừa tạo
import onnxruntime as ort
session = ort.InferenceSession(output_path)
onnx_outputs = session.run(
    None,
    {
        "input_ids": inputs["input_ids"].numpy(),
        "attention_mask": inputs["attention_mask"].numpy(),
        "token_type_ids": inputs["token_type_ids"].numpy()
    }
)
print("\nLogits từ ONNX:", onnx_outputs[0])