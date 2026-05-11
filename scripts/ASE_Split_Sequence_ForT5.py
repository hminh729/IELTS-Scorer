import pandas as pd
import nltk
import os

# Download punkt tokenizer for sentence splitting
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

def process_dataset():
    # Define paths
    input_file = os.path.join('..', 'data', 'raw', 'ielts_writing_dataset3.csv')
    output_file = os.path.join('..', 'data', 'raw', 'T5_dataset_raw.csv')
    
    # Lấy đường dẫn tuyệt đối dựa trên vị trí file script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.normpath(os.path.join(script_dir, input_file))
    output_path = os.path.normpath(os.path.join(script_dir, output_file))
    
    # 1. Kiểm tra file đầu vào
    if not os.path.exists(input_path):
        print(f"Error: Input file not found at {input_path}")
        return

    # Read the dataset
    print(f"Reading {input_path}...")
    df = pd.read_csv(input_path)
    
    # Filter "Overall" < 9 và xử lý dữ liệu
    df['Overall'] = pd.to_numeric(df['Overall'], errors='coerce')
    df = df.dropna(subset=['Overall', 'Essay'])
    df_filtered = df[df['Overall'] < 9].copy()
    
    print(f"Filtered {len(df_filtered)} essays with Overall score < 9.")
    
    # Process each essay into sentences
    data_rows = []
    for _, row in df_filtered.iterrows():
        essay = row['Essay']
        overall = row['Overall']
        
        sentences = nltk.sent_tokenize(essay)
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence:
                data_rows.append({
                    'Low_Band_Sentence': sentence,
                    'Current_Band': overall
                })
    
    # Create new dataframe
    result_df = pd.DataFrame(data_rows)
    
    # --- PHẦN SỬA ĐỔI: KIỂM TRA VÀ TẠO THƯ MỤC OUTPUT ---
    output_dir = os.path.dirname(output_path)
    if not os.path.exists(output_dir):
        print(f"Directory {output_dir} does not exist. Creating it...")
        # exist_ok=True giúp tránh lỗi nếu thư mục vừa được tạo bởi tiến trình khác
        os.makedirs(output_dir, exist_ok=True)
    # ---------------------------------------------------
    
    # Save to CSV
    result_df.to_csv(output_path, index=False, encoding='utf-8')
    print(f"Successfully saved {len(result_df)} sentences to {output_path}")

if __name__ == "__main__":
    process_dataset()