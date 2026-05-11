import csv
import os
import asyncio
import hashlib
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password123@localhost:27017")
DB_NAME = "ielts_scorer"

async def import_model_answers():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db.model_answers
    
    # Create index
    await collection.create_index([("question_hash", 1), ("target_band", 1)], unique=True)
    
    data_dir = "data/model_answers"
    if not os.path.exists(data_dir):
        print(f"❌ Directory {data_dir} not found. Please create it and add CSV files.")
        return

    total_imported = 0
    for filename in os.listdir(data_dir):
        if filename.endswith(".csv"):
            filepath = os.path.join(data_dir, filename)
            print(f"🔄 Importing {filename}...")
            
            with open(filepath, mode='r', encoding='utf-8-sig') as f:
                # Use a more robust CSV reading if possible, but standard should work for well-formatted Gemini output
                reader = csv.DictReader(f)
                for row in reader:
                    q_text = row["question"].strip()
                    # Create hash of the question for fast lookup
                    q_hash = hashlib.md5(q_text.lower().encode()).hexdigest()
                    
                    item = {
                        "question_hash": q_hash,
                        "question": q_text,
                        "task_type": int(row["task_type"]),
                        "target_band": float(row["target_band"]),
                        "essay": row["essay"].strip(),
                        "word_count": int(row["word_count"]),
                        "key_points": [p.strip() for p in row["key_points"].split('|')],
                        "created_at": datetime.now(timezone.utc)
                    }
                    
                    await collection.update_one(
                        {"question_hash": q_hash, "target_band": item["target_band"]},
                        {"$set": item},
                        upsert=True
                    )
                    total_imported += 1
                    
    print(f"✅ Finished! Total imported/updated: {total_imported}")

if __name__ == "__main__":
    asyncio.run(import_model_answers())
