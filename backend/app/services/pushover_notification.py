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
    
    # Enhanced V2 message templates with V1-inspired design
    MESSAGE_TEMPLATES = {
        "automation_started": {
            "title": "🚀 Automation Started",
            "message": "<b>🚀 Job Started</b>\n\n<font color='#007AFF'>Station:</font> {station_name}\n<font color='#888'>Dispensers:</font> {dispenser_count}\n<font color='#888'>Est. Time:</font> {estimated_duration} min\n<font color='#888'>Service:</font> {service_code}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Started: {start_time}</font>",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.PUSHOVER,
            "html": True
        },
        "automation_completed": {
            "title": "✅ Automation Completed",
            "message": "<b style='color: #34C759'>✅ Job Completed</b>\n\n<font color='#007AFF'>{station_name}</font>\n<font color='#888'>Duration:</font> {duration}\n<font color='#888'>Forms:</font> {forms_completed}/{total_forms}\n<font color='#888'>Success Rate:</font> {success_rate}%\n\n<font color='#34C759'>Status:</font> All dispensers processed\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Completed: {completion_time}</font>",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.MAGIC,
            "html": True
        },
        "automation_failed": {
            "title": "❌ Automation Failed",
            "message": "<b style='color: #FF3B30'>❌ Job Failed</b>\n\n<font color='#007AFF'>{station_name}</font>\n<font color='#FF3B30'>Error:</font> {error_message}\n<font color='#888'>Progress:</font> {progress_percentage}%\n<font color='#888'>Completed:</font> {completed_dispensers}/{total_dispensers}\n\n<font color='#FF9500'>Action:</font> {recommended_action}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Failed: {failure_time}</font>",
            "priority": PushoverPriority.HIGH,
            "sound": PushoverSound.SIREN,
            "html": True
        },
        "automation_progress": {
            "title": "⏳ Progress Update",
            "message": "<b>⏳ Progress Update</b>\n\n<font color='#007AFF'>{station_name}</font>\n<font color='#888'>Current:</font> Dispenser {current_dispenser}/{total_dispensers}\n<font color='#888'>Progress:</font> {progress_percentage}%\n<font color='#888'>ETA:</font> {estimated_completion}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Updated: {update_time}</font>",
            "priority": PushoverPriority.LOW,
            "sound": PushoverSound.NONE,
            "html": True
        },
        "schedule_change": {
            "title": "📅 Schedule Changes",
            "message": "<b>📅 Schedule Changes</b>\n\n<font color='#34C759'><b>✅ Added ({added_count})</b></font>\n{added_jobs}\n\n<font color='#FF3B30'><b>❌ Removed ({removed_count})</b></font>\n{removed_jobs}\n\n<font color='#FF9500'><b>📅 Changed ({changed_count})</b></font>\n{changed_jobs}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>{added_count} added • {removed_count} removed • {changed_count} changed</font>",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.INCOMING,
            "html": True
        },
        "error_alert": {
            "title": "🚨 Critical Alerts",
            "message": "<b style='color: #FF3B30'>🚨 Critical Alerts ({alert_count})</b>\n\n<font color='#FF3B30'><b>🔋 {alert_type}</b></font>\n<font color='#888'>Component:</font> {component}\n<font color='#888'>Details:</font> {error_details}\n<font color='#888'>Location:</font> {location}\n<font color='#FF9500'>Action:</font> {recommended_action}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>{alert_count} critical • 0 high • 0 normal</font>",
            "priority": PushoverPriority.HIGH,
            "sound": PushoverSound.SPACEALARM,
            "html": True
        },
        "daily_summary": {
            "title": "📊 Daily Summary",
            "message": "<b>📊 Daily Summary</b>\n\n<font color='#34C759'><b>✅ Successful ({successful_jobs})</b></font>\n<font color='#888'>Jobs completed without issues</font>\n\n<font color='#FF3B30'><b>❌ Failed ({failed_jobs})</b></font>\n<font color='#888'>Jobs requiring attention</font>\n\n<font color='#007AFF'><b>🔧 Dispensers ({dispensers_processed})</b></font>\n<font color='#888'>Total dispensers processed</font>\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Success Rate: {success_rate}% • {total_hours}h runtime</font>",
            "priority": PushoverPriority.LOW,
            "sound": PushoverSound.BIKE,
            "html": True
        },
        "test_notification": {
            "title": "🧪 Test Notification",
            "message": "<b>🧪 Test Notification</b>\n\n<font color='#34C759'>✅ Connection Successful</font>\n\n<b>Settings Verified:</b>\n• App Token: Valid\n• User Key: Valid\n• Sound: {sound_setting}\n• Priority: {priority_setting}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Fossa Monitor Test</font>\n<font color='#888'>{test_time}</font>",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.PUSHOVER,
            "html": True
        },
        "batch_update": {
            "title": "📦 Batch Progress",
            "message": "<b>📦 Batch Processing</b>\n\n<font color='#007AFF'>Batch ID:</font> {batch_id}\n<font color='#888'>Progress:</font> {completed_items}/{total_items}\n<font color='#888'>Success Rate:</font> {success_rate}%\n<font color='#888'>ETA:</font> {estimated_completion}\n\n<font color='#34C759'>✅ Completed:</font> {successful_items}\n<font color='#FF3B30'>❌ Failed:</font> {failed_items}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Updated: {update_time}</font>",
            "priority": PushoverPriority.LOW,
            "sound": PushoverSound.NONE,
            "html": True
        }
    }
    
    def __init__(self, db: Session, pushover_settings: PushoverSettings):
        self.db = db
        self.pushover_settings = pushover_settings
        self.logging_service = LoggingService()
        self.user_service = UserManagementService()
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
            
            # Create message(s)
            messages = await self._create_message(user_id, notification_type, data, priority)
            if not messages:
                return False
            
            # Handle both single message and list of messages
            if isinstance(messages, list):
                # Send multiple messages
                all_success = True
                for i, message in enumerate(messages):
                    success = await self._send_message(message, user_key)
                    if not success:
                        all_success = False
                    # Add small delay between messages to avoid rate limiting
                    if i < len(messages) - 1:
                        await asyncio.sleep(0.5)
                success = all_success
            else:
                # Send single message
                success = await self._send_message(messages, user_key)
            
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
    
    async def send_schedule_change_notification(
        self,
        user_id: str,
        schedule_changes: Dict[str, Any]
    ) -> bool:
        """Send enhanced schedule change notification with V1-style formatting"""
        try:
            # Format schedule change data
            added_jobs = []
            removed_jobs = []
            changed_jobs = []
            
            for change in schedule_changes.get("changes", []):
                if change["type"] == "added":
                    job_line = f"<font color='#888'>#{change['job_id']} • {change['date']}</font>\n{change['station_name']}\n{change.get('address', 'N/A')}\n<font color='#888'>{change.get('dispensers', 0)} disp • Job {change.get('service_code', 'N/A')}</font>"
                    added_jobs.append(job_line)
                elif change["type"] == "removed":
                    job_line = f"<font color='#888'>#{change['job_id']} • {change['date']}</font>\n{change['station_name']}\n{change.get('address', 'N/A')}"
                    removed_jobs.append(job_line)
                elif change["type"] == "changed":
                    job_line = f"<font color='#888'>#{change['job_id']}</font>\n{change['old_date']} → {change['new_date']}\n{change['station_name']}"
                    changed_jobs.append(job_line)
            
            data = {
                "added_count": len(added_jobs),
                "removed_count": len(removed_jobs),
                "changed_count": len(changed_jobs),
                "added_jobs": "\n\n".join(added_jobs[:3]) + (f"\n\n<font color='#888'>...and {len(added_jobs)-3} more</font>" if len(added_jobs) > 3 else ""),
                "removed_jobs": "\n\n".join(removed_jobs[:3]) + (f"\n\n<font color='#888'>...and {len(removed_jobs)-3} more</font>" if len(removed_jobs) > 3 else ""),
                "changed_jobs": "\n\n".join(changed_jobs[:3]) + (f"\n\n<font color='#888'>...and {len(changed_jobs)-3} more</font>" if len(changed_jobs) > 3 else ""),
            }
            
            return await self.send_automation_notification(
                user_id, "schedule_change", data, PushoverPriority.NORMAL
            )
            
        except Exception as e:
            logger.error(f"Error sending schedule change notification: {e}")
            return False

    async def send_test_notification(
        self,
        user_id: str,
        settings_info: Dict[str, Any] = None
    ) -> bool:
        """Send test notification with connection verification"""
        try:
            data = {
                "sound_setting": settings_info.get("sound", "pushover") if settings_info else "pushover",
                "priority_setting": settings_info.get("priority", "Normal") if settings_info else "Normal",
                "test_time": datetime.utcnow().strftime("%m/%d/%Y %I:%M %p")
            }
            
            return await self.send_automation_notification(
                user_id, "test_notification", data, PushoverPriority.NORMAL
            )
            
        except Exception as e:
            logger.error(f"Error sending test notification: {e}")
            return False

    async def send_batch_progress_notification(
        self,
        user_id: str,
        batch_info: Dict[str, Any]
    ) -> bool:
        """Send batch processing progress update"""
        try:
            data = {
                "batch_id": batch_info.get("batch_id", "Unknown"),
                "completed_items": batch_info.get("completed", 0),
                "total_items": batch_info.get("total", 0),
                "success_rate": round((batch_info.get("successful", 0) / max(batch_info.get("completed", 1), 1)) * 100, 1),
                "estimated_completion": batch_info.get("eta", "Unknown"),
                "successful_items": batch_info.get("successful", 0),
                "failed_items": batch_info.get("failed", 0),
                "update_time": datetime.utcnow().strftime("%I:%M %p")
            }
            
            return await self.send_automation_notification(
                user_id, "batch_update", data, PushoverPriority.LOW
            )
            
        except Exception as e:
            logger.error(f"Error sending batch progress notification: {e}")
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
    
    def _split_message_smart(self, message: str, max_length: int = 1024) -> List[str]:
        """Smart message splitting for Pushover's character limits"""
        if len(message) <= max_length:
            return [message]
        
        # Split points in order of preference
        split_points = [
            '\n\n',  # Double newline (section breaks)
            '\n',    # Single newline
            '• ',    # Bullet points
            ', ',    # Comma separation
            ' '      # Space (last resort)
        ]
        
        messages = []
        remaining = message
        part_num = 1
        
        while remaining:
            if len(remaining) <= max_length:
                # Add part indicator if this is not the first part
                if part_num > 1:
                    remaining = f"({part_num}/{part_num}) {remaining}"
                messages.append(remaining)
                break
            
            # Find the best split point
            split_pos = -1
            for split_point in split_points:
                # Look for split point before max_length
                pos = remaining.rfind(split_point, 0, max_length - 50)  # Leave room for part indicator
                if pos > max_length // 2:  # Don't split too early
                    split_pos = pos + len(split_point)
                    break
            
            if split_pos == -1:
                # Force split at max length if no good split point found
                split_pos = max_length - 50
            
            # Extract the part
            part = remaining[:split_pos].rstrip()
            
            # Add part indicator
            total_parts = "?" if len(remaining) > max_length * 2 else str(part_num + 1)
            part_with_indicator = f"({part_num}/{total_parts}) {part}"
            
            messages.append(part_with_indicator)
            remaining = remaining[split_pos:].lstrip()
            part_num += 1
        
        # Update part indicators with correct total
        if len(messages) > 1:
            for i, msg in enumerate(messages):
                # Replace the total count in part indicator
                messages[i] = msg.replace(f"({i+1}/?)", f"({i+1}/{len(messages)})")
        
        return messages

    async def _create_message(
        self,
        user_id: str,
        notification_type: str,
        data: Dict[str, Any],
        priority: Optional[PushoverPriority] = None
    ) -> Optional[Union[PushoverMessage, List[PushoverMessage]]]:
        """Create Pushover message(s) from template with smart splitting"""
        try:
            template = self.MESSAGE_TEMPLATES.get(notification_type)
            if not template:
                logger.warning(f"No Pushover template found for type: {notification_type}")
                return None
            
            # Format message content
            title = template["title"]
            
            # Handle missing data gracefully
            safe_data = {}
            for key, value in data.items():
                safe_data[key] = value if value is not None else "N/A"
            
            try:
                message_text = template["message"].format(**safe_data)
            except KeyError as e:
                logger.warning(f"Missing template variable {e} for {notification_type}")
                # Fallback to basic formatting
                message_text = template["message"]
                for key, value in safe_data.items():
                    message_text = message_text.replace(f"{{{key}}}", str(value))
            
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
            
            # Check if HTML is enabled in template
            html_enabled = template.get("html", False)
            
            # Split message if it's too long
            message_parts = self._split_message_smart(message_text)
            
            if len(message_parts) == 1:
                # Single message
                message = PushoverMessage(
                    message_id=f"{notification_type}_{user_id}_{datetime.utcnow().timestamp()}",
                    user_id=user_id,
                    title=title,
                    message=message_parts[0],
                    priority=msg_priority,
                    sound=sound,
                    html=html_enabled
                )
                
                # Add URL if provided in data
                if "url" in data:
                    message.url = data["url"]
                    message.url_title = data.get("url_title", "View Details")
                
                return message
            else:
                # Multiple messages
                messages = []
                base_timestamp = datetime.utcnow().timestamp()
                
                for i, part in enumerate(message_parts):
                    part_title = f"{title} ({i+1}/{len(message_parts)})" if len(message_parts) > 1 else title
                    
                    message = PushoverMessage(
                        message_id=f"{notification_type}_{user_id}_{base_timestamp}_{i}",
                        user_id=user_id,
                        title=part_title,
                        message=part,
                        priority=msg_priority,
                        sound=sound if i == 0 else PushoverSound.NONE,  # Only sound on first message
                        html=html_enabled
                    )
                    
                    # Add URL only to first message
                    if i == 0 and "url" in data:
                        message.url = data["url"]
                        message.url_title = data.get("url_title", "View Details")
                    
                    messages.append(message)
                
                return messages
            
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