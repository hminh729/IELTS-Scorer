from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks
from typing import List, Optional, Any
import asyncio
import hashlib

from schemas import (
    OCRResponse, EssaySubmit, ScoreResult, UserRegister, UserLogin, 
    Token, GoogleLoginRequest, DashboardStats, ExamSession, UserTargetBandUpdate,
    ExamLibraryItem, ExamDetailResponse, CommentCreate, RephraseRequest, RephraseResponse,
    LeaderboardEntry, UserProfile, UserUpdate, ModelAnswerResponse, PasswordChangeRequest
)
from services import (
    process_ocr, calculate_dummy_score, get_user_stats, rephrase_sentence, 
    generate_model_answer, generate_essay_outline
)
from crud import (
    register_user, login_user, get_user_history, handle_google_login, 
    save_essay_to_db, save_exam_session, get_active_exam_session, 
    submit_full_exam, delete_exam_session, delete_all_user_exams,
    update_user_target_band, get_user_target_band, delete_essay, 
    delete_all_user_essays, delete_batch_essays, delete_batch_exams, 
    get_exam_library, get_exam_detail, get_comments, create_comment, 
    toggle_reaction_comment, delete_comment, get_leaderboard,
    get_model_answers, get_model_answer_by_band, get_user_profile,
    update_user_profile, update_user_avatar, save_model_answer,
    save_essay_outline, get_essay_outline
)

from pydantic import BaseModel

class DeleteBatchRequest(BaseModel):
    ids: List[str]

# --- TRACKING ACTIVE GENERATIONS ---
# user_tasks: user_id -> question_hash_band
user_tasks = {}
# global_generations: question_hash_band -> status
global_generations = {}

router = APIRouter()

@router.get("/")
async def root():
    return {"message": "IELTS Scorer API is running!"}

# --- ENDPOINT OCR ---
@router.post("/api/extract-text", response_model=OCRResponse)
async def extract_text(file: UploadFile = File(...)):
    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File tải lên phải là ảnh.")
        content = await file.read()
        extracted_text = await asyncio.to_thread(process_ocr, content) 
        return OCRResponse(text=extracted_text)
    except Exception as e:
        return OCRResponse(text="", status="error", message=str(e))

