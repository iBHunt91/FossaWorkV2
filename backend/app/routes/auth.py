"""
Authentication Routes
Handles login, token refresh, and user verification using WorkFossa credentials
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any

from ..database import get_db
from ..auth.security import (
    AuthenticationService,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_HOURS
)
from ..models.user_models import User
from ..services.logging_service import LoggingService
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["authentication"])

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    username: str
    is_new_user: bool

class LoginRequest(BaseModel):
    username: str
    password: str

class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    created_at: str
    last_login: str

@router.post("/login", response_model=Token)
async def login(
    form_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login with WorkFossa credentials
    - Verifies credentials with WorkFossa
    - Creates new user profile if first login
    - Returns JWT access token
    """
    auth_service = AuthenticationService(db)
    
    # Check if this is the first user (no users exist)
    user_count = db.query(User).count()
    is_first_user = user_count == 0
    
    # Authenticate with WorkFossa
    user = await auth_service.authenticate_with_workfossa(
        form_data.username,
        form_data.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid WorkFossa credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if this is a new user
    is_new_user = user.created_at == user.last_login
    
    # Create access token
    access_token_expires = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    access_token = create_access_token(
        data={"sub": user.id, "username": user.username},
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        is_new_user=is_new_user
    )

@router.post("/verify", response_model=Dict[str, Any])
async def verify_credentials(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Verify WorkFossa credentials without creating a session
    Useful for credential validation before saving
    """
    auth_service = AuthenticationService(db)
    
    # Just verify credentials without creating user
    from ..services.workfossa_automation import WorkFossaAutomation
    workfossa = WorkFossaAutomation()
    
    session_id = f"verify_{credentials.username}_{datetime.now().timestamp()}"
    result = await workfossa.verify_credentials(
        session_id,
        credentials.username,
        credentials.password
    )
    
    return {
        "valid": result.get("success", False),
        "message": result.get("message", "Verification failed")
    }

@router.get("/me", response_model=UserInfo)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user information"""
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
        last_login=current_user.last_login.isoformat() if current_user.last_login else ""
    )

@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout current user
    Note: With JWT, we can't invalidate tokens server-side
    Client should remove the token
    """
    return {"message": "Successfully logged out"}

@router.get("/check")
async def check_auth_status(db: Session = Depends(get_db)):
    """
    Check if any users exist in the system
    Helps frontend determine if it should show login or setup screen
    """
    user_count = db.query(User).count()
    
    return {
        "has_users": user_count > 0,
        "user_count": user_count,
        "requires_setup": user_count == 0
    }