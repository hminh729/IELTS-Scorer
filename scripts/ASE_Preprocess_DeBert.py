import pandas as pd
import numpy as np
import os
from datasets import Dataset, DatasetDict
from transformers import AutoTokenizer
from sklearn.model_selection import train_test_split

def process_ielts_data(file_path, model_checkpoint="microsoft/deberta-v3-base", max_length=512):
    # 1. Load và clean
    if not os.path.exists(file_path):
        print(f"❌ File không tồn tại: {file_path}")
        return None, None
        
    df = pd.read_csv(file_path)
    # Đảm bảo có cột Task_Type
    required_cols = ['Essay', 'Question', 'Overall', 'Task_Type']
    df = df.dropna(subset=required_cols).reset_index(drop=True)

    print(f"📊 Tổng số mẫu nạp vào: {len(df)}")
    
    # 2. XÓA OVERSAMPLING Ở ĐÂY (Vì đã làm ở bước Augment)
    # Tránh làm loãng dữ liệu và overfitting
    
    # 3. Normalize Labels (Giữ nguyên logic chia cho 9.0)
    score_cols = ['Task_Response', 'Coherence_Cohesion', 'Lexical_Resource', 'Range_Accuracy', 'Overall']
    for col in score_cols:
        df[col] = df[col].astype(float) / 9.0

    # 4. Labels sang dạng list float32
    df['labels'] = df[score_cols].values.astype(np.float32).tolist()

    # 5. Split dữ liệu (Stratify theo Overall để đảm bảo cân bằng các tập)
    # Làm tròn Overall để stratify dễ hơn
    df['stratify_col'] = df['Overall'].round(1)
    
    try:
        train_df, temp_df = train_test_split(df, test_size=0.15, random_state=42, stratify=df['stratify_col'])
        val_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=42, stratify=temp_df['stratify_col'])
    except Exception as e:
        print(f"⚠️ Stratify thất bại ({e}), chuyển sang chia ngẫu nhiên...")
        train_df, temp_df = train_test_split(df, test_size=0.15, random_state=42)
        val_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=42)

    # 6. Tokenize
    tokenizer = AutoTokenizer.from_pretrained(model_checkpoint)

    # Chuyển sang Dataset - GIỮ LẠI Task_Type để dùng trong prompt
    ds_dict = DatasetDict({
        'train': Dataset.from_pandas(train_df[['Question', 'Essay', 'Task_Type', 'labels']]),
        'validation': Dataset.from_pandas(val_df[['Question', 'Essay', 'Task_Type', 'labels']]),
        'test': Dataset.from_pandas(test_df[['Question', 'Essay', 'Task_Type', 'labels']])
    })

    def tokenize_function(examples):
        # Tích hợp Task_Type vào Prompt
        prompts = [f"[TASK {int(t)}] Question: {q}" for t, q in zip(examples["Task_Type"], examples["Question"])]
        
        return tokenizer(
            prompts,
            examples["Essay"],
            truncation=True,
            padding="max_length",
            max_length=max_length
        )

    # Xác định các cột cần xóa
    cols_to_remove = ds_dict["train"].column_names
    cols_to_remove = [col for col in cols_to_remove if col != "labels"]

    tokenized_ds = ds_dict.map(
        tokenize_function,
        batched=True,
        remove_columns=cols_to_remove
    )

    tokenized_ds.set_format("torch")
    return tokenized_ds, tokenizer

# --- Chạy thực tế ---
if __name__ == "__main__":
    root = "../data/raw/ielts_writing_dataset2.csv"
    save_path = "../data/processed"
    
    dataset_final, tokenizer = process_ielts_data(root)
    if dataset_final:
        dataset_final.save_to_disk(save_path)
        tokenizer.save_pretrained(os.path.join(save_path, "tokenizer"))
        print(f"✅ Đã lưu Dataset thành công tại {save_path}")