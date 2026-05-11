import pandas as pd
import os
import asyncio
import logging
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# --- CẤU HÌNH ---
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("Chưa tìm thấy GEMINI_API_KEY trong file .env")

genai.configure(api_key=api_key)

# SỬA: Sử dụng Gemma 3 27B để có chất lượng tốt nhất và Quota lớn nhất
MODEL_NAME = "models/gemma-3-27b-it" 

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.normpath(os.path.join(SCRIPT_DIR, "../data/raw/T5_dataset_clean.csv"))
OUTPUT_PATH = os.path.normpath(os.path.join(SCRIPT_DIR, "../data/raw/T5_dataset_rewrite.csv"))

# Tối ưu cho Gemma 3 (Quota 30 RPM)
BATCH_SIZE = 10  
SAVE_EVERY = 20 

SAMPLING_STRATEGY = {
    "low": {"bands": [1.0, 3.0, 3.5, 4.0, 4.5], "target": 6500},
    "mid": {"bands": [5.0, 5.5, 6.0, 6.5], "target": 12500},
    "high": {"bands": [7.0, 7.5, 8.0, 8.5], "target": 6000}
}

def get_prompt(sentence, band_group):
    # Gemma 3 phản ứng tốt nhất với cấu trúc phân đoạn rõ ràng
    goals = {
        "low": "Focus on correcting grammatical errors and transforming informal phrases into formal academic structures.",
        "mid": "Enhance lexical precision using advanced academic collocations and professional synonyms.",
        "high": "Refine stylistic nuances, improve sentence flow, and ensure native-level academic sophistication."
    }
    specific = goals.get(band_group, "")
    
    prompt = (
        f"<start_of_turn>user\n" 
        f"Task: Rewrite the following sentence into IELTS Band 9 Academic English.\n"
        f"Requirements:\n"
        f"1. Strictly maintain the original meaning.\n"
        f"2. {specific}\n"
        f"3. Do NOT provide explanations, notes, or apologies.\n"
        f"4. Return ONLY the rewritten sentence.\n\n"
        f"Input Sentence: {sentence}\n"
        f"<end_of_turn>\n"
        f"<start_of_turn>model\n"
        f"Rewritten Sentence:"
    )
    return prompt

class DatasetGenerator:
    def __init__(self):
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
        # Thêm cấu hình sinh để kết quả mang tính học thuật cao và ổn định
        self.generation_config = {
            "temperature": 0.3, # Thấp để tránh sáng tạo quá đà làm mất nghĩa gốc
            "top_p": 0.95,
            "max_output_tokens": 512,
        }
        self.model = genai.GenerativeModel(
            model_name=MODEL_NAME, 
            safety_settings=self.safety_settings,
            generation_config=self.generation_config
        )
        self.semaphore = asyncio.Semaphore(BATCH_SIZE)

    async def rewrite_sentence(self, row):
        sentence = row['Low_Band_Sentence']
        band_group = row['group']
        
        async with self.semaphore:
            for attempt in range(3):
                try:
                    prompt = get_prompt(sentence, band_group)
                    # Với Gemma, dùng generate_content_async như bình thường
                    response = await self.model.generate_content_async(prompt)
                    
                    if response and response.text:
                        # Làm sạch output phòng trường hợp Gemma bị lặp lại prefix
                        cleaned_text = response.text.replace("Rewritten Sentence:", "").strip()
                        cleaned_text = cleaned_text.replace('"', '') # Bỏ ngoặc kép nếu có
                        
                        return {
                            'Low_Band_Sentence': sentence,
                            'Current_Band': row['Current_Band'],
                            'High_Band_Sentence': cleaned_text
                        }
                except Exception as e:
                    if "429" in str(e):
                        await asyncio.sleep(15)
                    else:
                        logging.error(f"Error at: {sentence[:30]} - {str(e)}")
                        await asyncio.sleep(2)
            return None

    def sample_remaining_data(self, df_clean, df_processed):
        processed_sentences = set(df_processed['Low_Band_Sentence']) if not df_processed.empty else set()
        
        sampled_dfs = []
        for group, config in SAMPLING_STRATEGY.items():
            sub_df = df_clean[df_clean['Current_Band'].isin(config['bands'])]
            available_df = sub_df[~sub_df['Low_Band_Sentence'].isin(processed_sentences)]
            
            already_done = len(df_processed[df_processed['Low_Band_Sentence'].isin(sub_df['Low_Band_Sentence'])]) if not df_processed.empty else 0
            n_needed = max(0, config['target'] - already_done)
            
            if n_needed > 0 and not available_df.empty:
                n_sample = min(len(available_df), n_needed)
                sampled = available_df.sample(n=n_sample, random_state=42).copy()
                sampled['group'] = group
                sampled_dfs.append(sampled)
        
        return pd.concat(sampled_dfs).sample(frac=1, random_state=42) if sampled_dfs else pd.DataFrame()

    async def run(self):
        if not os.path.exists(INPUT_PATH):
            print(f"❌ Không tìm thấy file input tại: {INPUT_PATH}")
            return

        df_clean = pd.read_csv(INPUT_PATH)
        df_final = pd.read_csv(OUTPUT_PATH) if os.path.exists(OUTPUT_PATH) else pd.DataFrame()
        
        to_process_df = self.sample_remaining_data(df_clean, df_final)
        if to_process_df.empty:
            print("✅ Dữ liệu đã hoàn thành hoặc không tìm thấy mục tiêu phù hợp.")
            return

        print(f"🚀 [Gemma 3 27B] Bắt đầu xử lý {len(to_process_df)} câu...")
        
        records = to_process_df.to_dict('records')
        
        # Tiến hành chạy theo Batch
        for i in range(0, len(records), BATCH_SIZE):
            chunk = records[i:i+BATCH_SIZE]
            tasks = [self.rewrite_sentence(row) for row in chunk]
            results = await asyncio.gather(*tasks)
            
            valid_results = [r for r in results if r is not None]
            
            if valid_results:
                new_data = pd.DataFrame(valid_results)
                df_final = pd.concat([df_final, new_data]).drop_duplicates(subset=['Low_Band_Sentence'])
                
                # Lưu định kỳ
                if (i // BATCH_SIZE) % (SAVE_EVERY // BATCH_SIZE) == 0 or i + BATCH_SIZE >= len(records):
                    df_final.to_csv(OUTPUT_PATH, index=False)
                    print(f"📊 Đã xử lý {i + len(chunk)}/{len(records)} - Tổng file: {len(df_final)} câu.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.ERROR, filename='gemma_rewrite_errors.log', 
                        format='%(asctime)s - %(levelname)s - %(message)s')
    asyncio.run(DatasetGenerator().run())