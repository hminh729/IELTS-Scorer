from datetime import datetime, timezone, timedelta
from typing import List, Optional
from bson import ObjectId
import os
from db import db
from auth_utils import get_password_hash, verify_password, create_access_token
from schemas import UserRegister, UserLogin, EssaySubmit, UserProfile

# --- USER CRUD ---

async def register_user(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email đã được đăng ký.")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = {
        "email": user_data.email,
        "username": user_data.username,
        "password": hashed_password,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(new_user)
    print(f"✅ Đã tạo user mới: {user_data.email}")
    
    token = create_access_token({"sub": user_data.email})
    return {"access_token": token, "token_type": "bearer", "username": user_data.username}

async def login_user(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email hoặc mật khẩu không chính xác.")
    
    token = create_access_token({"sub": user_data.email})
    return {"access_token": token, "token_type": "bearer", "username": user["username"]}

async def handle_google_login(credential: str):
    from google.oauth2 import id_token
    from google.auth.transport import requests
    
    CLIENT_ID = os.getenv("GG_Client_Id")
    try:
        # Verify the token
        idinfo = id_token.verify_oauth2_token(credential, requests.Request(), CLIENT_ID)
        
        email = idinfo['email']
        username = idinfo.get('name', email.split('@')[0])
        
        # Check if user exists
        user = await db.users.find_one({"email": email})
        if not user:
            # Create new user
            user = {
                "email": email,
                "username": username,
                "google_id": idinfo['sub'],
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user)
            print(f"✅ Đã tạo user Google mới: {email}")
        else:
            print(f"🔑 User Google đăng nhập lại: {email}")
            
        token = create_access_token({"sub": email})
        return {"access_token": token, "token_type": "bearer", "username": username}
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Google Token không hợp lệ.")

async def update_user_target_band(user_id: str, target_band: float):
    await db.users.update_one(
        {"username": user_id},
        {"$set": {"target_band": target_band}}
    )
    return True

async def get_user_target_band(user_id: str):
    user = await db.users.find_one({"username": user_id})
    if user:
        return user.get("target_band", 7.0)
    return 7.0

async def get_user_profile(user_id: str):
    user = await db.users.find_one({"username": user_id})
    if not user:
        return None
    
    # Calculate streak for profile
    exams = await db.exams.find({"user_id": user_id, "overall_status": "completed"}).sort("last_updated", -1).to_list(100)
    submission_dates = sorted(list(set(exam["last_updated"].astimezone(timezone.utc).date() for exam in exams)), reverse=True)
    
    streak = 0
    today = datetime.now(timezone.utc).date()
    if submission_dates:
        current_check = today
        if submission_dates[0] < today:
            if (today - submission_dates[0]).days == 1:
                current_check = submission_dates[0]
            else:
                streak = 0
                current_check = None
        
        if current_check:
            for d in submission_dates:
                if d == current_check:
                    streak += 1
                    current_check = current_check - timedelta(days=1)
                elif d > current_check:
                    continue
                else:
                    break

    return {
        "email": user["email"],
        "username": user["username"],
        "full_name": user.get("full_name"),
        "bio": user.get("bio"),
        "avatar_url": user.get("avatar_url"),
        "created_at": user["created_at"],
        "target_band": user.get("target_band", 7.0),
        "streak": streak
    }

async def update_user_profile(user_id: str, profile_data: dict):
    await db.users.update_one(
        {"username": user_id},
        {"$set": profile_data}
    )
    return True

async def update_user_avatar(user_id: str, avatar_url: str):
    await db.users.update_one(
        {"username": user_id},
        {"$set": {"avatar_url": avatar_url}}
    )
    return True

# --- ESSAY & EXAM CRUD ---

async def save_essay_to_db(user_id: str, result: dict, data: EssaySubmit):
    if not data.session_id or data.session_id == "quick-score":
        return
        
    update_data = {
        f"tasks.{data.task_type}.result": result,
        f"tasks.{data.task_type}.status": "submitted",
        f"tasks.{data.task_type}.question": data.question,
        f"tasks.{data.task_type}.essay": data.essay,
        "last_updated": datetime.now(timezone.utc)
    }
    
    doc = await db.exams.find_one({"_id": ObjectId(data.session_id)})
    if not doc:
        new_doc = {
            "_id": ObjectId(data.session_id),
            "user_id": user_id,
            "session_type": "practice",
            "task_mode": data.task_mode,
            "exam_title": data.exam_title,
            "overall_status": "in_progress",
            "created_at": datetime.now(timezone.utc),
            "last_updated": datetime.now(timezone.utc),
            "tasks": {
                str(data.task_type): {
                    "status": "submitted",
                    "question": data.question,
                    "essay": data.essay,
                    "result": result
                }
            }
        }
        await db.exams.insert_one(new_doc)
    else:
        await db.exams.update_one(
            {"_id": ObjectId(data.session_id)},
            {"$set": update_data}
        )
    return True

async def get_user_history(user_id: str, mode: str = "practice", source_exam_id: Optional[str] = None):
    query = {"user_id": user_id}
    if mode != "all":
        query["session_type"] = mode
    if source_exam_id:
        query["source_exam_id"] = source_exam_id
        
    exams = await db.exams.find(query).sort("last_updated", -1).to_list(100)
    history = []
    for exam in exams:
        status = exam.get("overall_status", "in_progress")
        task_mode = exam.get("task_mode", "unknown")
        tasks = exam.get("tasks", {})
        
        overalls = []
        heatmaps = []
        for task_key, task_data in tasks.items():
            res = task_data.get("result")
            if res and res.get("overall"):
                overalls.append(res["overall"])
                heatmaps.extend(res.get("heatmap", []))
        
        overall_score = exam.get("overall")
        if overall_score is None and overalls:
            if task_mode == 'both' and len(overalls) == 2:
                t1_score = tasks.get("1", {}).get("result", {}).get("overall", 0)
                t2_score = tasks.get("2", {}).get("result", {}).get("overall", 0)
                raw_avg = (t1_score * (1/3)) + (t2_score * (2/3))
            else:
                raw_avg = sum(overalls) / len(overalls)
                
            from services import ielts_rounding_standard # Local import to avoid circular dep
            overall_score = ielts_rounding_standard(raw_avg)

        question_title = exam.get("exam_title")
        if not question_title:
            question_title = "Full Test (Task 1 & Task 2)" if task_mode == "both" else (
                tasks.get("1", {}).get("question") if task_mode == "task1" else tasks.get("2", {}).get("question")
            )
        
        item = {
            "_id": str(exam["_id"]),
            "created_at": exam.get("last_updated", exam.get("created_at")),
            "question": question_title or "Exam Task",
            "task_mode": task_mode,
            "overall": overall_score,
            "word_count": sum(len(t.get("essay", "").split()) for t in tasks.values() if t.get("essay")),
            "heatmap": heatmaps,
            "status": status,
            "tasks": tasks,
            "source_exam_id": exam.get("source_exam_id"),
            "total_time_spent": exam.get("total_time_spent", 0),
            "session_type": exam.get("session_type", "practice")
        }

        history.append(item)
    return history


async def delete_essay(essay_id: str):
    await db.exams.delete_one({"_id": ObjectId(essay_id), "session_type": "practice"})
    return True

async def save_essay_outline(data: dict):
    # Ensure created_at is present
    if "created_at" not in data:
        from datetime import datetime, timezone
        data["created_at"] = datetime.now(timezone.utc)
    
    # Generate question hash for sharing across identical questions
    import hashlib
    question_hash = hashlib.md5(data["question"].strip().lower().encode()).hexdigest()
    data["question_hash"] = question_hash
    
    await db.essay_outlines.update_one(
        {"question_hash": question_hash, "task_type": data["task_type"]},
        {"$set": data},
        upsert=True
    )
    return True

async def get_essay_outline(question_hash: str, task_type: int):
    return await db.essay_outlines.find_one({"question_hash": question_hash, "task_type": task_type})

async def delete_all_user_essays(user_id: str):
    await db.exams.delete_many({"user_id": user_id, "session_type": "practice"})
    return True

async def delete_batch_essays(ids: List[str]):
    object_ids = [ObjectId(id) for id in ids]
    await db.exams.delete_many({"_id": {"$in": object_ids}, "session_type": "practice"})
    return True

async def save_exam_session(session_data: dict):
    session_id = session_data.get("id") or session_data.get("_id")
    to_save = {k: v for k, v in session_data.items() if k not in ["id", "_id"]}
    to_save["last_updated"] = datetime.now(timezone.utc)

    if session_id:
        await db.exams.update_one({"_id": ObjectId(session_id)}, {"$set": to_save})
        return session_id
    else:
        to_save["created_at"] = datetime.now(timezone.utc)
        result = await db.exams.insert_one(to_save)
        return str(result.inserted_id)

async def get_active_exam_session(user_id: str, session_id: Optional[str] = None):
    filter_query = {"user_id": user_id, "overall_status": "in_progress"}
    if session_id:
        filter_query = {"user_id": user_id, "_id": ObjectId(session_id)}
        
    session = await db.exams.find(filter_query).sort("last_updated", -1).limit(1).to_list(1)
    if session:
        s = session[0]
        s["_id"] = str(s["_id"])
        return s
    return None

async def submit_full_exam(session_data: dict):
    session_id = session_data.get("id") or session_data.get("_id")
    source_exam_id = session_data.get("source_exam_id")
    if not session_id or session_id == "quick-score":
        return False
        
    to_save = {k: v for k, v in session_data.items() if k not in ["id", "_id"]}
    to_save["overall_status"] = "completed"
    to_save["last_updated"] = datetime.now(timezone.utc)
    
    await db.exams.update_one({"_id": ObjectId(session_id)}, {"$set": to_save}, upsert=True)
    
    if source_exam_id:
        try:
            await db.ielts_exams.update_one({"_id": ObjectId(source_exam_id)}, {"$inc": {"participants_count": 1}})
        except: pass
    return True

async def delete_exam_session(user_id: str, session_id: Optional[str] = None):
    if session_id:
        await db.exams.delete_one({"_id": ObjectId(session_id)})
    else:
        await db.exams.delete_one({"user_id": user_id, "overall_status": "in_progress"})
    return True

async def delete_all_user_exams(user_id: str):
    await db.exams.delete_many({"user_id": user_id})
    return True

async def delete_batch_exams(ids: List[str]):
    object_ids = [ObjectId(id) for id in ids]
    await db.exams.delete_many({"_id": {"$in": object_ids}})
    return True

async def get_exam_library(search_query: str = "", limit: int = 50, user_id: Optional[str] = None):
    query = {}
    if search_query:
        query = {
            "$or": [
                {"lesson": {"$regex": search_query, "$options": "i"}},
                {"task1.prompt": {"$regex": search_query, "$options": "i"}},
                {"task2.prompt": {"$regex": search_query, "$options": "i"}}
            ]
        }
    cursor = db.ielts_exams.find(query).sort([("year", -1), ("month", -1)]).limit(limit)
    exams = await cursor.to_list(limit)
    exam_ids = [str(exam["_id"]) for exam in exams]
    
    # Aggregations
    participants_pipeline = [
        {"$match": {"source_exam_id": {"$in": exam_ids}}},
        {"$group": {"_id": {"source_exam_id": "$source_exam_id", "user_id": "$user_id"}}},
        {"$group": {"_id": "$_id.source_exam_id", "unique_users": {"$sum": 1}}}
    ]
    participants_data = await db.exams.aggregate(participants_pipeline).to_list(None)
    participants_map = {item["_id"]: item["unique_users"] for item in participants_data}
    
    comments_pipeline = [
        {"$match": {"exam_id": {"$in": exam_ids}}},
        {"$group": {"_id": "$exam_id", "comments_count": {"$sum": 1}}}
    ]
    comments_data = await db.exam_comments.aggregate(comments_pipeline).to_list(None)
    comments_map = {item["_id"]: item["comments_count"] for item in comments_data}
    
    completed_exam_ids = set()
    if user_id:
        user_exams = await db.exams.find({"user_id": user_id, "source_exam_id": {"$in": exam_ids}}, {"source_exam_id": 1}).to_list(None)
        completed_exam_ids = {str(item["source_exam_id"]) for item in user_exams if item.get("source_exam_id")}
    
    results = []
    for exam in exams:
        title_parts = [exam.get("lesson"), f"Tháng {exam['month']}" if exam.get("month") != -1 else None, str(exam.get("year")) if exam.get("year") != -1 else None]
        title = " - ".join(filter(None, title_parts)) or "Đề thi IELTS Writing"
        if all(x not in title for x in ["Bài", "Ngày", "Đề thi"]):
            title = f"Bài mẫu IELTS Writing {title}"
            
        tags = ["#IELTS Academic", "#Writing"]
        if exam.get("task1"): tags.append("#Task1")
        if exam.get("task2"): tags.append("#Task2")
        
        parts_count = (1 if exam.get("task1") else 0) + (1 if exam.get("task2") else 0)
        exam_id_str = str(exam["_id"])
        results.append({
            "id": exam_id_str,
            "title": title,
            "year": exam.get("year", 2025),
            "tags": tags,
            "participants_count": participants_map.get(exam_id_str, exam.get("participants_count", 0)),
            "comments_count": comments_map.get(exam_id_str, exam.get("comments_count", 0)),
            "time_minutes": 60 if parts_count == 2 else (20 if exam.get("task1") else 40),
            "parts_count": parts_count,
            "is_completed": exam_id_str in completed_exam_ids
        })
    return results

async def get_exam_detail(exam_id: str):
    exam = await db.ielts_exams.find_one({"_id": ObjectId(exam_id)})
    if not exam: return None
    
    title_parts = [exam.get("lesson"), f"Tháng {exam['month']}" if exam.get("month") != -1 else None, str(exam.get("year")) if exam.get("year") != -1 else None]
    title = " - ".join(filter(None, title_parts)) or "Đề thi IELTS Writing"
    
    participants_pipeline = [{"$match": {"source_exam_id": exam_id}}, {"$group": {"_id": "$user_id"}}]
    participants_data = await db.exams.aggregate(participants_pipeline).to_list(None)
    participants_count = len(participants_data) if participants_data else exam.get("participants_count", 0)
    comments_count = await db.exam_comments.count_documents({"exam_id": exam_id})
        
    return {
        "id": str(exam["_id"]),
        "title": title,
        "year": exam.get("year", 2025),
        "participants_count": participants_count,
        "comments_count": comments_count if comments_count > 0 else exam.get("comments_count", 0),
        "task1": exam.get("task1"),
        "task2": exam.get("task2")
    }

# --- COMMENT CRUD ---

async def get_comments(exam_id: str):
    cursor = db.exam_comments.find({"exam_id": exam_id}).sort("created_at", 1)
    all_comments = await cursor.to_list(None)
    comment_map = {}
    roots = []
    
    for doc in all_comments:
        comment = {
            "id": str(doc["_id"]),
            "exam_id": doc["exam_id"],
            "user_id": doc["user_id"],
            "username": doc["username"],
            "content": doc["content"],
            "parent_id": doc.get("parent_id"),
            "likes": doc.get("likes", 0),
            "reactions": doc.get("reactions", {}),
            "created_at": doc["created_at"].replace(tzinfo=timezone.utc).isoformat() if hasattr(doc["created_at"], "isoformat") else str(doc["created_at"]),
            "replies": []
        }
        comment_map[comment["id"]] = comment
        
    for comment in comment_map.values():
        parent_id = comment["parent_id"]
        if parent_id and parent_id in comment_map:
            comment_map[parent_id]["replies"].append(comment)
        else:
            roots.append(comment)
                
    roots.sort(key=lambda x: x["created_at"], reverse=True)
    return roots

async def create_comment(data: dict):
    doc = {
        "exam_id": data["exam_id"],
        "user_id": data["user_id"],
        "username": data["username"],
        "content": data["content"],
        "parent_id": data.get("parent_id"),
        "likes": 0,
        "liked_by": [],
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.exam_comments.insert_one(doc)
    try:
        await db.ielts_exams.update_one({"_id": ObjectId(data["exam_id"])}, {"$inc": {"comments_count": 1}})
    except: pass
    
    comment_res = doc.copy()
    comment_res["id"] = str(result.inserted_id)
    comment_res["created_at"] = doc["created_at"].replace(tzinfo=timezone.utc).isoformat()
    comment_res["replies"] = []
    return comment_res

async def toggle_reaction_comment(comment_id: str, user_id: str, reaction_type: str = "👍"):
    doc = await db.exam_comments.find_one({"_id": ObjectId(comment_id)})
    if not doc: return None
        
    reactions = doc.get("reactions", {})
    if reaction_type not in reactions: reactions[reaction_type] = []
        
    if user_id in reactions[reaction_type]:
        reactions[reaction_type].remove(user_id)
    else:
        reactions[reaction_type].append(user_id)
        
    for r_type in list(reactions.keys()):
        if r_type != reaction_type and user_id in reactions[r_type]:
            reactions[r_type].remove(user_id)
            
    reactions = {k: v for k, v in reactions.items() if v}
    total_likes = sum(len(v) for v in reactions.values())
    
    await db.exam_comments.update_one(
        {"_id": ObjectId(comment_id)},
        {"$set": {"reactions": reactions, "likes": total_likes}}
    )
    return {"reactions": reactions, "likes": total_likes}

async def delete_comment(comment_id: str, user_id: str):
    doc = await db.exam_comments.find_one({"_id": ObjectId(comment_id)})
    if not doc: raise Exception("Comment khong ton tai")
    if doc["user_id"] != user_id: raise Exception("Khong co quyen xoa comment nay")
    await db.exam_comments.delete_many({"parent_id": comment_id})
    await db.exam_comments.delete_one({"_id": ObjectId(comment_id)})
    try:
        await db.ielts_exams.update_one({"_id": ObjectId(doc["exam_id"])}, {"$inc": {"comments_count": -1}})
    except: pass

async def get_user_profile(user_id: str):
    # Update last_seen whenever profile is fetched (acts as a heartbeat)
    now = datetime.now(timezone.utc)
    await db.users.update_one({"username": user_id}, {"$set": {"last_seen": now}})
    
    user = await db.users.find_one({"username": user_id})
    if not user: return None
    
    # Calculate streak for profile
    exams = await db.exams.find({"user_id": user_id, "overall_status": "completed"}).sort("last_updated", -1).to_list(100)
    submission_dates = sorted(list(set(exam["last_updated"].astimezone(timezone.utc).date() for exam in exams)), reverse=True)
    
    streak = 0
    today = now.date()
    if submission_dates:
        current_check = today
        if submission_dates[0] < today:
            if (today - submission_dates[0]).days == 1:
                current_check = submission_dates[0]
            else:
                current_check = None
        
        if current_check:
            for d in submission_dates:
                if d == current_check:
                    streak += 1
                    current_check = current_check - timedelta(days=1)
                elif d > current_check:
                    continue
                else:
                    break
    
    return UserProfile(
        email=user["email"],
        username=user["username"],
        full_name=user.get("full_name"),
        bio=user.get("bio"),
        avatar_url=user.get("avatar_url"),
        created_at=user["created_at"],
        last_seen=user.get("last_seen"),
        target_band=user.get("target_band", 7.0),
        streak=streak,
        total_essays=len(exams)
    )

async def update_user_profile(user_id: str, data: dict):
    await db.users.update_one({"username": user_id}, {"$set": data})

async def update_user_avatar(user_id: str, avatar_url: str):
    await db.users.update_one({"username": user_id}, {"$set": {"avatar_url": avatar_url}})

async def update_user_password(user_id: str, current_password: str, new_password: str):
    user = await db.users.find_one({"username": user_id})
    if not user:
        return False, "Người dùng không tồn tại."
    
    if not user.get("password"):
        return False, "Tài khoản Google không thể đổi mật khẩu trực tiếp."

    if not verify_password(current_password, user["password"]):
        return False, "Mật khẩu hiện tại không chính xác."
    
    hashed_password = get_password_hash(new_password)
    await db.users.update_one(
        {"username": user_id},
        {"$set": {"password": hashed_password}}
    )
    return True, "Đổi mật khẩu thành công!"

async def get_leaderboard(sort_by: str = "average_band", limit: int = 100):
    # 1. Fetch all registered users
    all_users = await db.users.find().to_list(None)
    
    # 2. Aggregate stats from exams collection
    pipeline = [
        {"$match": {"overall_status": "completed"}},
        {
            "$group": {
                "_id": "$user_id",
                "total_essays": {"$sum": 1},
                "scores": {"$push": "$overall"},
                "submission_dates": {"$addToSet": {"$dateToString": {"format": "%Y-%m-%d", "date": "$last_updated"}}}
            }
        },
        {
            "$project": {
                "user_id": "$_id",
                "total_essays": 1,
                "average_band": {"$avg": "$scores"},
                "submission_dates": 1
            }
        }
    ]
    
    raw_stats = await db.exams.aggregate(pipeline).to_list(None)
    stats_map = {s["user_id"]: s for s in raw_stats}
    
    leaderboard = []
    now = datetime.now(timezone.utc)
    today = now.date()
    from services import ielts_rounding_standard
    
    for user in all_users:
        username = user["username"]
        stat = stats_map.get(username)
        
        streak = 0
        dates = []
        avg_band = 0
        total_essays = 0
        last_active = None
        
        if stat:
            dates = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in stat["submission_dates"]], reverse=True)
            # Calculate streak
            if dates:
                current_check = today
                if dates[0] < today:
                    if (today - dates[0]).days == 1:
                        current_check = dates[0]
                    else:
                        current_check = None
                
                if current_check:
                    for d in dates:
                        if d == current_check:
                            streak += 1
                            current_check = current_check - timedelta(days=1)
                        elif d > current_check:
                            continue
                        else:
                            break
            
            avg_band = ielts_rounding_standard(stat["average_band"] or 0)
            total_essays = stat["total_essays"]
            last_active = dates[0].isoformat() if dates else None

        # Check online status (active in last 5 minutes)
        is_online = False
        last_seen = user.get("last_seen")
        if last_seen:
            # Ensure last_seen is timezone-aware for comparison
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            if (now - last_seen).total_seconds() < 300: # 5 minutes
                is_online = True

        leaderboard.append({
            "username": username,
            "full_name": user.get("full_name"),
            "avatar_url": user.get("avatar_url"),
            "average_band": avg_band,
            "total_essays": total_essays,
            "streak": streak,
            "last_active": last_active,
            "is_online": is_online
        })
    
    # 3. Sort and limit
    # Primary sort by the selected criteria (descending)
    # Secondary sort by full_name or username (ascending) for alphabetical order
    sort_key = sort_by if sort_by in ["average_band", "total_essays", "streak"] else "average_band"
    
    leaderboard.sort(key=lambda x: (-x[sort_key], (x["full_name"] or x["username"]).lower()))
    
    return leaderboard[:limit]

async def find_vocab_matches(word_list: List[str], band_range: str):
    cursor = db.vocabulary.find({
        "basic_word": {"$in": word_list},
        "band_range": band_range
    })
    return await cursor.to_list(None)

async def get_model_answers(question_hash: str):
    cursor = db.model_answers.find({"question_hash": question_hash}).sort("target_band", 1)
    return await cursor.to_list(None)

async def get_model_answer_by_band(question_hash: str, target_band: float):
    return await db.model_answers.find_one({
        "question_hash": question_hash,
        "target_band": target_band
    })

async def save_model_answer(data: dict):
    """Lưu bài mẫu vào database"""
    import hashlib
    # Normalize question for hashing
    question_hash = hashlib.md5(data["question"].strip().lower().encode()).hexdigest()
    
    doc = {
        "question_hash": question_hash,
        "question": data["question"],
        "task_type": data["task_type"],
        "target_band": data["target_band"],
        "essay": data["essay"],
        "word_count": data["word_count"],
        "key_points": data["key_points"],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.model_answers.update_one(
        {"question_hash": question_hash, "target_band": data["target_band"]},
        {"$set": doc},
        upsert=True
    )
    return True
