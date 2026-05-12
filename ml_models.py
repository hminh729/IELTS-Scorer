import torch
import torch.nn as nn
import os
import json
from transformers import AutoTokenizer, DebertaV2Model, AutoModelForSeq2SeqLM
from transformers.modeling_outputs import SequenceClassifierOutput
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- 1. ĐỊNH NGHĨA CẤU TRÚC MODEL ---
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

# --- 2. KHỞI TẠO TÀI NGUYÊN (Singleton) ---
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
MODEL_PATH = "./models/DeBert/best_model"
SENTENCE_MODEL_PATH = "./models/DeBert/DeBERTa_Sentence_Scorer"

def sanitize_tokenizer_config(model_path):
    config_path = os.path.join(model_path, "tokenizer_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            if "extra_special_tokens" in config and isinstance(config["extra_special_tokens"], list):
                print(f"🔧 Fixing tokenizer_config for {model_path}...")
                del config["extra_special_tokens"]
                with open(config_path, "w", encoding="utf-8") as f:
                    json.dump(config, f, indent=2)
        except Exception as e:
            print(f"⚠️ Could not sanitize config at {model_path}: {e}")

# Sanitize configs
sanitize_tokenizer_config(MODEL_PATH)
sanitize_tokenizer_config(SENTENCE_MODEL_PATH)

# (EasyOCR disabled)

# Initialize Main Scorer Model
print(f"🔄 Đang nạp mô hình Scorer từ: {MODEL_PATH}")
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

# Scorer Model Option (ONNX or PyTorch)
onnx_session = None
model = None

# OPTION: PyTorch (Current default in controller.py)
model = DebertaV3ForIELTS(MODEL_PATH, num_labels=5)
state_dict = torch.load(os.path.join(MODEL_PATH, "pytorch_model.bin"), map_location=DEVICE)
model.load_state_dict(state_dict)
model.to(DEVICE)
model.eval()

# --- SENTENCE SCORER MODEL ---
print(f"🔄 Đang nạp mô hình Sentence Scorer từ: {SENTENCE_MODEL_PATH}")
sentence_tokenizer = AutoTokenizer.from_pretrained(SENTENCE_MODEL_PATH)
sentence_model = DebertaV3ForIELTS(SENTENCE_MODEL_PATH, num_labels=1)
sentence_state_dict = torch.load(os.path.join(SENTENCE_MODEL_PATH, "pytorch_model.bin"), map_location=DEVICE)
sentence_model.load_state_dict(sentence_state_dict)
sentence_model.to(DEVICE)
sentence_model.eval()

# --- GEMINI ---
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
llm_model = None
if GOOGLE_API_KEY:
    print(f"🔄 Đang nạp Gemini...")
    genai.configure(api_key=GOOGLE_API_KEY)
    llm_model = genai.GenerativeModel('models/gemini-2.5-flash')
else:
    print("WARNING: GOOGLE_API_KEY not found in .env file")

# --- T5 MODEL (Rephrase) ---
T5_PT_PATH = "./models/T5/ASE_model_T5_Final"
print(f"🔄 Đang nạp mô hình T5 PyTorch từ: {T5_PT_PATH}")
sanitize_tokenizer_config(T5_PT_PATH)
t5_model = AutoModelForSeq2SeqLM.from_pretrained(T5_PT_PATH)
t5_tokenizer = AutoTokenizer.from_pretrained(T5_PT_PATH)
t5_model.to(DEVICE)
t5_model.eval()
