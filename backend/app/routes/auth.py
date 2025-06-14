"""
Authentication Routes
Handles login, token refresh, and user verification using WorkFossa credentials
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import asyncio
import uuid

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

# Store verification status for real-time updates
verification_status = {}

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    username: str
    is_new_user: bool
    user: Dict[str, str]

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

class VerificationStatus(BaseModel):
    verification_id: str
    status: str  # "pending", "checking", "logging_in", "success", "failed"
    message: str
    progress: int  # 0-100

@router.post("/login", response_model=Token)
async def login(
    form_data: LoginRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Login with WorkFossa credentials
    - Verifies credentials with WorkFossa
    - Creates new user profile if first login
    - Returns JWT access token
    """
    auth_service = AuthenticationService(db)
    verification_id = str(uuid.uuid4())
    
    # Initialize verification status
    verification_status[verification_id] = {
        "status": "pending",
        "message": "Starting WorkFossa verification...",
        "progress": 0
    }
    
    # Check if this is the first user (no users exist)
    user_count = db.query(User).count()
    is_first_user = user_count == 0
    
    # Update status
    verification_status[verification_id] = {
        "status": "checking",
        "message": "Connecting to WorkFossa...",
        "progress": 20
    }
    
    # Authenticate with WorkFossa
    auth_result = await auth_service.authenticate_with_workfossa(
        form_data.username,
        form_data.password,
        verification_id=verification_id,
        status_callback=lambda status, msg, progress: verification_status.update({
            verification_id: {"status": status, "message": msg, "progress": progress}
        })
    )
    
    if not auth_result or not auth_result[0]:
        user, is_new_user = None, False
    else:
        user, is_new_user = auth_result
    
    if not user:
        verification_status[verification_id] = {
            "status": "failed",
            "message": "Invalid WorkFossa credentials",
            "progress": 100
        }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid WorkFossa credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # is_new_user is already determined by the authentication service
    
    # Create access token
    access_token_expires = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    access_token = create_access_token(
        data={"sub": user.id, "username": user.email},  # Using email as username
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        username=user.label or user.email,  # Use display name if available
        is_new_user=is_new_user,
        user={
            "id": user.id,
            "email": user.email,
            "username": user.label or user.email,  # Use display name if available
            "display_name": user.label,
            "friendly_name": user.friendly_name
        }
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
        username=current_user.label or current_user.email,  # Use display name if available
        email=current_user.email,
        is_active=True,  # Always true for authenticated users
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
        last_login=current_user.last_used.isoformat() if current_user.last_used else ""  # Using last_used instead of last_login
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

@router.get("/verification-status/{verification_id}", response_model=VerificationStatus)
async def get_verification_status(verification_id: str):
    """Get the current status of a credential verification"""
    if verification_id not in verification_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification ID not found"
        )
    
    status_data = verification_status[verification_id]
    return VerificationStatus(
        verification_id=verification_id,
        status=status_data["status"],
        message=status_data["message"],
        progress=status_data["progress"]
    )