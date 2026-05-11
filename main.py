from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from controller import router as api_router
from db import check_db_connection
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="IELTS Scorer API")

# --- CORS CONFIG ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await check_db_connection()

# Mount static files
UPLOAD_DIR = os.path.join("uploads", "avatars")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routes
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
