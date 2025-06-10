# V2 User Models Implementation

## FastAPI SQLAlchemy Models

Based on the V1 analysis, here are the complete V2 database models:

### 1. Core Models (`backend/app/models/user_models.py`)

```python
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Integer, 
    ForeignKey, UniqueConstraint, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB, UUID
import hashlib
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

Base = declarative_base()

def generate_user_id(email: str) -> str:
    """Generate MD5 hash user ID from email (V1 compatibility)"""
    return hashlib.md5(email.lower().strip().encode()).hexdigest()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(32), primary_key=True)  # MD5 hash
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)  # bcrypt hash
    label = Column(String(255))  # Display name like "Bruce Hunt"
    friendly_name = Column(String(100))  # Short name like "Bruce"
    configured_email = Column(String(255))  # Notification email
    last_used = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
    dispenser_data = relationship("UserDispenserData", back_populates="user", cascade="all, delete-orphan")
    scraped_content = relationship("UserScrapedContent", back_populates="user", cascade="all, delete-orphan")
    session = relationship("UserSession", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    def __init__(self, email: str, **kwargs):
        self.id = generate_user_id(email)
        self.email = email
        super().__init__(**kwargs)

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, unique=True)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="session")
    
    __table_args__ = (
        # Ensure only one active session at a time
        UniqueConstraint('is_active', name='one_active_user', postgresql_where=(is_active == True)),
    )

class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    category = Column(String(50), nullable=False)  # 'email', 'pushover', 'prover', 'work_week', 'notification'
    settings = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="preferences")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'category', name='unique_user_category'),
    )

class UserActivity(Base):
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    username = Column(String(255), nullable=False)
    activity_type = Column(String(100), nullable=False, index=True)  # 'login', 'settings_change', 'scrape', etc.
    details = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", back_populates="activities")

class UserDispenserData(Base):
    __tablename__ = "user_dispenser_data"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    work_order_id = Column(String(100), nullable=False, index=True)
    visit_id = Column(String(100))
    dispenser_data = Column(JSONB, nullable=False)
    metadata = Column(JSONB)  # For timestamp, user info, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="dispenser_data")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'work_order_id', name='unique_user_work_order'),
    )

class UserScrapedContent(Base):
    __tablename__ = "user_scraped_content"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    content_type = Column(String(100), nullable=False)  # 'dispenser', 'work_order', 'schedule_changes'
    content = Column(JSONB, nullable=False)
    source_url = Column(Text)
    checksum = Column(String(64))  # For detecting changes
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", back_populates="scraped_content")

# Settings models for complex preferences
class ProverSettings(Base):
    __tablename__ = "prover_settings"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    prover_id = Column(String(100), nullable=False)
    serial = Column(String(100))
    make = Column(String(255))
    preferred_fuel_type = Column(String(255))
    preferred_fuel_types = Column(JSONB)  # Array of fuel types
    priority = Column(Integer, default=1)
    full_text = Column(Text)  # Original scraped text
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'prover_id', name='unique_user_prover'),
    )
```

### 2. Pydantic Schemas (`backend/app/models/user_schemas.py`)

```python
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum

class UserBase(BaseModel):
    email: EmailStr
    label: Optional[str] = None
    friendly_name: Optional[str] = None
    configured_email: Optional[EmailStr] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    label: Optional[str] = None
    friendly_name: Optional[str] = None
    configured_email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)

class UserResponse(UserBase):
    id: str
    last_used: Optional[datetime]
    created_at: datetime
    is_active: bool = False

    class Config:
        from_attributes = True

class UserCredentialsVerify(BaseModel):
    email: EmailStr
    password: str

# Preference Categories
class PreferenceCategory(str, Enum):
    EMAIL = "email"
    PUSHOVER = "pushover"
    PROVER = "prover"
    WORK_WEEK = "work_week"
    NOTIFICATION = "notification"

class EmailSettings(BaseModel):
    recipient_email: EmailStr
    show_job_id: bool = True
    show_store_number: bool = True
    show_store_name: bool = True
    show_location: bool = True
    show_date: bool = True
    show_dispensers: bool = True

class PushoverSettings(BaseModel):
    app_token: str
    user_key: str
    preferences: Dict[str, Any] = {}
    enabled: bool = True

class WorkWeekPreference(BaseModel):
    start_day: int = Field(..., ge=0, le=6)  # 0=Sunday, 1=Monday, etc.
    end_day: int = Field(..., ge=0, le=6)
    timezone: str = "America/New_York"
    enable_rollover_notifications: bool = True

class NotificationSettings(BaseModel):
    enabled: bool = True
    email: Dict[str, Any] = {}
    pushover: Dict[str, Any] = {}

class ProverPreference(BaseModel):
    prover_id: str
    serial: str
    make: str
    preferred_fuel_type: str
    preferred_fuel_types: List[str] = []
    priority: int = 1
    full_text: Optional[str] = None

class ProverSettings(BaseModel):
    provers: List[ProverPreference] = []
    work_week_preference: Optional[WorkWeekPreference] = None
    last_updated: Optional[datetime] = None

class UserPreferenceCreate(BaseModel):
    category: PreferenceCategory
    settings: Dict[str, Any]

class UserPreferenceUpdate(BaseModel):
    settings: Dict[str, Any]

class UserPreferenceResponse(BaseModel):
    id: int
    user_id: str
    category: str
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Activity schemas
class ActivityType(str, Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    SETTINGS_CHANGE = "settings_change"
    SCRAPE = "scrape"
    FORM_AUTOMATION = "form_automation"
    FILTER_CHANGE = "filter_change"
    USER_SWITCH = "user_switch"

class UserActivityCreate(BaseModel):
    activity_type: ActivityType
    details: Optional[Dict[str, Any]] = None

class UserActivityResponse(BaseModel):
    id: int
    user_id: str
    username: str
    activity_type: str
    details: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

# Dispenser data schemas
class DispenserData(BaseModel):
    work_order_id: str
    visit_id: Optional[str] = None
    dispenser_data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class DispenserDataResponse(DispenserData):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Scraped content schemas
class ScrapedContentCreate(BaseModel):
    content_type: str
    content: Dict[str, Any]
    source_url: Optional[str] = None
    checksum: Optional[str] = None

class ScrapedContentResponse(ScrapedContentCreate):
    id: int
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Session schemas
class UserSessionResponse(BaseModel):
    user_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SetActiveUserRequest(BaseModel):
    user_id: str
```

