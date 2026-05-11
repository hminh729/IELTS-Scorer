import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password123@localhost:27017")
DB_NAME = "ielts_scorer"

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

async def check_db_connection():
    try:
        # The ping command is cheap and does not require auth.
        await client.admin.command('ping')
        print("✅ MongoDB connection successful")
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False
