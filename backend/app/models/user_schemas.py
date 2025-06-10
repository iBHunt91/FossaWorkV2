"""
V1-Compatible User Pydantic Schemas

These schemas provide API validation and serialization for the V1-compatible
user database models, maintaining exact V1 request/response structures.
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any, Literal, Union
from datetime import datetime
from enum import Enum

# ===== BASE USER SCHEMAS =====

class UserBase(BaseModel):
    """Base user model matching V1 user structure"""
    email: EmailStr
    label: Optional[str] = None
    friendly_name: Optional[str] = None
    configured_email: Optional[EmailStr] = None

class UserCreate(UserBase):
    """User creation schema with password validation"""
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    
    # V1 notification settings structure (optional on creation)
    notification_settings: Optional[Dict[str, Any]] = None

class UserUpdate(BaseModel):
    """User update schema - all fields optional"""
    email: Optional[EmailStr] = None
    label: Optional[str] = None
    friendly_name: Optional[str] = None
    configured_email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    notification_settings: Optional[Dict[str, Any]] = None

class UserResponse(UserBase):
    """User response schema with computed fields"""
    id: str
    last_used: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    is_active: bool = False
    notification_settings: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class UserCredentialsVerify(BaseModel):
    """Credential verification for V1 compatibility"""
    email: EmailStr
    password: str

# ===== PREFERENCE SCHEMAS =====

class PreferenceCategory(str, Enum):
    """V1-compatible preference categories"""
    EMAIL = "email"
    PUSHOVER = "pushover"
    PROVER = "prover"
    WORK_WEEK = "work_week"
    NOTIFICATION = "notification"

class EmailSettings(BaseModel):
    """V1 email_settings.json structure"""
    recipient_email: EmailStr
    show_job_id: bool = True
    show_store_number: bool = True
    show_store_name: bool = True
    show_location: bool = True
    show_date: bool = True
    show_dispensers: bool = True
    last_updated: Optional[datetime] = None

class PushoverSettings(BaseModel):
    """V1 pushover_settings.json structure"""
    app_token: str
    user_key: str
    preferences: Dict[str, Any] = {
        "show_job_id": True,
        "show_store_number": True,
        "show_store_name": True,
        "show_location": True,
        "show_date": True,
        "show_dispensers": True,
        "enabled": True
    }
    last_updated: Optional[datetime] = None

class WorkWeekPreference(BaseModel):
    """V1 workWeekPreference structure"""
    start_day: int = Field(..., ge=0, le=6, description="0=Sunday, 1=Monday, etc.")
    end_day: int = Field(..., ge=0, le=6, description="0=Sunday, 1=Monday, etc.")
    timezone: str = "America/New_York"
    enable_rollover_notifications: bool = True

class ProverPreference(BaseModel):
    """V1 individual prover structure"""
    prover_id: str
    serial: str
    make: str
    preferred_fuel_type: str
    preferred_fuel_types: List[str] = []
    priority: int = 1
    full_text: Optional[str] = None

class ProverSettings(BaseModel):
    """V1 prover_preferences.json structure"""
    provers: List[ProverPreference] = []
    work_week_preference: Optional[WorkWeekPreference] = None

class NotificationSettings(BaseModel):
    """V1 notification settings structure"""
    enabled: bool = True
    email: Dict[str, Any] = {
        "enabled": True,
        "frequency": "immediate",
        "delivery_time": "15:40"
    }
    pushover: Dict[str, Any] = {
        "enabled": True
    }

class UserPreferenceCreate(BaseModel):
    """Create user preference"""
    category: PreferenceCategory
    settings: Dict[str, Any]

class UserPreferenceUpdate(BaseModel):
    """Update user preference"""
    settings: Dict[str, Any]

class UserPreferenceResponse(BaseModel):
    """User preference response"""
    id: int
    user_id: str
    category: str
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ===== ACTIVITY SCHEMAS =====

class ActivityType(str, Enum):
    """V1-compatible activity types"""
    LOGIN = "login"
    LOGOUT = "logout"
    SETTINGS_CHANGE = "settings_change"
    SCRAPE = "scrape"
    FORM_AUTOMATION = "form_automation"
    FILTER_CHANGE = "filter_change"
    USER_SWITCH = "user_switch"
    DISPENSER_DATA_SAVED = "dispenser_data_saved"
    CREDENTIALS_UPDATED = "credentials_updated"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"

class UserActivityCreate(BaseModel):
    """Create user activity"""
    activity_type: ActivityType
    details: Optional[Dict[str, Any]] = None

class UserActivityResponse(BaseModel):
    """User activity response matching V1 structure"""
    id: int
    user_id: str
    username: str
    activity_type: str
    details: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

# ===== DISPENSER DATA SCHEMAS =====

class DispenserInfo(BaseModel):
    """Individual dispenser information from V1"""
    title: str
    serial: str
    make: Optional[str] = ""
    model: Optional[str] = ""
    fields: Dict[str, str] = {}

class DispenserData(BaseModel):
    """V1 dispenser_store.json structure"""
    work_order_id: str
    visit_id: Optional[str] = None
    dispenser_data: Dict[str, Any]  # Contains "dispensers" array and other V1 structure
    meta_data: Optional[Dict[str, Any]] = None

class DispenserDataResponse(DispenserData):
    """Dispenser data response with database fields"""
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ===== SCRAPED CONTENT SCHEMAS =====

class ScrapedContentCreate(BaseModel):
    """Create scraped content"""
    content_type: str
    content: Dict[str, Any]
    source_url: Optional[str] = None
    checksum: Optional[str] = None

class ScrapedContentResponse(ScrapedContentCreate):
    """Scraped content response"""
    id: int
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# ===== SESSION SCHEMAS =====

class UserSessionResponse(BaseModel):
    """User session response"""
    user_id: str
    is_active: bool
    session_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SetActiveUserRequest(BaseModel):
    """Set active user request (V1 compatibility)"""
    user_id: str

# ===== COMPLETED JOBS SCHEMAS =====

class CompletedJobCreate(BaseModel):
    """Create completed job entry"""
    job_id: str
    work_order_id: Optional[str] = None
    completion_date: Optional[datetime] = None
    job_data: Dict[str, Any]
    removal_reason: Optional[str] = None

class CompletedJobResponse(CompletedJobCreate):
    """Completed job response"""
    id: int
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# ===== SCHEDULE CHANGES SCHEMAS =====

class ScheduleChangeCreate(BaseModel):
    """Create schedule change entry"""
    change_type: str  # 'added', 'removed', 'modified'
    change_data: Dict[str, Any]
    change_text: Optional[str] = None

class ScheduleChangeResponse(ScheduleChangeCreate):
    """Schedule change response"""
    id: int
    user_id: str
    detected_at: datetime
    notified: bool

    class Config:
        from_attributes = True

# ===== BATCH HISTORY SCHEMAS =====

class BatchHistoryCreate(BaseModel):
    """Create batch history entry"""
    batch_id: str
    batch_type: str
    work_orders: List[str]
    results: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None

class BatchHistoryResponse(BatchHistoryCreate):
    """Batch history response"""
    id: int
    user_id: str
    completed_at: Optional[datetime]
    status: str

    class Config:
        from_attributes = True

# ===== CHANGE HISTORY SCHEMAS =====

class ChangeHistoryCreate(BaseModel):
    """Create change history entry"""
    change_id: str
    entity_type: str
    entity_id: Optional[str] = None
    before_data: Optional[Dict[str, Any]] = None
    after_data: Optional[Dict[str, Any]] = None
    change_reason: Optional[str] = None
    changed_by: str

class ChangeHistoryResponse(ChangeHistoryCreate):
    """Change history response"""
    id: int
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# ===== GLOBAL SETTINGS SCHEMAS =====

class GlobalSettingCreate(BaseModel):
    """Create global setting"""
    setting_key: str
    setting_value: Dict[str, Any]
    description: Optional[str] = None

class GlobalSettingResponse(GlobalSettingCreate):
    """Global setting response"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ===== TUTORIAL DATA SCHEMAS =====

