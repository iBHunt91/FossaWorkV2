"""
Security and Authentication Module
Handles JWT tokens and user authentication using WorkFossa credentials
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user_models import User, generate_user_id
from ..services.credential_manager import CredentialManager
from ..services.workfossa_automation import WorkFossaAutomationService
import os
import logging

logger = logging.getLogger(__name__)

# Security settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token authentication
security = HTTPBearer(auto_error=False)

class AuthenticationService:
    """Handles authentication using WorkFossa credentials"""
    
    def __init__(self, db: Session):
        self.db = db
        self.credential_manager = CredentialManager()
        self.workfossa = WorkFossaAutomationService()
    
    async def authenticate_with_workfossa(self, username: str, password: str) -> Optional[User]:
        """
        Authenticate user with WorkFossa credentials
        If successful and user doesn't exist, create new user profile
        """
        try:
            # Verify credentials with WorkFossa
            logger.info(f"Attempting WorkFossa authentication for user: {username}")
            
            # Create a temporary session to verify credentials
            session_id = f"auth_verify_{datetime.now().timestamp()}"
            logger.info(f"[AUTH] Calling workfossa.verify_credentials with session_id: {session_id}")
            verification_result = await self.workfossa.verify_credentials(
                session_id, username, password
            )
            
            logger.info(f"[AUTH] WorkFossa verification result: {verification_result}")
            if not verification_result.get("success"):
                logger.warning(f"WorkFossa authentication failed for user: {username}")
                return None
            
            # Generate user ID from email/username
            user_id = generate_user_id(username)
            
            # Check if user already exists
            existing_user = self.db.query(User).filter(User.id == user_id).first()
            
            if existing_user:
                logger.info(f"Existing user found: {user_id}")
                # Update last login
                existing_user.last_login = datetime.utcnow()
                self.db.commit()
                return existing_user
            
            # Create new user profile
            logger.info(f"Creating new user profile for: {username}")
            
            new_user = User(
                id=user_id,
                username=username,
                email=username,  # WorkFossa uses email as username
                hashed_password=pwd_context.hash(password),  # Store hashed password
                is_active=True,
                is_verified=True,  # Verified through WorkFossa
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow()
            )
            
            self.db.add(new_user)
            
            # Store encrypted WorkFossa credentials
            from ..models.user_models import UserCredential
            encrypted_username = self.credential_manager.encrypt_credential(username)
            encrypted_password = self.credential_manager.encrypt_credential(password)
            
            credential = UserCredential(
                user_id=user_id,
                service_name="work_fossa",
                encrypted_username=encrypted_username,
                encrypted_password=encrypted_password,
                is_active=True,
                is_verified=True,
                last_verified=datetime.utcnow()
            )
            
            self.db.add(credential)
            
            # Set default preferences
            from ..models.user_models import UserPreference
            default_preferences = [
                UserPreference(
                    user_id=user_id,
                    preference_type="notification_settings",
                    preference_data={
                        "email": {"enabled": True, "frequency": "immediate"},
                        "pushover": {"enabled": False}
                    }
                ),
                UserPreference(
                    user_id=user_id,
                    preference_type="work_week",
                    preference_data={
                        "monday": True,
                        "tuesday": True,
                        "wednesday": True,
                        "thursday": True,
                        "friday": True,
                        "saturday": False,
                        "sunday": False
                    }
                )
            ]
            
            for pref in default_preferences:
                self.db.add(pref)
            
            self.db.commit()
            
            logger.info(f"Successfully created new user profile: {user_id}")
            return new_user
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            self.db.rollback()
            return None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
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
        return None
    
    token = credentials.credentials
    
    if not token:
        return None
    
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
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
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