import pandas as pd
import os
from sklearn.model_selection import train_test_split
from datasets import Dataset, DatasetDict
from transformers import AutoTokenizer

# --- 1. Cấu hình đường dẫn ---
# Trỏ thẳng vào file đã được làm sạch và cân bằng hoàn chỉnh
INPUT_CSV = "e:/Learning/IELTS-Scorer/data/raw/T5_dataset_final_balanced.csv"
OUTPUT_DIR = "e:/Learning/IELTS-Scorer/data/Deberta_Sentence_Processed"
MODEL_NAME = "microsoft/deberta-v3-base"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- 2. Đọc dữ liệu ---
print(f"📂 Đang nạp dữ liệu sạch từ {INPUT_CSV}...")
try:
    df = pd.read_csv(INPUT_CSV, encoding='utf-8-sig')
except:
    df = pd.read_csv(INPUT_CSV, encoding='latin1')

df = df.dropna(subset=["Low_Band_Sentence", "Current_Band"])
df["Current_Band"] = df["Current_Band"].astype(float)

print(f"📊 Tổng số mẫu: {len(df)}")

# --- 3. Chia tập dữ liệu (Stratified Split) ---
# Chia nhóm (binning) để đảm bảo phân phối điểm số đồng đều giữa các tập
df["band_bin"] = pd.cut(df["Current_Band"], 
                        bins=[0, 3.5, 5, 6, 7, 8, 10], 
                        labels=[1, 2, 3, 4, 5, 6])

print("⚖️ Đang chia tập Train/Validation/Test (80/10/10)...")
train_df, temp_df = train_test_split(
    df, 
    test_size=0.2, 
    random_state=42, 
    stratify=df["band_bin"]
)

val_df, test_df = train_test_split(
    temp_df, 
    test_size=0.5, 
    random_state=42, 
    stratify=temp_df["band_bin"]
)

# --- 4. Chuyển sang Hugging Face Dataset ---
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def preprocess_function(examples):
    # Tokenize câu văn
    tokenized = tokenizer(
        examples["Low_Band_Sentence"], 
        truncation=True, 
        padding="max_length", 
        max_length=128
    )
    # Scale nhãn Current_Band về khoảng [0, 1] cho bài toán hồi quy (Sigmoid output)
    tokenized["labels"] = [float(b) / 9.0 for b in examples["Current_Band"]]
    return tokenized

print("🏗️ Đang tiền xử lý (Tokenization)...")
raw_datasets = DatasetDict({
    "train": Dataset.from_pandas(train_df.reset_index(drop=True)),
    "validation": Dataset.from_pandas(val_df.reset_index(drop=True)),
    "test": Dataset.from_pandas(test_df.reset_index(drop=True))
})

# Loại bỏ các cột không cần thiết để tiết kiệm bộ nhớ
processed_datasets = raw_datasets.map(
    preprocess_function, 
    batched=True, 
    remove_columns=raw_datasets["train"].column_names
)

# --- 5. Lưu xuống đĩa ---
print(f"💾 Đang lưu Dataset vào {OUTPUT_DIR}...")
processed_datasets.save_to_disk(OUTPUT_DIR)

print("✅ HOÀN TẤT! Dữ liệu đã sẵn sàng để training.")
