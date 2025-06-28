#!/usr/bin/env python3
"""
Simplified Notification API Routes

Desktop app appropriate notification endpoints with basic functionality.
Removed enterprise complexity for desktop tool use case.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from datetime import datetime
from pydantic import BaseModel

from ..services.notification_manager import (
    NotificationManager, 
    NotificationTrigger,
    NotificationPriority,
    get_notification_manager
)
from ..services.email_notification import EmailSettings
from ..services.desktop_notification import DesktopNotificationSettings
from ..services.logging_service import LoggingService
from ..auth.dependencies import require_auth
from ..models.user_models import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def get_logging_service():
    """Get logging service instance"""
    return LoggingService()


def get_notification_manager_dependency(current_user: User = Depends(require_auth)):
    """Get notification manager instance"""
    return get_notification_manager(user_id=current_user.id)


# Simplified Pydantic models
class NotificationPreferencesRequest(BaseModel):
    """Simple notification preferences - 8 toggles maximum"""
    # Channel toggles (2)
    email_enabled: bool = True
    desktop_enabled: bool = True
    
    # Trigger toggles (4)
    automation_started_enabled: bool = True
    automation_completed_enabled: bool = True
    automation_failed_enabled: bool = True
    error_alert_enabled: bool = True


class TestNotificationRequest(BaseModel):
    """Simple test notification request"""
    channel: str = "both"  # email, desktop, or both
    test_data: Dict[str, Any] = {}


@router.get("/preferences")
async def get_notification_preferences(
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Get user notification preferences"""
    try:
        preferences = notification_manager.get_user_preferences(current_user.id)
        
        return {
            "success": True,
            "user_id": current_user.id,
            "preferences": preferences
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notification preferences: {str(e)}"
        )


@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferencesRequest,
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Update user notification preferences"""
    try:
        # Convert request to dict
        preferences_dict = preferences.dict()
        
        # Update preferences
        success = await notification_manager.update_user_preferences(current_user.id, preferences_dict)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update notification preferences"
            )
        
        return {
            "success": True,
            "message": "Notification preferences updated successfully",
            "user_id": current_user.id,
            "preferences": preferences_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await logging_service.log_error(
            f"Failed to update notification preferences for user {current_user.id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update notification preferences: {str(e)}"
        )


@router.post("/test")
async def send_test_notification(
    test_request: TestNotificationRequest,
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Send test notification"""
    try:
        # Prepare test data
        test_data = {
            "station_name": "Test Station #001",
            "job_id": "TEST_JOB_001",
            "service_code": "2861",
            "dispenser_count": 4,
            "start_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "duration": "5 minutes",
            "forms_completed": 4,
            "success_rate": 100,
            "error_message": "This is a test error message",
            "failure_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            **test_request.test_data
        }
        
        # Send test notification (always use AUTOMATION_COMPLETED for testing)
        results = await notification_manager.send_automation_notification(
            current_user.id, 
            NotificationTrigger.AUTOMATION_COMPLETED, 
            test_data, 
            NotificationPriority.NORMAL
        )
        
        await logging_service.log_info(
            f"Test notification sent to user {current_user.id}"
        )
        
        return {
            "success": True,
            "message": "Test notification sent",
            "user_id": current_user.id,
            "channel": test_request.channel,
            "results": results,
            "test_data": test_data
        }
        
    except Exception as e:
        await logging_service.log_error(
            f"Failed to send test notification: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )


@router.post("/test/{channel}")
async def send_test_notification_channel(
    channel: str,
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Send test notification via specific channel"""
    try:
        # Validate channel
        valid_channels = ["email", "desktop", "both"]
        if channel not in valid_channels:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid channel. Must be one of: {', '.join(valid_channels)}"
            )
        
        # Prepare test data
        test_data = {
            "station_name": f"Test Station via {channel.title()}",
            "job_id": f"TEST_{channel.upper()}_001",
            "service_code": "2861",
            "dispenser_count": 4,
            "start_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "duration": "3 minutes",
            "forms_completed": 4,
            "success_rate": 100,
        }
        
        # Temporarily override user preferences to test specific channel
        current_prefs = notification_manager.get_user_preferences(current_user.id)
        
        if channel == "email":
            temp_prefs = {**current_prefs, "email_enabled": True, "desktop_enabled": False}
        elif channel == "desktop":
            temp_prefs = {**current_prefs, "email_enabled": False, "desktop_enabled": True}
        else:  # both
            temp_prefs = {**current_prefs, "email_enabled": True, "desktop_enabled": True}
        
        # Temporarily update preferences
        await notification_manager.update_user_preferences(current_user.id, temp_prefs)
        
        # Send test notification
        results = await notification_manager.send_automation_notification(
            current_user.id, 
            NotificationTrigger.AUTOMATION_COMPLETED, 
            test_data, 
            NotificationPriority.NORMAL
        )
        
        # Restore original preferences
        await notification_manager.update_user_preferences(current_user.id, current_prefs)
        
        return {
            "success": True,
            "message": f"Test notification sent via {channel}",
            "user_id": current_user.id,
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


@router.get("/status")
async def get_notification_status(
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Get simplified notification system status"""
    try:
        # Get user preferences
        preferences = notification_manager.get_user_preferences(current_user.id)
        
        return {
            "success": True,
            "message": "Simplified notification system is operational",
            "channels": {
                "email": {
                    "enabled": preferences["email_enabled"],
                    "status": "available"
                },
                "desktop": {
                    "enabled": preferences["desktop_enabled"],
                    "status": "available"
                }
            },
            "notification_types": [
                "automation_started",
                "automation_completed", 
                "automation_failed",
                "error_alert"
            ],
            "features": [
                "Simple email notifications",
                "Desktop notifications", 
                "Basic preferences (8 toggles)",
                "Two priority levels (Normal/Urgent)"
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get notification status: {str(e)}"
        )


@router.get("/desktop/pending")
async def get_pending_desktop_notifications(
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Get pending desktop notifications for web polling"""
    try:
        notifications = await notification_manager.get_pending_desktop_notifications(current_user.id)
        
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


@router.post("/alert")
async def send_system_alert(
    title: str,
    message: str,
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Send system alert notification"""
    try:
        results = await notification_manager.send_system_alert(
            current_user.id, title, message
        )
        
        return {
            "success": True,
            "message": "System alert sent",
            "results": results,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send system alert: {str(e)}"
        )