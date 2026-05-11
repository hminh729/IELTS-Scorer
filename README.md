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
│   ├── ASE_Training_DeBert.py      # Fine-tuning Scorer
│   ├── ASE_Training_T5.py          # Fine-tuning Rephrasing Engine
│   └── ASE_Model_Onnx_Quantize.py  # 8-bit Quantization
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
```

---

## 🚀 Getting Started

### 1. Setup Environment
```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configuration
Create a `.env` file with:
- `MONGO_URI`: Your MongoDB connection string.
- `GEMINI_API_KEY`: Your Google AI Studio key.

### 3. Run
```bash
uvicorn main:app --reload
```

---
*Developed by [hminh729](https://github.com/hminh729) - A blend of Deep Learning and Practical Education Tools.*