"""
V1-Compatible User Database Models

These models replicate the V1 file-based user data isolation system
using PostgreSQL with exact MD5-based user ID generation and data patterns.
"""

from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Integer, 
    ForeignKey, UniqueConstraint, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
# from sqlalchemy.dialects.postgresql import JSON  # Using JSON for SQLite compatibility
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from ..database import Base

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_user_id(email: str) -> str:
    """Generate MD5 hash user ID from email (V1 compatibility)"""
    return hashlib.md5(email.lower().strip().encode()).hexdigest()

class User(Base):
    """
    User model matching V1 users.json structure
    
    V1 Reference: data/users/users.json
    """
    __tablename__ = "users"
    
    # Primary key - MD5 hash like V1
    id = Column(String(32), primary_key=True)  # MD5 hash
    
    # Core user information (V1 compatible)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)  # bcrypt hash (V1 had plaintext)
    label = Column(String(255))  # Display name like "Bruce Hunt"
    friendly_name = Column(String(100))  # Short name like "Bruce"
    configured_email = Column(String(255))  # Notification email
    
    # Add username property for compatibility
    @property
    def username(self):
        """Return email as username for compatibility"""
        return self.email
    
    # Add is_active property for compatibility with auth dependencies
    @property
    def is_active(self):
        """All authenticated users are considered active"""
        return True
    
    # Add is_admin property for compatibility
    @property
    def is_admin(self):
        """Check if user is admin based on email domain or specific users"""
        # You can customize this logic based on your requirements
        # For now, no users are admins
        return False
    
    # Timestamps
    last_used = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # V1 notification settings structure preserved
    notification_settings = Column(JSON)  # Full V1 notification structure
    
    # Direct preferences storage for compatibility with existing routes
    preferences_json = Column(JSON)  # Store preferences as JSON for compatibility
    
    # Relationships
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
    dispenser_data = relationship("UserDispenserData", back_populates="user", cascade="all, delete-orphan")
    scraped_content = relationship("UserScrapedContent", back_populates="user", cascade="all, delete-orphan")
    session = relationship("UserSession", back_populates="user", uselist=False, cascade="all, delete-orphan")
    prover_settings = relationship("ProverSettings", back_populates="user", cascade="all, delete-orphan")
    credentials = relationship("UserCredential", back_populates="user", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="user", cascade="all, delete-orphan")
    automation_jobs = relationship("AutomationJob", back_populates="user", cascade="all, delete-orphan")
    
    def __init__(self, email: str, **kwargs):
        """Initialize user with V1-compatible MD5 ID generation"""
        self.id = generate_user_id(email)
        self.email = email
        super().__init__(**kwargs)
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        return pwd_context.hash(password)
    
    def verify_password(self, password: str) -> bool:
        """Verify a password against the hash"""
        return pwd_context.verify(password, self.password_hash)

class UserSession(Base):
    """
    Active user session management (replaces V1 data/settings.json activeUserId)
    
    V1 Reference: data/settings.json {"activeUserId": "..."}
    """
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, unique=True)
    is_active = Column(Boolean, default=False, nullable=False)
    session_data = Column(JSON)  # Store environment variables and context
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="session")
    
    __table_args__ = (
        # Ensure only one active session at a time (V1 behavior)
        # Note: PostgreSQL partial unique constraint would be preferred but not supported by all engines
        Index('idx_user_sessions_active', 'is_active'),
    )

class UserPreference(Base):
    """
    User preferences storage (replaces V1 individual JSON files)
    
    V1 References:
    - {user_id}/prover_preferences.json
    - {user_id}/email_settings.json  
    - {user_id}/pushover_settings.json
    """
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # 'email', 'pushover', 'prover', 'work_week', 'notification'
    settings = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="preferences")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'category', name='unique_user_category'),
        Index('idx_user_preferences_category', 'user_id', 'category'),
    )

class UserActivity(Base):
    """
    User activity tracking (replaces V1 {user_id}/activity_log.json)
    
    V1 Reference: {user_id}/activity_log.json
    """
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    username = Column(String(255), nullable=False)  # V1 stored email as username
    activity_type = Column(String(100), nullable=False, index=True)  # 'login', 'settings_change', 'scrape', etc.
    details = Column(JSON)  # V1 details structure preserved
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", back_populates="activities")
    
    __table_args__ = (
        Index('idx_user_activities_type_time', 'user_id', 'activity_type', 'created_at'),
    )

