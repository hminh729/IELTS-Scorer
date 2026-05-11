import pandas as pd
import re
import os

def clean_and_filter_data(input_path, output_path, min_words=6):
    if not os.path.exists(input_path):
        print(f"❌ Không tìm thấy file: {input_path}")
        return

    # 1. Load data
    df = pd.read_csv(input_path)
    initial_count = len(df)
    print(f"📊 Số lượng mẫu ban đầu: {initial_count}")

    # 2. Xử lý trùng lặp (Deduplication)
    # Loại bỏ những câu giống hệt nhau (do quá trình augment dùng replace=True)
    df = df.drop_duplicates(subset=['Low_Band_Sentence']).reset_index(drop=True)
    dedup_count = len(df)
    print(f"✨ Sau khi xóa trùng lặp: {dedup_count} (Giảm {initial_count - dedup_count})")

    # 3. Loại bỏ câu quá ngắn (Sentence Length Filtering)
    # Những câu quá ngắn thường thiếu ngữ cảnh để "nâng cấp" lên Band 9
    df['word_count'] = df['Low_Band_Sentence'].str.split().str.len()
    df = df[df['word_count'] >= min_words].copy()
    length_count = len(df)
    print(f"📏 Sau khi lọc câu ngắn (< {min_words} từ): {length_count} (Giảm {dedup_count - length_count})")

    # 4. Lọc nhiễu (Noise Filtering)
    def is_noise(text):
        if pd.isna(text): return True
        # Loại bỏ câu có quá nhiều ký tự đặc biệt (nhiễu do quá trình augment)
        # Nếu tỷ lệ chữ cái thấp hơn 70%, có thể là câu nhiễu/vô nghĩa
        letters = re.findall(r'[a-zA-Z]', text)
        if len(text) > 0 and (len(letters) / len(text)) < 0.7:
            return True
        # Loại bỏ câu chỉ toàn số hoặc ký tự lặp lại (ví dụ: "aaaaa", "123123")
        if re.search(r'(.)\1{4,}', text): # Ký tự lặp lại hơn 4 lần
            return True
        return False

    df['is_noise'] = df['Low_Band_Sentence'].apply(is_noise)
    df = df[df['is_noise'] == False].copy()
    noise_count = len(df)
    print(f"🧹 Sau khi lọc nhiễu (ký tự đặc biệt/rác): {noise_count} (Giảm {length_count - noise_count})")

    # 5. Dọn dẹp và lưu file
    final_df = df[['Low_Band_Sentence', 'Current_Band']].reset_index(drop=True)
    final_df.to_csv(output_path, index=False, encoding='utf-8')
    
    print("-" * 30)
    print(f"✅ Đã lưu bộ dữ liệu sạch tại: {output_path}")
    print(f"🚀 Tổng số câu còn lại: {len(final_df)} ({round(len(final_df)/initial_count*100, 2)}%)")

# Đường dẫn file (Bạn điều chỉnh cho đúng cấu trúc thư mục của mình)
input_file = "../data/raw/T5_dataset_raw.csv"
output_file = "../data/raw/T5_dataset_clean.csv"

if __name__ == "__main__":
    clean_and_filter_data(input_file, output_file)