import torch
import os
import shutil
from transformers import (
    T5ForConditionalGeneration, 
    T5Tokenizer, 
    Seq2SeqTrainingArguments, 
    Seq2SeqTrainer, 
    DataCollatorForSeq2Seq,
    EarlyStoppingCallback
)
from datasets import load_from_disk
import evaluate
import numpy as np
import nltk

# =================================================================
# 0. CẤU HÌNH ĐƯỜNG DẪN
# =================================================================
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

LOCAL_DATA_PATH = os.path.join(base_dir, "data/T5_Data_Processed")
OUTPUT_DIR = os.path.join(base_dir, "models/ASE/ASE_model_T5_Checkpoints")
FINAL_DIR = os.path.join(base_dir, "models/ASE/ASE_model_T5_Final")

# Đảm bảo thư mục đầu ra tồn tại
os.makedirs(OUTPUT_DIR, exist_ok=True)

# =================================================================
# 1. KHỞI TẠO TOKENIZER & MODEL
# =================================================================
model_name = "t5-base"
tokenizer = T5Tokenizer.from_pretrained(model_name, legacy=False)
model = T5ForConditionalGeneration.from_pretrained(model_name)

# Metric (ROUGE)
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)
rouge = evaluate.load("rouge")

def compute_metrics(eval_preds):
    preds, labels = eval_preds
    if isinstance(preds, tuple): 
        preds = preds[0]
    
    # 🛡️ BẢO VỆ: Tránh OverflowError trên Python 3.12
    vocab_size = tokenizer.vocab_size
    preds = np.where(preds >= 0, preds, tokenizer.pad_token_id)
    preds = np.where(preds < vocab_size, preds, tokenizer.pad_token_id)
    preds = preds.astype(np.int32)
    
    labels = np.where(labels != -100, labels, tokenizer.pad_token_id)
    labels = np.where(labels >= 0, labels, tokenizer.pad_token_id)
    labels = np.where(labels < vocab_size, labels, tokenizer.pad_token_id)
    labels = labels.astype(np.int32)

    decoded_preds = tokenizer.batch_decode(preds, skip_special_tokens=True)
    decoded_labels = tokenizer.batch_decode(labels, skip_special_tokens=True)
    
    decoded_preds = ["\n".join(nltk.sent_tokenize(pred.strip())) for pred in decoded_preds]
    decoded_labels = ["\n".join(nltk.sent_tokenize(label.strip())) for label in decoded_labels]
    
    result = rouge.compute(predictions=decoded_preds, references=decoded_labels, use_stemmer=True)
    return {k: round(v, 4) for k, v in result.items()}

# =================================================================
# 2. THIẾT LẬP TRAINING
# =================================================================
dataset = load_from_disk(LOCAL_DATA_PATH)

# Kiểm tra resume training từ checkpoint
resume_from_checkpoint = False
if os.path.exists(OUTPUT_DIR) and any(d.startswith("checkpoint") for d in os.listdir(OUTPUT_DIR)):
    print(f"--- Tìm thấy checkpoint. Sẽ resume training... ---")
    resume_from_checkpoint = True

training_args = Seq2SeqTrainingArguments(
    output_dir=OUTPUT_DIR,
    eval_strategy="epoch", 
    save_strategy="epoch",
    learning_rate=5e-5,
    per_device_train_batch_size=32,
    per_device_eval_batch_size=16,
    gradient_accumulation_steps=2,
    weight_decay=0.05,
    warmup_steps=500,
    num_train_epochs=10,
    predict_with_generate=True,
    generation_max_length=128,
    generation_num_beams=4,
    fp16=torch.cuda.is_available(),
    optim="adamw_torch_fused",
    dataloader_num_workers=2,
    dataloader_pin_memory=True,
    save_total_limit=2,
    load_best_model_at_end=True,
    metric_for_best_model="eval_rougeL",
    logging_steps=50,
    report_to="none"
)

trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    processing_class=tokenizer,
    data_collator=DataCollatorForSeq2Seq(tokenizer=tokenizer, model=model),
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
)

# 3. TRAINING
print(f"🚀 Bắt đầu training...")
trainer.train(resume_from_checkpoint=resume_from_checkpoint)

# 4. ĐÁNH GIÁ & LƯU BẢN CUỐI CÙNG
print("\n🔍 Đang đánh giá cuối cùng trên tập Test...")
test_results = trainer.evaluate(eval_dataset=dataset["test"], metric_key_prefix="test")
print(f"Kết quả Test: {test_results}")

# Lưu bản Model tốt nhất vào thư mục Final
trainer.save_model(FINAL_DIR)
tokenizer.save_pretrained(FINAL_DIR)

print(f"\n✅ Training Hoàn Tất! Model đã được lưu tại: {FINAL_DIR}")
