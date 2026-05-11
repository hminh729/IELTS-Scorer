import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
import os

def scrape_zim_ielts(years):
    base_url = "https://zim.vn/de-thi-ielts-writing-"
    all_data = []
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for year in years:
        url = f"{base_url}{year}"
        print(f"--- Đang cào dữ liệu năm {year}: {url} ---")
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f"Không thể truy cập năm {year}")
                continue
            
            soup = BeautifulSoup(response.content, 'html.parser')
            content_div = soup.find('div', class_='content-main') or soup.find('article')
            
            if not content_div:
                print(f"Không tìm thấy thẻ nội dung chính cho năm {year}")
                continue

            current_month = ""
            current_lesson = ""
            current_task = None
            current_prompt = ""
            current_img = ""
            
            def save_current_task():
                if current_task and current_prompt:
                    all_data.append({
                        "year": year,
                        "month": current_month,
                        "lesson": current_lesson,
                        "task_type": current_task,
                        "prompt": current_prompt.strip(),
                        "image_url": current_img
                    })

            for element in content_div.find_all(['h2', 'h3', 'h4', 'p', 'li', 'img', 'figure']):
                if element.name == 'img':
                    text = ""
                else:
                    text = element.get_text(separator=' ', strip=True)
                
                text_lower = text.lower()
                
                # 1. Cập nhật tháng
                if "tháng" in text_lower and element.name in ['h2', 'h3', 'h4']:
                    month_match = re.search(r'tháng\s+(\d+)', text_lower)
                    if month_match:
                        save_current_task()
                        current_task = None
                        current_month = month_match.group(1)
                    continue
                
                # 2. Cập nhật Bài mẫu / Ngày thi
                if ("bài mẫu" in text_lower or "đề thi" in text_lower) and "tháng" not in text_lower:
                    date_match = re.search(r'ngày\s+(\d{1,2}/\d{1,2}/\d{4})', text_lower)
                    if date_match:
                        save_current_task()
                        current_task = None
                        current_lesson = f"Ngày {date_match.group(1)}"
                        continue
                    
                    lesson_match = re.search(r'bài mẫu\s*(số\s*)?(\d+)', text_lower)
                    if lesson_match:
                        save_current_task()
                        current_task = None
                        current_lesson = f"Bài {lesson_match.group(2)}"
                        continue
                        
                    if element.name in ['h2', 'h3', 'h4'] and len(text.split()) < 15:
                        save_current_task()
                        current_task = None
                        current_lesson = text
                        continue

                # 3. Nhận diện Task 1
                if "task 1:" in text_lower or text_lower.startswith("task 1"):
                    save_current_task()
                    current_task = "Task 1"
                    current_prompt = text
                    current_img = ""
                    
                    # Nếu ảnh nằm luôn trong thẻ p hiện tại
                    img_in_task = element.find('img') if element.name != 'img' else None
                    if img_in_task:
                        src = img_in_task.get('src') or img_in_task.get('data-src')
                        if src and not src.startswith("data:") and "avatar" not in src.lower():
                            if src.startswith('/'): src = "https://zim.vn" + src
                            current_img = src
                    continue
                    
                # 4. Nhận diện Task 2
                if "task 2:" in text_lower or text_lower.startswith("task 2"):
                    save_current_task()
                    current_task = "Task 2"
                    current_prompt = text
                    current_img = ""
                    continue
                    
                # 5. Đang ở trong Task, tích lũy văn bản hoặc tìm ảnh
                if current_task:
                    if element.name == 'img':
                        if current_task == "Task 1" and not current_img:
                            src = element.get('src') or element.get('data-src')
                            if src and not src.startswith("data:") and "avatar" not in src.lower() and "logo" not in src.lower():
                                if src.startswith('/'): src = "https://zim.vn" + src
                                current_img = src
                    elif text:
                        # Kiểm tra substring để tránh lặp nội dung do thẻ cha chứa thẻ con (p chứa li)
                        if text not in current_prompt:
                            current_prompt += "\n" + text

            # Lưu lại Task cuối cùng của trang
            save_current_task()
            
            # Tránh bị block
            time.sleep(2)
            
        except Exception as e:
            print(f"Lỗi tại năm {year}: {e}")

    return all_data

