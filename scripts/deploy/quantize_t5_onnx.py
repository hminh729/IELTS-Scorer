import os
from optimum.onnxruntime import ORTQuantizer
from optimum.onnxruntime.configuration import AutoQuantizationConfig

# Đảm bảo đường dẫn tuyệt đối
# BASE_DIR is now 3 levels up from scripts/deploy/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ONNX_SRC = os.path.join(BASE_DIR, "models", "T5", "ASE_model_T5_ONNX")
QUANT_OUT = os.path.join(BASE_DIR, "models", "T5", "ASE_model_T5_Quantized")

def quantize_t5():
    print(f"🚀 Bắt đầu Quantize mô hình T5 tại: {ONNX_SRC}")
    print(f"📂 Kết quả sẽ được lưu tại: {QUANT_OUT}")

    if not os.path.exists(ONNX_SRC):
        print(f"❌ Lỗi: Không tìm thấy mô hình ONNX tại {ONNX_SRC}. Vui lòng chạy script export trước.")
        return

    os.makedirs(QUANT_OUT, exist_ok=True)
    
    # Danh sách các file ONNX cần quantize cho mô hình Seq2Seq
    onnx_files = [
        "encoder_model.onnx",
        "decoder_model.onnx",
        "decoder_with_past_model.onnx"
    ]

    # Cấu hình Quantization (Dynamic INT8)
    qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)

    for file_name in onnx_files:
        full_path = os.path.join(ONNX_SRC, file_name)
        if not os.path.exists(full_path):
            print(f"⚠️ Bỏ qua {file_name} vì không tìm thấy.")
            continue
            
        print(f"--- Đang Quantize {file_name} ---")
        quantizer = ORTQuantizer.from_pretrained(ONNX_SRC, file_name=file_name)
        
        quantizer.quantize(
            save_dir=QUANT_OUT,
            quantization_config=qconfig,
        )
    
    # Copy các file config và tokenizer sang thư mục mới
    import shutil
    for item in os.listdir(ONNX_SRC):
        if not item.endswith(".onnx"):
            src_item = os.path.join(ONNX_SRC, item)
            dst_item = os.path.join(QUANT_OUT, item)
            if os.path.isfile(src_item):
                shutil.copy2(src_item, dst_item)

    print(f"✅ Quantize hoàn tất! Mô hình đã nén nằm tại: {QUANT_OUT}")

if __name__ == "__main__":
    quantize_t5()
