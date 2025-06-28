"""
Simplified Security and Authentication Module
Single authentication flow using only database credential storage
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import os
import logging

from ..database import get_db
from ..models.user_models import User

logger = logging.getLogger(__name__)

# Security settings
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY environment variable is not set. "
        "Please set a secure secret key in your .env file. "
        "You can generate one using: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Bearer token authentication
security = HTTPBearer(auto_error=False)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create minimal JWT access token with only essential data"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    # Minimal payload: only user_id, email, and expiry
    minimal_payload = {
        "sub": to_encode.get("sub"),  # user_id
        "email": to_encode.get("email"),
        "exp": expire
    }
    
    encoded_jwt = jwt.encode(minimal_payload, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current authenticated user from JWT token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None

def get_user_credentials(user_id: str, db: Session) -> Optional[tuple[str, str]]:
    """
    Get WorkFossa credentials for user from database
    Returns tuple of (username, password) or None if not found
    """
    from ..models.user_models import UserCredential
    
    credential = db.query(UserCredential).filter(
        UserCredential.user_id == user_id,
        UserCredential.service_name == "workfossa",
        UserCredential.is_active == True
    ).first()
    
    if not credential:
        logger.warning(f"No WorkFossa credentials found for user {user_id}")
        return None
    
    try:
        # Use the model's built-in decryption methods
        username = credential.username
        password = credential.password
        return username, password
    except Exception as e:
        logger.error(f"Failed to decrypt credentials for user {user_id}: {e}")
        return None

def store_user_credentials(user_id: str, username: str, password: str, db: Session) -> bool:
    """
    Store WorkFossa credentials for user in database
    Returns True if stored successfully
    """
    from ..models.user_models import UserCredential
    
    try:
        # Check if credentials already exist
        credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa"
        ).first()
        
        if credential:
            # Update existing credentials
            credential.set_username(username)
            credential.set_password(password)
            credential.is_verified = True
            credential.last_verified = datetime.utcnow()
        else:
            # Create new credentials
            credential = UserCredential(
                user_id=user_id,
                service_name="workfossa",
                encrypted_username="",
                encrypted_password="",
                is_active=True,
                is_verified=True,
                last_verified=datetime.utcnow()
            )
            credential.set_username(username)
            credential.set_password(password)
            db.add(credential)
        
        db.commit()
        logger.info(f"Stored WorkFossa credentials for user {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to store credentials for user {user_id}: {e}")
        db.rollback()
        return False