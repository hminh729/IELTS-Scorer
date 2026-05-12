import os
import subprocess
import sys

# Đảm bảo đường dẫn tuyệt đối
# BASE_DIR is now 3 levels up from scripts/deploy/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_SRC = os.path.join(BASE_DIR, "models", "T5", "ASE_model_T5_Final")
ONNX_OUT = os.path.join(BASE_DIR, "models", "T5", "ASE_model_T5_ONNX")

def install_optimum():
    print("📦 Đang kiểm tra và cài đặt thư viện 'optimum' và 'onnxruntime'...")
    try:
        import optimum
        print("✅ Thư viện 'optimum' đã sẵn sàng.")
    except ImportError:
        print("⚠️ Thiếu thư viện 'optimum'. Đang tiến hành cài đặt...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "optimum[onnxruntime]"])
        print("✅ Cài đặt hoàn tất.")

def export_t5_to_onnx():
    from optimum.onnxruntime import ORTModelForSeq2SeqLM
    from transformers import AutoTokenizer
    import json

    print(f"🚀 Bắt đầu chuyển đổi mô hình T5 tại: {MODEL_SRC}")
    
    if not os.path.exists(MODEL_SRC):
        print(f"❌ Lỗi: Không tìm thấy thư mục mô hình nguồn tại {MODEL_SRC}")
        return

    # Sửa lỗi tokenizer config nếu cần
    tokenizer_config_path = os.path.join(MODEL_SRC, "tokenizer_config.json")
    if os.path.exists(tokenizer_config_path):
        with open(tokenizer_config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        if "extra_special_tokens" in config and isinstance(config["extra_special_tokens"], list):
            print("🔧 Đang hiệu chỉnh tokenizer_config.json để tương thích...")
            with open(tokenizer_config_path + ".bak", "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
            del config["extra_special_tokens"]
            with open(tokenizer_config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)

    print(f"📂 Kết quả sẽ được lưu tại: {ONNX_OUT}")

    # Load và Export mô hình
    model = ORTModelForSeq2SeqLM.from_pretrained(MODEL_SRC, export=True)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_SRC)

    # Lưu mô hình ONNX
    os.makedirs(ONNX_OUT, exist_ok=True)
    model.save_pretrained(ONNX_OUT)
    tokenizer.save_pretrained(ONNX_OUT)

    print(f"✅ Chuyển đổi thành công! Các file ONNX nằm trong: {ONNX_OUT}")

if __name__ == "__main__":
    install_optimum()
    export_t5_to_onnx()
