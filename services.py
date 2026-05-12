import numpy as np
import torch
import math
import json
import os
from datetime import datetime, timezone
from ml_models import (
    tokenizer, model, onnx_session, llm_model, t5_model, t5_tokenizer, 
    sentence_model, sentence_tokenizer, DEVICE
)
from crud import get_user_history, db, find_vocab_matches
import re
from collections import Counter

def ielts_rounding_standard(score: float) -> float:
    """Làm tròn chuẩn IELTS (.0, .5, 1.0)"""
    fraction = score - int(score)
    if fraction < 0.25:
        return float(int(score))
    elif fraction < 0.75:
        return int(score) + 0.5
    else:
        return float(int(score) + 1)

def process_ocr(image_bytes: bytes) -> str:
    """OCR feature is currently disabled in Docker environment."""
    return "Tính năng OCR hiện đã bị tắt để tối ưu hóa tài nguyên hệ thống."

async def get_user_stats(user_id: str, mode: str = "practice"):
    """Tính toán thống kê dashboard từ lịch sử người dùng"""
    user = await db.users.find_one({"username": user_id})
    target_band = user.get("target_band", 7.0) if user else 7.0
    
    history = await get_user_history(user_id, mode=mode)
    if not history:
        return {
            "average_band": 0, "total_essays": 0, "total_completed": 0, "total_in_progress": 0,
            "top_error": None, "score_history": [], "error_distribution": [], "recent_essays": [],
            "target_band": target_band, "score_history": []
        }
    
    total = len(history)
    total_completed = len([h for h in history if h["status"] == "completed"])
    total_in_progress = total - total_completed
    
    scored_history = [h for h in history if h.get("overall") is not None and h["overall"] > 0]
    total_scored = len(scored_history)
    avg_band = sum(h["overall"] for h in scored_history) / total_scored if total_scored > 0 else 0
    
    score_history = []
    for h in reversed(scored_history):
        tasks = h.get("tasks", {})
        criteria = {"tr": [], "cc": [], "lr": [], "gra": []}
        for t_data in tasks.values():
            res = t_data.get("result", {})
            if res:
                for key in criteria:
                    if res.get(key) is not None:
                        criteria[key].append(res[key])
        
        score_history.append({
            "date": h["created_at"].strftime("%d/%m") if isinstance(h["created_at"], datetime) else str(h["created_at"]),
            "overall": h["overall"],
            "tr": round(sum(criteria["tr"]) / len(criteria["tr"]), 1) if criteria["tr"] else None,
            "cc": round(sum(criteria["cc"]) / len(criteria["cc"]), 1) if criteria["cc"] else None,
            "lr": round(sum(criteria["lr"]) / len(criteria["lr"]), 1) if criteria["lr"] else None,
            "gra": round(sum(criteria["gra"]) / len(criteria["gra"]), 1) if criteria["gra"] else None,
        })
    
    errors = {}
    for h in history:
        for hm in h.get("heatmap", []):
            t = hm.get("type")
            errors[t] = errors.get(t, 0) + 1
            
    error_map = {"GRA": "Ngữ pháp (GRA)", "LR": "Từ vựng (LR)", "CC": "Mạch lạc (CC)", "TR": "Nội dung (TR)"}
    distribution = [{"type": k, "count": v, "name_vi": error_map.get(k, k)} for k, v in sorted(errors.items(), key=lambda item: item[1], reverse=True)]
    top_error = distribution[0] if distribution else None
    
    recent = []
    for h in history[:5]:
        recent.append({
            "_id": h["_id"], "question": h["question"], "overall": h["overall"],
            "created_at": h["created_at"], "task_mode": h.get("task_mode"),
            "status": h.get("status"), "word_count": h.get("word_count", 0), "tasks": h.get("tasks", {})
        })
        
    return {
        "average_band": round(avg_band, 1),
        "total_essays": total,
        "total_completed": total_completed,
        "total_in_progress": total_in_progress,
        "top_error": top_error,
        "score_history": score_history,
        "error_distribution": distribution,
        "recent_essays": recent,
        "target_band": target_band
    }