### 3. Database Service (`backend/app/services/user_service.py`)

```python
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from typing import List, Optional, Dict, Any
from passlib.context import CryptContext
import json
from datetime import datetime, timedelta

from ..models.user_models import (
    User, UserSession, UserPreference, UserActivity, 
    UserDispenserData, UserScrapedContent, ProverSettings
)
from ..models.user_schemas import (
    UserCreate, UserUpdate, UserPreferenceCreate, 
    UserActivityCreate, DispenserData, ScrapedContentCreate
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
    def __init__(self, db: Session):
        self.db = db

    # Core user management
    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user with hashed password"""
        hashed_password = pwd_context.hash(user_data.password)
        
        db_user = User(
            email=user_data.email,
            password_hash=hashed_password,
            label=user_data.label,
            friendly_name=user_data.friendly_name,
            configured_email=user_data.configured_email
        )
        
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        
        # Create default session entry
        session = UserSession(user_id=db_user.id, is_active=False)
        self.db.add(session)
        self.db.commit()
        
        return db_user

    def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()

    def get_all_users(self) -> List[User]:
        """Get all users with their active status"""
        return self.db.query(User).join(UserSession).all()

    def update_user(self, user_id: str, user_data: UserUpdate) -> Optional[User]:
        """Update user information"""
        db_user = self.get_user(user_id)
        if not db_user:
            return None

        update_data = user_data.dict(exclude_unset=True)
        
        # Handle password hashing
        if "password" in update_data:
            update_data["password_hash"] = pwd_context.hash(update_data.pop("password"))

        for field, value in update_data.items():
            setattr(db_user, field, value)

        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def delete_user(self, user_id: str) -> bool:
        """Delete user and all associated data"""
        db_user = self.get_user(user_id)
        if not db_user:
            return False

        self.db.delete(db_user)
        self.db.commit()
        return True

    def verify_password(self, email: str, password: str) -> Optional[User]:
        """Verify user credentials"""
        user = self.get_user_by_email(email)
        if not user:
            return None
        
        if not pwd_context.verify(password, user.password_hash):
            return None
            
        return user

    # Session management
    def get_active_user(self) -> Optional[User]:
        """Get the currently active user"""
        session = self.db.query(UserSession).filter(UserSession.is_active == True).first()
        return session.user if session else None

    def set_active_user(self, user_id: str) -> bool:
        """Set the active user (V1 compatibility)"""
        # Deactivate all sessions
        self.db.query(UserSession).update({"is_active": False})
        
        # Activate target user session
        session = self.db.query(UserSession).filter(UserSession.user_id == user_id).first()
        if not session:
            return False
            
        session.is_active = True
        session.updated_at = datetime.utcnow()
        
        # Update user's last_used timestamp
        user = self.get_user(user_id)
        if user:
            user.last_used = datetime.utcnow()
        
        self.db.commit()
        return True

    # Preferences management
    def get_user_preference(self, user_id: str, category: str) -> Optional[Dict[str, Any]]:
        """Get user preference by category"""
        pref = self.db.query(UserPreference).filter(
            and_(UserPreference.user_id == user_id, UserPreference.category == category)
        ).first()
        
        return pref.settings if pref else None

    def set_user_preference(self, user_id: str, category: str, settings: Dict[str, Any]) -> UserPreference:
        """Set or update user preference"""
        pref = self.db.query(UserPreference).filter(
            and_(UserPreference.user_id == user_id, UserPreference.category == category)
        ).first()
        
        if pref:
            pref.settings = settings
            pref.updated_at = datetime.utcnow()
        else:
            pref = UserPreference(
                user_id=user_id,
                category=category,
                settings=settings
            )
            self.db.add(pref)
        
        self.db.commit()
        self.db.refresh(pref)
        return pref

    # Activity tracking
    def track_activity(self, user_id: str, username: str, activity_type: str, details: Optional[Dict[str, Any]] = None) -> UserActivity:
        """Track user activity"""
        activity = UserActivity(
            user_id=user_id,
            username=username,
            activity_type=activity_type,
            details=details or {}
        )
        
        self.db.add(activity)
        self.db.commit()
        self.db.refresh(activity)
        return activity

    def get_user_activities(self, user_id: str, limit: int = 100) -> List[UserActivity]:
        """Get user activities with limit"""
        return self.db.query(UserActivity)\
            .filter(UserActivity.user_id == user_id)\
            .order_by(desc(UserActivity.created_at))\
            .limit(limit)\
            .all()

    def get_activity_summary(self, days: int = 1) -> Dict[str, Any]:
        """Get activity summary for dashboard"""
        since = datetime.utcnow() - timedelta(days=days)
        
        # Active users count
        active_users = self.db.query(UserActivity.user_id)\
            .filter(UserActivity.created_at >= since)\
            .distinct()\
            .count()

        # Activity by type
        activity_counts = self.db.query(
            UserActivity.activity_type, 
            func.count(UserActivity.id)
        )\
        .filter(UserActivity.created_at >= since)\
        .group_by(UserActivity.activity_type)\
        .all()

        # Recent activities
        recent_activities = self.db.query(UserActivity)\
            .order_by(desc(UserActivity.created_at))\
            .limit(20)\
            .all()

        return {
            "active_users_count": active_users,
            "activity_by_type": dict(activity_counts),
            "recent_activities": recent_activities
        }

    # Dispenser data management
    def save_dispenser_data(self, user_id: str, data: DispenserData) -> UserDispenserData:
        """Save or update dispenser data for user"""
        existing = self.db.query(UserDispenserData).filter(
            and_(
                UserDispenserData.user_id == user_id,
                UserDispenserData.work_order_id == data.work_order_id
            )
        ).first()
        
        if existing:
            existing.visit_id = data.visit_id
            existing.dispenser_data = data.dispenser_data
            existing.metadata = data.metadata
            existing.updated_at = datetime.utcnow()
            dispenser_record = existing
        else:
            dispenser_record = UserDispenserData(
                user_id=user_id,
                work_order_id=data.work_order_id,
                visit_id=data.visit_id,
                dispenser_data=data.dispenser_data,
                metadata=data.metadata
            )
            self.db.add(dispenser_record)
        
        self.db.commit()
        self.db.refresh(dispenser_record)
        return dispenser_record

    def get_user_dispenser_data(self, user_id: str, work_order_id: Optional[str] = None) -> List[UserDispenserData]:
        """Get dispenser data for user"""
        query = self.db.query(UserDispenserData).filter(UserDispenserData.user_id == user_id)
        
        if work_order_id:
            query = query.filter(UserDispenserData.work_order_id == work_order_id)
            
        return query.order_by(desc(UserDispenserData.updated_at)).all()

    # Migration helpers for V1 compatibility
    def migrate_v1_user_data(self, user_id: str, v1_data: Dict[str, Any]) -> bool:
        """Migrate V1 user data to V2 format"""
        try:
            # Migrate preferences
            if "prover_preferences" in v1_data:
                self.set_user_preference(user_id, "prover", v1_data["prover_preferences"])
            
            if "email_settings" in v1_data:
                self.set_user_preference(user_id, "email", v1_data["email_settings"])
            
            if "pushover_settings" in v1_data:
                self.set_user_preference(user_id, "pushover", v1_data["pushover_settings"])
            
            # Migrate activities
            if "activities" in v1_data:
                for activity in v1_data["activities"]:
                    self.track_activity(
                        user_id=activity["userId"],
                        username=activity["username"],
                        activity_type=activity["activityType"],
                        details=activity.get("details", {})
                    )
            
            return True
        except Exception as e:
            print(f"Migration error for user {user_id}: {e}")
            return False
```

This implementation provides:

1. **Complete SQLAlchemy models** that match the V1 file structure
2. **Pydantic schemas** for API validation
3. **Comprehensive service layer** with all V1 functionality
4. **Migration helpers** for V1 to V2 data conversion
5. **Security improvements** (bcrypt password hashing)
6. **Database constraints** for data integrity

The models maintain V1 compatibility while providing the benefits of a relational database structure.