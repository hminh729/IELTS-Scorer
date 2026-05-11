import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from dotenv import load_dotenv
import bcrypt
import hashlib

load_dotenv()

# Cấu hình JWT
JWT_SECRET = os.getenv("JWT_SECRET", "8f92176b9f2d5d8e7b1a2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 ngày

def verify_password(plain_password, hashed_password):
    try:
        if not isinstance(plain_password, str):
            plain_password = str(plain_password)
        
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')

        # 1. Try new method (SHA-256 pre-hash)
        password_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
        if bcrypt.checkpw(password_hash.encode('utf-8'), hashed_password):
            return True
            
        # 2. Try legacy method (plain password) for backward compatibility
        # This will work for passwords previously hashed without SHA-256
        encoded_pwd = plain_password.encode('utf-8')
        # Bcrypt internally truncates to 72 bytes, but we can pass it as is
        # or truncate to be explicit. Direct bcrypt library will handle it.
        if bcrypt.checkpw(encoded_pwd, hashed_password):
            return True
            
        return False
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False

def get_password_hash(password):
    if not isinstance(password, str):
        password = str(password)
        
    # Pre-hash with SHA-256 to handle passwords > 72 bytes safely
    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    encoded_pwd = password_hash.encode('utf-8')
        
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(encoded_pwd, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload if payload.get("exp") >= datetime.now(timezone.utc).timestamp() else None
    except JWTError:
        return None