async def get_llm_feedback(task_type: int, question: str, essay_text: str, predicted_scores: dict, mode: int = 1):
    """Gọi Gemini API để lấy nhận xét và kiểm tra điểm số"""
    if not llm_model: return None

    if mode == 1:
        score_context = f"AI MODEL PREDICTED SCORES: {predicted_scores}"
        instruction = "2. Assess the scores realistically. If the AI model's score is inaccurate, provide your corrected scores."
    elif mode == 2:
        score_context = ""
        instruction = "2. Evaluate and provide your scores for each criterion (Scale 0-9) independently."
    else: # mode 3
        score_context = f"FINAL ASSIGNED SCORES: {predicted_scores}"
        instruction = "2. IMPORTANT: Provide feedback that JUSTIFIES and EXPLAINS these assigned scores. DO NOT critique or evaluate the accuracy of these scores."

    prompt = f"""
    You are a professional IELTS Writing Examiner. 
    Evaluate the following essay based on the IELTS Writing Task {task_type} criteria.
    QUESTION: {question}
    ESSAY: {essay_text}
    {score_context}
    INSTRUCTIONS:
    1. Provide high-quality, professional feedback for each criterion in VIETNAMESE.
    {instruction}
    3. Return ONLY a JSON object with the following structure:
       {{
         "corrected_scores": {{"tr": float, "cc": float, "lr": float, "gra": float}},
         "detailed_feedback": {{"tr": "...", "cc": "...", "lr": "...", "gra": "..."}},
         "heatmap": [
           {{
             "type": "GRA" | "LR" | "CC", 
             "original_snippet": "A larger exact substring from the essay containing the error", 
             "target_text": "The specific exact word or phrase that is wrong within that snippet", 
             "suggestion": "How to fix it", 
             "reason_vi": "Explanation in Vietnamese"
           }}
         ],
         "general_conclusion": "..."
       }}
    IMPORTANT: The 'original_snippet' and 'target_text' MUST be exact, character-for-character matches from the provided ESSAY text.
    """

    try:
        gen_config = {"response_mime_type": "application/json"} if "gemini" in llm_model.model_name else {}
        response = await llm_model.generate_content_async(prompt, generation_config=gen_config)
        text = response.text.strip()
        if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text: text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return None

async def extract_vocab_suggestions(essay_text: str, lr_band: float) -> list:
    """
    Trích xuất các từ cơ bản trong essay và gợi ý từ nâng cấp từ DB.
    """
    # 1. Tokenize đơn giản
    words = re.findall(r'\b[a-z]{3,}\b', essay_text.lower())
    
    # 2. Đếm tần suất
    counts = Counter(words)
    unique_words = list(counts.keys())
    
    # 3. Xác định band_range mục tiêu
    if lr_band <= 5.5: band_range = "5.0-6.0"
    elif lr_band <= 6.5: band_range = "6.0-7.0"
    elif lr_band <= 7.5: band_range = "7.0-8.0"
    else: band_range = "8.0-9.0"
    
    # 4. Tìm trong DB
    matches = await find_vocab_matches(unique_words, band_range)
    
    # 5. Gắn tần suất và sort
    results = []
    for m in matches:
        # MongoDB objectid needs to be string
        if "_id" in m: m["_id"] = str(m["_id"])
        m["frequency"] = counts[m["basic_word"]]
        results.append(m)
        
    results.sort(key=lambda x: x["frequency"], reverse=True)
    return results[:8]

