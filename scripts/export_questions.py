import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password123@localhost:27017")
DB_NAME = "ielts_scorer"

async def export_questions():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db.ielts_exams
    
    exams = await collection.find({}).to_list(None)
    
    output_file = "data/all_questions_for_gemini.txt"
    os.makedirs("data", exist_ok=True)
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("DANH SÁCH ĐỀ BÀI IELTS WRITING\n")
        f.write("===============================\n\n")
        
        for i, exam in enumerate(exams):
            f.write(f"Đề {i+1}: {exam.get('lesson', 'Unnamed')}\n")
            if exam.get("task1"):
                f.write(f"[TASK 1] {exam['task1']['prompt']}\n")
            if exam.get("task2"):
                f.write(f"[TASK 2] {exam['task2']['prompt']}\n")
            f.write("-" * 30 + "\n\n")
            
    print(f"✅ Đã export thành công {len(exams)} đề bài vào file: {output_file}")
    print("👉 Hãy copy nội dung file này dán vào prompt Gemini để tạo bài mẫu.")

if __name__ == "__main__":
    asyncio.run(export_questions())
