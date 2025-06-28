"""
Simplified User Database Models
Single authentication system with database-only credential storage
"""

from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Integer, 
    ForeignKey, UniqueConstraint, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any
from ..database import Base

def generate_user_id(email: str) -> str:
    """Generate MD5 hash user ID from email (V1 compatibility)"""
    return hashlib.md5(email.lower().strip().encode()).hexdigest()

class User(Base):
    """
    Simplified User model for WorkFossa-only authentication
    """
    __tablename__ = "users"
    
    # Primary key - MD5 hash like V1
    id = Column(String(32), primary_key=True)  # MD5 hash
    
    # Core user information
    email = Column(String(255), unique=True, nullable=False, index=True)
    label = Column(String(255))  # Display name like "Bruce Hunt"
    friendly_name = Column(String(100))  # Short name like "Bruce"
    configured_email = Column(String(255))  # Notification email
    
    # Remove password_hash - WorkFossa-only authentication
    
    # Compatibility properties
    @property
    def username(self):
        """Return email as username for compatibility"""
        return self.email
    
    @property
    def is_active(self):
        """All authenticated users are considered active"""
        return True
    
    @property
    def is_admin(self):
        """No admin users in simplified system"""
        return False
    
    # Timestamps
    last_used = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Simplified preferences storage
    notification_settings = Column(JSON)
    preferences_json = Column(JSON)
    
    # Essential relationships only
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan")
    credentials = relationship("UserCredential", back_populates="user", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="user", cascade="all, delete-orphan")
    
    # Keep other relationships for data compatibility
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
    dispenser_data = relationship("UserDispenserData", back_populates="user", cascade="all, delete-orphan")
    scraped_content = relationship("UserScrapedContent", back_populates="user", cascade="all, delete-orphan")
    session = relationship("UserSession", back_populates="user", uselist=False, cascade="all, delete-orphan")
    prover_settings = relationship("ProverSettings", back_populates="user", cascade="all, delete-orphan")
    automation_jobs = relationship("AutomationJob", back_populates="user", cascade="all, delete-orphan")
    
    def __init__(self, email: str, **kwargs):
        """Initialize user with V1-compatible MD5 ID generation"""
        self.id = generate_user_id(email)
        self.email = email
        super().__init__(**kwargs)

class UserCredential(Base):
    """
    Simplified user credential storage for external services
    Single source of truth for encrypted credentials
    """
    __tablename__ = "user_credentials"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    service_name = Column(String(50), nullable=False)  # 'workfossa'
    encrypted_username = Column(Text, nullable=False)
    encrypted_password = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_verified = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="credentials")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'service_name', name='unique_user_service'),
        Index('idx_user_credentials_service', 'user_id', 'service_name'),
    )
    
    @property
    def username(self) -> str:
        """Get decrypted username"""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            from ..services.encryption_service import decrypt_string
            result = decrypt_string(self.encrypted_username)
            if not result:
                logger.warning(f"Decryption returned empty string for user {self.user_id}")
                return self.encrypted_username
            return result
        except Exception as e:
            logger.error(f"Failed to decrypt username for user {self.user_id}: {e}")
            return self.encrypted_username
    
    @property
    def password(self) -> str:
        """Get decrypted password"""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            from ..services.encryption_service import decrypt_string
            result = decrypt_string(self.encrypted_password)
            if not result:
                logger.warning(f"Decryption returned empty string for password of user {self.user_id}")
                return self.encrypted_password
            return result
        except Exception as e:
            logger.error(f"Failed to decrypt password for user {self.user_id}: {e}")
            return self.encrypted_password
    
    def set_username(self, username: str) -> None:
        """Set encrypted username"""
        from ..services.encryption_service import encrypt_string
        self.encrypted_username = encrypt_string(username)
    
    def set_password(self, password: str) -> None:
        """Set encrypted password"""
        from ..services.encryption_service import encrypt_string
        self.encrypted_password = encrypt_string(password)

