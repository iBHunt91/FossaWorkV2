#!/usr/bin/env python3
"""
Simplified Notification Manager

Desktop app appropriate notification system with only Email + Desktop channels.
Removed enterprise complexity for desktop tool use case.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from .email_notification import EmailNotificationService, EmailSettings, NotificationType, NotificationPriority
from .desktop_notification import DesktopNotificationService, DesktopNotificationSettings
from .logging_service import LoggingService

logger = logging.getLogger(__name__)


class NotificationTrigger(Enum):
    """Simple notification triggers"""
    AUTOMATION_STARTED = "automation_started"
    AUTOMATION_COMPLETED = "automation_completed"
    AUTOMATION_FAILED = "automation_failed"
    ERROR_ALERT = "error_alert"


@dataclass
class NotificationPreferences:
    """Simple user notification preferences - 8 toggles maximum"""
    user_id: str
    
    # Channel toggles (4 toggles)
    email_enabled: bool = True
    desktop_enabled: bool = True
    
    # Trigger toggles (4 toggles)
    automation_started_enabled: bool = True
    automation_completed_enabled: bool = True
    automation_failed_enabled: bool = True
    error_alert_enabled: bool = True


class NotificationManager:
    """Simplified notification management service"""
    
    def __init__(self, email_settings: EmailSettings, desktop_settings: DesktopNotificationSettings = None):
        self.logging_service = LoggingService()
        
        # Initialize simplified services
        self.email_service = EmailNotificationService(email_settings)
        self.desktop_service = DesktopNotificationService(desktop_settings or DesktopNotificationSettings())
        
        # Simple preferences storage
        self.user_preferences: Dict[str, NotificationPreferences] = {}
    
    async def initialize(self) -> bool:
        """Initialize notification manager"""
        try:
            desktop_init = await self.desktop_service.initialize()
            
            await self.logging_service.log_info(
                f"Simplified notification manager initialized - Desktop: {desktop_init}"
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize notification manager: {e}")
            return False
    
    async def send_automation_notification(
        self,
        user_id: str,
        trigger: NotificationTrigger,
        data: Dict[str, Any],
        priority: NotificationPriority = NotificationPriority.NORMAL
    ) -> Dict[str, bool]:
        """Send notification via enabled channels"""
        try:
            # Get user preferences
            preferences = self._get_user_preferences(user_id)
            
            # Check if this trigger is enabled
            if not self._is_trigger_enabled(trigger, preferences):
                return {"email": True, "desktop": True}  # Return success for disabled triggers
            
            results = {"email": True, "desktop": True}  # Default to success for disabled channels
            
            # Send email notification if enabled
            if preferences.email_enabled:
                notification_type = self._trigger_to_notification_type(trigger)
                results["email"] = await self.email_service.send_automation_notification(
                    user_id, notification_type, data, priority
                )
            
            # Send desktop notification if enabled
            if preferences.desktop_enabled:
                results["desktop"] = await self.desktop_service.send_automation_notification(
                    user_id, trigger.value, data, 
                    self.desktop_service.NotificationPriority.URGENT if priority == NotificationPriority.URGENT 
                    else self.desktop_service.NotificationPriority.NORMAL
                )
            
            # Log notification attempt
            channels_used = []
            if preferences.email_enabled:
                channels_used.append("email")
            if preferences.desktop_enabled:
                channels_used.append("desktop")
            
            success_count = sum(1 for r in results.values() if r)
            total_count = len(channels_used)
            
            await self.logging_service.log_info(
                f"Notification sent - User: {user_id}, Trigger: {trigger.value}, "
                f"Channels: {','.join(channels_used)}, Success: {success_count}/{total_count}"
            )
            
            return results
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending automation notification: {str(e)}"
            )
            return {"email": False, "desktop": False}
    
    async def send_system_alert(
        self,
        user_id: str,
        title: str,
        message: str
    ) -> Dict[str, bool]:
        """Send system alert via all enabled channels"""
        try:
            preferences = self._get_user_preferences(user_id)
            
            # Check if error alerts are enabled
            if not preferences.error_alert_enabled:
                return {"email": True, "desktop": True}
            
            results = {"email": True, "desktop": True}
            
            # Send via email if enabled
            if preferences.email_enabled:
                data = {
                    "error_type": "System Alert",
                    "error_message": message,
                    "component": "System",
                    "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                }
                results["email"] = await self.email_service.send_automation_notification(
                    user_id, NotificationType.ERROR_ALERT, data, NotificationPriority.URGENT
                )
            
            # Send via desktop if enabled
            if preferences.desktop_enabled:
                results["desktop"] = await self.desktop_service.send_system_alert(
                    user_id, message, self.desktop_service.NotificationPriority.URGENT
                )
            
            return results
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending system alert: {str(e)}"
            )
            return {"email": False, "desktop": False}
    
    async def update_user_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> bool:
        """Update user notification preferences"""
        try:
            # Convert dict to NotificationPreferences
            user_prefs = NotificationPreferences(user_id=user_id)
            
            # Update from provided preferences
            for key, value in preferences.items():
                if hasattr(user_prefs, key):
                    setattr(user_prefs, key, value)
            
            # Store preferences
            self.user_preferences[user_id] = user_prefs
            
            # Persist to file for simple storage
            await self._persist_user_preferences(user_id, user_prefs)
            
            await self.logging_service.log_info(
                f"Notification preferences updated for user {user_id}"
            )
            
            return True
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error updating notification preferences: {str(e)}"
            )
            return False
    
    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user notification preferences as dict"""
        preferences = self._get_user_preferences(user_id)
        return {
            'email_enabled': preferences.email_enabled,
            'desktop_enabled': preferences.desktop_enabled,
            'automation_started_enabled': preferences.automation_started_enabled,
            'automation_completed_enabled': preferences.automation_completed_enabled,
            'automation_failed_enabled': preferences.automation_failed_enabled,
            'error_alert_enabled': preferences.error_alert_enabled
        }
    
    async def get_pending_desktop_notifications(self, user_id: str) -> list:
        """Get pending desktop notifications for web polling"""
        return await self.desktop_service.get_pending_notifications(user_id)
    
    def _get_user_preferences(self, user_id: str) -> NotificationPreferences:
        """Get user notification preferences with defaults"""
        if user_id in self.user_preferences:
            return self.user_preferences[user_id]
        
        # Try to load from file
        preferences = self._load_user_preferences(user_id)
        if preferences:
            self.user_preferences[user_id] = preferences
            return preferences
        
        # Return defaults
        default_prefs = NotificationPreferences(user_id=user_id)
        self.user_preferences[user_id] = default_prefs
        return default_prefs
    
    def _is_trigger_enabled(self, trigger: NotificationTrigger, preferences: NotificationPreferences) -> bool:
        """Check if notification trigger is enabled"""
        trigger_mapping = {
            NotificationTrigger.AUTOMATION_STARTED: preferences.automation_started_enabled,
            NotificationTrigger.AUTOMATION_COMPLETED: preferences.automation_completed_enabled,
            NotificationTrigger.AUTOMATION_FAILED: preferences.automation_failed_enabled,
            NotificationTrigger.ERROR_ALERT: preferences.error_alert_enabled,
        }
        
        return trigger_mapping.get(trigger, True)
    
    def _trigger_to_notification_type(self, trigger: NotificationTrigger) -> NotificationType:
        """Convert trigger to email notification type"""
        mapping = {
            NotificationTrigger.AUTOMATION_STARTED: NotificationType.AUTOMATION_STARTED,
            NotificationTrigger.AUTOMATION_COMPLETED: NotificationType.AUTOMATION_COMPLETED,
            NotificationTrigger.AUTOMATION_FAILED: NotificationType.AUTOMATION_FAILED,
            NotificationTrigger.ERROR_ALERT: NotificationType.ERROR_ALERT,
        }
        
        return mapping.get(trigger, NotificationType.ERROR_ALERT)
    
    def _load_user_preferences(self, user_id: str) -> Optional[NotificationPreferences]:
        """Load user preferences from file"""
        try:
            import json
            from pathlib import Path
            
            prefs_path = Path(f"data/users/{user_id}/settings/notification_preferences.json")
            if prefs_path.exists():
                with open(prefs_path, 'r') as f:
                    data = json.load(f)
                
                preferences = NotificationPreferences(user_id=user_id)
                for key, value in data.items():
                    if hasattr(preferences, key):
                        setattr(preferences, key, value)
                
                return preferences
        except Exception as e:
            logger.warning(f"Error loading user preferences: {e}")
        
        return None
    
    async def _persist_user_preferences(self, user_id: str, preferences: NotificationPreferences):
        """Persist user preferences to file"""
        try:
            import json
            from pathlib import Path
            
            prefs_dir = Path(f"data/users/{user_id}/settings")
            prefs_dir.mkdir(parents=True, exist_ok=True)
            
            prefs_path = prefs_dir / "notification_preferences.json"
            
            data = {
                'email_enabled': preferences.email_enabled,
                'desktop_enabled': preferences.desktop_enabled,
                'automation_started_enabled': preferences.automation_started_enabled,
                'automation_completed_enabled': preferences.automation_completed_enabled,
                'automation_failed_enabled': preferences.automation_failed_enabled,
                'error_alert_enabled': preferences.error_alert_enabled
            }
            
            with open(prefs_path, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error persisting user preferences: {e}")
    
    async def cleanup(self):
        """Cleanup notification manager resources"""
        try:
            await self.desktop_service.cleanup()
            
            await self.logging_service.log_info("Simplified notification manager cleaned up")
            
        except Exception as e:
            logger.error(f"Error during notification manager cleanup: {e}")


# Factory function for dependency injection
def get_notification_manager(
    email_settings: EmailSettings = None,
    desktop_settings: DesktopNotificationSettings = None,
    user_id: str = None
) -> NotificationManager:
    """Factory function for creating simplified notification manager"""
    
    # Load user-specific SMTP settings
    if email_settings is None and user_id:
        import json
        from pathlib import Path
        
        # Load from user-specific SMTP settings file
        smtp_path = Path(f"data/users/{user_id}/settings/smtp.json")
        if smtp_path.exists():
            try:
                with open(smtp_path, 'r') as f:
                    smtp_config = json.load(f)
                
                email_settings = EmailSettings(
                    smtp_server=smtp_config.get('smtp_server', 'smtp.gmail.com'),
                    smtp_port=smtp_config.get('smtp_port', 587),
                    username=smtp_config.get('username', ''),
                    password=smtp_config.get('password', ''),
                    use_tls=smtp_config.get('use_tls', True),
                    from_email=smtp_config.get('from_email', smtp_config.get('username', '')),
                    from_name=smtp_config.get('from_name', 'FossaWork Automation')
                )
            except Exception as e:
                logger.error(f"Error loading SMTP settings for user {user_id}: {e}")
    
    # Fallback to default settings if not found
    if email_settings is None:
        email_settings = EmailSettings(
            smtp_server="smtp.gmail.com",
            smtp_port=587,
            username="fossawork@example.com",
            password="app_specific_password"
        )
    
    if desktop_settings is None:
        desktop_settings = DesktopNotificationSettings()
    
    return NotificationManager(email_settings, desktop_settings)