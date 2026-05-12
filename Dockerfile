# ==============================================================================
# IELTS Scorer — Multi-stage Dockerfile
# Stage 1: Build React frontend
# Stage 2: Python backend + serve built frontend
# ==============================================================================

# ─── Stage 1: Frontend Build ─────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (cached layer)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy source and build
COPY frontend/ ./

# Production build — API calls use same-origin (empty VITE_API_BASE_URL)
ENV VITE_API_BASE_URL=""
RUN npm run build


# ─── Stage 2: Python Backend ─────────────────────────────────────────────────
FROM python:3.11-slim AS backend

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY main.py .
COPY controller.py .
COPY services.py .
COPY crud.py .
COPY schemas.py .
COPY db.py .
COPY auth_utils.py .
COPY ml_models.py .
COPY prompt.txt .
COPY scripts/ ./scripts/
COPY data/ ./data/

# Copy ML models
# NOTE: Models are ~2.3GB total. For smaller images, consider:
#   - Using ONNX quantized models only (~180MB each)
#   - Downloading models from cloud storage at startup
COPY models/ ./models/
# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create required directories
RUN mkdir -p uploads/avatars

# Expose FastAPI port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Start script: Run import then start server
CMD python scripts/data/import_mongo.py && uvicorn main:app --host "0.0.0.0" --port 8000 --workers 2