class UserDispenserData(Base):
    """
    User dispenser data storage (replaces V1 {user_id}/dispenser_store.json)
    
    V1 Reference: {user_id}/dispenser_store.json
    Structure: {"dispenserData": {"W-110450": {"visitId": "...", "dispensers": [...]}}}
    """
    __tablename__ = "user_dispenser_data"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    work_order_id = Column(String(100), nullable=False, index=True)
    visit_id = Column(String(100))
    dispenser_data = Column(JSON, nullable=False)  # Full V1 dispenser structure
    meta_data = Column(JSON)  # Timestamp, user info, migration flags
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="dispenser_data")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'work_order_id', name='unique_user_work_order'),
        Index('idx_user_dispenser_work_order', 'user_id', 'work_order_id'),
    )

class UserScrapedContent(Base):
    """
    User scraped content storage (replaces V1 {user_id}/scraped_content.json)
    
    V1 Reference: {user_id}/scraped_content.json
    """
    __tablename__ = "user_scraped_content"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    content_type = Column(String(100), nullable=False)  # 'dispenser', 'work_order', 'schedule_changes'
    content = Column(JSON, nullable=False)
    source_url = Column(Text)
    checksum = Column(String(64))  # For detecting changes
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", back_populates="scraped_content")
    
    __table_args__ = (
        Index('idx_user_scraped_content_type', 'user_id', 'content_type', 'created_at'),
    )

class ProverSettings(Base):
    """
    Enhanced prover settings (based on V1 prover_preferences.json structure)
    
    V1 Reference: {user_id}/prover_preferences.json
    """
    __tablename__ = "prover_settings"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    prover_id = Column(String(100), nullable=False)  # V1: "21-65435-04"
    serial = Column(String(100))  # V1: same as prover_id
    make = Column(String(255))  # V1: "Seraphin Prover"
    preferred_fuel_type = Column(String(255))  # V1: "Ethanol-Free Gasoline Plus"
    preferred_fuel_types = Column(JSON)  # V1: Array of fuel types
    priority = Column(Integer, default=1)  # V1: priority field
    full_text = Column(Text)  # Original scraped text for reference
    work_week_preference = Column(JSON)  # V1: workWeekPreference object
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="prover_settings")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'prover_id', name='unique_user_prover'),
        Index('idx_prover_settings_priority', 'user_id', 'priority'),
    )

class UserCompletedJobs(Base):
    """
    User completed jobs tracking (replaces V1 {user_id}/completed_jobs.json)
    
    V1 Reference: {user_id}/completed_jobs.json
    """
    __tablename__ = "user_completed_jobs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    job_id = Column(String(100), nullable=False, index=True)
    work_order_id = Column(String(100))
    completion_date = Column(DateTime(timezone=True))
    job_data = Column(JSON)  # Full job information
    removal_reason = Column(String(255))  # Why job was marked complete
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'job_id', name='unique_user_job'),
        Index('idx_user_completed_jobs_date', 'user_id', 'completion_date'),
    )

class UserScheduleChanges(Base):
    """
    User schedule changes tracking (replaces V1 {user_id}/schedule_changes.txt)
    
    V1 Reference: {user_id}/schedule_changes.txt
    """
    __tablename__ = "user_schedule_changes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    change_type = Column(String(100), nullable=False)  # 'added', 'removed', 'modified'
    change_data = Column(JSON, nullable=False)  # Details of the change
    change_text = Column(Text)  # Raw text description (V1 format)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    notified = Column(Boolean, default=False)
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_user_schedule_changes_type', 'user_id', 'change_type', 'detected_at'),
        Index('idx_user_schedule_changes_notified', 'user_id', 'notified'),
    )

class UserBatchHistory(Base):
    """
    User batch processing history (replaces V1 {user_id}/batch_history.json)
    
    V1 Reference: {user_id}/batch_history.json
    """
    __tablename__ = "user_batch_history"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    batch_id = Column(String(100), nullable=False, index=True)
    batch_type = Column(String(100), nullable=False)  # 'form_automation', 'data_scrape'
    work_orders = Column(JSON)  # List of work order IDs processed
    results = Column(JSON)  # Processing results and errors
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    status = Column(String(50), default='pending')  # 'pending', 'running', 'completed', 'failed'
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_user_batch_history_status', 'user_id', 'status', 'started_at'),
    )

