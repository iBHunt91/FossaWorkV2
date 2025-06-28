#!/usr/bin/env python3
"""
Simplified Desktop Notification Service

Desktop app appropriate desktop notifications with basic functionality.
Removed enterprise complexity for desktop tool use case.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

# Native desktop notification support
try:
    from plyer import notification as plyer_notification
    PLYER_AVAILABLE = True
except ImportError:
    PLYER_AVAILABLE = False

logger = logging.getLogger(__name__)


class NotificationPriority(Enum):
    """Simple priority system"""
    NORMAL = "normal"
    URGENT = "urgent"


@dataclass
class DesktopNotificationSettings:
    """Desktop notification settings"""
    enabled: bool = True
    sound_enabled: bool = True
    app_name: str = "FossaWork"
    app_icon: str = ""  # Path to app icon


@dataclass
class DesktopNotification:
    """Desktop notification structure"""
    notification_id: str
    user_id: str
    title: str
    message: str
    priority: NotificationPriority
    created_at: datetime
    data: Dict[str, Any]


class DesktopNotificationService:
    """Simplified desktop notification service"""
    
    def __init__(self, settings: DesktopNotificationSettings = None):
        self.settings = settings or DesktopNotificationSettings()
        self.logger = logger
        self.pending_notifications: Dict[str, List[DesktopNotification]] = {}
    
    async def initialize(self) -> bool:
        """Initialize desktop notification service"""
        try:
            if not PLYER_AVAILABLE:
                self.logger.warning("Desktop notifications not available - plyer not installed")
                return False
            
            self.logger.info("Desktop notification service initialized")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize desktop notification service: {e}")
            return False
    
    async def send_automation_notification(
        self,
        user_id: str,
        notification_type: str,
        data: Dict[str, Any],
        priority: NotificationPriority = NotificationPriority.NORMAL
    ) -> bool:
        """Send automation notification"""
        try:
            # Generate title and message based on type
            title, message = self._format_notification(notification_type, data)
            
            # Send native notification
            success = await self._send_native_notification(title, message, priority)
            
            # Store for web polling fallback
            if success or not PLYER_AVAILABLE:
                await self._store_web_notification(user_id, title, message, priority, data)
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error sending automation notification: {e}")
            return False
    
    async def send_system_alert(
        self,
        user_id: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.URGENT
    ) -> bool:
        """Send system alert notification"""
        try:
            title = "FossaWork System Alert"
            
            # Send native notification
            success = await self._send_native_notification(title, message, priority)
            
            # Store for web polling fallback
            await self._store_web_notification(user_id, title, message, priority, {})
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error sending system alert: {e}")
            return False
    
    async def get_pending_notifications(self, user_id: str) -> List[Dict[str, Any]]:
        """Get pending notifications for web polling"""
        try:
            notifications = self.pending_notifications.get(user_id, [])
            
            # Convert to dict format
            result = []
            for notification in notifications:
                result.append({
                    'id': notification.notification_id,
                    'title': notification.title,
                    'message': notification.message,
                    'priority': notification.priority.value,
                    'timestamp': notification.created_at.isoformat(),
                    'data': notification.data
                })
            
            # Clear pending notifications after retrieval
            self.pending_notifications[user_id] = []
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error getting pending notifications: {e}")
            return []
    
    def _format_notification(self, notification_type: str, data: Dict[str, Any]) -> tuple[str, str]:
        """Format notification title and message"""
        station_name = data.get('station_name', 'Unknown Station')
        
        if notification_type == 'automation_started':
            title = "🚀 Automation Started"
            message = f"{station_name} - Job ID: {data.get('job_id', 'N/A')}"
            
        elif notification_type == 'automation_completed':
            title = "✅ Automation Completed"
            message = f"{station_name} - {data.get('forms_completed', 0)} forms processed"
            
        elif notification_type == 'automation_failed':
            title = "❌ Automation Failed"
            message = f"{station_name} - {data.get('error_message', 'Unknown error')}"
            
        elif notification_type == 'error_alert':
            title = "⚠️ System Error"
            message = data.get('error_message', 'An error occurred')
            
        else:
            title = "FossaWork Notification"
            message = f"Event: {notification_type}"
        
        return title, message
    
    async def _send_native_notification(
        self,
        title: str,
        message: str,
        priority: NotificationPriority
    ) -> bool:
        """Send native desktop notification"""
        if not PLYER_AVAILABLE:
            return False
        
        try:
            # Prepare notification
            timeout = 10 if priority == NotificationPriority.NORMAL else 0  # 0 = no timeout for urgent
            
            plyer_notification.notify(
                title=title,
                message=message,
                app_name=self.settings.app_name,
                app_icon=self.settings.app_icon or None,
                timeout=timeout
            )
            
            self.logger.info(f"Native notification sent: {title}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to send native notification: {e}")
            return False
    
    async def _store_web_notification(
        self,
        user_id: str,
        title: str,
        message: str,
        priority: NotificationPriority,
        data: Dict[str, Any]
    ):
        """Store notification for web polling"""
        try:
            notification_id = f"{int(datetime.utcnow().timestamp())}-{user_id}"
            
            notification = DesktopNotification(
                notification_id=notification_id,
                user_id=user_id,
                title=title,
                message=message,
                priority=priority,
                created_at=datetime.utcnow(),
                data=data
            )
            
            if user_id not in self.pending_notifications:
                self.pending_notifications[user_id] = []
            
            self.pending_notifications[user_id].append(notification)
            
            # Limit to last 10 notifications per user
            if len(self.pending_notifications[user_id]) > 10:
                self.pending_notifications[user_id] = self.pending_notifications[user_id][-10:]
            
        except Exception as e:
            self.logger.error(f"Error storing web notification: {e}")
    
    async def cleanup(self):
        """Cleanup notification service"""
        try:
            self.pending_notifications.clear()
            self.logger.info("Desktop notification service cleaned up")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")