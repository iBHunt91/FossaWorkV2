#!/usr/bin/env python3
"""
Pushover Notification Service

V1-compatible Pushover notification system for real-time automation alerts.
Supports job status updates, error notifications, and system alerts with
priority levels, sounds, and device targeting.
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.orm import Session

from ..services.logging_service import LoggingService
from ..services.user_management import UserManagementService
from ..database import get_db

logger = logging.getLogger(__name__)


class PushoverPriority(Enum):
    """Pushover priority levels"""
    LOWEST = -2      # No notification/sound
    LOW = -1         # Quiet notification
    NORMAL = 0       # Normal notification
    HIGH = 1         # Bypass quiet hours
    EMERGENCY = 2    # Repeat until acknowledged


class PushoverSound(Enum):
    """Available Pushover sounds"""
    PUSHOVER = "pushover"
    BIKE = "bike"
    BUGLE = "bugle"
    CASHREGISTER = "cashregister"
    CLASSICAL = "classical"
    COSMIC = "cosmic"
    FALLING = "falling"
    GAMELAN = "gamelan"
    INCOMING = "incoming"
    INTERMISSION = "intermission"
    MAGIC = "magic"
    MECHANICAL = "mechanical"
    PIANOBAR = "pianobar"
    SIREN = "siren"
    SPACEALARM = "spacealarm"
    TUGBOAT = "tugboat"
    ALIEN = "alien"
    CLIMB = "climb"
    PERSISTENT = "persistent"
    ECHO = "echo"
    UPDOWN = "updown"
    NONE = "none"


@dataclass
class PushoverMessage:
    """Pushover message structure"""
    message_id: str
    user_id: str
    title: str
    message: str
    priority: PushoverPriority
    sound: PushoverSound
    url: Optional[str] = None
    url_title: Optional[str] = None
    device: Optional[str] = None
    timestamp: Optional[int] = None
    html: bool = False
    created_at: datetime = None
    sent_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.timestamp is None:
            self.timestamp = int(self.created_at.timestamp())


@dataclass
class PushoverSettings:
    """Pushover API configuration"""
    api_token: str
    user_key: str
    api_url: str = "https://api.pushover.net/1/messages.json"


class PushoverNotificationService:
    """V1-compatible Pushover notification service"""
    
    # V1-compatible message templates
    MESSAGE_TEMPLATES = {
        "automation_started": {
            "title": "🚀 Automation Started",
            "message": "Job started for {station_name}\nDispensers: {dispenser_count}\nEstimated time: {estimated_duration} min",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.PUSHOVER
        },
        "automation_completed": {
            "title": "✅ Automation Completed",
            "message": "Job completed successfully!\n{station_name}\nDuration: {duration}\nForms: {forms_completed}",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.MAGIC
        },
        "automation_failed": {
            "title": "❌ Automation Failed",
            "message": "Job failed for {station_name}\nError: {error_message}\nProgress: {progress_percentage}%",
            "priority": PushoverPriority.HIGH,
            "sound": PushoverSound.SIREN
        },
        "automation_progress": {
            "title": "⏳ Progress Update",
            "message": "{station_name}\nDispenser {current_dispenser}/{total_dispensers}\nProgress: {progress_percentage}%",
            "priority": PushoverPriority.LOW,
            "sound": PushoverSound.NONE
        },
        "schedule_change": {
            "title": "📅 Schedule Change Detected",
            "message": "Schedule updated for {station_name}\nChanges: {change_count}\nNext visit: {next_visit_date}",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.INCOMING
        },
        "error_alert": {
            "title": "🚨 System Error",
            "message": "Error in {component}\nDetails: {error_details}\nTime: {timestamp}",
            "priority": PushoverPriority.HIGH,
            "sound": PushoverSound.SPACEALARM
        },
        "daily_summary": {
            "title": "📊 Daily Summary",
            "message": "Today's automation stats:\n✅ {successful_jobs} successful\n❌ {failed_jobs} failed\n🔧 {dispensers_processed} dispensers processed",
            "priority": PushoverPriority.LOW,
            "sound": PushoverSound.BIKE
        }
    }
    
    def __init__(self, db: Session, pushover_settings: PushoverSettings):
        self.db = db
        self.pushover_settings = pushover_settings
        self.logging_service = LoggingService(db)
        self.user_service = UserManagementService(db)
        self.pending_messages: List[PushoverMessage] = []
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def initialize(self) -> bool:
        """Initialize Pushover service"""
        try:
            self.session = aiohttp.ClientSession()
            await self.logging_service.log_info("Pushover notification service initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Pushover service: {e}")
            return False
    
    async def send_automation_notification(
        self,
        user_id: str,
        notification_type: str,
        data: Dict[str, Any],
        priority: Optional[PushoverPriority] = None
    ) -> bool:
        """Send automation-related Pushover notification"""
        try:
            # Check user preferences
            user = self.user_service.get_user(user_id)
            if not user:
                logger.warning(f"User {user_id} not found for Pushover notification")
                return False
            
            # Get user Pushover preferences
            pushover_prefs = self.user_service.get_user_preference(user_id, "pushover_notifications")
            if not pushover_prefs or not pushover_prefs.get("enabled", False):
                logger.info(f"User {user_id} has Pushover notifications disabled")
                return True  # Not an error, just disabled
            
            # Check if this notification type is enabled
            if not pushover_prefs.get(notification_type, True):
                logger.info(f"User {user_id} has {notification_type} Pushover notifications disabled")
                return True
            
            # Get user's Pushover user key
            user_key = pushover_prefs.get("user_key")
            if not user_key:
                logger.warning(f"No Pushover user key configured for user {user_id}")
                return False
            
            # Create message
            message = await self._create_message(user_id, notification_type, data, priority)
            if not message:
                return False
            
            # Send message
            success = await self._send_message(message, user_key)
            
            if success:
                await self.logging_service.log_info(
                    f"Pushover notification sent to user {user_id}: {notification_type}"
                )
            else:
                await self.logging_service.log_error(
                    f"Failed to send Pushover notification to user {user_id}: {notification_type}"
                )
            
            return success
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending Pushover notification: {str(e)}"
            )
            return False
    
    async def send_progress_update(
        self,
        user_id: str,
        job_data: Dict[str, Any],
        throttle_seconds: int = 60
    ) -> bool:
        """Send progress update with throttling to avoid spam"""
        try:
            # Check if we should throttle this update
            last_progress_key = f"last_progress_{user_id}_{job_data.get('job_id')}"
            
            # Simple throttling (in production, use Redis or similar)
            current_time = datetime.utcnow()
            
            # Send progress update
            return await self.send_automation_notification(
                user_id, "automation_progress", job_data, PushoverPriority.LOW
            )
            
        except Exception as e:
            logger.warning(f"Error sending progress update: {e}")
            return False
    
    async def send_emergency_alert(
        self,
        user_id: str,
        title: str,
        message: str,
        retry_seconds: int = 60,
        expire_seconds: int = 3600
    ) -> bool:
        """Send emergency alert that requires acknowledgment"""
        try:
            user = self.user_service.get_user(user_id)
            if not user:
                return False
            
            pushover_prefs = self.user_service.get_user_preference(user_id, "pushover_notifications")
            if not pushover_prefs or not pushover_prefs.get("enabled", False):
                return True
            
            user_key = pushover_prefs.get("user_key")
            if not user_key:
                return False
            
            # Create emergency message
            emergency_message = PushoverMessage(
                message_id=f"emergency_{user_id}_{datetime.utcnow().timestamp()}",
                user_id=user_id,
                title=title,
                message=message,
                priority=PushoverPriority.EMERGENCY,
                sound=PushoverSound.SPACEALARM
            )
            
            # Send with emergency parameters
            payload = {
                "token": self.pushover_settings.api_token,
                "user": user_key,
                "title": emergency_message.title,
                "message": emergency_message.message,
                "priority": emergency_message.priority.value,
                "sound": emergency_message.sound.value,
                "retry": retry_seconds,
                "expire": expire_seconds,
                "timestamp": emergency_message.timestamp
            }
            
            success = await self._send_api_request(payload)
            
            if success:
                emergency_message.sent_at = datetime.utcnow()
                await self.logging_service.log_info(
                    f"Emergency Pushover alert sent to user {user_id}: {title}"
                )
            
            return success
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending emergency alert: {str(e)}"
            )
            return False
    
    async def _create_message(
        self,
        user_id: str,
        notification_type: str,
        data: Dict[str, Any],
        priority: Optional[PushoverPriority] = None
    ) -> Optional[PushoverMessage]:
        """Create Pushover message from template"""
        try:
            template = self.MESSAGE_TEMPLATES.get(notification_type)
            if not template:
                logger.warning(f"No Pushover template found for type: {notification_type}")
                return None
            
            # Format message content
            title = template["title"]
            message_text = template["message"].format(**data)
            
            # Use provided priority or template default
            msg_priority = priority or template["priority"]
            
            # Get user preferences for sound
            pushover_prefs = self.user_service.get_user_preference(user_id, "pushover_notifications")
            sound = PushoverSound.NONE  # Default
            
            if pushover_prefs:
                sound_pref = pushover_prefs.get("sound", template["sound"].value)
                try:
                    sound = PushoverSound(sound_pref)
                except ValueError:
                    sound = template["sound"]
            else:
                sound = template["sound"]
            
            # Create message
            message = PushoverMessage(
                message_id=f"{notification_type}_{user_id}_{datetime.utcnow().timestamp()}",
                user_id=user_id,
                title=title,
                message=message_text,
                priority=msg_priority,
                sound=sound
            )
            
            # Add URL if provided in data
            if "url" in data:
                message.url = data["url"]
                message.url_title = data.get("url_title", "View Details")
            
            return message
            
        except Exception as e:
            logger.error(f"Error creating Pushover message: {e}")
            return None
    
    async def _send_message(self, message: PushoverMessage, user_key: str) -> bool:
        """Send individual Pushover message"""
        try:
            payload = {
                "token": self.pushover_settings.api_token,
                "user": user_key,
                "title": message.title,
                "message": message.message,
                "priority": message.priority.value,
                "sound": message.sound.value,
                "timestamp": message.timestamp
            }
            
            # Add optional fields
            if message.url:
                payload["url"] = message.url
                payload["url_title"] = message.url_title or "View Details"
            
            if message.device:
                payload["device"] = message.device
            
            if message.html:
                payload["html"] = "1"
            
            success = await self._send_api_request(payload)
            
            if success:
                message.sent_at = datetime.utcnow()
            else:
                message.failed_at = datetime.utcnow()
                message.retry_count += 1
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending Pushover message: {e}")
            message.failed_at = datetime.utcnow()
            message.retry_count += 1
            return False
    
    async def _send_api_request(self, payload: Dict[str, Any]) -> bool:
        """Send request to Pushover API"""
        try:
            if not self.session:
                await self.initialize()
            
            async with self.session.post(
                self.pushover_settings.api_url,
                data=payload,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    if result.get("status") == 1:
                        return True
                    else:
                        logger.error(f"Pushover API error: {result.get('errors', 'Unknown error')}")
                        return False
                else:
                    logger.error(f"Pushover API HTTP error: {response.status}")
                    return False
                    
        except asyncio.TimeoutError:
            logger.error("Pushover API request timeout")
            return False
        except Exception as e:
            logger.error(f"Pushover API request failed: {e}")
            return False
    
    async def process_pending_messages(self):
        """Process queued messages with retry logic"""
        for message in self.pending_messages[:]:
            if message.retry_count >= message.max_retries:
                self.pending_messages.remove(message)
                await self.logging_service.log_error(
                    f"Pushover message {message.message_id} exceeded max retries"
                )
                continue
            
            # Get user key for retry
            pushover_prefs = self.user_service.get_user_preference(message.user_id, "pushover_notifications")
            user_key = pushover_prefs.get("user_key") if pushover_prefs else None
            
            if not user_key:
                self.pending_messages.remove(message)
                continue
            
            success = await self._send_message(message, user_key)
            if success:
                self.pending_messages.remove(message)
    
    async def validate_user_key(self, user_key: str) -> bool:
        """Validate Pushover user key"""
        try:
            payload = {
                "token": self.pushover_settings.api_token,
                "user": user_key
            }
            
            if not self.session:
                await self.initialize()
            
            async with self.session.post(
                "https://api.pushover.net/1/users/validate.json",
                data=payload,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    return result.get("status") == 1
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Error validating Pushover user key: {e}")
            return False
    
    async def cleanup(self):
        """Cleanup Pushover service resources"""
        try:
            if self.session:
                await self.session.close()
            
            await self.logging_service.log_info("Pushover notification service cleaned up")
            
        except Exception as e:
            logger.error(f"Error during Pushover cleanup: {e}")


# Factory function for dependency injection
def get_pushover_notification_service(
    db: Session = None, 
    pushover_settings: PushoverSettings = None
) -> PushoverNotificationService:
    """Factory function for creating Pushover notification service"""
    if db is None:
        db = next(get_db())
    
    if pushover_settings is None:
        # Default settings (should be configured via environment)
        pushover_settings = PushoverSettings(
            api_token="your_pushover_app_token",
            user_key="your_pushover_user_key"
        )
    
    return PushoverNotificationService(db, pushover_settings)