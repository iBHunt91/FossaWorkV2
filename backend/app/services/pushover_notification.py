#!/usr/bin/env python3
"""
Simple Pushover Notification Service

Basic Pushover integration for desktop app notifications.
"""

import asyncio
import logging
import aiohttp
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class PushoverPriority(Enum):
    """Pushover priority levels"""
    LOWEST = -2
    LOW = -1
    NORMAL = 0
    HIGH = 1
    EMERGENCY = 2


@dataclass
class PushoverSettings:
    """Pushover configuration settings"""
    user_key: str
    api_token: str  # Application token - required, no default
    sound: str = "pushover"
    
    def __post_init__(self):
        if not self.user_key:
            raise ValueError("Pushover user key is required")
        if not self.api_token:
            raise ValueError("Pushover application token is required")
        
        # Validate token format (30 characters, alphanumeric)
        if len(self.api_token) != 30:
            raise ValueError("Pushover application token must be exactly 30 characters")
        if not self.api_token.replace('_', 'a').replace('-', 'a').isalnum():
            raise ValueError("Pushover application token contains invalid characters")
            
        # Validate user key format (30 characters, alphanumeric)
        if len(self.user_key) != 30:
            raise ValueError("Pushover user key must be exactly 30 characters")
        if not self.user_key.replace('_', 'a').replace('-', 'a').isalnum():
            raise ValueError("Pushover user key contains invalid characters")