class UserChangeHistory(Base):
    """
    User change history tracking (replaces V1 {user_id}/change_history.json)
    
    V1 Reference: {user_id}/change_history.json
    """
    __tablename__ = "user_change_history"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    change_id = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False)  # 'user', 'preferences', 'dispenser_data'
    entity_id = Column(String(100))  # ID of changed entity
    before_data = Column(JSON)  # Data before change
    after_data = Column(JSON)  # Data after change
    change_reason = Column(String(255))  # Why change was made
    changed_by = Column(String(255))  # User who made change
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_user_change_history_entity', 'user_id', 'entity_type', 'created_at'),
    )

# Global settings table (replaces V1 data/settings.json)
class GlobalSettings(Base):
    """
    Global application settings (replaces V1 data/settings.json)
    
    V1 Reference: data/settings.json
    """
    __tablename__ = "global_settings"
    
    id = Column(Integer, primary_key=True)
    setting_key = Column(String(100), unique=True, nullable=False, index=True)
    setting_value = Column(JSON)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Tutorial user support (V1 had special tutorial directory)
class TutorialData(Base):
    """
    Tutorial data storage (replaces V1 data/users/tutorial/ directory)
    
    V1 Reference: data/users/tutorial/
    """
    __tablename__ = "tutorial_data"
    
    id = Column(Integer, primary_key=True)
    data_type = Column(String(100), nullable=False, index=True)  # 'dispenser_store', 'email_settings', etc.
    data = Column(JSON, nullable=False)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class UserCredential(Base):
    """
    User credential storage for external services (WorkFossa, etc.)
    """
    __tablename__ = "user_credentials"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    service_name = Column(String(50), nullable=False)  # 'work_fossa', 'email', etc.
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
        from ..services.encryption_service import decrypt_string
        try:
            return decrypt_string(self.encrypted_username)
        except Exception as e:
            # Log error but don't expose it - fallback to returning encrypted data
            import logging
            logging.error(f"Failed to decrypt username for user {self.user_id}: {e}")
            return self.encrypted_username
    
    @property
    def password(self) -> str:
        """Get decrypted password"""
        from ..services.encryption_service import decrypt_string
        try:
            return decrypt_string(self.encrypted_password)
        except Exception as e:
            # Log error but don't expose it - fallback to returning encrypted data
            import logging
            logging.error(f"Failed to decrypt password for user {self.user_id}: {e}")
            return self.encrypted_password
    
    def set_username(self, username: str) -> None:
        """Set encrypted username"""
        from ..services.encryption_service import encrypt_string
        self.encrypted_username = encrypt_string(username)
    
    def set_password(self, password: str) -> None:
        """Set encrypted password"""
        from ..services.encryption_service import encrypt_string
        self.encrypted_password = encrypt_string(password)
    
    def migrate_to_encrypted(self) -> bool:
        """
        Migrate existing plain text credentials to encrypted format
        Returns True if migration was performed, False if already encrypted
        """
        from ..services.encryption_service import migrate_plain_text_password
        
        try:
            # Migrate username
            new_username = migrate_plain_text_password(self.encrypted_username)
            username_migrated = new_username != self.encrypted_username
            self.encrypted_username = new_username
            
            # Migrate password
            new_password = migrate_plain_text_password(self.encrypted_password)
            password_migrated = new_password != self.encrypted_password
            self.encrypted_password = new_password
            
            return username_migrated or password_migrated
            
        except Exception as e:
            import logging
            logging.error(f"Failed to migrate credentials for user {self.user_id}: {e}")
            return False

def test_user_id_generation():
    """Test function to verify MD5 generation matches V1 exactly"""
    test_email = "bruce.hunt@owlservices.com"
    expected_id = "7bea3bdb7e8e303eacaba442bd824004"
    generated_id = generate_user_id(test_email)
    
    print(f"Testing V1 MD5 compatibility:")
    print(f"Email: {test_email}")
    print(f"Expected: {expected_id}")
    print(f"Generated: {generated_id}")
    print(f"Match: {generated_id == expected_id}")
    
    return generated_id == expected_id

if __name__ == "__main__":
    # Test V1 compatibility
    test_user_id_generation()