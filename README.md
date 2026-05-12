# 📝 IELTS-Scorer: Fine-tuned Transformer Pipeline for Essay Grading

**IELTS-Scorer** is a high-performance, intelligent system designed to automate IELTS Writing evaluation. Unlike generic LLM-based solutions, this project features a **custom-trained pipeline** of fine-tuned Transformer models (DeBERTa & T5) to provide objective scoring and precise linguistic upgrades.

---

## 🌟 Key Features

- **Multi-Task Neural Scoring**: Custom fine-tuned **DeBERTa-v3-Small** predicts 4 official IELTS criteria (TR, CC, LR, GRA) with high correlation to human examiners.
- **Dynamic Sentence Upgrading**:
    1.  **Band Detection**: A dedicated fine-tuned DeBERTa model evaluates the band score of every individual sentence.
    2.  **Controlled Generation**: A fine-tuned **T5-Base** model rephrases sentences using dynamic prefixes (`fix grammar`, `enhance vocabulary`, `refine style`) selected based on the detected band.
- **Hybrid Feedback System**: Combines custom neural insights with **Gemini LLM** to provide character-accurate "Heatmap" feedback and detailed justifications in Vietnamese.
- **Linguistic Depth**: Automatic CEFR-level vocabulary density analysis and grammar error categorization.
- **Optimized for Speed**: Model quantization via **ONNX Runtime** ensures near-instant inference even on CPU.

---

## 🖼️ Preview & UI

<div align="center">
  <img src="assets/dashboard.png" alt="Dashboard" width="800">
  <p><i>Personalized Dashboard with learning progress and streaks.</i></p>
</div>

<div align="center">
  <table>
    <tr>
      <td width="50%"><img src="assets/trangdethi.png" alt="Exam Library"><br><i>Exam Library</i></td>
      <td width="50%"><img src="assets/chitietdethi.png" alt="Exam Detail"><br><i>Exam Details & Discussion</i></td>
    </tr>
    <tr>
      <td width="50%"><img src="assets/chedoluyentap.png" alt="Practice Mode"><br><i>AI-Powered Practice Mode</i></td>
      <td width="50%"><img src="assets/chedophongthi.png" alt="Exam Mode"><br><i>Simulated Exam Environment</i></td>
    </tr>
  </table>
</div>

---

## 🧠 AI/ML Engineering & Training

This project demonstrates a full ML lifecycle: Data collection -> Preprocessing -> Fine-tuning -> Quantization -> Deployment.

### 1. Automated Essay Scoring (AES) - DeBERTa-v3-Small
- **Training Strategy**: Multi-head Regression.
- **Optimization**: Fine-tuned on a curated IELTS dataset using **Weighted MSE Loss** to handle score distribution imbalances (e.g., scarcity of Band 8.0/9.0 samples).
- **Inference**: Exported to **ONNX** with 8-bit quantization for production efficiency.

### 2. Sentence-Level Band Evaluator - DeBERTa-v3-Small
- **Purpose**: Acts as the "critic" for the rephrasing engine.
- **Logic**: Predicts a continuous score (0.0 - 9.0) for single sentences, allowing the system to decide whether a sentence needs basic grammar fixing or stylistic refinement.

### 3. Conditional Rephrasing - T5-Base
- **Architecture**: Encoder-Decoder with **Prefix-Controlled Generation**.
- **Training**: Fine-tuned using ROUGE-L optimization to transform "Basic" sentences into "Academic" counterparts.
- **Control Mechanism**:
    - `Band <= 5.0` ➔ `fix grammar:` prefix.
    - `5.0 < Band <= 6.5` ➔ `enhance vocabulary:` prefix.
    - `Band > 6.5` ➔ `refine style:` prefix.

---

## 🛠 Tech Stack

### Backend & AI
- **Framework**: FastAPI (Python)
- **Neural Engines**: `transformers`, `onnxruntime`, `optimum`.
- **Database**: MongoDB (Motor) for user history and vocabulary CEFR mapping.
- **LLM Integration**: Google Generative AI (Gemini Pro) for discursive feedback.

### Frontend
- **Framework**: React.js with Vite & TypeScript.
- **Styling**: Modern, responsive UI with real-time feedback heatmaps.

---

## 📂 Project Structure

```text
IELTS-Scorer/
├── frontend/           # React.js + TypeScript (Vite)
├── scripts/            # AI/ML Pipeline: Crawling, Training, & Quantization
│   ├── data/           # Data crawling, preprocessing & importing
│   ├── train/          # Model fine-tuning (DeBERTa, T5)
│   └── deploy/         # Exporting to ONNX & Quantization
├── assets/             # Project visual assets (Banners, diagrams)
├── main.py             # FastAPI entry point
├── controller.py       # API Route controllers
├── services.py         # Business logic (Scoring, Feedback, Rephrasing)
├── ml_models.py        # Model initialization & ONNX management
├── crud.py             # Database CRUD operations (MongoDB)
├── db.py               # MongoDB connection config
├── auth_utils.py       # Security, JWT, and Password hashing
├── schemas.py          # Pydantic data models
├── prompt.txt          # LLM system prompts
├── docker-compose.yml  # Containerization config
└── requirements.txt    # Backend dependencies

---

## 📊 Datasets & Models

Due to the large size of the fine-tuned models and processed datasets, they are hosted on Google Drive:

- **Download Models**: [Google Drive - Models](https://drive.google.com/drive/folders/13UZ0KnyDtuA25MIaOiuMX9LTcgAr0pTC?usp=sharing)
- **Download Data**: [Google Drive - Data](https://drive.google.com/drive/folders/1KaEYBcfVGW64CcC8xcRJrUD2sfW4M-pX?usp=sharing)

### 1. Data Files (`data/raw/`)
- **`ielts_writing_dataset3.csv`**: Main training set (Task 1 & 2) with detailed 4-criteria scores and justifications.
- **`zim_ielts_writing_all.csv`**: Real-world IELTS essays collected from Zim.vn.
- **`T5_dataset_final_balanced.csv`**: Curated sentence-level dataset for rephrasing training.
- **`augmented_band_3_5.csv`**: Synthetic data used to improve accuracy for low-band essay scoring.

### 2. Model Structure (`models/`)
- **`DeBert/best_model/`**: Fine-tuned **DeBERTa-v3-Small** for multi-criteria automated essay scoring.
- **`DeBert/DeBERTa_Sentence_Scorer/`**: Fine-tuned model used to evaluate the band score of individual sentences.
- **`T5/ASE_model_T5_Final/`**: Fine-tuned **T5-Base** for conditional sentence rephrasing (grammar, vocabulary, style).

---
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) & Docker Compose installed.
- (Optional) Python 3.10+ if running locally without Docker.

### 2. Configuration
Create a `.env` file in the root directory:
```env
MONGO_URI=mongodb://admin:password123@mongodb:27017
GEMINI_API_KEY=your_gemini_api_key_here
GG_Client_Id=your_google_client_id
JWT_SECRET=your_random_secret_string
```

### 3. Run with Docker (Recommended)
This will spin up the FastAPI backend, MongoDB, and the React frontend automatically.
```bash
docker compose up --build -d
```
The app will be available at `http://localhost:8000`.

### 4. Local Development (Manual)
If you prefer to run the components separately:
```bash
# Backend
python -m venv venv
source ./venv/bin/activate  # Windows: ./venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

---
*Developed by [hminh729](https://github.com/hminh729) - A blend of Deep Learning and Practical Education Tools.*