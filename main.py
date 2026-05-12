from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from controller import router as api_router
from db import check_db_connection
import os
import logging

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="IELTS Scorer API")

# ─── CORS CONFIG ────────────────────────────────────────────────────────────
# In production (Docker), frontend is served from the same origin,
# so CORS is not needed. For development, allow localhost:5173.
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:8000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await check_db_connection()

# ─── Upload directory ───────────────────────────────────────────────────────
UPLOAD_DIR = os.path.join("uploads", "avatars")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ─── API routes ─────────────────────────────────────────────────────────────
app.include_router(api_router)

# ─── Serve frontend (production) ────────────────────────────────────────────
# In Docker, the built React app is at ./frontend/dist
# We serve static assets and use a catch-all for React Router (SPA)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(FRONTEND_DIR):
    logger.info(f"🌐 Serving frontend from {FRONTEND_DIR}")

    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="frontend-assets")

    # Catch-all: serve index.html for any non-API, non-static route (React Router)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Don't serve index.html for API routes or uploads
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            return  # Let FastAPI handle 404
        
        # Try to serve the exact file first (e.g., favicon.ico, robots.txt)
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Otherwise, serve index.html (SPA fallback)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    logger.info("⚙️ Frontend not found — running in API-only mode (development)")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
