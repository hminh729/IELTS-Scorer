import os
import numpy as np
import onnxruntime as ort
from optimum.onnxruntime import ORTQuantizer
from optimum.onnxruntime.configuration import AutoQuantizationConfig, CalibrationConfig, CalibrationMethod
from transformers import AutoTokenizer
from datasets import load_from_disk
import torch

# 1. Cấu hình đường dẫn
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
source_dir = os.path.join(base_dir, "models/DeBert/best_model_onnx")
source_model_path = os.path.join(source_dir, "ASE_model.onnx")
output_dir = os.path.join(base_dir, "models/DeBert/best_model_onnx_quantize")
output_model_path = os.path.join(output_dir, "ASE_model_quantized.onnx")

# Đường dẫn data để Calibration (Định chuẩn)
data_path = os.path.join(base_dir, "data/Deberta_Sentence_Processed")
model_path_base = os.path.join(base_dir, "models/DeBert/best_model")

if not os.path.exists(source_model_path):
    print(f"❌ Lỗi: Không tìm thấy mô hình tại {source_model_path}")
    exit(1)

os.makedirs(output_dir, exist_ok=True)

# 2. Chuẩn bị dữ liệu Calibration
print("📊 Bước 1: Chuẩn bị dữ liệu Calibration (Định chuẩn)...")
try:
    tokenizer = AutoTokenizer.from_pretrained(model_path_base)
    dataset = load_from_disk(data_path)["train"]
    # Lấy ngẫu nhiên 200 mẫu để định chuẩn dải giá trị
    calibration_samples = dataset.shuffle(seed=42).select(range(min(200, len(dataset))))

    # Dữ liệu đã được Tokenize sẵn trong dataset
    calibration_dataset = calibration_samples.remove_columns([c for c in calibration_samples.column_names if c not in ["input_ids", "attention_mask", "token_type_ids"]])
    
    calibration_dataset.set_format("torch")
    
    print(f"✅ Đã chuẩn bị {len(calibration_dataset)} mẫu dữ liệu định chuẩn (đã tokenize sẵn).")
except Exception as e:
    print(f"❌ Lỗi khi chuẩn bị dữ liệu Calibration: {e}")
    exit(1)

# 3. Thực hiện Static Quantization (INT8) sử dụng Optimum
print(f"🚀 Bước 2: Đang tiến hành Static Quantization mô hình...")
try:
    quantizer = ORTQuantizer.from_pretrained(source_dir, file_name="ASE_model.onnx")

    # Cấu hình nén tĩnh
    qconfig = AutoQuantizationConfig.avx512_vnni(is_static=True, per_channel=True)
    
    calibration_config = CalibrationConfig(
        dataset_name="ielts_calibration",
        dataset_config_name="default",
        dataset_split="train",
        dataset_num_samples=len(calibration_dataset),
        method=CalibrationMethod.MinMax
    )

    print("   - Đang chạy Calibration...")
    ranges = quantizer.fit(
        dataset=calibration_dataset,
        calibration_config=calibration_config,
        batch_size=1
    )

    print("   - Đang nạp dải giá trị và nén...")
    quantizer.quantize(
        quantization_config=qconfig,
        save_dir=output_dir,
        calibration_tensors_range=ranges,
        file_suffix="quantized"
    )
    
    # Đổi tên cho khớp
    default_output = os.path.join(output_dir, "model_quantized.onnx")
    if os.path.exists(default_output):
        if os.path.exists(output_model_path): os.remove(output_model_path)
        os.rename(default_output, output_model_path)

    print(f"✅ Đã Static Quantize xong! Lưu tại: {output_model_path}")

except Exception as e:
    print(f"❌ Lỗi khi Quantize: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# 4. Kiểm tra và so sánh
print("\n📋 Bước 3: Đang kiểm tra độ chính xác sau khi Static Quantize...")
try:
    text = "This is a high-quality sample IELTS essay used to verify the performance of the Static Quantized ONNX model."
    inputs = tokenizer(text, return_tensors="np", padding="max_length", truncation=True, max_length=512)
    input_feed = {k: v for k, v in inputs.items()}

    session_fp32 = ort.InferenceSession(source_model_path)
    outputs_fp32 = session_fp32.run(None, input_feed)

    session_quant = ort.InferenceSession(output_model_path)
    outputs_quant = session_quant.run(None, input_feed)

    print("\n--- Kết quả so sánh Logits (Raw) ---")
    print("Original (FP32): ", outputs_fp32[0])
    print("Quantized (INT8 Static):", outputs_quant[0])

    diff = np.abs(outputs_fp32[0] - outputs_quant[0])
    print(f"\nSai số lớn nhất (Max diff): {np.max(diff):.6f}")
    print(f"Sai số trung bình (Mean diff): {np.mean(diff):.6f}")
    
    def sigmoid(x): return 1 / (1 + np.exp(-x))
    score_fp32 = sigmoid(outputs_fp32[0][0]) * 9.0
    score_quant = sigmoid(outputs_quant[0][0]) * 9.0
    print(f"\nĐiểm dự kiến (Scale 0-9):")
    print(f"FP32: {score_fp32}")
    print(f"INT8: {score_quant}")
    print(f"Độ lệch điểm: {np.abs(score_fp32 - score_quant).mean():.4f}")

except Exception as e:
    print(f"⚠️ Cảnh báo khi test: {e}")
