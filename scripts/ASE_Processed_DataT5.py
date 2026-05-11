import pandas as pd
from datasets import Dataset, DatasetDict
from transformers import T5Tokenizer
import os

# 1. Cấu hình đường dẫn
input_path = "../data/raw/T5_dataset_rewrite.csv"
output_dir = "../data/T5_Data_Processed"
model_name = "t5-base"

# Tạo thư mục đầu ra nếu chưa có
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 2. Đọc và Làm sạch dữ liệu
if not os.path.exists(input_path):
    raise FileNotFoundError(f"Không tìm thấy file input tại: {input_path}")

df = pd.read_csv(input_path)
# Loại bỏ các dòng bị trống (null) hoặc dữ liệu rác
df = df.dropna(subset=["Low_Band_Sentence", "High_Band_Sentence"])
# Chuyển đổi sang string để tránh lỗi type
df["Low_Band_Sentence"] = df["Low_Band_Sentence"].astype(str)
df["High_Band_Sentence"] = df["High_Band_Sentence"].astype(str)

df = df[df["Low_Band_Sentence"].str.strip().astype(bool)]
df = df[df["High_Band_Sentence"].str.strip().astype(bool)]

print(f"📊 Đã load và làm sạch {len(df)} dòng dữ liệu.")

# 3. Khởi tạo Tokenizer
# legacy=False để tránh các cảnh báo version cũ và đảm bảo tính nhất quán
tokenizer = T5Tokenizer.from_pretrained(model_name, legacy=False)

# 4. Định dạng dữ liệu cho T5
def get_prefix(band):
    """Trả về prefix dựa trên band điểm của câu đầu vào."""
    band = float(band)
    if band <= 5.0:
        return "fix grammar: "
    elif 5.0 < band <= 6.5:
        return "enhance vocabulary: "
    else:
        return "refine style: "

# Áp dụng prefix động cho dữ liệu gốc
df["Prefix"] = df["Current_Band"].apply(get_prefix)

# --- Identity Mapping Strategy ---
# Trích xuất ngẫu nhiên 15% dữ liệu từ High_Band_Sentence để làm Identity Mapping (Input = Target)
# Việc này giúp mô hình học cách giữ nguyên những câu đã đạt chuẩn.
df_identity = df.sample(frac=0.15, random_state=42).copy()
df_identity["Low_Band_Sentence"] = df_identity["High_Band_Sentence"]
df_identity["Prefix"] = "refine style: "  # Gán nhãn refine style cho các câu đã chuẩn

# Gộp dữ liệu identity mapping vào tập dữ liệu chính
df = pd.concat([df, df_identity], ignore_index=True)
print(f"🔄 Sau khi thêm Identity Mapping (15%): {len(df)} dòng dữ liệu.")

def preprocess_function(examples):
    # Đầu vào: Prefix động + câu Low Band
    inputs = [prefix + str(doc) for prefix, doc in zip(examples["Prefix"], examples["Low_Band_Sentence"])]
    
    # Tokenize input
    model_inputs = tokenizer(inputs, max_length=128, truncation=True, padding="max_length")

    # Tokenize target (High Band)
    labels = tokenizer(text_target=examples["High_Band_Sentence"], max_length=128, truncation=True, padding="max_length")

    # QUAN TRỌNG: Thay thế pad_token_id trong labels bằng -100 
    labels_with_ignore_index = []
    for label_example in labels["input_ids"]:
        label_example = [label if label != tokenizer.pad_token_id else -100 for label in label_example]
        labels_with_ignore_index.append(label_example)

    model_inputs["labels"] = labels_with_ignore_index
    return model_inputs

# 5. Chuyển đổi và Chia dữ liệu (Train: 80%, Val: 10%, Test: 10%)
# Sử dụng Stratified Split để đảm bảo tỉ lệ các band điểm đồng đều ở các tập
raw_dataset = Dataset.from_pandas(df)
# Cần convert sang ClassLabel để có thể dùng stratify_by_column
raw_dataset = raw_dataset.class_encode_column("Current_Band")

# Chia Train và tập trung (test + val)
train_testvalid = raw_dataset.train_test_split(
    test_size=0.2, 
    seed=42, 
    stratify_by_column="Current_Band"
)
# Chia đôi tập trung còn lại thành validation và test
test_valid = train_testvalid['test'].train_test_split(
    test_size=0.5, 
    seed=42, 
    stratify_by_column="Current_Band"
)

dataset = DatasetDict({
    'train': train_testvalid['train'],
    'validation': test_valid['train'],
    'test': test_valid['test']
})

print(f"📈 Phân phối: Train ({len(dataset['train'])}), Val ({len(dataset['validation'])}), Test ({len(dataset['test'])})")

# 6. Apply tiền xử lý
# Xác định các cột cần xóa (cột text thô)
column_names = dataset["train"].column_names

processed_dataset = dataset.map(
    preprocess_function, 
    batched=True,
    remove_columns=column_names,
    desc="Tokenizing dataset"
)

# 7. Lưu dữ liệu đã xử lý
processed_dataset.save_to_disk(output_dir)

print(f"✅ Hoàn thành! Dữ liệu đã được lưu tại: {output_dir}")