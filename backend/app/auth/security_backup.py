"""
Security and Authentication Module
Handles JWT tokens and user authentication using WorkFossa credentials
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple, Union, Callable
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user_models import User, generate_user_id
from ..services.credential_manager_deprecated import CredentialManager
from ..services.workfossa_automation import WorkFossaAutomationService
import os
import logging

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

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token authentication
security = HTTPBearer(auto_error=False)

class AuthenticationService:
    """Handles authentication using WorkFossa credentials"""
    
    def __init__(self, db: Session) -> None:
        self.db = db
        self.credential_manager = CredentialManager()
        self.workfossa = WorkFossaAutomationService()
    
    async def authenticate_with_workfossa(self, username: str, password: str, verification_id: Optional[str] = None, status_callback: Optional[Callable[[str, str, int], None]] = None) -> Optional[Tuple[User, bool]]:
        """
        Authenticate user with WorkFossa credentials
        If successful and user doesn't exist, create new user profile
        Returns tuple of (User, is_new_user) or (None, False) if authentication fails
        """
        try:
            # Verify credentials with WorkFossa
            logger.info(f"Attempting WorkFossa authentication for user: {username}")
            
            # Basic validation
            if not username or not password:
                logger.warning(f"[AUTH] Missing username or password")
                return None
            
            logger.info(f"[AUTH] Starting WorkFossa verification for: {username}")
            
            # Verify credentials with WorkFossa
            if status_callback:
                status_callback("verifying", "Verifying credentials with WorkFossa...", 40)
            
            session_id = f"auth_{username}_{datetime.utcnow().timestamp()}"
            logger.info(f"[AUTH] Creating verification session: {session_id}")
            
            verification_result = await self.workfossa.verify_credentials(
                session_id=session_id,
                username=username,
                password=password,
                status_callback=status_callback
            )
            
            logger.info(f"[AUTH] Verification result: {verification_result}")
            
            if not verification_result.get("success", False):
                logger.warning(f"[AUTH] WorkFossa verification failed for user: {username}")
                logger.warning(f"[AUTH] Failure reason: {verification_result.get('message', 'Unknown')}")
                return None
                
            logger.info(f"[AUTH] WorkFossa credentials verified for: {username}")
            
            # Generate user ID from email/username
            user_id = generate_user_id(username)
            
            # Check if user already exists
            existing_user = self.db.query(User).filter(User.id == user_id).first()
            
            if existing_user:
                logger.info(f"Existing user found: {user_id}")
                # Update last used timestamp
                existing_user.last_used = datetime.utcnow()
                
                # Update or create WorkFossa credentials
                from ..models.user_models import UserCredential
                credential = self.db.query(UserCredential).filter(
                    UserCredential.user_id == user_id,
                    UserCredential.service_name == "workfossa"
                ).first()
                
                if credential:
                    # Update existing credentials using secure methods
                    credential.set_username(username)
                    credential.set_password(password)
                    credential.is_verified = True
                    credential.last_verified = datetime.utcnow()
                    logger.info(f"Updated WorkFossa credentials for user: {user_id}")
                else:
                    # Create new credentials using secure methods
                    credential = UserCredential(
                        user_id=user_id,
                        service_name="workfossa",
                        encrypted_username="",  # Will be set securely below
                        encrypted_password="",  # Will be set securely below
                        is_active=True,
                        is_verified=True,
                        last_verified=datetime.utcnow()
                    )
                    # Use secure methods to set credentials
                    credential.set_username(username)
                    credential.set_password(password)
                    self.db.add(credential)
                    logger.info(f"Created WorkFossa credentials for user: {user_id}")
                
                # Also update in credential manager
                from ..services.credential_manager_deprecated import WorkFossaCredentials
                workfossa_creds = WorkFossaCredentials(
                    username=username,
                    password=password,
                    user_id=user_id,
                    is_valid=True
                )
                self.credential_manager.store_credentials(workfossa_creds)
                
                self.db.commit()
                return existing_user, False  # Not a new user
            
            # Create new user profile
            logger.info(f"Creating new user profile for: {username}")
            
            # Extract display name from email format (firstname.lastname@domain.com)
            email_prefix = username.split('@')[0]
            name_parts = email_prefix.split('.')
            
            # Extract first and last name
            first_name = name_parts[0].title() if name_parts else email_prefix.title()
            last_name = name_parts[1].title() if len(name_parts) > 1 else ""
            display_name = f"{first_name} {last_name}".strip()
            
            new_user = User(
                id=user_id,
                email=username,  # WorkFossa uses email as username
                password_hash=pwd_context.hash(password),  # Store hashed password
                label=display_name,  # Full display name
                friendly_name=first_name,  # First name only
                created_at=datetime.utcnow()
            )
            
            self.db.add(new_user)
            
            # Store encrypted WorkFossa credentials using credential manager
            from ..services.credential_manager_deprecated import WorkFossaCredentials
            
            workfossa_creds = WorkFossaCredentials(
                username=username,
                password=password,
                user_id=user_id,
                is_valid=True
            )
            
            # Store in credential manager's secure storage
            self.credential_manager.store_credentials(workfossa_creds)
            
            # Also store in database for backward compatibility using secure methods
            from ..models.user_models import UserCredential
            credential = UserCredential(
                user_id=user_id,
                service_name="workfossa",
                encrypted_username="",  # Will be set securely below
                encrypted_password="",  # Will be set securely below
                is_active=True,
                is_verified=True,
                last_verified=datetime.utcnow()
            )
            # Use secure methods to set credentials
            credential.set_username(username)
            credential.set_password(password)
            
            self.db.add(credential)
            
            # Set default preferences
            from ..models.user_models import UserPreference
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
            return new_user, True  # This is a new user
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            self.db.rollback()
            return None, False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
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
    
    # User model doesn't have is_active field, so we skip this check
    # All authenticated users are considered active
    
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