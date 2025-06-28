"""
Simplified Authentication Routes
Single WorkFossa authentication flow with database-only credential storage
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import logging

from ..database import get_db
from ..auth.security import (
    create_access_token,
    get_current_user,
    get_optional_current_user,
    ACCESS_TOKEN_EXPIRE_HOURS
)
from ..models.user_models import User, UserCredential, UserPreference, generate_user_id
from ..services.workfossa_automation import WorkFossaAutomationService
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["authentication"])

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str

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

class AuthenticationService:
    """Simplified authentication service using only database storage"""
    
    def __init__(self, db: Session) -> None:
        self.db = db
        self.workfossa = WorkFossaAutomationService()
    
    async def authenticate_with_workfossa(self, username: str, password: str) -> Optional[tuple[User, bool]]:
        """
        Authenticate user with WorkFossa credentials
        Returns tuple of (User, is_new_user) or None if authentication fails
        """
        try:
            logger.info(f"Authenticating with WorkFossa: {username}")
            
            # Basic validation
            if not username or not password:
                logger.warning("Missing username or password")
                return None
            
            # Verify credentials with WorkFossa
            session_id = f"auth_{username}_{datetime.utcnow().timestamp()}"
            verification_result = await self.workfossa.verify_credentials(
                session_id=session_id,
                username=username,
                password=password
            )
            
            if not verification_result.get("success", False):
                logger.warning(f"WorkFossa verification failed: {verification_result.get('message', 'Unknown')}")
                return None
                
            logger.info(f"WorkFossa credentials verified for: {username}")
            
            # Generate user ID from email/username
            user_id = generate_user_id(username)
            
            # Check if user already exists
            existing_user = self.db.query(User).filter(User.id == user_id).first()
            
            if existing_user:
                # Update existing user
                existing_user.last_used = datetime.utcnow()
                
                # Update or create WorkFossa credentials in database
                credential = self.db.query(UserCredential).filter(
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
                    self.db.add(credential)
                
                self.db.commit()
                return existing_user, False
            
            # Create new user profile
            logger.info(f"Creating new user profile for: {username}")
            
            # Extract display name from email
            email_prefix = username.split('@')[0]
            name_parts = email_prefix.split('.')
            first_name = name_parts[0].title() if name_parts else email_prefix.title()
            last_name = name_parts[1].title() if len(name_parts) > 1 else ""
            display_name = f"{first_name} {last_name}".strip()
            
            new_user = User(
                id=user_id,
                email=username,
                password_hash="",  # No password hash needed for WorkFossa-only auth
                label=display_name,
                friendly_name=first_name,
                created_at=datetime.utcnow()
            )
            
            self.db.add(new_user)
            
            # Store encrypted WorkFossa credentials in database
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
            self.db.add(credential)
            
            # Set default preferences
            default_preferences = [
                UserPreference(
                    user_id=user_id,
                    category="notification_settings",
                    settings={
                        "email": {"enabled": True, "frequency": "immediate"},
                        "pushover": {"enabled": False}
                    }
                ),
                UserPreference(
                    user_id=user_id,
                    category="work_week",
                    settings={
                        "monday": True, "tuesday": True, "wednesday": True,
                        "thursday": True, "friday": True, "saturday": False, "sunday": False
                    }
                )
            ]
            
            for pref in default_preferences:
                self.db.add(pref)
            
            self.db.commit()
            
            logger.info(f"Successfully created new user profile: {user_id}")
            return new_user, True
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            self.db.rollback()
            return None

@router.post("/login", response_model=Token)
async def login(
    form_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login with WorkFossa credentials
    - Verifies credentials with WorkFossa
    - Creates new user profile if first login
    - Returns minimal JWT access token
    """
    auth_service = AuthenticationService(db)
    
    # Authenticate with WorkFossa
    auth_result = await auth_service.authenticate_with_workfossa(
        form_data.username,
        form_data.password
    )
    
    if not auth_result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid WorkFossa credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user, is_new_user = auth_result
    
    # Create minimal access token
    access_token_expires = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email},
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email
    )

@router.post("/verify")
async def verify_credentials(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Verify WorkFossa credentials without creating a session
    Synchronous operation - no complex tracking
    """
    workfossa = WorkFossaAutomationService()
    
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
        username=current_user.label or current_user.email,
        email=current_user.email,
        is_active=True,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
        last_login=current_user.last_used.isoformat() if current_user.last_used else ""
    )

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
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

@router.get("/status")
async def auth_status(
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Check authentication status - returns whether a user is currently authenticated
    This endpoint does not require authentication
    """
    is_authenticated = current_user is not None
    
    return {
        "authenticated": is_authenticated,
        "user": {
            "id": current_user.id,
            "username": current_user.label or current_user.email,
            "email": current_user.email
        } if is_authenticated else None
    }