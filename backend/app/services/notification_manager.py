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
from .pushover_notification import PushoverNotificationService, PushoverSettings, PushoverPriority, get_pushover_service
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
    """Simple user notification preferences - 10 toggles maximum"""
    user_id: str
    
    # Channel toggles (3 toggles)
    email_enabled: bool = True
    desktop_enabled: bool = True
    pushover_enabled: bool = False
    
    # Notification type channel settings (values: 'email', 'pushover', 'all', 'none')
    automation_started: str = "email"
    automation_completed: str = "email"
    automation_failed: str = "email"
    error_alert: str = "email"
    
    # Legacy support - will be removed
    automation_started_enabled: bool = True
    automation_completed_enabled: bool = True
    automation_failed_enabled: bool = True
    error_alert_enabled: bool = True
    
    # Pushover settings
    pushover_user_key: str = ""
    pushover_api_token: str = ""
    pushover_sound: str = "pushover"


class NotificationManager:
    """Simplified notification management service"""
    
    def __init__(self, email_settings: EmailSettings, desktop_settings: DesktopNotificationSettings = None):
        self.logging_service = LoggingService()
        
        # Initialize simplified services
        self.email_service = EmailNotificationService(email_settings)
        self.desktop_service = DesktopNotificationService(desktop_settings or DesktopNotificationSettings())
        
        # Simple preferences storage
        self.user_preferences: Dict[str, NotificationPreferences] = {}
        
        # Pushover services per user (lazy loaded)
        self.pushover_services: Dict[str, Optional[PushoverNotificationService]] = {}
    
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
                return {"email": True, "desktop": True, "pushover": True}  # Return success for disabled triggers
            
            # Get the channel setting for this trigger
            trigger_mapping = {
                NotificationTrigger.AUTOMATION_STARTED: preferences.automation_started,
                NotificationTrigger.AUTOMATION_COMPLETED: preferences.automation_completed,
                NotificationTrigger.AUTOMATION_FAILED: preferences.automation_failed,
                NotificationTrigger.ERROR_ALERT: preferences.error_alert,
            }
            channel_setting = trigger_mapping.get(trigger, "none")
            
            results = {"email": False, "desktop": False, "pushover": False}
            
            # Send notifications based on channel setting
            if channel_setting in ["email", "all"]:
                # Send email notification if the email channel is enabled globally
                if preferences.email_enabled:
                    notification_type = self._trigger_to_notification_type(trigger)
                    results["email"] = await self.email_service.send_automation_notification(
                        user_id, notification_type, data, priority
                    )
                else:
                    await self.logging_service.log_warning(
                        f"Email requested for {trigger.value} but email channel is disabled"
                    )
            
            # Desktop notification (always if not 'none' and desktop is enabled)
            if channel_setting != "none" and preferences.desktop_enabled:
                results["desktop"] = await self.desktop_service.send_automation_notification(
                    user_id, trigger.value, data, 
                    self.desktop_service.NotificationPriority.URGENT if priority == NotificationPriority.URGENT 
                    else self.desktop_service.NotificationPriority.NORMAL
                )
            
            # Send Pushover notification if selected
            if channel_setting in ["pushover", "all"]:
                # Send pushover if the pushover channel is enabled globally
                if preferences.pushover_enabled:
                    pushover_service = await self._get_pushover_service(user_id, preferences)
                    if pushover_service:
                        pushover_priority = PushoverPriority.HIGH if priority == NotificationPriority.URGENT else PushoverPriority.NORMAL
                        try:
                            await self.logging_service.log_info(
                                f"Attempting to send Pushover notification for user {user_id} with trigger {trigger.value}"
                            )
                            results["pushover"] = await pushover_service.send_automation_notification(
                                user_id, trigger.value, data, pushover_priority
                            )
                            await self.logging_service.log_info(
                                f"Pushover notification sent for user {user_id}: {results['pushover']}"
                            )
                        except Exception as e:
                            results["pushover"] = False
                            await self.logging_service.log_error(
                                f"Error sending Pushover notification for user {user_id}: {str(e)}"
                            )
                    else:
                        results["pushover"] = False
                        await self.logging_service.log_warning(
                            f"Pushover service unavailable for user {user_id} - check credentials"
                        )
                else:
                    await self.logging_service.log_warning(
                        f"Pushover requested for {trigger.value} but pushover channel is disabled"
                    )
            
            # Log notification attempt
            channels_used = []
            if preferences.email_enabled:
                channels_used.append("email")
            if preferences.desktop_enabled:
                channels_used.append("desktop")
            if preferences.pushover_enabled:
                channels_used.append("pushover")
            
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
            return {"email": False, "desktop": False, "pushover": False}
    
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
                return {"email": True, "desktop": True, "pushover": True}
            
            results = {"email": True, "desktop": True, "pushover": True}
            
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
            
            # Send via Pushover if enabled
            if preferences.pushover_enabled:
                pushover_service = await self._get_pushover_service(user_id, preferences)
                if pushover_service:
                    results["pushover"] = await pushover_service.send_notification(
                        title=title, message=message, priority=PushoverPriority.HIGH
                    )
                else:
                    results["pushover"] = False
            
            return results
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending system alert: {str(e)}"
            )
            return {"email": False, "desktop": False, "pushover": False}
    
    async def update_user_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> bool:
        """Update user notification preferences"""
        try:
            # Get existing preferences first
            existing_prefs = self._get_user_preferences(user_id)
            
            # Create a new preferences object starting with existing values
            user_prefs = NotificationPreferences(
                user_id=user_id,
                email_enabled=existing_prefs.email_enabled,
                desktop_enabled=existing_prefs.desktop_enabled,
                pushover_enabled=existing_prefs.pushover_enabled,
                automation_started=existing_prefs.automation_started,
                automation_completed=existing_prefs.automation_completed,
                automation_failed=existing_prefs.automation_failed,
                error_alert=existing_prefs.error_alert,
                automation_started_enabled=existing_prefs.automation_started_enabled,
                automation_completed_enabled=existing_prefs.automation_completed_enabled,
                automation_failed_enabled=existing_prefs.automation_failed_enabled,
                error_alert_enabled=existing_prefs.error_alert_enabled,
                pushover_user_key=existing_prefs.pushover_user_key,
                pushover_api_token=existing_prefs.pushover_api_token,
                pushover_sound=existing_prefs.pushover_sound
            )
            
            # Update only the provided preferences (skip None values)
            for key, value in preferences.items():
                if value is not None and hasattr(user_prefs, key):
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
            'pushover_enabled': preferences.pushover_enabled,
            # New channel settings
            'automation_started': preferences.automation_started,
            'automation_completed': preferences.automation_completed,
            'automation_failed': preferences.automation_failed,
            'error_alert': preferences.error_alert,
            # Legacy enabled fields
            'automation_started_enabled': preferences.automation_started_enabled,
            'automation_completed_enabled': preferences.automation_completed_enabled,
            'automation_failed_enabled': preferences.automation_failed_enabled,
            'error_alert_enabled': preferences.error_alert_enabled,
            'pushover_user_key': preferences.pushover_user_key,
            'pushover_api_token': preferences.pushover_api_token,
            'pushover_sound': preferences.pushover_sound
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
        # Map trigger to preference field
        trigger_mapping = {
            NotificationTrigger.AUTOMATION_STARTED: preferences.automation_started,
            NotificationTrigger.AUTOMATION_COMPLETED: preferences.automation_completed,
            NotificationTrigger.AUTOMATION_FAILED: preferences.automation_failed,
            NotificationTrigger.ERROR_ALERT: preferences.error_alert,
        }
        
        # Get the channel setting for this trigger
        channel_setting = trigger_mapping.get(trigger, "none")
        
        # If set to 'none', trigger is disabled
        return channel_setting != "none"
    
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
                'pushover_enabled': preferences.pushover_enabled,
                # New channel settings
                'automation_started': preferences.automation_started,
                'automation_completed': preferences.automation_completed,
                'automation_failed': preferences.automation_failed,
                'error_alert': preferences.error_alert,
                # Legacy boolean fields
                'automation_started_enabled': preferences.automation_started_enabled,
                'automation_completed_enabled': preferences.automation_completed_enabled,
                'automation_failed_enabled': preferences.automation_failed_enabled,
                'error_alert_enabled': preferences.error_alert_enabled,
                # Pushover settings
                'pushover_user_key': preferences.pushover_user_key,
                'pushover_api_token': preferences.pushover_api_token,
                'pushover_sound': preferences.pushover_sound
            }
            
            with open(prefs_path, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error persisting user preferences: {e}")
    
    async def _get_pushover_service(self, user_id: str, preferences: NotificationPreferences) -> Optional[PushoverNotificationService]:
        """Get or create Pushover service for user"""
        try:
            # Check if service is already cached
            if user_id in self.pushover_services:
                return self.pushover_services[user_id]
            
            # Check if user has valid Pushover settings
            if not preferences.pushover_user_key or not preferences.pushover_api_token:
                await self.logging_service.log_warning(
                    f"Pushover credentials missing for user {user_id} - "
                    f"user_key: {'present' if preferences.pushover_user_key else 'missing'}, "
                    f"api_token: {'present' if preferences.pushover_api_token else 'missing'}"
                )
                self.pushover_services[user_id] = None
                return None
            
            # Create Pushover service
            pushover_settings = PushoverSettings(
                user_key=preferences.pushover_user_key,
                api_token=preferences.pushover_api_token,
                sound=preferences.pushover_sound
            )
            
            service = PushoverNotificationService(pushover_settings)
            self.pushover_services[user_id] = service
            
            await self.logging_service.log_info(
                f"Pushover service created successfully for user {user_id}"
            )
            
            return service
            
        except ValueError as e:
            await self.logging_service.log_error(
                f"Invalid Pushover credentials for user {user_id}: {e}"
            )
            self.pushover_services[user_id] = None
            return None
        except Exception as e:
            await self.logging_service.log_error(
                f"Error creating Pushover service for user {user_id}: {e}"
            )
            self.pushover_services[user_id] = None
            return None
    
    async def validate_pushover_credentials(self, user_id: str, user_key: str = None, api_token: str = None) -> dict:
        """Validate Pushover credentials"""
        try:
            # Get current preferences for fallback values
            preferences = self._get_user_preferences(user_id)
            
            # Use provided values or fall back to stored preferences
            test_user_key = user_key or preferences.pushover_user_key
            test_api_token = api_token or preferences.pushover_api_token
            
            if not test_user_key or not test_api_token:
                return {
                    "valid": False,
                    "message": "Both user key and application token are required"
                }
            
            # Create a temporary service to validate credentials
            temp_settings = PushoverSettings(
                user_key=test_user_key,
                api_token=test_api_token
            )
            temp_service = PushoverNotificationService(temp_settings)
            return await temp_service.validate_credentials(test_user_key, test_api_token)
            
        except ValueError as e:
            # Handle validation errors from PushoverSettings
            return {
                "valid": False,
                "message": str(e)
            }
        except Exception as e:
            logger.error(f"Error validating Pushover credentials: {e}")
            return {
                "valid": False,
                "message": f"Validation error: {str(e)}"
            }
    
    async def validate_pushover_key(self, user_id: str, user_key: str) -> bool:
        """Validate a Pushover user key (legacy method for backward compatibility)"""
        result = await self.validate_pushover_credentials(user_id, user_key=user_key)
        return result.get("valid", False)
    
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