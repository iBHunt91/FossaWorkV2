#!/usr/bin/env python3
"""
Notification API Routes

REST API endpoints for managing email and Pushover notifications,
user preferences, digest scheduling, and notification testing.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, time
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.notification_manager import (
    NotificationManager, 
    NotificationTrigger, 
    NotificationChannel,
    get_notification_manager
)
from ..services.email_notification import EmailSettings
from ..services.pushover_notification import PushoverSettings, PushoverPriority
from ..services.desktop_notification import DesktopNotificationSettings
from ..services.user_management import UserManagementService
from ..services.logging_service import LoggingService
from ..auth.dependencies import require_auth
from ..models.user_models import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

def get_user_service(db: Session = Depends(get_db)):
    """Get user management service instance"""
    return UserManagementService()

def get_logging_service(db: Session = Depends(get_db)):
    """Get logging service instance"""
    return LoggingService()

def get_notification_manager_dependency(current_user: User = Depends(require_auth)):
    """Get notification manager instance without exposing Session type"""
    return get_notification_manager(user_id=current_user.id)


# Pydantic models for request/response
class NotificationPreferencesRequest(BaseModel):
    email_enabled: bool = True
    pushover_enabled: bool = False
    desktop_enabled: bool = True
    
    # Channel preferences
    automation_started: str = "email_desktop"
    automation_completed: str = "all"
    automation_failed: str = "all"
    automation_progress: str = "pushover_desktop"
    schedule_change: str = "email_desktop"
    daily_digest: str = "email"
    weekly_summary: str = "email"
    error_alert: str = "all"
    
    # Timing preferences
    digest_time: str = "08:00"
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "07:00"
    
    # Pushover specific
    pushover_user_key: Optional[str] = None
    pushover_device: Optional[str] = None
    pushover_sound: str = "pushover"
    
    # Desktop specific
    desktop_sound_enabled: bool = True
    desktop_auto_close_time: int = 10
    desktop_quiet_hours_enabled: bool = False


class TestNotificationRequest(BaseModel):
    notification_type: str
    channel: str = "both"
    test_data: Dict[str, Any] = {}


class EmergencyAlertRequest(BaseModel):
    title: str
    message: str
    target_users: List[str] = []
    force_all_channels: bool = True


# Duplicate function removed - already defined above


@router.get("/preferences")
async def get_user_notification_preferences(
    user_service: UserManagementService = Depends(get_user_service),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user_id = current_user.id
    """Get user notification preferences"""
    try:
        # User is already verified through authentication
        user = current_user
        
        # Get preferences
        preferences = await user_service.get_user_preferences(user_id, "notification_preferences", db)
        
        if not preferences:
            # Return default preferences
            preferences = {
                "email_enabled": True,
                "pushover_enabled": False,
                "automation_started": "email",
                "automation_completed": "both",
                "automation_failed": "both",
                "automation_progress": "pushover",
                "schedule_change": "email",
                "daily_digest": "email",
                "weekly_summary": "email",
                "error_alert": "both",
                "digest_time": "08:00",
                "quiet_hours_start": "22:00",
                "quiet_hours_end": "07:00",
                "pushover_user_key": None,
                "pushover_device": None,
                "pushover_sound": "pushover"
            }
        
        return {
            "success": True,
            "user_id": user_id,
            "user_email": user.email,
            "preferences": preferences
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notification preferences: {str(e)}"
        )


@router.get("/preferences/{user_id}", response_model=Dict[str, Any])
async def get_notification_preferences_by_user_id(
    user_id: str,
    user_service: UserManagementService = Depends(get_user_service),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get notification preferences for a specific user"""
    try:
        # Verify the requesting user has permission to access this user's preferences
        # For now, users can only access their own preferences
        if current_user.id != user_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Cannot access another user's preferences"
            )
        
        # User is already verified through current_user
        user = current_user
        
        # Get preferences
        preferences = await user_service.get_user_preferences(user_id, "notification_preferences", db)
        
        if not preferences:
            # Return default preferences
            preferences = {
                "email_enabled": True,
                "pushover_enabled": False,
                "automation_started": "email",
                "automation_completed": "both",
                "automation_failed": "both",
                "automation_progress": "pushover",
                "schedule_change": "email",
                "daily_digest": "email",
                "weekly_summary": "email",
                "error_alert": "both",
                "digest_time": "08:00",
                "quiet_hours_start": "22:00",
                "quiet_hours_end": "07:00",
                "pushover_user_key": None,
                "pushover_device": None,
                "pushover_sound": "pushover"
            }
        
        return {
            "success": True,
            "user_id": user_id,
            "user_email": user.email,
            "preferences": preferences
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notification preferences: {str(e)}"
        )


