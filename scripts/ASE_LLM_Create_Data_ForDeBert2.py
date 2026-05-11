import pandas as pd
import os
import asyncio
import logging
import io
import csv
import sys
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# --- CẤU HÌNH ---
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("Chưa tìm thấy GEMINI_API_KEY trong file .env")

genai.configure(api_key=api_key)

# Sử dụng model
MODEL_NAME = "models/gemini-2.5-flash" 
OUTPUT_PATH = "../data/raw/augmented_band_3_5.csv"

# Thiết lập logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Cấu hình an toàn
safety_settings = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    safety_settings=safety_settings
)

async def generate_band_3_5_batch(batch_size):
    """Sinh một batch các câu Band 3.5."""
    prompt = f"""
    Task: Generate {batch_size} unique English sentences at IELTS Band 3.5 level. 
    Format: Strictly CSV with NO headers. Each line: "sentence content",3.5
    """
    
    try:
        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        text = text.replace("```csv", "").replace("```", "").strip()
        return text
    except Exception as e:
        if "429" in str(e):
            logging.error("❌ Lỗi Quota 429: Đã hết lượt dùng hôm nay.")
        else:
            logging.error(f"❌ Lỗi khi gọi LLM: {e}")
        return None

async def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    abs_output_path = os.path.normpath(os.path.join(script_dir, OUTPUT_PATH))
    os.makedirs(os.path.dirname(abs_output_path), exist_ok=True)
    
    total_needed = 1500
    batch_size = 75 
    
    # --- BƯỚC 1: SỬA TRỰC TIẾP FILE CSV (DÙNG RAW TEXT) ---
    existing_count = 0
    if os.path.exists(abs_output_path) and os.stat(abs_output_path).st_size > 0:
        try:
            print("🔍 Đang kiểm tra cấu trúc file CSV...")
            with open(abs_output_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Kiểm tra xem dòng đầu tiên có phải header chuẩn không
            header_standard = "Low_Band_Sentence,Current_Band"
            if lines and header_standard not in lines[0]:
                print("🛠️ Phát hiện tiêu đề sai. Đang sửa trực tiếp vào file...")
                # Nếu dòng đầu chứa dữ liệu (có dấu phẩy), ta chèn header vào trước nó
                if "," in lines[0] and "Current_Band" not in lines[0]:
                    lines.insert(0, header_standard + "\n")
                else:
                    # Nếu dòng đầu là header sai, ta thay thế nó
                    lines[0] = header_standard + "\n"
                
                with open(abs_output_path, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                print("✅ Đã sửa tiêu đề file thành công.")

            # Sau khi sửa bằng text, đọc lại bằng pandas để đếm mẫu
            df_old = pd.read_csv(abs_output_path)
            # Lọc bỏ các dòng lỗi (không đủ 2 cột)
            df_old = df_old.dropna(subset=["Low_Band_Sentence", "Current_Band"])
            df_old = df_old.drop_duplicates(subset=["Low_Band_Sentence"])
            existing_count = len(df_old)
            # Lưu lại bản sạch
            df_old.to_csv(abs_output_path, index=False)
            print(f"📊 Đã nạp {existing_count} câu hợp lệ từ file CSV.")
        except Exception as e:
            print(f"📊 File lỗi nặng ({e}), sẽ bắt đầu mới.")
            existing_count = 0

    if existing_count >= total_needed:
        print(f"✅ Đã đủ {total_needed} câu.")
        return

    # --- BƯỚC 2: CHẠY TIẾP ---
    remaining_needed = total_needed - existing_count
    print(f"🚀 Sinh thêm {remaining_needed} câu bằng {MODEL_NAME}...")

    for i in range(0, remaining_needed, batch_size):
        current_batch_size = min(batch_size, remaining_needed - i)
        print(f"🔄 Đang sinh {current_batch_size} câu tiếp theo...")
        
        batch_text = await generate_band_3_5_batch(current_batch_size)
        
        if batch_text is None:
            break
            
        new_rows = []
        f = io.StringIO(batch_text)
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 1:
                sentence = row[0].strip().strip('"')
                if sentence and len(sentence) > 3 and "sentence" not in sentence.lower():
                    new_rows.append([sentence, 3.5])
        
        if new_rows:
            df_batch = pd.DataFrame(new_rows, columns=["Low_Band_Sentence", "Current_Band"])
            # Ghi vào file (Append)
            file_exists = os.path.exists(abs_output_path) and os.stat(abs_output_path).st_size > 0
            df_batch.to_csv(abs_output_path, 
                            mode='a', 
                            header=not file_exists, 
                            index=False, 
                            columns=["Low_Band_Sentence", "Current_Band"])
            
            existing_count += len(new_rows)
            print(f"💾 Đã lưu tích lũy. Tổng cộng hiện có: {existing_count}/1500")
        
        if i + batch_size < remaining_needed:
            print(f"⏳ Nghỉ 15 giây...")
            await asyncio.sleep(15)

    print(f"🏁 Xong! Kết quả tại: {abs_output_path}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