def process_and_save_data(df):
    print("\n--- Bắt đầu xử lý dữ liệu ---")
    
    # 1. Lưu bản Raw ban đầu
    raw_dir = "../data/raw"
    os.makedirs(raw_dir, exist_ok=True)
    df.to_csv(f"{raw_dir}/zim_ielts_writing_all.csv", index=False, encoding='utf-8-sig')
    
    # 2. Dọn dẹp text thừa
    df['prompt'] = df['prompt'].str.replace(r'Task \d+:\s*', '', regex=True, flags=re.IGNORECASE)
    
    # 3. Loại bỏ Task 1 bị thiếu ảnh
    to_remove = (df['task_type'] == 'Task 1') & (df['image_url'].isna() | (df['image_url'].astype(str).str.strip() == ''))
    df = df[~to_remove]
    print(f"Đã loại bỏ các đề Task 1 bị thiếu ảnh.")
    
    # 4. Xử lý trùng lặp dựa trên đề bài và bài mẫu
    initial_len = len(df)
    
    # Xóa trùng lặp nội dung y hệt
    df = df.drop_duplicates(subset=['task_type', 'prompt'], keep='first')
    
    # Loại bỏ task thứ 2 trong cùng 1 bài (cùng năm, tháng, bài, và loại task)
    # Chỉ áp dụng với những dòng có 'lesson' rõ ràng để tránh xóa nhầm các bài không parse được tên
    mask = df['lesson'].astype(str).str.strip() != ""
    df_with_lesson = df[mask].drop_duplicates(subset=['year', 'month', 'lesson', 'task_type'], keep='first')
    df_no_lesson = df[~mask]
    
    # Ghép lại và sắp xếp theo index cũ để giữ nguyên thứ tự
    df = pd.concat([df_with_lesson, df_no_lesson]).sort_index()
    
    print(f"Đã loại bỏ {initial_len - len(df)} dòng trùng lặp.")
    
    # 5. Tải ảnh
    print("\n--- Bắt đầu tải ảnh cho Task 1 ---")
    IMAGE_DIR = "../data/assets/task1_images"
    os.makedirs(IMAGE_DIR, exist_ok=True)
    
    headers = {"User-Agent": "Mozilla/5.0"}
    df['local_image_path'] = None
    
    for index, row in df.iterrows():
        if row['task_type'] == 'Task 1' and pd.notna(row['image_url']):
            try:
                # Tránh lỗi filepath nếu lesson có chứa dấu gạch chéo ('Ngày 28/12/2024')
                clean_lesson = str(row['lesson']).replace(" ", "_").replace("/", "-") if row['lesson'] else f"row_{index}"
                filename = f"{row['year']}_{row['month']}_{clean_lesson}.jpg"
                filepath = os.path.join(IMAGE_DIR, filename)

                if not os.path.exists(filepath):
                    img_data = requests.get(row['image_url'], headers=headers).content
                    with open(filepath, 'wb') as f:
                        f.write(img_data)
                    print(f"✓ Đã tải: {filename}")
                else:
                    print(f"- Đã tồn tại: {filename}")
                
                # Cập nhật đường dẫn
                df.at[index, 'local_image_path'] = filepath
            except Exception as e:
                print(f"✗ Lỗi khi tải ảnh dòng {index}: {e}")
                
    # 6. Lưu file đã xử lý cuối cùng
    processed_dir = "../data/processed"
    os.makedirs(processed_dir, exist_ok=True)
    output_path = f"{processed_dir}/zim_with_images.csv"
    
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"\nHoàn thành! Đã lưu {len(df)} đề bài hợp lệ vào {output_path}")


# Danh sách các năm cần cào
years_to_scrape = [2025, 2024, 2023, 2022, 2021, 2020]

# Thực hiện cào
results = scrape_zim_ielts(years_to_scrape)

# Chuyển đổi sang DataFrame và tích hợp các xử lý
if results:
    df = pd.DataFrame(results)
    process_and_save_data(df)
else:
    print("Không lấy được dữ liệu.")