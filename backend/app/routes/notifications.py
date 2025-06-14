#!/usr/bin/env python3
"""
Notification API Routes

REST API endpoints for managing email and Pushover notifications,
user preferences, digest scheduling, and notification testing.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime, time
from pydantic import BaseModel

from ..database import get_db
from ..services.notification_manager import (
    NotificationManager, 
    NotificationTrigger, 
    NotificationChannel,
    get_notification_manager
)
from ..services.email_notification import EmailSettings
from ..services.pushover_notification import PushoverSettings, PushoverPriority
from ..services.user_management import UserManagementService
from ..services.logging_service import LoggingService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# Pydantic models for request/response
class NotificationPreferencesRequest(BaseModel):
    email_enabled: bool = True
    pushover_enabled: bool = False
    
    # Channel preferences
    automation_started: str = "email"
    automation_completed: str = "both"
    automation_failed: str = "both"
    automation_progress: str = "pushover"
    schedule_change: str = "email"
    daily_digest: str = "email"
    weekly_summary: str = "email"
    error_alert: str = "both"
    
    # Timing preferences
    digest_time: str = "08:00"
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "07:00"
    
    # Pushover specific
    pushover_user_key: Optional[str] = None
    pushover_device: Optional[str] = None
    pushover_sound: str = "pushover"


class TestNotificationRequest(BaseModel):
    notification_type: str
    channel: str = "both"
    test_data: Dict[str, Any] = {}


class EmergencyAlertRequest(BaseModel):
    title: str
    message: str
    target_users: List[str] = []
    force_all_channels: bool = True


def get_user_service(db: Session = Depends(get_db)) -> UserManagementService:
    return UserManagementService(db)


def get_logging_service(db: Session = Depends(get_db)) -> LoggingService:
    return LoggingService(db)


@router.get("/preferences/{user_id}")
async def get_user_notification_preferences(
    user_id: str,
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get user notification preferences"""
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
        # Get preferences
        preferences = user_service.get_user_preference(user_id, "notification_preferences")
        
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


@router.put("/preferences/{user_id}")
async def update_user_notification_preferences(
    user_id: str,
    preferences: NotificationPreferencesRequest,
    background_tasks: BackgroundTasks,
    notification_manager: NotificationManager = Depends(get_notification_manager),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Update user notification preferences"""
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
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


@router.post("/test/{user_id}")
async def send_test_notification(
    user_id: str,
    test_request: TestNotificationRequest,
    notification_manager: NotificationManager = Depends(get_notification_manager),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Send test notification to user"""
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
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


@router.post("/digest/{user_id}")
async def send_manual_digest(
    user_id: str,
    digest_type: str = Query("daily", description="Type of digest (daily/weekly)"),
    notification_manager: NotificationManager = Depends(get_notification_manager),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Manually trigger digest notification for user"""
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
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
    notification_manager: NotificationManager = Depends(get_notification_manager),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
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


@router.post("/validate-pushover/{user_id}")
async def validate_pushover_key(
    user_id: str,
    pushover_user_key: str,
    notification_manager: NotificationManager = Depends(get_notification_manager),
    user_service: UserManagementService = Depends(get_user_service)
):
    """Validate Pushover user key"""
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
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
    notification_manager: NotificationManager = Depends(get_notification_manager)
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
            "channels": ["email", "pushover", "both"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notification status: {str(e)}"
        )