class PushoverNotificationService:
    """Simple Pushover notification service"""
    
    PUSHOVER_API_URL = "https://api.pushover.net/1/messages.json"
    
    def __init__(self, pushover_settings: PushoverSettings):
        self.settings = pushover_settings
        self.logger = logger
    
    async def send_notification(
        self,
        title: str,
        message: str,
        priority: PushoverPriority = PushoverPriority.NORMAL,
        url: Optional[str] = None,
        url_title: Optional[str] = None
    ) -> bool:
        """Send a Pushover notification"""
        try:
            # Prepare the payload
            payload = {
                "token": self.settings.api_token,
                "user": self.settings.user_key,
                "title": title,
                "message": message,
                "priority": priority.value,
                "sound": self.settings.sound,
                "timestamp": int(datetime.utcnow().timestamp())
            }
            
            self.logger.info(f"Sending Pushover notification: title='{title}', message='{message}', priority={priority.value}")
            
            # Add optional parameters
            if url:
                payload["url"] = url
            if url_title:
                payload["url_title"] = url_title
            
            # Send the notification
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.PUSHOVER_API_URL,
                    data=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 200 and response_data.get("status") == 1:
                        self.logger.info(f"Pushover notification sent successfully: {title}")
                        self.logger.info(f"Pushover response: {response_data}")
                        return True
                    else:
                        error_msg = response_data.get("errors", ["Unknown error"])
                        self.logger.error(f"Pushover notification failed: {error_msg}")
                        self.logger.error(f"Full response: {response_data}")
                        return False
                        
        except asyncio.TimeoutError:
            self.logger.error("Pushover notification timeout")
            return False
        except Exception as e:
            self.logger.error(f"Error sending Pushover notification: {e}")
            return False
    
    async def send_automation_notification(
        self,
        user_id: str,
        notification_type: str,
        data: Dict[str, Any],
        priority: PushoverPriority = PushoverPriority.NORMAL
    ) -> bool:
        """Send automation-specific notification"""
        try:
            # Create title and message based on notification type
            title, message = self._format_automation_message(notification_type, data)
            
            # Send the notification
            return await self.send_notification(
                title=title,
                message=message,
                priority=priority
            )
            
        except Exception as e:
            self.logger.error(f"Error sending automation notification: {e}")
            return False
    
    def _format_automation_message(self, notification_type: str, data: Dict[str, Any]) -> tuple[str, str]:
        """Format automation message for Pushover"""
        station_name = data.get("station_name", "Unknown Station")
        job_id = data.get("job_id", "Unknown Job")
        
        if notification_type == "automation_started":
            title = f"🚀 Automation Started"
            message = f"Station: {station_name}\nJob ID: {job_id}\nStatus: Processing..."
            
        elif notification_type == "automation_completed":
            duration = data.get("duration", "Unknown")
            success_rate = data.get("success_rate", 0)
            title = f"✅ Automation Completed"
            message = f"Station: {station_name}\nJob ID: {job_id}\nDuration: {duration}\nSuccess: {success_rate}%"
            
        elif notification_type == "automation_failed":
            error_msg = data.get("error_message", "Unknown error")
            title = f"❌ Automation Failed"
            message = f"Station: {station_name}\nJob ID: {job_id}\nError: {error_msg}"
            
        elif notification_type == "error_alert":
            error_msg = data.get("error_message", "System error occurred")
            title = f"⚠️ System Alert"
            message = f"Component: {data.get('component', 'System')}\nError: {error_msg}"
            
        else:
            title = f"📱 FossaWork Notification"
            message = f"Type: {notification_type}\nData: {data}"
        
        return title, message
    
    async def validate_credentials(self, user_key: str = None, api_token: str = None) -> dict:
        """Validate Pushover credentials (user key and/or application token)"""
        try:
            # Use provided credentials or fall back to settings
            test_user_key = user_key or self.settings.user_key
            test_api_token = api_token or self.settings.api_token
            
            payload = {
                "token": test_api_token,
                "user": test_user_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.pushover.net/1/users/validate.json",
                    data=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 200 and response_data.get("status") == 1:
                        return {
                            "valid": True,
                            "message": "Credentials are valid",
                            "devices": response_data.get("devices", []),
                            "group": response_data.get("group")
                        }
                    else:
                        errors = response_data.get("errors", ["Unknown error"])
                        return {
                            "valid": False,
                            "message": f"Validation failed: {', '.join(errors)}",
                            "errors": errors
                        }
                    
        except asyncio.TimeoutError:
            return {
                "valid": False,
                "message": "Validation timeout - check your internet connection"
            }
        except Exception as e:
            self.logger.error(f"Error validating Pushover credentials: {e}")
            return {
                "valid": False,
                "message": f"Validation error: {str(e)}"
            }
    
    async def validate_user_key(self, user_key: str) -> bool:
        """Validate a Pushover user key (legacy method for backward compatibility)"""
        result = await self.validate_credentials(user_key=user_key)
        return result.get("valid", False)
    
    async def send_test_notification(self, user_id: str) -> bool:
        """Send a test notification"""
        return await self.send_notification(
            title="🧪 FossaWork Test",
            message="This is a test notification from FossaWork to verify your Pushover settings are working correctly.",
            priority=PushoverPriority.NORMAL
        )


# Factory function for dependency injection
def get_pushover_service(user_id: str = None) -> Optional[PushoverNotificationService]:
    """Factory function for creating Pushover service"""
    try:
        import json
        from pathlib import Path
        
        if not user_id:
            return None
        
        # Load user-specific Pushover settings
        pushover_path = Path(f"data/users/{user_id}/settings/pushover.json")
        if not pushover_path.exists():
            logger.debug(f"No Pushover settings found for user {user_id}")
            return None
        
        with open(pushover_path, 'r') as f:
            pushover_config = json.load(f)
        
        user_key = pushover_config.get('user_key')
        api_token = pushover_config.get('api_token')
        
        if not user_key or not api_token:
            logger.debug(f"Incomplete Pushover configuration for user {user_id}")
            return None
        
        pushover_settings = PushoverSettings(
            user_key=user_key,
            api_token=api_token,
            sound=pushover_config.get('sound', 'pushover')
        )
        
        return PushoverNotificationService(pushover_settings)
        
    except Exception as e:
        logger.error(f"Error creating Pushover service for user {user_id}: {e}")
        return None