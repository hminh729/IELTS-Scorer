import os
import pandas as pd
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne
from dotenv import load_dotenv

async def import_data():
    # 1. Tải biến môi trường
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    load_dotenv(dotenv_path=env_path)
    
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password123@localhost:27017")
    DB_NAME = "ielts_scorer"
    
    print(f"🔗 Đang kết nối tới DB: {MONGO_URI} | Database: {DB_NAME}")
    
    # 2. Khởi tạo kết nối MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db["ielts_exams"] # Đổi tên collection thành ielts_exams cho phù hợp ngữ nghĩa
    
    # 3. Đọc dữ liệu từ file CSV
    csv_path = os.path.join(base_dir, "data", "processed", "zim_with_images.csv")
    if not os.path.exists(csv_path):
        print(f"❌ Không tìm thấy file dữ liệu tại: {csv_path}")
        return
        
    print(f"📄 Đang đọc dữ liệu từ: {csv_path}")
    df = pd.read_csv(csv_path, encoding='utf-8-sig')
    
    # Tiền xử lý NaN
    df = df.where(pd.notnull(df), None)
    
    # Xử lý các giá trị None/NaN ở khóa gom nhóm để tránh lỗi khi groupby
    df['year'] = df['year'].fillna(-1)
    df['month'] = df['month'].fillna(-1)
    df['lesson'] = df['lesson'].fillna("")

    operations = []
    now = datetime.now(timezone.utc)
    
    # 4. Gom nhóm dữ liệu theo từng bài thi (Exam)
    grouped = df.groupby(['year', 'month', 'lesson'])
    
    for (year, month, lesson), group in grouped:
        # Chuẩn bị dữ liệu cho 1 bài thi
        doc = {
            "year": int(year) if year != -1 else None,
            "month": int(month) if month != -1 else None,
            "lesson": lesson if lesson != "" else None,
            "task1": None,
            "task2": None,
            "created_at": now
        }
        
        # Bóc tách Task 1 và Task 2
        for _, row in group.iterrows():
            if row['task_type'] == 'Task 1':
                doc['task1'] = {
                    "prompt": row['prompt'],
                    "image_url": row['image_url'],
                    "local_image_path": row['local_image_path']
                }
            elif row['task_type'] == 'Task 2':
                doc['task2'] = {
                    "prompt": row['prompt']
                }
                
        # 5. Tạo lệnh Upsert theo bài thi (Dựa trên year, month, lesson)
        query = {
            "year": doc["year"],
            "month": doc["month"],
            "lesson": doc["lesson"]
        }
        
        # Chỉ cập nhật nội dung các Task nếu có thay đổi, giữ nguyên created_at
        update_doc = {
            "$set": {
                "task1": doc["task1"],
                "task2": doc["task2"]
            },
            "$setOnInsert": {
                "created_at": doc["created_at"]
            }
        }
        
        operations.append(
            UpdateOne(query, update_doc, upsert=True)
        )
        
    # 6. Thực thi Bulk Write
    if operations:
        print(f"⚙️ Bắt đầu đồng bộ {len(operations)} bài thi Full Test lên MongoDB...")
        try:
            result = await collection.bulk_write(operations, ordered=False)
            print(f"✅ Đồng bộ hoàn tất!")
            print(f"   - Đã chèn mới: {result.upserted_count} bài thi")
            print(f"   - Đã cập nhật: {result.modified_count} bài thi")
            print(f"   - Không thay đổi: {len(operations) - result.upserted_count - result.modified_count} bài thi")
        except Exception as e:
            print(f"❌ Lỗi trong quá trình import: {e}")
    else:
        print("Không có dữ liệu để import.")

if __name__ == "__main__":
    asyncio.run(import_data())
