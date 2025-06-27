#!/usr/bin/env python3
"""
Unified Notification Manager

Coordinated notification system that manages both email and Pushover notifications
with user preferences, scheduling, digest reports, and integration with automation services.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, time
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.orm import Session

from ..services.email_notification import EmailNotificationService, EmailSettings, NotificationType
from ..services.pushover_notification import PushoverNotificationService, PushoverSettings, PushoverPriority
from ..services.desktop_notification import DesktopNotificationService, DesktopNotificationSettings, NotificationPriority as DesktopPriority
from ..services.logging_service import LoggingService
from ..services.user_management import UserManagementService
from ..database import get_db

logger = logging.getLogger(__name__)


class NotificationChannel(Enum):
    """Available notification channels"""
    EMAIL = "email"
    PUSHOVER = "pushover"
    DESKTOP = "desktop"
    EMAIL_PUSHOVER = "email_pushover"
    EMAIL_DESKTOP = "email_desktop"
    PUSHOVER_DESKTOP = "pushover_desktop"
    ALL = "all"


class NotificationTrigger(Enum):
    """Notification trigger events"""
    AUTOMATION_STARTED = "automation_started"
    AUTOMATION_COMPLETED = "automation_completed"
    AUTOMATION_FAILED = "automation_failed"
    AUTOMATION_PROGRESS = "automation_progress"
    SCHEDULE_CHANGE = "schedule_change"
    DAILY_DIGEST = "daily_digest"
    WEEKLY_SUMMARY = "weekly_summary"
    ERROR_ALERT = "error_alert"
    SYSTEM_MAINTENANCE = "system_maintenance"


@dataclass
class NotificationPreferences:
    """User notification preferences"""
    user_id: str
    email_enabled: bool = True
    pushover_enabled: bool = False
    desktop_enabled: bool = True
    
    # Channel preferences for each trigger
    automation_started: NotificationChannel = NotificationChannel.EMAIL_DESKTOP
    automation_completed: NotificationChannel = NotificationChannel.ALL
    automation_failed: NotificationChannel = NotificationChannel.ALL
    automation_progress: NotificationChannel = NotificationChannel.PUSHOVER_DESKTOP
    schedule_change: NotificationChannel = NotificationChannel.EMAIL_DESKTOP
    daily_digest: NotificationChannel = NotificationChannel.EMAIL
    weekly_summary: NotificationChannel = NotificationChannel.EMAIL
    error_alert: NotificationChannel = NotificationChannel.ALL
    
    # Timing preferences
    digest_time: time = time(8, 0)  # 8:00 AM
    quiet_hours_start: time = time(22, 0)  # 10:00 PM
    quiet_hours_end: time = time(7, 0)   # 7:00 AM
    
    # Pushover specific
    pushover_user_key: Optional[str] = None
    pushover_device: Optional[str] = None
    pushover_sound: str = "pushover"
    
    # Desktop specific
    desktop_sound_enabled: bool = True
    desktop_auto_close_time: int = 10
    desktop_quiet_hours_enabled: bool = False


@dataclass
class DigestData:
    """Daily/weekly digest data structure"""
    user_id: str
    period_start: datetime
    period_end: datetime
    total_jobs: int
    successful_jobs: int
    failed_jobs: int
    dispensers_processed: int
    stations_automated: Set[str]
    average_duration: float
    recent_jobs: List[Dict[str, Any]]
    schedule_changes: List[Dict[str, Any]]
    error_summary: List[Dict[str, Any]]


class NotificationManager:
    """Unified notification management service"""
    
    def __init__(self, db: Session, email_settings: EmailSettings, pushover_settings: PushoverSettings, desktop_settings: DesktopNotificationSettings = None):
        self.db = db
        self.logging_service = LoggingService()
        self.user_service = UserManagementService()
        
        # Initialize notification services
        self.email_service = EmailNotificationService(db, email_settings)
        self.pushover_service = PushoverNotificationService(db, pushover_settings)
        self.desktop_service = DesktopNotificationService(db, desktop_settings or DesktopNotificationSettings())
        
        # Background tasks
        self.digest_scheduler_running = False
        self.notification_processor_running = False
        
    async def initialize(self) -> bool:
        """Initialize notification manager"""
        try:
            # Initialize services
            pushover_init = await self.pushover_service.initialize()
            desktop_init = await self.desktop_service.initialize()
            
            # Start background tasks
            asyncio.create_task(self._digest_scheduler())
            asyncio.create_task(self._notification_processor())
            
            await self.logging_service.log_info(
                f"Notification manager initialized successfully - "
                f"Pushover: {pushover_init}, Desktop: {desktop_init}"
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
        priority: Optional[PushoverPriority] = None
    ) -> Dict[str, bool]:
        """Send notification via appropriate channels based on user preferences"""
        try:
            # Get user preferences
            preferences = await self._get_user_preferences(user_id)
            if not preferences:
                logger.warning(f"No notification preferences found for user {user_id}")
                return {"email": False, "pushover": False, "desktop": False}
            
            # Determine which channels to use
            channel = self._get_trigger_channel(trigger, preferences)
            
            results = {"email": True, "pushover": True, "desktop": True}  # Default to success for disabled channels
            
            # Send email notification
            if self._should_send_email(channel, preferences):
                email_type = self._trigger_to_email_type(trigger)
                results["email"] = await self.email_service.send_automation_notification(
                    user_id, email_type, data, self._pushover_to_email_priority(priority)
                )
            
            # Send Pushover notification
            if self._should_send_pushover(channel, preferences):
                results["pushover"] = await self.pushover_service.send_automation_notification(
                    user_id, trigger.value, data, priority
                )
            
            # Send Desktop notification
            if self._should_send_desktop(channel, preferences):
                desktop_priority = self._pushover_to_desktop_priority(priority)
                results["desktop"] = await self.desktop_service.send_automation_notification(
                    user_id, trigger.value, data, desktop_priority
                )
            
            # Log notification attempt
            channels_used = []
            if self._should_send_email(channel, preferences):
                channels_used.append("email")
            if self._should_send_pushover(channel, preferences):
                channels_used.append("pushover")
            if self._should_send_desktop(channel, preferences):
                channels_used.append("desktop")
            
            success_count = sum(1 for r in results.values() if r)
            total_count = len([c for c in channels_used])
            
            await self.logging_service.log_info(
                f"Notification sent - User: {user_id}, Trigger: {trigger.value}, "
                f"Channels: {','.join(channels_used)}, Success: {success_count}/{total_count}"
            )
            
            return results
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending automation notification: {str(e)}"
            )
            return {"email": False, "pushover": False, "desktop": False}
    
    async def send_daily_digest(self, user_id: str) -> bool:
        """Generate and send daily digest"""
        try:
            # Get user preferences
            preferences = await self._get_user_preferences(user_id)
            if not preferences or not preferences.email_enabled:
                return True  # Not an error if disabled
            
            # Check if user wants daily digest
            channel = preferences.daily_digest
            if channel == NotificationChannel.PUSHOVER:
                # Skip email digest if user only wants Pushover
                return True
            
            # Generate digest data
            digest_data = await self._generate_digest_data(user_id, "daily")
            if not digest_data:
                logger.info(f"No digest data for user {user_id}")
                return True
            
            # Convert to notification format
            notification_data = {
                "date": digest_data.period_start.strftime("%Y-%m-%d"),
                "total_jobs": digest_data.total_jobs,
                "successful_jobs": digest_data.successful_jobs,
                "failed_jobs": digest_data.failed_jobs,
                "dispensers_processed": digest_data.dispensers_processed,
                "recent_jobs": digest_data.recent_jobs[:5],  # Limit to 5 most recent
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            }
            
            # Send email digest
            success = await self.email_service.send_daily_digest(user_id, notification_data)
            
            # Send Pushover summary if enabled
            if channel == NotificationChannel.BOTH and preferences.pushover_enabled:
                await self.pushover_service.send_automation_notification(
                    user_id, "daily_summary", notification_data, PushoverPriority.LOW
                )
            
            return success
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending daily digest: {str(e)}"
            )
            return False
    
    async def send_emergency_alert(
        self,
        user_id: str,
        title: str,
        message: str,
        force_all_channels: bool = True
    ) -> Dict[str, bool]:
        """Send emergency alert via all available channels"""
        try:
            preferences = await self._get_user_preferences(user_id)
            results = {"email": True, "pushover": True, "desktop": True}
            
            # Send via email (high priority)
            if (force_all_channels or preferences.email_enabled):
                data = {
                    "station_name": "System Alert",
                    "job_id": "EMERGENCY",
                    "work_order_id": "ALERT",
                    "error_message": message,
                    "failure_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "progress_percentage": 0,
                    "retry_available": False
                }
                results["email"] = await self.email_service.send_automation_notification(
                    user_id, NotificationType.AUTOMATION_FAILED, data
                )
            
            # Send via Pushover (emergency priority)
            if (force_all_channels or preferences.pushover_enabled) and preferences.pushover_user_key:
                results["pushover"] = await self.pushover_service.send_emergency_alert(
                    user_id, title, message
                )
            
            # Send via Desktop (critical priority)
            if (force_all_channels or preferences.desktop_enabled):
                results["desktop"] = await self.desktop_service.send_system_alert(
                    user_id, message, DesktopPriority.CRITICAL
                )
            
            return results
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending emergency alert: {str(e)}"
            )
            return {"email": False, "pushover": False, "desktop": False}
    
    async def update_user_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> bool:
        """Update user notification preferences"""
        try:
            # Validate Pushover user key if provided
            if preferences.get("pushover_enabled") and preferences.get("pushover_user_key"):
                is_valid = await self.pushover_service.validate_user_key(
                    preferences["pushover_user_key"]
                )
                if not is_valid:
                    raise ValueError("Invalid Pushover user key")
            
            # Store preferences
            result = await self.user_service.update_user_preferences(user_id, "notification_preferences", preferences)
            
            if not result:
                await self.logging_service.log_error(f"Failed to store notification preferences for user {user_id}")
                return False
            
            await self.logging_service.log_info(
                f"Notification preferences updated for user {user_id}"
            )
            
            return True
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error updating notification preferences: {str(e)}"
            )
            return False
    
    async def _get_user_preferences(self, user_id: str) -> Optional[NotificationPreferences]:
        """Get user notification preferences"""
        try:
            prefs_data = self.user_service.get_user_preference(user_id, "notification_preferences")
            if not prefs_data:
                # Return default preferences
                return NotificationPreferences(user_id=user_id)
            
            # Convert dict to NotificationPreferences
            preferences = NotificationPreferences(user_id=user_id)
            
            # Update from stored preferences
            for key, value in prefs_data.items():
                if hasattr(preferences, key):
                    if key in ["digest_time", "quiet_hours_start", "quiet_hours_end"]:
                        # Handle time fields
                        if isinstance(value, str):
                            hour, minute = map(int, value.split(":"))
                            setattr(preferences, key, time(hour, minute))
                    elif key.startswith("automation_") or key in ["schedule_change", "daily_digest", "weekly_summary", "error_alert"]:
                        # Handle channel preferences
                        setattr(preferences, key, NotificationChannel(value))
                    else:
                        setattr(preferences, key, value)
            
            return preferences
            
        except Exception as e:
            logger.warning(f"Error getting user preferences: {e}")
            return NotificationPreferences(user_id=user_id)
    
    def _get_trigger_channel(self, trigger: NotificationTrigger, preferences: NotificationPreferences) -> NotificationChannel:
        """Get notification channel for trigger based on preferences"""
        trigger_mapping = {
            NotificationTrigger.AUTOMATION_STARTED: preferences.automation_started,
            NotificationTrigger.AUTOMATION_COMPLETED: preferences.automation_completed,
            NotificationTrigger.AUTOMATION_FAILED: preferences.automation_failed,
            NotificationTrigger.AUTOMATION_PROGRESS: preferences.automation_progress,
            NotificationTrigger.SCHEDULE_CHANGE: preferences.schedule_change,
            NotificationTrigger.DAILY_DIGEST: preferences.daily_digest,
            NotificationTrigger.WEEKLY_SUMMARY: preferences.weekly_summary,
            NotificationTrigger.ERROR_ALERT: preferences.error_alert,
        }
        
        return trigger_mapping.get(trigger, NotificationChannel.EMAIL)
    
    def _trigger_to_email_type(self, trigger: NotificationTrigger) -> NotificationType:
        """Convert trigger to email notification type"""
        mapping = {
            NotificationTrigger.AUTOMATION_STARTED: NotificationType.AUTOMATION_STARTED,
            NotificationTrigger.AUTOMATION_COMPLETED: NotificationType.AUTOMATION_COMPLETED,
            NotificationTrigger.AUTOMATION_FAILED: NotificationType.AUTOMATION_FAILED,
            NotificationTrigger.SCHEDULE_CHANGE: NotificationType.SCHEDULE_CHANGE,
            NotificationTrigger.DAILY_DIGEST: NotificationType.DAILY_DIGEST,
            NotificationTrigger.WEEKLY_SUMMARY: NotificationType.WEEKLY_SUMMARY,
            NotificationTrigger.ERROR_ALERT: NotificationType.ERROR_ALERT,
            NotificationTrigger.SYSTEM_MAINTENANCE: NotificationType.SYSTEM_MAINTENANCE,
        }
        
        return mapping.get(trigger, NotificationType.AUTOMATION_COMPLETED)
    
    def _pushover_to_email_priority(self, pushover_priority: Optional[PushoverPriority]):
        """Convert Pushover priority to email priority (placeholder)"""
        # Email service uses NotificationPriority from email_notification.py
        # This is a simple mapping - adjust based on actual email priority system
        from ..services.email_notification import NotificationPriority
        
        if not pushover_priority:
            return NotificationPriority.NORMAL
        
        mapping = {
            PushoverPriority.LOWEST: NotificationPriority.LOW,
            PushoverPriority.LOW: NotificationPriority.LOW,
            PushoverPriority.NORMAL: NotificationPriority.NORMAL,
            PushoverPriority.HIGH: NotificationPriority.HIGH,
            PushoverPriority.EMERGENCY: NotificationPriority.URGENT,
        }
        
        return mapping.get(pushover_priority, NotificationPriority.NORMAL)
    
    def _pushover_to_desktop_priority(self, pushover_priority: Optional[PushoverPriority]) -> DesktopPriority:
        """Convert Pushover priority to desktop priority"""
        if not pushover_priority:
            return DesktopPriority.NORMAL
        
        mapping = {
            PushoverPriority.LOWEST: DesktopPriority.LOW,
            PushoverPriority.LOW: DesktopPriority.LOW,
            PushoverPriority.NORMAL: DesktopPriority.NORMAL,
            PushoverPriority.HIGH: DesktopPriority.HIGH,
            PushoverPriority.EMERGENCY: DesktopPriority.CRITICAL,
        }
        
        return mapping.get(pushover_priority, DesktopPriority.NORMAL)
    
    def _should_send_email(self, channel: NotificationChannel, preferences: NotificationPreferences) -> bool:
        """Check if email notification should be sent"""
        return (channel in [
            NotificationChannel.EMAIL, 
            NotificationChannel.EMAIL_PUSHOVER, 
            NotificationChannel.EMAIL_DESKTOP,
            NotificationChannel.ALL
        ] and preferences.email_enabled)
    
    def _should_send_pushover(self, channel: NotificationChannel, preferences: NotificationPreferences) -> bool:
        """Check if Pushover notification should be sent"""
        return (channel in [
            NotificationChannel.PUSHOVER, 
            NotificationChannel.EMAIL_PUSHOVER, 
            NotificationChannel.PUSHOVER_DESKTOP,
            NotificationChannel.ALL
        ] and preferences.pushover_enabled)
    
    def _should_send_desktop(self, channel: NotificationChannel, preferences: NotificationPreferences) -> bool:
        """Check if desktop notification should be sent"""
        return (channel in [
            NotificationChannel.DESKTOP, 
            NotificationChannel.EMAIL_DESKTOP, 
            NotificationChannel.PUSHOVER_DESKTOP,
            NotificationChannel.ALL
        ] and preferences.desktop_enabled)
    
    async def _generate_digest_data(self, user_id: str, period: str) -> Optional[DigestData]:
        """Generate digest data for user"""
        try:
            # Calculate period
            now = datetime.utcnow()
            if period == "daily":
                period_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
                period_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == "weekly":
                days_since_monday = now.weekday()
                period_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_since_monday + 7)
                period_end = period_start + timedelta(days=7)
            else:
                return None
            
            # Get user activities for the period
            activities = self.user_service.get_user_activities(
                user_id, period_start, period_end
            )
            
            # Process activities to generate digest data
            total_jobs = 0
            successful_jobs = 0
            failed_jobs = 0
            dispensers_processed = 0
            stations_automated = set()
            durations = []
            recent_jobs = []
            
            for activity in activities:
                if activity.activity_type in ["automation_job_completed", "automation_job_failed", "full_automation_executed"]:
                    total_jobs += 1
                    
                    data = activity.data or {}
                    
                    if activity.activity_type == "automation_job_completed" or "successful" in str(data):
                        successful_jobs += 1
                    else:
                        failed_jobs += 1
                    
                    # Extract dispenser count
                    dispensers_processed += data.get("dispenser_count", 1)
                    
                    # Extract station name
                    station_name = data.get("station_name", "Unknown Station")
                    stations_automated.add(station_name)
                    
                    # Add to recent jobs
                    recent_jobs.append({
                        "station_name": station_name,
                        "status": "completed" if activity.activity_type == "automation_job_completed" else "failed",
                        "time": activity.created_at.strftime("%H:%M")
                    })
            
            # Only generate digest if there's activity
            if total_jobs == 0:
                return None
            
            average_duration = sum(durations) / len(durations) if durations else 0
            
            digest_data = DigestData(
                user_id=user_id,
                period_start=period_start,
                period_end=period_end,
                total_jobs=total_jobs,
                successful_jobs=successful_jobs,
                failed_jobs=failed_jobs,
                dispensers_processed=dispensers_processed,
                stations_automated=stations_automated,
                average_duration=average_duration,
                recent_jobs=sorted(recent_jobs, key=lambda x: x["time"], reverse=True),
                schedule_changes=[],  # TODO: Get from schedule detection service
                error_summary=[]      # TODO: Get from error logs
            )
            
            return digest_data
            
        except Exception as e:
            logger.error(f"Error generating digest data: {e}")
            return None
    
    async def _digest_scheduler(self):
        """Background task to schedule digest notifications"""
        if self.digest_scheduler_running:
            return
        
        self.digest_scheduler_running = True
        
        try:
            while True:
                now = datetime.utcnow()
                
                # Check if it's time to send daily digests (8 AM UTC by default)
                if now.hour == 8 and now.minute == 0:
                    await self._send_scheduled_digests()
                
                # Sleep for 1 minute
                await asyncio.sleep(60)
                
        except Exception as e:
            logger.error(f"Digest scheduler error: {e}")
        finally:
            self.digest_scheduler_running = False
    
    async def _send_scheduled_digests(self):
        """Send scheduled digest notifications to all users"""
        try:
            # Get all users with digest enabled
            users = self.user_service.get_all_users()
            
            for user in users:
                try:
                    preferences = await self._get_user_preferences(user.user_id)
                    if preferences and preferences.email_enabled:
                        await self.send_daily_digest(user.user_id)
                except Exception as e:
                    logger.warning(f"Error sending digest to user {user.user_id}: {e}")
                    
        except Exception as e:
            logger.error(f"Error in scheduled digest sending: {e}")
    
    async def _notification_processor(self):
        """Background task to process pending notifications"""
        if self.notification_processor_running:
            return
        
        self.notification_processor_running = True
        
        try:
            while True:
                # Process pending email notifications
                await self.email_service.process_pending_notifications()
                
                # Process pending Pushover messages
                await self.pushover_service.process_pending_messages()
                
                # Sleep for 30 seconds
                await asyncio.sleep(30)
                
        except Exception as e:
            logger.error(f"Notification processor error: {e}")
        finally:
            self.notification_processor_running = False
    
    async def cleanup(self):
        """Cleanup notification manager resources"""
        try:
            await self.email_service.cleanup()
            await self.pushover_service.cleanup()
            await self.desktop_service.cleanup()
            
            await self.logging_service.log_info("Notification manager cleaned up")
            
        except Exception as e:
            logger.error(f"Error during notification manager cleanup: {e}")


# Factory function for dependency injection
def get_notification_manager(
    db: Session = None,
    email_settings: EmailSettings = None,
    pushover_settings: PushoverSettings = None,
    desktop_settings: DesktopNotificationSettings = None,
    user_id: str = None
) -> NotificationManager:
    """Factory function for creating notification manager"""
    if db is None:
        db = next(get_db())
    
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
    
    if pushover_settings is None:
        pushover_settings = PushoverSettings(
            api_token="azrfbwsp4w3mjnuxvuk9s96n6j2jg2",
            user_key=""
        )
    
    if desktop_settings is None:
        desktop_settings = DesktopNotificationSettings()
    
    return NotificationManager(db, email_settings, pushover_settings, desktop_settings)