@router.post("/api/score", response_model=ScoreResult)
async def score_essay(data: EssaySubmit):
    try:
        result = await calculate_dummy_score(data.task_type, data.question, data.essay)
        if data.user_id:
            await save_essay_to_db(data.user_id, result, data)
        return ScoreResult(**result)
    except Exception as e:
        print(f"Error in score_essay: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- AUTH ROUTES ---
@router.post("/api/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    try:
        return await register_user(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    try:
        return await login_user(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/auth/google", response_model=Token)
async def google_login(data: GoogleLoginRequest):
    try:
        return await handle_google_login(data.credential)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- USER DATA ROUTES ---
@router.get("/api/user/history")
async def history(user_id: str, mode: str = "practice", exam_id: Optional[str] = None):
    return await get_user_history(user_id, mode, exam_id)


@router.get("/api/user/stats", response_model=DashboardStats)
async def stats(user_id: str, mode: str = "practice"):
    return await get_user_stats(user_id, mode)

# --- ENDPOINT REPHRASE ---
@router.post("/api/rephrase", response_model=RephraseResponse)
async def rephrase(data: RephraseRequest):
    try:
        improved = await asyncio.to_thread(rephrase_sentence, data.text)
        return RephraseResponse(original=data.text, improved=improved)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- EXAM SIMULATION ROUTES ---
@router.post("/api/exam/save-session")
async def save_session(session: ExamSession):
    try:
        new_id = await save_exam_session(session.dict())
        return {"status": "success", "message": "Session saved", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/exam/load-session")
async def load_session(user_id: str, session_id: Optional[str] = None):
    try:
        return await get_active_exam_session(user_id, session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/exam/delete-session")
async def delete_session_endpoint(user_id: str, session_id: Optional[str] = None):
    try:
        await delete_exam_session(user_id, session_id)
        return {"status": "success", "message": "Draft deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/exam/delete-all/{user_id}")
async def clear_all_exams(user_id: str):
    try:
        await delete_all_user_exams(user_id)
        return {"status": "success", "message": "All exams deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/exam/delete-batch")
async def clear_batch_exams(data: DeleteBatchRequest):
    try:
        await delete_batch_exams(data.ids)
        return {"status": "success", "message": "Batch exams deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/exam/submit")
async def submit_exam(session: ExamSession):
    try:
        await submit_full_exam(session.dict())
        return {"status": "success", "message": "Exam completed and results saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/exam/library", response_model=List[ExamLibraryItem])
async def exam_library(search: str = "", limit: int = 50, user_id: Optional[str] = None):
    try:
        return await get_exam_library(search, limit, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/exam/detail/{exam_id}", response_model=ExamDetailResponse)
async def exam_detail(exam_id: str):
    try:
        result = await get_exam_detail(exam_id)
        if not result: raise HTTPException(status_code=404, detail="Exam not found")
        return result
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/user/target-band")
async def fetch_target_band(user_id: str):
    try:
        band = await get_user_target_band(user_id)
        return {"target_band": band}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/user/target-band")
async def update_target_band_endpoint(data: UserTargetBandUpdate):
    try:
        await update_user_target_band(data.user_id, data.target_band)
        return {"status": "success", "message": "Target band updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/user/profile", response_model=UserProfile)
async def user_profile_endpoint(user_id: str):
    profile = await get_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile

@router.post("/api/user/profile")
async def update_profile_endpoint(user_id: str, data: UserUpdate):
    try:
        await update_user_profile(user_id, data.dict(exclude_none=True))
        return {"status": "success", "message": "Profile updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/user/change-password")
async def change_password_endpoint(data: PasswordChangeRequest):
    try:
        success, message = await update_user_password(data.user_id, data.current_password, data.new_password)
        if not success:
            raise HTTPException(status_code=400, detail=message)
        return {"status": "success", "message": message}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/user/avatar")
async def upload_avatar_endpoint(user_id: str, file: UploadFile = File(...)):
    import os
    import time
    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        file_ext = os.path.splitext(file.filename)[1]
        if file_ext.lower() not in [".jpg", ".jpeg", ".png"]:
             raise HTTPException(status_code=400, detail="Only .jpg and .png are supported")
             
        filename = f"{user_id}_{int(time.time())}{file_ext}"
        filepath = os.path.join("uploads", "avatars", filename)
        
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
            
        avatar_url = f"http://localhost:8000/uploads/avatars/{filename}"
        await update_user_avatar(user_id, avatar_url)
        
        return {"status": "success", "avatar_url": avatar_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/essays/{essay_id}")
async def remove_essay(essay_id: str):
    try:
        await delete_essay(essay_id)
        return {"status": "success", "message": "Essay deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/essays/all/{user_id}")
async def clear_all_essays(user_id: str):
    try:
        await delete_all_user_essays(user_id)
        return {"status": "success", "message": "All essays deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/essays/delete-batch")
async def clear_batch_essays(data: DeleteBatchRequest):
    try:
        await delete_batch_essays(data.ids)
        return {"status": "success", "message": "Batch essays deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- DISCUSSION ROUTES ---
@router.get("/api/exam/{exam_id}/comments")
async def get_exam_comments(exam_id: str):
    try:
        return await get_comments(exam_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/exam/{exam_id}/comments")
async def post_comment(exam_id: str, data: CommentCreate):
    try:
        data.exam_id = exam_id
        return await create_comment(data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/comments/{comment_id}/react")
async def react_to_comment(comment_id: str, user_id: str, reaction_type: str = "👍"):
    try:
        result = await toggle_reaction_comment(comment_id, user_id, reaction_type)
        if not result: raise HTTPException(status_code=404, detail="Comment not found")
        return result
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/comments/{comment_id}")
async def remove_comment(comment_id: str, user_id: str):
    try:
        await delete_comment(comment_id, user_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.get("/api/leaderboard", response_model=List[LeaderboardEntry])
async def leaderboard(sort_by: str = "average_band", limit: int = 100):
    return await get_leaderboard(sort_by, limit)

async def background_generate_answer(user_id: str, question: str, target_band: float, task_type: int, exam_title: str = "Bài mẫu"):
    """Hàm chạy ngầm để tạo bài mẫu mà không chặn request chính"""
    question_hash = hashlib.md5(question.strip().lower().encode()).hexdigest()
    task_key = f"{question_hash}_{target_band}"
    
    try:
        generated = await generate_model_answer(question, target_band, task_type)
        if generated:
            await save_model_answer(generated)
            print(f"✅ [BACKGROUND] Đã tạo xong bài mẫu cho key: {task_key}")
    except Exception as e:
        print(f"❌ [BACKGROUND] Lỗi khi tạo bài mẫu: {e}")
    finally:
        global_generations.pop(task_key, None)
        user_tasks.pop(user_id, None)

@router.get("/api/model-answer", response_model=Optional[Any])
async def get_model_answer(
    question: str, 
    target_band: float, 
    task_type: int, 
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = None, 
    force_generate: bool = False,
    exam_title: str = "IELTS Writing",
    exam_id: Optional[str] = None
):
    try:
        print(f"📥 [API] Requesting model answer for: {exam_title} (Band {target_band})")
        # Normalize question for hashing
        question_hash = hashlib.md5(question.strip().lower().encode()).hexdigest()
        task_key = f"{question_hash}_{target_band}"
        
        # 1. Check DB first
        ans = await get_model_answer_by_band(question_hash, target_band)
        if ans:
            ans["_id"] = str(ans["_id"])
            return ans
        
        # 2. Check if already being generated GLOBALLY
        if task_key in global_generations:
            return {"status": "started", "message": "Bài mẫu đang được tạo bởi hệ thống."}

        # 3. If not found and not forcing generation, return null
        if not force_generate:
            return None
            
        # 4. Forcing generation
        if not user_id:
            raise HTTPException(status_code=400, detail="Cần đăng nhập để yêu cầu tạo bài mẫu.")
            
        # Check if this SPECIFIC user already has an active task
        if user_id in user_tasks:
            raise HTTPException(status_code=400, detail="Bạn đang có một yêu cầu khác đang xử lý.")
        
        # Start background task
        global_generations[task_key] = True
        user_tasks[user_id] = {"key": task_key, "title": exam_title, "exam_id": exam_id}
        background_tasks.add_task(background_generate_answer, user_id, question, target_band, task_type, exam_title)
        
        return {"status": "started", "message": "Đã bắt đầu tạo bài mẫu trong nền."}
    except Exception as e:
        print(f"💥 [API ERROR] get_model_answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/model-answer/status")
async def get_model_answer_status(user_id: Optional[str] = None, question: Optional[str] = None, target_band: Optional[float] = None):
    """Kiểm tra trạng thái tạo bài mẫu"""
    is_generating = False
    title = "IELTS Writing"
    exam_id = None
    task_type = "model_answer"
    
    # Check by user
    if user_id and user_id in user_tasks:
        is_generating = True
        title = user_tasks[user_id].get("title", "IELTS Writing")
        exam_id = user_tasks[user_id].get("exam_id")
        task_type = user_tasks[user_id].get("type", "model_answer")
        
    # Check by question (global)
    if not is_generating and question and target_band:
        question_hash = hashlib.md5(question.strip().lower().encode()).hexdigest()
        task_key = f"{question_hash}_{target_band}"
        if task_key in global_generations:
            is_generating = True
            
    return {"is_generating": is_generating, "title": title, "exam_id": exam_id, "type": task_type}

# Global storage for tracking active generations
global_outline_generations = {}

async def background_generate_outline(user_id: str, question: str, task_type: int):
    task_key = f"{hashlib.md5(question.strip().lower().encode()).hexdigest()}_{task_type}"
    try:
        print(f"🚀 [BACKGROUND] Bắt đầu tạo dàn bài cho key: {task_key}")
        outline = await generate_essay_outline(question, task_type)
        if outline:
            # Force the correct metadata
            outline["task_type"] = int(task_type)
            outline["question"] = question
            await save_essay_outline(outline)
            print(f"✅ [BACKGROUND] Đã tạo xong dàn bài cho key: {task_key}")
    except Exception as e:
        print(f"❌ [BACKGROUND] Lỗi khi tạo dàn bài: {e}")
    finally:
        global_outline_generations.pop(task_key, None)
        user_tasks.pop(user_id, None)

@router.get("/api/exam/outline")
async def get_outline_endpoint(
    question: str, 
    task_type: int, 
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = None,
    force_generate: bool = False,
    exam_title: str = "Lập dàn ý IELTS",
    exam_id: Optional[str] = None
):
    try:
        question_hash = hashlib.md5(question.strip().lower().encode()).hexdigest()
        task_key = f"{question_hash}_{task_type}"
        
        # 1. Check DB first
        ans = await get_essay_outline(question_hash, task_type)
        if ans:
            ans["_id"] = str(ans["_id"])
            return ans
        
        # 2. Check if already being generated GLOBALLY
        if task_key in global_outline_generations:
            return {"status": "started", "message": "Dàn bài đang được hệ thống khởi tạo."}

        # 3. If not found and not forcing generation, return null
        if not force_generate:
            return None
            
        # 4. Forcing generation
        if not user_id:
            raise HTTPException(status_code=400, detail="Cần đăng nhập để yêu cầu tạo dàn bài.")
            
        if user_id in user_tasks:
            raise HTTPException(status_code=400, detail="Bạn đang có một yêu cầu khác đang xử lý.")
        
        # Start background task
        global_outline_generations[task_key] = True
        user_tasks[user_id] = {"key": task_key, "title": exam_title, "exam_id": exam_id, "type": "outline"}
        background_tasks.add_task(background_generate_outline, user_id, question, task_type)
        
        return {"status": "started", "message": "Đã bắt đầu tạo dàn bài trong nền."}
    except Exception as e:
        print(f"💥 [API ERROR] get_outline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

