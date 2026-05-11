import csv
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password123@localhost:27017")
DB_NAME = "ielts_scorer"

async def import_vocabulary():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db.vocabulary
    
    # Create index
    await collection.create_index([("basic_word", 1), ("band_range", 1)], unique=True)
    
    data_dir = "../data/vocabulary"
    if not os.path.exists(data_dir):
        print(f"❌ Directory {data_dir} not found. Please create it and add CSV files.")
        return

    total_imported = 0
    for filename in os.listdir(data_dir):
        if filename.endswith(".csv"):
            filepath = os.path.join(data_dir, filename)
            print(f"🔄 Importing {filename}...")
            
            with open(filepath, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Clean up data
                    item = {
                        "basic_word": row["basic_word"].strip().lower(),
                        "band_range": row["band_range"].strip(),
                        "upgraded_words": [w.strip() for w in row["upgraded_words"].split('|')],
                        "part_of_speech": row["part_of_speech"].strip(),
                        "example_sentence": row["example_sentence"].strip(),
                        "usage_note_vi": row["usage_note_vi"].strip()
                    }
                    
                    await collection.update_one(
                        {"basic_word": item["basic_word"], "band_range": item["band_range"]},
                        {"$set": item},
                        upsert=True
                    )
                    total_imported += 1
                    
    print(f"✅ Finished! Total imported/updated: {total_imported}")

if __name__ == "__main__":
    asyncio.run(import_vocabulary())
