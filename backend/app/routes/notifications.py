#!/usr/bin/env python3
"""
Simplified Notification API Routes

Desktop app appropriate notification endpoints with basic functionality.
Removed enterprise complexity for desktop tool use case.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

from ..services.notification_manager import (
    NotificationManager, 
    NotificationTrigger,
    NotificationPriority,
    get_notification_manager
)
from ..services.pushover_notification import PushoverPriority
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
    """Simple notification preferences - 10 toggles maximum"""
    # Channel toggles (3) - all optional for partial updates
    email_enabled: Optional[bool] = None
    desktop_enabled: Optional[bool] = None
    pushover_enabled: Optional[bool] = None
    
    # Notification type channel settings (values: 'email', 'pushover', 'all', 'none')
    automation_started: Optional[str] = None
    automation_completed: Optional[str] = None
    automation_failed: Optional[str] = None
    error_alert: Optional[str] = None
    
    # Legacy trigger toggles (for backward compatibility)
    automation_started_enabled: Optional[bool] = None
    automation_completed_enabled: Optional[bool] = None
    automation_failed_enabled: Optional[bool] = None
    error_alert_enabled: Optional[bool] = None
    
    # Pushover settings (optional fields)
    pushover_user_key: Optional[str] = None
    pushover_api_token: Optional[str] = None
    pushover_sound: Optional[str] = None


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
        
        # Log the incoming preferences
        await logging_service.log_info(
            f"Updating notification preferences for user {current_user.id}: {preferences_dict}"
        )
        
        # Update preferences
        success = await notification_manager.update_user_preferences(current_user.id, preferences_dict)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update notification preferences"
            )
        
        # Get the updated preferences to return
        updated_prefs = notification_manager.get_user_preferences(current_user.id)
        
        return {
            "success": True,
            "message": "Notification preferences updated successfully",
            "user_id": current_user.id,
            "preferences": updated_prefs
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
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Send test notification via specific channel"""
    try:
        # Validate channel
        valid_channels = ["email", "desktop", "pushover", "both"]
        if channel not in valid_channels:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid channel. Must be one of: {', '.join(valid_channels)}"
            )
        
        await logging_service.log_info(f"Test notification requested for channel: {channel} by user {current_user.id}")
        
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
        
        await logging_service.log_info(
            f"Current preferences for user {current_user.id}: "
            f"pushover_enabled={current_prefs.get('pushover_enabled')}, "
            f"has_user_key={bool(current_prefs.get('pushover_user_key'))}, "
            f"has_api_token={bool(current_prefs.get('pushover_api_token'))}"
        )
        
        if channel == "email":
            temp_prefs = {**current_prefs, "email_enabled": True, "desktop_enabled": False, "pushover_enabled": False, "automation_completed": "email"}
        elif channel == "desktop":
            temp_prefs = {**current_prefs, "email_enabled": False, "desktop_enabled": True, "pushover_enabled": False, "automation_completed": "all"}
        elif channel == "pushover":
            temp_prefs = {**current_prefs, "email_enabled": False, "desktop_enabled": False, "pushover_enabled": True, "automation_completed": "pushover"}
        else:  # both
            temp_prefs = {**current_prefs, "email_enabled": True, "desktop_enabled": True, "pushover_enabled": True, "automation_completed": "all"}
        
        # Temporarily update preferences
        await notification_manager.update_user_preferences(current_user.id, temp_prefs)
        
        # For pushover or both channels, handle direct test notifications
        if channel in ["pushover", "both"]:
            results = {"email": False, "desktop": False, "pushover": False}
            
            # Test Pushover if enabled
            if channel == "pushover" or (channel == "both" and current_prefs.get("pushover_enabled")):
                # Create Pushover service directly from credentials
                pushover_user_key = current_prefs.get("pushover_user_key")
                pushover_api_token = current_prefs.get("pushover_api_token")
                
                if pushover_user_key and pushover_api_token:
                    try:
                        from ..services.pushover_notification import PushoverNotificationService, PushoverSettings
                        
                        pushover_settings = PushoverSettings(
                            user_key=pushover_user_key,
                            api_token=pushover_api_token,
                            sound=current_prefs.get("pushover_sound", "pushover")
                        )
                        
                        pushover_service = PushoverNotificationService(pushover_settings)
                        
                        # Send a simple test notification directly
                        test_result = await pushover_service.send_notification(
                            title="🧪 FossaWork Test",
                            message="Test notification from FossaWork Settings. Your Pushover integration is working!",
                            priority=PushoverPriority.NORMAL
                        )
                        await logging_service.log_info(
                            f"Pushover test notification result: {test_result} for user {current_user.id}"
                        )
                        results["pushover"] = test_result
                    except Exception as e:
                        await logging_service.log_error(
                            f"Pushover test notification error: {str(e)} for user {current_user.id}"
                        )
                        results["pushover"] = False
                else:
                    await logging_service.log_warning(
                        f"No Pushover credentials available for user {current_user.id}"
                    )
                    results["pushover"] = False
            
            # Test Email if both channel
            if channel == "both" and current_prefs.get("email_enabled"):
                # Send email through normal flow
                email_results = await notification_manager.send_automation_notification(
                    current_user.id, 
                    NotificationTrigger.AUTOMATION_COMPLETED, 
                    test_data, 
                    NotificationPriority.NORMAL
                )
                results["email"] = email_results.get("email", False)
        else:
            # Send test notification through normal flow for email/desktop
            results = await notification_manager.send_automation_notification(
                current_user.id, 
                NotificationTrigger.AUTOMATION_COMPLETED, 
                test_data, 
                NotificationPriority.NORMAL
            )
        
        await logging_service.log_info(
            f"Test notification results for {channel}: {results}"
        )
        
        # Restore original preferences
        await notification_manager.update_user_preferences(current_user.id, current_prefs)
        
        return {
            "success": True,
            "message": f"Test notification sent via {channel}",
            "user_id": current_user.id,
            "channel": channel,
            "results": results,
            "test_data": test_data,
            "details": {
                "pushover_enabled": temp_prefs.get("pushover_enabled", False),
                "pushover_credentials_present": bool(current_prefs.get("pushover_user_key")) and bool(current_prefs.get("pushover_api_token")),
                "preferences_used": temp_prefs
            }
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
                },
                "pushover": {
                    "enabled": preferences["pushover_enabled"],
                    "status": "available" if preferences.get("pushover_user_key") else "needs_setup"
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
                "Pushover notifications",
                "Basic preferences (10 toggles)",
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


@router.post("/validate-pushover/{user_id}")
async def validate_pushover_credentials(
    user_id: str,
    pushover_user_key: str = Query(None, description="Pushover user key to validate"),
    pushover_api_token: str = Query(None, description="Pushover application token to validate"),
    current_user: User = Depends(require_auth),
    notification_manager: NotificationManager = Depends(get_notification_manager_dependency)
):
    """Validate Pushover credentials (user key and/or application token)"""
    try:
        # Check if user has permission
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to validate these credentials")
        
        # Validate the Pushover credentials
        result = await notification_manager.validate_pushover_credentials(
            user_id, 
            user_key=pushover_user_key, 
            api_token=pushover_api_token
        )
        
        return {
            "success": True,
            "is_valid": result.get("valid", False),
            "message": result.get("message", "Unknown validation result"),
            "devices": result.get("devices", []),
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate Pushover credentials: {str(e)}"
        )