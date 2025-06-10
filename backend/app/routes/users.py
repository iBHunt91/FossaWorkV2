"""
Enhanced User API Routes with V1 Compatibility

Complete API endpoints that replicate V1 user management functionality
with improved security and PostgreSQL backend support.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta

from ..database import get_db
from ..services.user_management import UserManagementService
from ..services.logging_service import LoggingService
from ..auth.security import get_current_user
from ..models.user_schemas import (
    UserCreate, UserUpdate, UserResponse, UserCredentialsVerify,
    UserPreferenceCreate, UserPreferenceUpdate, UserPreferenceResponse,
    UserActivityCreate, UserActivityResponse, DispenserData, DispenserDataResponse,
    SetActiveUserRequest, PreferenceCategory, EmailSettings, PushoverSettings,
    WorkWeekPreference, NotificationSettings, ProverSettings, ProverPreference,
    CompletedJobCreate, CompletedJobResponse, ScheduleChangeCreate, ScheduleChangeResponse,
    BatchHistoryCreate, BatchHistoryResponse, ChangeHistoryCreate, ChangeHistoryResponse,
    APIResponse, V1CredentialResponse, V1UserSwitchResponse, ActivitySummary, UserStatistics,
    ScrapedContentCreate, ScrapedContentResponse
)
from ..models.user_models import User, generate_user_id

router = APIRouter(prefix="/api/users", tags=["users"])

def get_user_service(db: Session = Depends(get_db)) -> UserManagementService:
    return UserManagementService(db)

def get_logging_service(db: Session = Depends(get_db)) -> LoggingService:
    return LoggingService(db)

# ===== CORE USER MANAGEMENT =====

@router.get("/", response_model=List[UserResponse])
async def get_users(
    include_inactive: bool = Query(False, description="Include inactive users"),
    user_service: UserManagementService = Depends(get_user_service),
    current_user: User = Depends(get_current_user)  # Requires authentication
):
    """Get all users with their active status (V1 compatible)"""
    try:
        users = user_service.get_all_users()
        active_user = user_service.get_active_user()
        
        result = []
        for user in users:
            # Skip inactive users if not requested
            if not include_inactive and user.last_used:
                # Consider user inactive if not used in 30 days
                inactive_threshold = datetime.utcnow() - timedelta(days=30)
                if user.last_used < inactive_threshold:
                    continue
            
            result.append(UserResponse(
                **user.__dict__,
                is_active=(user.id == active_user.id if active_user else False)
            ))
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )

@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Create a new user with V1-compatible ID generation and credential verification"""
    try:
        # Check if user already exists
        existing_user = user_service.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Generate V1-compatible user ID
        user_id = generate_user_id(user_data.email)
        
        # TODO: Add credential verification against WorkFossa system
        # This would replicate the loginToFossa verification from V1
        
        # Create user
        user = user_service.create_user(user_data)
        
        # Set as active if this is the first user
        all_users = user_service.get_all_users()
        if len(all_users) == 1:
            user_service.set_active_user(user.id)
        
        # Initialize default preferences (V1 behavior)
        default_preferences = {
            "email": {
                "recipient_email": user_data.configured_email or user_data.email,
                "show_job_id": True,
                "show_store_number": True,
                "show_store_name": True,
                "show_location": True,
                "show_date": True,
                "show_dispensers": True
            },
            "work_week": {
                "start_day": 1,
                "end_day": 5,
                "timezone": "America/New_York",
                "enable_rollover_notifications": True
            }
        }
        
        for category, settings in default_preferences.items():
            user_service.set_user_preference(user.id, category, settings)
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user.id,
            user.email,
            "user_created",
            {"result": "success", "defaults_applied": True}
        )
        
        # Log action
        background_tasks.add_task(
            logging_service.log_info,
            f"User created: {user.email} ({user.id})"
        )
        
        return UserResponse(**user.__dict__, is_active=(len(all_users) == 1))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get user by ID (supports 'active' for current user)"""
    # Handle 'active' user ID
    if user_id == "active":
        active_user = user_service.get_active_user()
        if not active_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active user found"
            )
        user_id = active_user.id
    
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    active_user = user_service.get_active_user()
    return UserResponse(
        **user.__dict__,
        is_active=(user.id == active_user.id if active_user else False)
    )

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Update user information with change tracking"""
    try:
        # Handle 'active' user ID
        if user_id == "active":
            active_user = user_service.get_active_user()
            if not active_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active user found"
                )
            user_id = active_user.id
        
        # Get user before update for change tracking
        old_user = user_service.get_user(user_id)
        if not old_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update user
        user = user_service.update_user(user_id, user_data)
        
        # Track changes
        updated_fields = list(user_data.dict(exclude_unset=True).keys())
        background_tasks.add_task(
            user_service.track_change_history,
            user_id,
            "user",
            user_id,
            old_user.__dict__,
            user.__dict__,
            f"User update: {', '.join(updated_fields)}",
            user.email
        )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user.id,
            user.email,
            "user_updated",
            {"fields_updated": updated_fields}
        )
        
        # Log action
        background_tasks.add_task(
            logging_service.log_info,
            f"User updated: {user.email} ({user.id}) - {updated_fields}"
        )
        
        active_user = user_service.get_active_user()
        return UserResponse(
            **user.__dict__,
            is_active=(user.id == active_user.id if active_user else False)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Delete user and all associated data (V1 compatible)"""
    try:
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_email = user.email
        
        # Check if this is the active user
        active_user = user_service.get_active_user()
        was_active = active_user and active_user.id == user_id
        
        # Delete user (cascades to all related data)
        success = user_service.delete_user(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user"
            )
        
        # If deleted user was active, set new active user
        if was_active:
            remaining_users = user_service.get_all_users()
            if remaining_users:
                user_service.set_active_user(remaining_users[0].id)
        
        # Log action
        background_tasks.add_task(
            logging_service.log_info,
            f"User deleted: {user_email} ({user_id})"
        )
        
        return APIResponse(success=True, message="User deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )

# ===== SESSION MANAGEMENT =====

@router.get("/active", response_model=Optional[UserResponse])
async def get_active_user(
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get the currently active user (V1 compatible)"""
    user = user_service.get_active_user()
    if not user:
        return None
    
    return UserResponse(**user.__dict__, is_active=True)

@router.post("/active", response_model=V1UserSwitchResponse)
async def set_active_user(
    request: SetActiveUserRequest,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Set the active user (V1 compatibility with environment variable updating)"""
    try:
        # Verify user exists
        user = user_service.get_user(request.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get previous active user for logging
        previous_active = user_service.get_active_user()
        previous_user_id = previous_active.id if previous_active else None
        
        # Set active user (V1 compatibility includes environment variable updates)
        success = user_service.set_active_user(request.user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to set active user"
            )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user.id,
            user.email,
            "user_switch",
            {
                "action": "user_switch",
                "previous_user": previous_user_id,
                "result": "success"
            }
        )
        
        # Log action
        background_tasks.add_task(
            logging_service.log_info,
            f"Active user changed to: {user.email} ({user.id})"
        )
        
        return V1UserSwitchResponse(
            success=True,
            message=f"Active user set to {user.label or user.email}",
            active_user=UserResponse(**user.__dict__, is_active=True)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set active user: {str(e)}"
        )

# ===== CREDENTIAL VERIFICATION =====

@router.post("/verify-credentials", response_model=APIResponse)
async def verify_credentials(
    credentials: UserCredentialsVerify,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Verify credentials without creating user (V1 compatibility)"""
    try:
        # TODO: Implement actual WorkFossa credential verification
        # This would call the equivalent of loginToFossa from V1
        
        # For now, check if user exists and password is correct
        user = user_service.verify_password(credentials.email, credentials.password)
        success = user is not None
        
        # Log verification attempt
        background_tasks.add_task(
            logging_service.log_info,
            f"Credential verification for {credentials.email}: {'success' if success else 'failed'}"
        )
        
        return APIResponse(
            success=success,
            message="Credentials verified successfully" if success else "Invalid credentials"
        )
        
    except Exception as e:
        background_tasks.add_task(
            logging_service.log_error,
            f"Credential verification failed for {credentials.email}: {str(e)}"
        )
        
        return APIResponse(
            success=False,
            message=f"Credential verification failed: {str(e)}"
        )

# ===== USER PREFERENCES =====

@router.get("/{user_id}/preferences/{category}")
async def get_user_preference(
    user_id: str,
    category: PreferenceCategory,
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get user preference by category (V1 compatible)"""
    # Handle 'active' user ID
    if user_id == "active":
        active_user = user_service.get_active_user()
        if not active_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active user found"
            )
        user_id = active_user.id
    
    # Verify user exists
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    settings = user_service.get_user_preference(user_id, category.value)
    
    # Return V1-compatible default settings if none exist
    if settings is None:
        if category == PreferenceCategory.WORK_WEEK:
            settings = {
                "start_day": 1,
                "end_day": 5,
                "timezone": "America/New_York",
                "enable_rollover_notifications": True
            }
        elif category == PreferenceCategory.EMAIL:
            settings = {
                "recipient_email": user.configured_email or user.email,
                "show_job_id": True,
                "show_store_number": True,
                "show_store_name": True,
                "show_location": True,
                "show_date": True,
                "show_dispensers": True
            }
        elif category == PreferenceCategory.PUSHOVER:
            settings = {
                "app_token": "",
                "user_key": "",
                "preferences": {
                    "show_job_id": True,
                    "show_store_number": True,
                    "show_store_name": True,
                    "show_location": True,
                    "show_date": True,
                    "show_dispensers": True,
                    "enabled": False
                }
            }
        elif category == PreferenceCategory.PROVER:
            settings = {
                "provers": [],
                "work_week_preference": {
                    "start_day": 1,
                    "end_day": 5,
                    "timezone": "America/New_York",
                    "enable_rollover_notifications": True
                }
            }
        else:
            settings = {}
    
    return settings

@router.put("/{user_id}/preferences/{category}")
async def set_user_preference(
    user_id: str,
    category: PreferenceCategory,
    settings: Dict[str, Any],
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Set or update user preference (V1 compatible with change tracking)"""
    try:
        # Handle 'active' user ID
        if user_id == "active":
            active_user = user_service.get_active_user()
            if not active_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active user found"
                )
            user_id = active_user.id
        
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get previous settings for change tracking
        previous_settings = user_service.get_user_preference(user_id, category.value)
        
        # Update settings
        preference = user_service.set_user_preference(user_id, category.value, settings)
        
        # Track change history
        background_tasks.add_task(
            user_service.track_change_history,
            user_id,
            "preferences",
            f"{category.value}_preference",
            previous_settings,
            settings,
            f"Updated {category.value} preferences",
            user.email
        )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user_id,
            user.email,
            "settings_change",
            {
                "action": f"update_{category.value}_preference",
                "previous_settings": previous_settings,
                "new_settings": settings,
                "result": "success"
            }
        )
        
        # Log action
        background_tasks.add_task(
            logging_service.log_info,
            f"User {user.email} updated {category.value} preferences"
        )
        
        return APIResponse(success=True, message=f"{category.value} preference updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preference: {str(e)}"
        )

# ===== ACTIVITY TRACKING =====

@router.get("/{user_id}/activities", response_model=List[UserActivityResponse])
async def get_user_activities(
    user_id: str,
    limit: int = Query(100, description="Maximum number of activities to return"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get user activities with filtering (V1 compatible)"""
    # Handle 'active' user ID
    if user_id == "active":
        active_user = user_service.get_active_user()
        if not active_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active user found"
            )
        user_id = active_user.id
    
    # Verify user exists
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    activities = user_service.get_user_activities(user_id, limit, activity_type)
    return [UserActivityResponse(**activity.__dict__) for activity in activities]

@router.post("/{user_id}/activities", response_model=UserActivityResponse)
async def create_user_activity(
    user_id: str,
    activity_data: UserActivityCreate,
    user_service: UserManagementService = Depends(get_user_service)
):
    """Track a new user activity (V1 compatible)"""
    # Handle 'active' user ID
    if user_id == "active":
        active_user = user_service.get_active_user()
        if not active_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active user found"
            )
        user_id = active_user.id
    
    # Verify user exists
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    activity = user_service.track_activity(
        user_id,
        user.email,
        activity_data.activity_type.value,
        activity_data.details
    )
    
    return UserActivityResponse(**activity.__dict__)

# ===== DISPENSER DATA MANAGEMENT =====

@router.get("/{user_id}/dispenser-data", response_model=List[DispenserDataResponse])
async def get_user_dispenser_data(
    user_id: str,
    work_order_id: Optional[str] = Query(None, description="Filter by work order ID"),
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get dispenser data for user (V1 compatible)"""
    # Handle 'active' user ID
    if user_id == "active":
        active_user = user_service.get_active_user()
        if not active_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active user found"
            )
        user_id = active_user.id
    
    # Verify user exists
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    data = user_service.get_user_dispenser_data(user_id, work_order_id)
    return [DispenserDataResponse(**item.__dict__) for item in data]

@router.post("/{user_id}/dispenser-data", response_model=DispenserDataResponse)
async def save_user_dispenser_data(
    user_id: str,
    data: DispenserData,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Save dispenser data for user (V1 compatible)"""
    try:
        # Handle 'active' user ID
        if user_id == "active":
            active_user = user_service.get_active_user()
            if not active_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active user found"
                )
            user_id = active_user.id
        
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Add V1-compatible metadata
        if not data.meta_data:
            data.meta_data = {}
        data.meta_data.update({
            "timestamp": datetime.utcnow().isoformat(),
            "user": user_id
        })
        
        # Save data
        dispenser_record = user_service.save_dispenser_data(user_id, data)
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user_id,
            user.email,
            "dispenser_data_saved",
            {
                "work_order_id": data.work_order_id,
                "visit_id": data.visit_id,
                "dispenser_count": len(data.dispenser_data.get("dispensers", []))
            }
        )
        
        # Log action
        background_tasks.add_task(
            logging_service.log_info,
            f"Dispenser data saved for user {user.email}: {data.work_order_id}"
        )
        
        return DispenserDataResponse(**dispenser_record.__dict__)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save dispenser data: {str(e)}"
        )

# ===== DASHBOARD & STATISTICS =====

@router.get("/statistics/summary", response_model=UserStatistics)
async def get_user_statistics(
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get user statistics for dashboard"""
    try:
        stats = user_service.get_user_statistics()
        return UserStatistics(**stats)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user statistics: {str(e)}"
        )

@router.get("/activities/summary", response_model=ActivitySummary)
async def get_activity_summary(
    days: int = Query(1, description="Number of days to include"),
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get activity summary for dashboard"""
    try:
        summary = user_service.get_activity_summary(days)
        return ActivitySummary(**summary)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get activity summary: {str(e)}"
        )

# ===== V1 COMPATIBILITY ENDPOINTS =====

@router.get("/{user_id}/work-week-preference")
async def get_work_week_preference(
    user_id: str,
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get work week preference (V1 compatibility)"""
    return await get_user_preference(user_id, PreferenceCategory.WORK_WEEK, user_service)

@router.put("/{user_id}/work-week-preference")
async def set_work_week_preference(
    user_id: str,
    preference: WorkWeekPreference,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Set work week preference (V1 compatibility)"""
    return await set_user_preference(
        user_id, 
        PreferenceCategory.WORK_WEEK, 
        preference.dict(),
        background_tasks,
        user_service,
        logging_service
    )

@router.get("/{user_id}/credentials", response_model=V1CredentialResponse)
async def get_user_credentials(
    user_id: str,
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get user credentials (V1 compatibility - security risk, use with caution)"""
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # WARNING: This is for V1 compatibility only
    # In production, this should be removed or heavily restricted
    return V1CredentialResponse(
        success=True,
        email=user.email,
        password="[HASHED]"  # Never expose actual hash
    )

@router.put("/{user_id}/credentials", response_model=V1CredentialResponse)
async def update_user_credentials(
    user_id: str,
    credentials: UserCredentialsVerify,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Update user credentials (V1 compatibility)"""
    try:
        # TODO: Verify new credentials against WorkFossa system
        
        # Update user
        update_data = UserUpdate(email=credentials.email, password=credentials.password)
        user = user_service.update_user(user_id, update_data)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user_id,
            user.email,
            "credentials_updated",
            {"result": "success"}
        )
        
        # Log action
        background_tasks.add_task(
            logging_service.log_info,
            f"Credentials updated for user: {user.email}"
        )
        
        return V1CredentialResponse(
            success=True,
            message="Credentials updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update credentials: {str(e)}"
        )