async def calculate_dummy_score(task_type: int, question: str, essay_text: str):
    """Quy trình chấm điểm AI: Inference -> Rounding -> LLM Feedback"""
    prompt = f"[TASK {task_type}] Question: {question}"
    inputs = tokenizer(prompt, essay_text, return_tensors="pt", truncation=True, padding="max_length", max_length=512).to(DEVICE)

    if onnx_session:
        onnx_inputs = {k: v.cpu().numpy() for k, v in inputs.items()}
        outputs = onnx_session.run(None, onnx_inputs)
        logits = outputs[0][0]
        raw_scores = (1 / (1 + np.exp(-logits))) * 9.0
    else:
        with torch.no_grad():
            outputs = model(**inputs)
            raw_scores = outputs.logits[0].cpu().numpy() * 9.0

    rounded_criteria = [math.floor(s * 2) / 2 for s in raw_scores.tolist()]
    model_scores = {"tr": rounded_criteria[0], "cc": rounded_criteria[1], "lr": rounded_criteria[2], "gra": rounded_criteria[3]}
    model_scores["overall"] = ielts_rounding_standard((sum(rounded_criteria[:4])) / 4)
    
    # MODE 3: Model Only by default
    SCORING_MODE = 3
    llm_result = await get_llm_feedback(task_type, question, essay_text, model_scores, mode=SCORING_MODE)
    
    final_scores = model_scores
    is_corrected = False
    detailed_feedback = llm_result.get("detailed_feedback") if llm_result else None
    general_feedback = llm_result.get("general_conclusion", "Phần chấm điểm đang được phân tích...") if llm_result else "Không nhận được phản hồi từ LLM."
    heatmap = llm_result.get("heatmap", []) if llm_result else []
    
    # --- LOGGING FOR HEATMAP DEBUGGING ---
    print(f"\n[AI HEATMAP LOG]")
    if not heatmap:
        print("Heatmap is empty or missing from LLM response.")
    else:
        print(f"Number of heatmap items: {len(heatmap)}")
        for i, item in enumerate(heatmap):
            print(f"Item {i}: Type={item.get('type')}, Snippet='{item.get('original_snippet')}', Target='{item.get('target_text')}'")
    print("------------------\n")

    if isinstance(heatmap, dict):
        # Nếu model trả về dict thay vì list, cố gắng lấy values nếu phù hợp hoặc reset về list trống
        heatmap = list(heatmap.values()) if all(isinstance(v, dict) for v in heatmap.values()) else []
    elif not isinstance(heatmap, list):
        heatmap = []

    # --- FEATURE 1: VOCABULARY BUILDER ---
    vocab_suggestions = await extract_vocab_suggestions(essay_text, float(final_scores["lr"]))

    return {
        "tr": float(final_scores["tr"]), "cc": float(final_scores["cc"]), "lr": float(final_scores["lr"]),
        "gra": float(final_scores["gra"]), "overall": float(final_scores["overall"]),
        "word_count": len(essay_text.split()), "feedback": general_feedback,
        "detailed_feedback": detailed_feedback, "is_corrected": is_corrected,
        "heatmap": heatmap, "essay_text": essay_text, 
        "vocabulary_suggestions": vocab_suggestions,
        "created_at": datetime.now(timezone.utc)
    }

def get_rephrase_prefix(band: float) -> str:
    """Xác định prefix dựa trên Band điểm hiện tại để điều khiển mức độ sửa câu."""
    if band <= 5.0:
        return "fix grammar: "        # Tập trung sửa lỗi ngữ pháp cơ bản
    elif band <= 6.5:
        return "enhance vocabulary: " # Tập trung nâng cấp từ vựng học thuật
    else:
        return "refine style: "       # Tập trung vào văn phong và nhịp điệu

def score_single_sentence(text: str) -> float:
    """Tính toán band điểm cho một câu đơn lẻ (0-9)."""
    if not sentence_model or not sentence_tokenizer:
        return 5.0 # Fallback
    
    with torch.no_grad():
        inputs = sentence_tokenizer(text, return_tensors="pt", truncation=True, padding="max_length", max_length=128).to(DEVICE)
        outputs = sentence_model(**inputs)
        # Model output is Sigmoid [0, 1], scale to [0, 9]
        predicted_band = outputs.logits.item() * 9.0
    return predicted_band