class TutorialDataCreate(BaseModel):
    """Create tutorial data"""
    data_type: str
    data: Dict[str, Any]
    description: Optional[str] = None

class TutorialDataResponse(TutorialDataCreate):
    """Tutorial data response"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ===== MIGRATION SCHEMAS =====

class V1UserMigration(BaseModel):
    """V1 user data for migration"""
    id: str
    email: str
    password: str  # V1 had plaintext
    label: Optional[str] = None
    friendly_name: Optional[str] = None
    configured_email: Optional[str] = None
    last_used: Optional[str] = None
    notification_settings: Optional[Dict[str, Any]] = None

class V1MigrationRequest(BaseModel):
    """V1 migration request"""
    users: List[V1UserMigration]
    user_data: Dict[str, Dict[str, Any]]  # user_id -> file data mapping

class MigrationValidationResult(BaseModel):
    """Migration validation result"""
    user_id: str
    valid: bool
    validation_results: Dict[str, Any]
    error: Optional[str] = None

# ===== DASHBOARD SCHEMAS =====

class ActivitySummary(BaseModel):
    """Dashboard activity summary"""
    active_users_count: int
    activity_by_type: Dict[str, int]
    recent_activities: List[UserActivityResponse]

class UserStatistics(BaseModel):
    """User statistics for dashboard"""
    total_users: int
    active_users_24h: int
    total_activities: int
    total_work_orders: int
    total_dispensers: int

# ===== API RESPONSE WRAPPERS =====

class APIResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None

class APIError(BaseModel):
    """Standard API error response"""
    success: bool = False
    message: str
    detail: Optional[str] = None
    status_code: int

# ===== V1 COMPATIBILITY HELPERS =====

class V1CredentialResponse(BaseModel):
    """V1-style credential response"""
    success: bool
    email: Optional[str] = None
    password: Optional[str] = None  # Should always be "[HASHED]" for security
    message: Optional[str] = None

class V1UserSwitchResponse(BaseModel):
    """V1-style user switch response"""
    success: bool
    message: str
    active_user: Optional[UserResponse] = None

# ===== VALIDATORS =====

@validator('email', pre=True, always=True)
def normalize_email(cls, v):
    """Normalize email for V1 compatibility"""
    if isinstance(v, str):
        return v.lower().strip()
    return v

# Apply email normalization to all email fields
UserCreate.model_rebuild()
UserUpdate.model_rebuild()
UserCredentialsVerify.model_rebuild()
EmailSettings.model_rebuild()

def validate_v1_user_id(user_id: str, email: str) -> bool:
    """Validate that user_id matches V1 MD5 generation for email"""
    import hashlib
    expected_id = hashlib.md5(email.lower().strip().encode()).hexdigest()
    return user_id == expected_id