# Keep essential models for data compatibility
class UserPreference(Base):
    """User preferences storage"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    settings = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="preferences")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'category', name='unique_user_category'),
        Index('idx_user_preferences_category', 'user_id', 'category'),
    )

# Keep other models for backward compatibility but don't use in new auth flow
class UserSession(Base):
    """User session management (backward compatibility)"""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, unique=True)
    is_active = Column(Boolean, default=False, nullable=False)
    session_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="session")
    
    __table_args__ = (
        Index('idx_user_sessions_active', 'is_active'),
    )

class UserActivity(Base):
    """User activity tracking"""
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    username = Column(String(255), nullable=False)
    activity_type = Column(String(100), nullable=False, index=True)
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    user = relationship("User", back_populates="activities")
    
    __table_args__ = (
        Index('idx_user_activities_type_time', 'user_id', 'activity_type', 'created_at'),
    )

class UserDispenserData(Base):
    """User dispenser data storage"""
    __tablename__ = "user_dispenser_data"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    work_order_id = Column(String(100), nullable=False, index=True)
    visit_id = Column(String(100))
    dispenser_data = Column(JSON, nullable=False)
    meta_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="dispenser_data")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'work_order_id', name='unique_user_work_order'),
        Index('idx_user_dispenser_work_order', 'user_id', 'work_order_id'),
    )

class UserScrapedContent(Base):
    """User scraped content storage"""
    __tablename__ = "user_scraped_content"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    content_type = Column(String(100), nullable=False)
    content = Column(JSON, nullable=False)
    source_url = Column(Text)
    checksum = Column(String(64))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    user = relationship("User", back_populates="scraped_content")
    
    __table_args__ = (
        Index('idx_user_scraped_content_type', 'user_id', 'content_type', 'created_at'),
    )

class ProverSettings(Base):
    """Prover settings"""
    __tablename__ = "prover_settings"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    prover_id = Column(String(100), nullable=False)
    serial = Column(String(100))
    make = Column(String(255))
    preferred_fuel_type = Column(String(255))
    preferred_fuel_types = Column(JSON)
    priority = Column(Integer, default=1)
    full_text = Column(Text)
    work_week_preference = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="prover_settings")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'prover_id', name='unique_user_prover'),
        Index('idx_prover_settings_priority', 'user_id', 'priority'),
    )

# Global settings and other models for compatibility
class GlobalSettings(Base):
    """Global application settings"""
    __tablename__ = "global_settings"
    
    id = Column(Integer, primary_key=True)
    setting_key = Column(String(100), unique=True, nullable=False, index=True)
    setting_value = Column(JSON)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Import remaining model classes for compatibility (don't change these)
class UserCompletedJobs(Base):
    """User completed jobs tracking"""
    __tablename__ = "user_completed_jobs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    job_id = Column(String(100), nullable=False, index=True)
    work_order_id = Column(String(100))
    completion_date = Column(DateTime(timezone=True))
    job_data = Column(JSON)
    removal_reason = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'job_id', name='unique_user_job'),
        Index('idx_user_completed_jobs_date', 'user_id', 'completion_date'),
    )

class UserScheduleChanges(Base):
    """User schedule changes tracking"""
    __tablename__ = "user_schedule_changes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    change_type = Column(String(100), nullable=False)
    change_data = Column(JSON, nullable=False)
    change_text = Column(Text)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    notified = Column(Boolean, default=False)
    
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_user_schedule_changes_type', 'user_id', 'change_type', 'detected_at'),
        Index('idx_user_schedule_changes_notified', 'user_id', 'notified'),
    )

class UserBatchHistory(Base):
    """User batch processing history"""
    __tablename__ = "user_batch_history"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    batch_id = Column(String(100), nullable=False, index=True)
    batch_type = Column(String(100), nullable=False)
    work_orders = Column(JSON)
    results = Column(JSON)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    status = Column(String(50), default='pending')
    
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_user_batch_history_status', 'user_id', 'status', 'started_at'),
    )

class UserChangeHistory(Base):
    """User change history tracking"""
    __tablename__ = "user_change_history"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    change_id = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(100))
    before_data = Column(JSON)
    after_data = Column(JSON)
    change_reason = Column(String(255))
    changed_by = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_user_change_history_entity', 'user_id', 'entity_type', 'created_at'),
    )

class TutorialData(Base):
    """Tutorial data storage"""
    __tablename__ = "tutorial_data"
    
    id = Column(Integer, primary_key=True)
    data_type = Column(String(100), nullable=False, index=True)
    data = Column(JSON, nullable=False)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Add missing relationship for AutomationJob compatibility
# This should be imported from the actual automation models file
# For now, just create a placeholder to avoid import errors
class AutomationJob(Base):
    """Automation job tracking (placeholder for compatibility)"""
    __tablename__ = "automation_jobs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    job_type = Column(String(100), nullable=False)
    status = Column(String(50), default='pending')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="automation_jobs")

# Add missing relationship for WorkOrder compatibility
class WorkOrder(Base):
    """Work order tracking (placeholder for compatibility)"""
    __tablename__ = "work_orders"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    work_order_id = Column(String(100), nullable=False)
    status = Column(String(50), default='pending')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="work_orders")