def rephrase_sentence(text: str) -> str:
    """Nâng cấp câu sử dụng mô hình T5 với tiền tố điều khiển (Controlled Generation)."""
    if not t5_model or not t5_tokenizer: return "Lỗi: Mô hình T5 chưa được nạp."
    
    # 1. Tính toán band điểm hiện tại
    current_band = score_single_sentence(text)
    
    # 2. Lấy prefix điều khiển tương ứng
    prefix = get_rephrase_prefix(current_band)
    
    # 3. Thực hiện nâng cấp câu
    input_text = prefix + text
    
    # --- LOGGING FOR DEBUGGING ---
    print(f"\n[SENTENCE REPHRASE LOG]")
    print(f"Input text: '{text}'")
    print(f"DeBERTa Prediction (Band Score): {current_band:.4f}")
    print(f"Dynamic Prefix Applied: '{prefix}'")
    print(f"Combined input for T5: '{input_text}'\n")
    
    inputs = t5_tokenizer(input_text, return_tensors="pt", truncation=True, max_length=128).to(DEVICE)
    summary_ids = t5_model.generate(inputs["input_ids"], max_length=128, num_beams=4, early_stopping=True)
    return t5_tokenizer.decode(summary_ids[0], skip_special_tokens=True)

async def generate_model_answer(question: str, target_band: float, task_type: int) -> dict:
    """Gọi Gemini API để tạo bài mẫu IELTS theo band điểm mục tiêu"""
    if not llm_model: return None

    word_range = "170-200" if task_type == 1 else "280-320"
    
    prompt = f"""
    Create a high-quality IELTS Writing Task {task_type} model answer.
    TARGET BAND: {target_band}
    QUESTION: {question}

    REQUIREMENTS FOR BAND {target_band}:
    - Word count: {word_range} words.
    - Structure: Introduction, Body 1, Body 2, Conclusion.
    - Vocabulary: Diverse, natural, and highly appropriate for band {target_band}. Use less common lexical items where natural.
    - Grammar: A wide mix of simple and complex sentences with high accuracy.
    - Cohesion: Smooth transitions and effective use of cohesive devices.
    - Content: Fully address all parts of the prompt with relevant, well-developed ideas.

    Return ONLY a JSON object with the following structure:
    {{
      "question": "The original question text",
      "task_type": {task_type},
      "target_band": {target_band},
      "essay": "The full model answer text",
      "word_count": number,
      "key_points": ["3-5 main key points or strategies used in this essay"]
    }}
    """

    try:
        gen_config = {"response_mime_type": "application/json"} if "gemini" in llm_model.model_name else {}
        response = await llm_model.generate_content_async(prompt, generation_config=gen_config)
        text = response.text.strip()
        
        # Cleanup response text
        if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text: text = text.split("```")[1].split("```")[0].strip()
        
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error generating model answer: {e}")
        return None

async def generate_essay_outline(question: str, task_type: int) -> dict:
    """Gọi Gemini API để tạo dàn bài (outline) gợi ý cho câu hỏi IELTS"""
    if not llm_model: return None

    prompt = f"""
    Create a professional IELTS Writing Task {task_type} outline for: {question}

    RULES:
    - 2-3 detailed bullet points per section.
    - Max 12 words per bullet.
    - NO bolding (**).
    - Format: JSON only.

    STRUCTURE:
    - "Introduction": Brief thesis.
    - "Body 1": Heading format "Body Paragraph 1 (Topic Summary)".
    - "Body 2": Heading format "Body Paragraph 2 (Topic Summary)".
    - "Conclusion": Summary.

    VOCABULARY:
    - Provide 6-8 high-level, contextual vocabulary items.

    JSON TEMPLATE:
    {{
      "structure": [
        {{ "heading": "Introduction", "bullets": [] }},
        {{ "heading": "Body Paragraph 1 (Topic)", "bullets": [] }},
        {{ "heading": "Body Paragraph 2 (Topic)", "bullets": [] }},
        {{ "heading": "Conclusion", "bullets": [] }}
      ],
      "useful_vocabulary": [
        {{ "word": "...", "meaning": "...", "usage": "..." }},
        ... (6-8 items)
      ],
      "key_tips": ["Tip 1", "Tip 2"]
    }}
    """

    try:
        gen_config = {"response_mime_type": "application/json"} if "gemini" in llm_model.model_name else {}
        response = await llm_model.generate_content_async(prompt, generation_config=gen_config)
        text = response.text.strip()
        
        # Parse JSON more robustly
        import re
        json_match = re.search(r'(\{.*\})', text, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        else:
            if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text: text = text.split("```")[1].split("```")[0].strip()
            
        return json.loads(text)
    except Exception as e:
        print(f"Error generating outline: {e}")
        return None