@router.put("/preferences/{user_id}", response_model=Dict[str, Any])
async def update_notification_preferences_by_user_id(
    user_id: str,
    preferences: NotificationPreferencesRequest,
    background_tasks: BackgroundTasks,
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service),
    current_user: User = Depends(require_auth)
) -> Dict[str, Any]:
    """Update notification preferences for a specific user"""
    try:
        # Verify the requesting user has permission to update this user's preferences
        # For now, users can only update their own preferences
        if current_user.id != user_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Cannot update another user's preferences"
            )
        
        # User is already verified through current_user
        user = current_user
        
        # Convert request to dict
        preferences_dict = preferences.dict()
        
        # Update preferences
        success = await notification_manager.update_user_preferences(user_id, preferences_dict)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update notification preferences"
            )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user_id,
            user.email,
            "notification_preferences_updated",
            {
                "email_enabled": preferences.email_enabled,
                "pushover_enabled": preferences.pushover_enabled,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        return {
            "success": True,
            "message": "Notification preferences updated successfully",
            "user_id": user_id,
            "preferences": preferences_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await logging_service.log_error(
            f"Failed to update notification preferences for user {user_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update notification preferences: {str(e)}"
        )


@router.put("/preferences")
async def update_user_notification_preferences(
    preferences: NotificationPreferencesRequest,
    background_tasks: BackgroundTasks,
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """Update user notification preferences"""
    try:
        # User is already verified through authentication
        user = current_user
        
        # Convert request to dict
        preferences_dict = preferences.dict()
        
        # Update preferences
        success = await notification_manager.update_user_preferences(user_id, preferences_dict)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update notification preferences"
            )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user_id,
            user.email,
            "notification_preferences_updated",
            {
                "email_enabled": preferences.email_enabled,
                "pushover_enabled": preferences.pushover_enabled,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        return {
            "success": True,
            "message": "Notification preferences updated successfully",
            "user_id": user_id,
            "preferences": preferences_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await logging_service.log_error(
            f"Failed to update notification preferences for user {user_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update notification preferences: {str(e)}"
        )


@router.post("/test")
async def send_test_notification(
    test_request: TestNotificationRequest,
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """Send test notification to user"""
    try:
        # User is already verified through authentication
        user = current_user
        
        # Validate notification type
        try:
            trigger = NotificationTrigger(test_request.notification_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid notification type: {test_request.notification_type}"
            )
        
        # Prepare test data
        test_data = {
            "station_name": "Test Station #001",
            "job_id": "TEST_JOB_001",
            "work_order_id": "TEST_WO_001",
            "service_code": "2861",
            "dispenser_count": 4,
            "total_iterations": 20,
            "start_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "duration": "15 minutes",
            "forms_completed": 4,
            "success_rate": 100,
            "dispensers_processed": 4,
            "error_message": "This is a test error message",
            "failure_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "progress_percentage": 75,
            "retry_available": True,
            **test_request.test_data
        }
        
        # Send test notification
        results = await notification_manager.send_automation_notification(
            user_id, trigger, test_data, PushoverPriority.NORMAL
        )
        
        await logging_service.log_info(
            f"Test notification sent to user {user_id}: {test_request.notification_type}"
        )
        
        return {
            "success": True,
            "message": "Test notification sent",
            "user_id": user_id,
            "notification_type": test_request.notification_type,
            "results": results,
            "test_data": test_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await logging_service.log_error(
            f"Failed to send test notification: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )


@router.post("/digest")
async def send_manual_digest(
    digest_type: str = Query("daily", description="Type of digest (daily/weekly)"),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """Manually trigger digest notification for user"""
    try:
        # User is already verified through authentication
        user = current_user
        
        if digest_type not in ["daily", "weekly"]:
            raise HTTPException(
                status_code=400,
                detail="Digest type must be 'daily' or 'weekly'"
            )
        
        # Send digest
        success = await notification_manager.send_daily_digest(user_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to send digest notification"
            )
        
        await logging_service.log_info(
            f"Manual {digest_type} digest sent to user {user_id}"
        )
        
        return {
            "success": True,
            "message": f"{digest_type.title()} digest sent successfully",
            "user_id": user_id,
            "digest_type": digest_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await logging_service.log_error(
            f"Failed to send manual digest: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send manual digest: {str(e)}"
        )


@router.post("/emergency")
async def send_emergency_alert(
    alert_request: EmergencyAlertRequest,
    background_tasks: BackgroundTasks,
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service),
    current_user: User = Depends(require_auth)
):
    """Send emergency alert to specified users or all users"""
    try:
        # Initialize notification manager
        await notification_manager.initialize()
        
        # Determine target users
        target_users = alert_request.target_users
        if not target_users:
            # Send to all users if none specified
            all_users = user_service.get_all_users()
            target_users = [user.user_id for user in all_users]
        
        # Send emergency alerts
        results = {}
        for user_id in target_users:
            try:
                user_results = await notification_manager.send_emergency_alert(
                    user_id,
                    alert_request.title,
                    alert_request.message,
                    alert_request.force_all_channels
                )
                results[user_id] = user_results
            except Exception as e:
                results[user_id] = {"email": False, "pushover": False, "error": str(e)}
        
        # Log emergency alert
        background_tasks.add_task(
            logging_service.log_info,
            f"Emergency alert sent: {alert_request.title} - "
            f"Targets: {len(target_users)} users"
        )
        
        return {
            "success": True,
            "message": "Emergency alert sent",
            "title": alert_request.title,
            "target_count": len(target_users),
            "results": results
        }
        
    except Exception as e:
        await logging_service.log_error(
            f"Failed to send emergency alert: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send emergency alert: {str(e)}"
        )


@router.post("/validate-pushover")
async def validate_pushover_key(
    pushover_user_key: str,
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    user_service: UserManagementService = Depends(get_user_service),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """Validate Pushover user key"""
    try:
        # User is already verified through authentication
        user = current_user
        
        # Initialize notification manager
        await notification_manager.initialize()
        
        # Validate key
        is_valid = await notification_manager.pushover_service.validate_user_key(pushover_user_key)
        
        return {
            "success": True,
            "user_id": user_id,
            "pushover_user_key": pushover_user_key,
            "is_valid": is_valid,
            "message": "Pushover key is valid" if is_valid else "Pushover key is invalid"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate Pushover key: {str(e)}"
        )


@router.get("/status")
async def get_notification_status(
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    current_user: User = Depends(require_auth)
):
    """Get notification system status"""
    try:
        # Initialize if needed
        await notification_manager.initialize()
        
        return {
            "success": True,
            "message": "Notification system is operational",
            "services": {
                "email": {
                    "available": True,
                    "smtp_server": notification_manager.email_service.email_settings.smtp_server,
                    "from_email": notification_manager.email_service.email_settings.from_email
                },
                "pushover": {
                    "available": True,
                    "api_url": notification_manager.pushover_service.pushover_settings.api_url
                }
            },
            "features": [
                "Email notifications with HTML templates",
                "Pushover real-time notifications",
                "User preference management",
                "Daily/weekly digest reports",
                "Emergency alert system",
                "Notification testing",
                "Background processing with retry logic"
            ],
            "notification_types": [
                "automation_started",
                "automation_completed",
                "automation_failed",
                "automation_progress",
                "schedule_change",
                "daily_digest",
                "weekly_summary",
                "error_alert",
                "system_maintenance"
            ],
            "channels": ["email", "pushover", "desktop", "email_pushover", "email_desktop", "pushover_desktop", "all"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notification status: {str(e)}"
        )


# Desktop Notification Endpoints

@router.get("/desktop/pending")
async def get_pending_desktop_notifications(
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Get pending desktop notifications for the current user"""
    try:
        notifications = await notification_manager.desktop_service.get_pending_notifications(current_user.id)
        
        return {
            "success": True,
            "notifications": notifications,
            "count": len(notifications),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pending notifications: {str(e)}"
        )


@router.post("/desktop/click/{notification_id}")
async def handle_desktop_notification_click(
    notification_id: str,
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Handle desktop notification click action"""
    try:
        result = await notification_manager.desktop_service.handle_notification_click(
            notification_id, current_user.id
        )
        
        return {
            "success": True,
            "action": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to handle notification click: {str(e)}"
        )


@router.get("/desktop/history")
async def get_desktop_notification_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Get desktop notification history for the current user"""
    try:
        history = await notification_manager.desktop_service.get_notification_history(
            current_user.id, limit
        )
        
        return {
            "success": True,
            "history": history,
            "count": len(history),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notification history: {str(e)}"
        )


class DesktopNotificationTestRequest(BaseModel):
    title: str = "Test Desktop Notification"
    message: str = "This is a test desktop notification from Fossa Monitor."
    priority: str = "normal"  # low, normal, high, critical


@router.post("/desktop/test")
async def test_desktop_notification(
    request: DesktopNotificationTestRequest,
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Send a test desktop notification"""
    try:
        from ..services.desktop_notification import NotificationPriority as DesktopPriority
        
        # Convert priority string to enum
        priority_mapping = {
            "low": DesktopPriority.LOW,
            "normal": DesktopPriority.NORMAL,
            "high": DesktopPriority.HIGH,
            "critical": DesktopPriority.CRITICAL
        }
        
        priority = priority_mapping.get(request.priority.lower(), DesktopPriority.NORMAL)
        
        # Send test notification
        success = await notification_manager.desktop_service.send_system_alert(
            current_user.id, request.message, priority
        )
        
        return {
            "success": success,
            "message": "Test notification sent" if success else "Failed to send test notification",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )


class DesktopSettingsRequest(BaseModel):
    enabled: bool = True
    sound_enabled: bool = True
    auto_close_time: int = 10
    priority_threshold: str = "normal"
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "07:00"


@router.put("/desktop/settings")
async def update_desktop_settings(
    settings: DesktopSettingsRequest,
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Update desktop notification settings"""
    try:
        settings_dict = settings.dict()
        
        success = await notification_manager.desktop_service.update_user_settings(
            current_user.id, settings_dict
        )
        
        return {
            "success": success,
            "message": "Desktop notification settings updated" if success else "Failed to update settings",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update desktop settings: {str(e)}"
        )


@router.get("/desktop/settings")
async def get_desktop_settings(
    current_user: User = Depends(require_auth),
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get current desktop notification settings"""
    try:
        settings = user_service.get_user_preference(current_user.id, "desktop_notification_settings") or {}
        
        # Provide defaults for missing values
        default_settings = {
            "enabled": True,
            "sound_enabled": True,
            "auto_close_time": 10,
            "priority_threshold": "normal",
            "quiet_hours_enabled": False,
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "07:00"
        }
        
        # Merge defaults with user settings
        merged_settings = {**default_settings, **settings}
        
        return {
            "success": True,
            "settings": merged_settings,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get desktop settings: {str(e)}"
        )


@router.post("/test/{channel}")
async def send_test_notification_channel(
    channel: str,
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    current_user: User = Depends(require_auth)
):
    """Send test notification via specific channel"""
    try:
        user_id = current_user.id
        
        # Validate channel
        valid_channels = ["email", "pushover", "desktop", "all"]
        if channel not in valid_channels:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid channel. Must be one of: {', '.join(valid_channels)}"
            )
        
        # Prepare test data
        test_data = {
            "station_name": f"Test Station via {channel.title()}",
            "job_id": f"TEST_{channel.upper()}_001",
            "work_order_id": f"TEST_WO_{channel.upper()}_001",
            "service_code": "2861",
            "dispenser_count": 4,
            "start_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "duration": "2 minutes",
            "forms_completed": 4,
            "success_rate": 100,
            "dispensers_processed": 4,
        }
        
        # Override notification preferences to force specific channel
        original_prefs = await notification_manager._get_user_preferences(user_id)
        
        if channel == "email":
            results = await notification_manager.email_service.send_automation_notification(
                user_id, NotificationTrigger.AUTOMATION_COMPLETED.value, test_data
            )
            results = {"email": results, "pushover": True, "desktop": True}  # Mark others as skipped
            
        elif channel == "pushover":
            results = await notification_manager.pushover_service.send_automation_notification(
                user_id, NotificationTrigger.AUTOMATION_COMPLETED.value, test_data, PushoverPriority.NORMAL
            )
            results = {"email": True, "pushover": results, "desktop": True}  # Mark others as skipped
            
        elif channel == "desktop":
            from ..services.desktop_notification import NotificationPriority as DesktopPriority
            results = await notification_manager.desktop_service.send_automation_notification(
                user_id, NotificationTrigger.AUTOMATION_COMPLETED.value, test_data, DesktopPriority.NORMAL
            )
            results = {"email": True, "pushover": True, "desktop": results}  # Mark others as skipped
            
        elif channel == "all":
            results = await notification_manager.send_automation_notification(
                user_id, NotificationTrigger.AUTOMATION_COMPLETED, test_data, PushoverPriority.NORMAL
            )
        
        return {
            "success": True,
            "message": f"Test notification sent via {channel}",
            "user_id": user_id,
            "channel": channel,
            "results": results,
            "test_data": test_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification via {channel}: {str(e)}"
        )


@router.get("/channels/status")
async def get_notification_channels_status(
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    current_user: User = Depends(require_auth)
):
    """Get status of all notification channels for the current user"""
    try:
        user_id = current_user.id
        
        # Get user preferences
        preferences = await notification_manager._get_user_preferences(user_id)
        
        # Check email configuration
        email_configured = bool(
            notification_manager.email_service.email_settings.username and
            notification_manager.email_service.email_settings.password
        )
        
        # Check Pushover configuration
        pushover_configured = bool(preferences and preferences.pushover_user_key)
        
        # Check desktop notification support
        desktop_supported = True  # Always available in web/electron
        
        return {
            "success": True,
            "channels": {
                "email": {
                    "enabled": preferences.email_enabled if preferences else True,
                    "configured": email_configured,
                    "smtp_server": notification_manager.email_service.email_settings.smtp_server,
                    "from_email": notification_manager.email_service.email_settings.from_email,
                    "status": "ready" if (email_configured and (preferences.email_enabled if preferences else True)) else "needs_configuration"
                },
                "pushover": {
                    "enabled": preferences.pushover_enabled if preferences else False,
                    "configured": pushover_configured,
                    "user_key_set": bool(preferences.pushover_user_key if preferences else False),
                    "device": preferences.pushover_device if preferences else None,
                    "sound": preferences.pushover_sound if preferences else "pushover",
                    "status": "ready" if (pushover_configured and (preferences.pushover_enabled if preferences else False)) else "needs_configuration"
                },
                "desktop": {
                    "enabled": preferences.desktop_enabled if preferences else True,
                    "supported": desktop_supported,
                    "sound_enabled": preferences.desktop_sound_enabled if preferences else True,
                    "auto_close_time": preferences.desktop_auto_close_time if preferences else 10,
                    "status": "ready" if desktop_supported else "not_supported"
                }
            },
            "quiet_hours": {
                "enabled": preferences and hasattr(preferences, 'quiet_hours_start'),
                "start": preferences.quiet_hours_start.strftime("%H:%M") if preferences and hasattr(preferences, 'quiet_hours_start') else "22:00",
                "end": preferences.quiet_hours_end.strftime("%H:%M") if preferences and hasattr(preferences, 'quiet_hours_end') else "07:00"
            },
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get channels status: {str(e)}"
        )