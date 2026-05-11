from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- SCHEMAS CHO OCR ---

class OCRResponse(BaseModel):
    text: str
    status: str = "success"
    message: Optional[str] = None

# --- SCHEMAS CHO SUBMIT BÀI VIẾT ---

class EssaySubmit(BaseModel):
    task_type: int  # 1 hoặc 2
    question: str
    essay: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    task_mode: Optional[str] = "both"
    exam_title: Optional[str] = "Practice Test"

# --- SCHEMAS CHO KẾT QUẢ CHẤM ĐIỂM ---

class HeatmapItem(BaseModel):
    type: str
    original_snippet: str
    target_text: str
    suggestion: str
    reason_vi: str

class ScoreResult(BaseModel):
    overall: float
    tr: float  # Task Response
    cc: float  # Coherence and Cohesion
    lr: float  # Lexical Resource
    gra: float # Grammatical Range and Accuracy
    feedback: Optional[str] = None
    detailed_feedback: Optional[dict] = None
    is_corrected: bool = False
    heatmap: Optional[List[HeatmapItem]] = []
    essay_text: str

# --- SCHEMAS CHO AUTH & USER ---

class UserRegister(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class GoogleLoginRequest(BaseModel):
    credential: str

class UserProfile(BaseModel):
    email: str
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    last_seen: Optional[datetime] = None
    target_band: float = 7.0
    streak: int = 0
    total_essays: int = 0

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    target_band: Optional[float] = None

class UserTargetBandUpdate(BaseModel):
    user_id: str
    target_band: float
    
class PasswordChangeRequest(BaseModel):
    user_id: str
    current_password: str
    new_password: str

# --- SCHEMAS CHO REPHRASE ---

class RephraseRequest(BaseModel):
    text: str

class RephraseResponse(BaseModel):
    original: str
    improved: str

# --- SCHEMAS CHO DASHBOARD ---

class ScoreHistoryItem(BaseModel):
    date: str
    overall: float
    tr: Optional[float] = None
    cc: Optional[float] = None
    lr: Optional[float] = None
    gra: Optional[float] = None

class TopError(BaseModel):
    type: str
    count: int
    name_vi: str

class DashboardStats(BaseModel):
    average_band: float
    total_essays: int
    total_completed: int = 0
    total_in_progress: int = 0
    top_error: Optional[TopError] = None
    score_history: List[ScoreHistoryItem] = []
    error_distribution: List[dict] = []
    recent_essays: List[dict] = []

# --- SCHEMAS CHO EXAM SIMULATION (UNIFIED) ---

class ExamTask(BaseModel):
    essay: str = ""
    question: Optional[Any] = None
    status: str = "draft"  # "draft" hoặc "submitted"
    result: Optional[ScoreResult] = None

class ExamSession(BaseModel):
    id: Optional[str] = None
    user_id: str
    session_type: str = "exam"
    source_exam_id: Optional[str] = None
    task_mode: str  # "task1", "task2", "both"
    time_left: int
    tasks: Dict[str, ExamTask] = {}  # Key: "1" hoặc "2"
    overall_status: str = "in_progress"  # "in_progress", "completed"
    overall: Optional[float] = None
    total_time_spent: int = 0
    last_updated: datetime = datetime.now()
    created_at: datetime = datetime.now() 

# --- SCHEMAS CHO EXAM LIBRARY ---

class ExamLibraryItem(BaseModel):
    id: str
    title: str
    year: int
    tags: List[str]
    participants_count: int
    comments_count: int
    time_minutes: int
    parts_count: int
    is_completed: Optional[bool] = False

class ExamDetailResponse(BaseModel):
    id: str
    title: str
    year: int
    participants_count: int
    comments_count: int
    task1: Optional[dict] = None
    task2: Optional[dict] = None

# --- SCHEMAS CHO THẢO LUẬN ---

class CommentCreate(BaseModel):
    exam_id: str
    user_id: str
    username: str
    content: str
    parent_id: Optional[str] = None  # None = top-level, else = reply

class CommentResponse(BaseModel):
    id: str
    exam_id: str
    user_id: str
    username: str
    content: str
    parent_id: Optional[str] = None
    likes: int = 0
    liked_by: List[str] = []
    created_at: str
    replies: List[Any] = []

class LeaderboardEntry(BaseModel):
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    average_band: float
    total_essays: int
    streak: int
    last_active: Optional[str] = None
    is_online: bool = False

# --- SCHEMAS CHO MODEL ANSWER ---

class ModelAnswerResponse(BaseModel):
    question: str
    task_type: int
    target_band: float
    essay: str
    word_count: int
    key_points: List[str]