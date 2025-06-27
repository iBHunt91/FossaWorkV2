#!/usr/bin/env python3
"""
Desktop Notification Service

V1-compatible desktop notification system for native operating system notifications.
Supports automation job alerts, schedule changes, and system notifications with
professional branding, click actions, and platform-specific integration.

Enhanced V2 Implementation: Supports both native desktop notifications (plyer/win10toast)
and web notifications via frontend polling for maximum compatibility.
"""

import asyncio
import json
import logging
import platform
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from sqlalchemy.orm import Session

# Native desktop notification support
try:
    from plyer import notification as plyer_notification
    PLYER_AVAILABLE = True
except ImportError:
    PLYER_AVAILABLE = False
    logging.warning("Plyer not available - native desktop notifications disabled")

try:
    # Windows-specific enhanced notifications
    if platform.system() == "Windows":
        import win10toast
        WIN10TOAST_AVAILABLE = True
    else:
        WIN10TOAST_AVAILABLE = False
except ImportError:
    WIN10TOAST_AVAILABLE = False

from ..services.logging_service import LoggingService
from ..services.user_management import UserManagementService
from ..database import get_db

logger = logging.getLogger(__name__)


class NotificationPriority(Enum):
    """Desktop notification priority levels"""
    LOW = "low"          # Silent notification
    NORMAL = "normal"    # Standard notification  
    HIGH = "high"        # Urgent notification with sound
    CRITICAL = "critical" # Critical alert that demands attention


class NotificationAction(Enum):
    """Available notification actions"""
    OPEN_DASHBOARD = "open_dashboard"
    VIEW_WORK_ORDER = "view_work_order"
    VIEW_SCHEDULE = "view_schedule"
    OPEN_SETTINGS = "open_settings"
    DISMISS = "dismiss"


@dataclass
class DesktopNotification:
    """Desktop notification structure"""
    notification_id: str
    user_id: str
    title: str
    message: str
    priority: NotificationPriority
    notification_type: str
    icon_path: Optional[str] = None
    click_action: Optional[NotificationAction] = None
    action_data: Optional[Dict[str, Any]] = None
    sound_enabled: bool = True
    auto_close_time: Optional[int] = None  # seconds
    created_at: datetime = None
    sent_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()


@dataclass
class DesktopNotificationSettings:
    """Desktop notification configuration"""
    enabled: bool = True
    sound_enabled: bool = True
    show_on_startup: bool = True
    auto_close_time: int = 10  # seconds
    priority_threshold: NotificationPriority = NotificationPriority.NORMAL
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "07:00"
    
    # Native notification preferences
    use_native_notifications: bool = True  # Prefer native over web notifications
    app_name: str = "Fossa Monitor"
    
    # Platform-specific settings
    windows_use_win10toast: bool = True  # Use win10toast on Windows if available
    macos_use_osascript: bool = True     # Use osascript on macOS for native notifications
    linux_use_notify_send: bool = True  # Use notify-send on Linux


class DesktopNotificationService:
    """V1-compatible desktop notification service"""
    
    # Enhanced V2 notification templates with V1 design patterns
    NOTIFICATION_TEMPLATES = {
        "automation_started": {
            "title": "🚀 Automation Started - {station_name}",
            "message": "Processing {job_count} work orders at {station_name}. Starting automation sequence...",
            "priority": NotificationPriority.NORMAL,
            "click_action": NotificationAction.OPEN_DASHBOARD,
            "auto_close_time": 8,
            "sound_enabled": True
        },
        "automation_completed": {
            "title": "✅ Automation Complete - {station_name}",
            "message": "Successfully processed {successful_count}/{total_count} work orders at {station_name}. Duration: {duration}",
            "priority": NotificationPriority.NORMAL,
            "click_action": NotificationAction.VIEW_WORK_ORDER,
            "auto_close_time": 10,
            "sound_enabled": True
        },
        "automation_failed": {
            "title": "❌ Automation Failed - {station_name}",
            "message": "Automation failed at {station_name}: {error_message}. Click to view details.",
            "priority": NotificationPriority.HIGH,
            "click_action": NotificationAction.VIEW_WORK_ORDER,
            "auto_close_time": None,  # Require manual dismissal
            "sound_enabled": True
        },
        "schedule_change": {
            "title": "📅 Schedule Changes Detected",
            "message": "{change_count} schedule changes detected: {summary}. Click to review.",
            "priority": NotificationPriority.NORMAL,
            "click_action": NotificationAction.VIEW_SCHEDULE,
            "auto_close_time": 12,
            "sound_enabled": False
        },
        "system_alert": {
            "title": "⚠️ System Alert",
            "message": "{alert_message}",
            "priority": NotificationPriority.CRITICAL,
            "click_action": NotificationAction.OPEN_SETTINGS,
            "auto_close_time": None,
            "sound_enabled": True
        },
        "daily_summary": {
            "title": "📊 Daily Summary - Fossa Monitor",
            "message": "Completed {completed_jobs} jobs today. {dispensers_processed} dispensers processed successfully.",
            "priority": NotificationPriority.LOW,
            "click_action": NotificationAction.OPEN_DASHBOARD,
            "auto_close_time": 15,
            "sound_enabled": False
        }
    }
    
    def __init__(self, db: Session, desktop_settings: DesktopNotificationSettings = None):
        self.db = db
        self.settings = desktop_settings or DesktopNotificationSettings()
        self.logging_service = LoggingService()
        self.user_service = UserManagementService()
        
        # Platform detection for native implementation
        self.platform = platform.system()
        self.is_windows = self.platform == "Windows"
        self.is_macos = self.platform == "Darwin"
        self.is_linux = self.platform == "Linux"
        
        # Native notification support detection
        self.native_support = self._detect_native_support()
        
        # Notification queue for processing
        self.pending_notifications: List[DesktopNotification] = []
        self.notification_history: List[DesktopNotification] = []
        
        # Icon paths (V1 design compatibility)
        self.icon_path = self._get_app_icon_path()
        
        # Platform-specific notification handlers
        self.win10toast = None
        if self.is_windows and WIN10TOAST_AVAILABLE and desktop_settings and desktop_settings.windows_use_win10toast:
            try:
                self.win10toast = win10toast.ToastNotifier()
            except Exception as e:
                logger.warning(f"Failed to initialize Windows 10 toast notifications: {e}")
        
    def _detect_native_support(self) -> Dict[str, bool]:
        """Detect available native notification support"""
        support = {
            'plyer': PLYER_AVAILABLE,
            'win10toast': WIN10TOAST_AVAILABLE and self.is_windows,
            'osascript': self.is_macos,
            'notify_send': self.is_linux,
            'web_fallback': True  # Always available as fallback
        }
        
        logger.info(f"Native notification support detected: {support}")
        return support
    
    async def initialize(self) -> bool:
        """Initialize desktop notification service"""
        try:
            # Test native notification capability
            native_available = await self._test_native_notifications()
            
            # Start notification processor
            asyncio.create_task(self._notification_processor())
            
            await self.logging_service.log_info(
                f"Desktop notification service initialized - "
                f"Platform: {self.platform}, Native: {native_available}, "
                f"Support: {self.native_support}"
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize desktop notification service: {e}")
            return False
    
    async def _test_native_notifications(self) -> bool:
        """Test native notification capability"""
        if not self.settings.use_native_notifications:
            return False
            
        try:
            # Try sending a silent test notification
            await self._send_native_notification(
                title="Fossa Monitor",
                message="Desktop notifications initialized",
                timeout=1,
                priority=NotificationPriority.LOW,
                test_mode=True
            )
            return True
        except Exception as e:
            logger.warning(f"Native notification test failed: {e}")
            return False
    
    async def send_automation_notification(
        self,
        user_id: str,
        notification_type: str,
        data: Dict[str, Any],
        priority: Optional[NotificationPriority] = None
    ) -> bool:
        """Send automation notification via desktop"""
        try:
            # Check user preferences
            user_settings = await self._get_user_settings(user_id)
            if not user_settings or not user_settings.enabled:
                return True  # Not an error if disabled
            
            # Check quiet hours
            if await self._is_quiet_hours(user_settings):
                return True  # Skip during quiet hours
            
            # Get notification template
            template = self.NOTIFICATION_TEMPLATES.get(notification_type)
            if not template:
                logger.warning(f"Unknown notification type: {notification_type}")
                return False
            
            # Format notification content
            formatted_notification = await self._format_notification(template, data)
            
            # Override priority if specified
            if priority:
                formatted_notification["priority"] = priority
            
            # Create notification object
            notification = DesktopNotification(
                notification_id=f"auto_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{user_id}",
                user_id=user_id,
                notification_type=notification_type,
                icon_path=self.icon_path,
                **formatted_notification
            )
            
            # Add action data for click handling
            if data.get("work_order_id"):
                notification.action_data = {"work_order_id": data["work_order_id"]}
            elif data.get("job_id"):
                notification.action_data = {"job_id": data["job_id"]}
            
            # Queue for processing
            self.pending_notifications.append(notification)
            
            await self.logging_service.log_info(
                f"Desktop notification queued - User: {user_id}, Type: {notification_type}"
            )
            
            return True
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending desktop notification: {str(e)}"
            )
            return False
    
    async def send_schedule_notification(
        self,
        user_id: str,
        changes: List[Dict[str, Any]]
    ) -> bool:
        """Send schedule change notification"""
        try:
            if not changes:
                return True
            
            # Summarize changes
            change_types = {}
            for change in changes[:5]:  # Limit to first 5 changes
                change_type = change.get("type", "unknown")
                change_types[change_type] = change_types.get(change_type, 0) + 1
            
            summary_parts = []
            for change_type, count in change_types.items():
                if change_type == "added":
                    summary_parts.append(f"{count} added")
                elif change_type == "removed":
                    summary_parts.append(f"{count} removed")
                elif change_type == "date_changed":
                    summary_parts.append(f"{count} rescheduled")
            
            summary = ", ".join(summary_parts)
            if len(changes) > 5:
                summary += f" (+{len(changes) - 5} more)"
            
            data = {
                "change_count": len(changes),
                "summary": summary,
                "changes": changes
            }
            
            return await self.send_automation_notification(
                user_id, "schedule_change", data, NotificationPriority.NORMAL
            )
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending schedule notification: {str(e)}"
            )
            return False
    
    async def send_system_alert(
        self,
        user_id: str,
        alert_message: str,
        priority: NotificationPriority = NotificationPriority.CRITICAL
    ) -> bool:
        """Send critical system alert"""
        try:
            data = {
                "alert_message": alert_message,
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            }
            
            return await self.send_automation_notification(
                user_id, "system_alert", data, priority
            )
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending system alert: {str(e)}"
            )
            return False
    
    async def handle_notification_click(
        self,
        notification_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Handle notification click action"""
        try:
            # Find notification in history
            notification = None
            for notif in self.notification_history:
                if notif.notification_id == notification_id and notif.user_id == user_id:
                    notification = notif
                    break
            
            if not notification:
                return {"success": False, "error": "Notification not found"}
            
            # Mark as clicked
            notification.clicked_at = datetime.utcnow()
            
            # Determine action
            action_response = {
                "success": True,
                "action": notification.click_action.value if notification.click_action else "none",
                "data": notification.action_data or {}
            }
            
            # Log click action
            await self.logging_service.log_info(
                f"Notification clicked - ID: {notification_id}, Action: {action_response['action']}"
            )
            
            return action_response
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error handling notification click: {str(e)}"
            )
            return {"success": False, "error": str(e)}
    
    async def update_user_settings(
        self,
        user_id: str,
        settings: Dict[str, Any]
    ) -> bool:
        """Update user desktop notification settings"""
        try:
            # Validate settings
            validated_settings = {}
            
            if "enabled" in settings:
                validated_settings["enabled"] = bool(settings["enabled"])
            
            if "sound_enabled" in settings:
                validated_settings["sound_enabled"] = bool(settings["sound_enabled"])
            
            if "auto_close_time" in settings:
                validated_settings["auto_close_time"] = max(0, int(settings["auto_close_time"]))
            
            if "priority_threshold" in settings:
                try:
                    validated_settings["priority_threshold"] = NotificationPriority(settings["priority_threshold"])
                except ValueError:
                    validated_settings["priority_threshold"] = NotificationPriority.NORMAL
            
            if "quiet_hours_enabled" in settings:
                validated_settings["quiet_hours_enabled"] = bool(settings["quiet_hours_enabled"])
            
            if "quiet_hours_start" in settings:
                validated_settings["quiet_hours_start"] = str(settings["quiet_hours_start"])
            
            if "quiet_hours_end" in settings:
                validated_settings["quiet_hours_end"] = str(settings["quiet_hours_end"])
            
            # Store settings
            result = await self.user_service.update_user_preferences(
                user_id, "desktop_notification_settings", validated_settings
            )
            
            if result:
                await self.logging_service.log_info(
                    f"Desktop notification settings updated for user {user_id}"
                )
            
            return result
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error updating desktop notification settings: {str(e)}"
            )
            return False
    
    async def get_notification_history(
        self,
        user_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get notification history for user"""
        try:
            user_notifications = [
                asdict(notif) for notif in self.notification_history
                if notif.user_id == user_id
            ]
            
            # Sort by creation time (newest first)
            user_notifications.sort(
                key=lambda x: x["created_at"], 
                reverse=True
            )
            
            return user_notifications[:limit]
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error getting notification history: {str(e)}"
            )
            return []
    
    async def _check_notification_support(self) -> bool:
        """Check if desktop notifications are supported"""
        try:
            # Check if any native notification method is available
            if self.settings.use_native_notifications:
                if (self.native_support['plyer'] or 
                    self.native_support['win10toast'] or 
                    self.native_support['osascript'] or 
                    self.native_support['notify_send']):
                    return True
            
            # Web notifications are always available as fallback
            return True
            
        except Exception as e:
            logger.error(f"Error checking notification support: {e}")
            return False
    
    async def _get_user_settings(self, user_id: str) -> Optional[DesktopNotificationSettings]:
        """Get user desktop notification settings"""
        try:
            settings_data = self.user_service.get_user_preference(user_id, "desktop_notification_settings")
            if not settings_data:
                return DesktopNotificationSettings()  # Return defaults
            
            # Convert dict to DesktopNotificationSettings
            settings = DesktopNotificationSettings()
            
            for key, value in settings_data.items():
                if hasattr(settings, key):
                    if key == "priority_threshold":
                        try:
                            setattr(settings, key, NotificationPriority(value))
                        except ValueError:
                            setattr(settings, key, NotificationPriority.NORMAL)
                    else:
                        setattr(settings, key, value)
            
            return settings
            
        except Exception as e:
            logger.warning(f"Error getting user settings: {e}")
            return DesktopNotificationSettings()
    
    async def _is_quiet_hours(self, settings: DesktopNotificationSettings) -> bool:
        """Check if current time is within quiet hours"""
        try:
            if not settings.quiet_hours_enabled:
                return False
            
            from datetime import time
            
            now = datetime.utcnow().time()
            start_time = time(*map(int, settings.quiet_hours_start.split(":")))
            end_time = time(*map(int, settings.quiet_hours_end.split(":")))
            
            if start_time <= end_time:
                # Same day (e.g., 10:00 - 18:00)
                return start_time <= now <= end_time
            else:
                # Overnight (e.g., 22:00 - 07:00)
                return now >= start_time or now <= end_time
                
        except Exception as e:
            logger.warning(f"Error checking quiet hours: {e}")
            return False
    
    async def _format_notification(
        self,
        template: Dict[str, Any],
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format notification template with data"""
        try:
            formatted = {}
            
            # Format title and message
            formatted["title"] = template["title"].format(**data)
            formatted["message"] = template["message"].format(**data)
            
            # Copy other template properties
            formatted["priority"] = template.get("priority", NotificationPriority.NORMAL)
            formatted["click_action"] = template.get("click_action")
            formatted["auto_close_time"] = template.get("auto_close_time")
            formatted["sound_enabled"] = template.get("sound_enabled", True)
            
            return formatted
            
        except KeyError as e:
            logger.warning(f"Missing template data: {e}")
            # Return safe defaults
            return {
                "title": "Fossa Monitor Notification",
                "message": "Automation update available",
                "priority": NotificationPriority.NORMAL,
                "click_action": NotificationAction.OPEN_DASHBOARD,
                "auto_close_time": 10,
                "sound_enabled": True
            }
        except Exception as e:
            logger.error(f"Error formatting notification: {e}")
            raise
    
    def _get_app_icon_path(self) -> str:
        """Get application icon path for notifications"""
        try:
            # V1 design icon paths
            if self.is_windows:
                return "assets/images/FossaFoxIco.ico"
            elif self.is_macos:
                return "assets/images/FossaFoxIco.icns"
            else:
                return "assets/images/FossaFoxIco.png"
                
        except Exception:
            return "assets/images/default-icon.png"
    
    async def _notification_processor(self):
        """Background task to process pending notifications"""
        try:
            while True:
                if self.pending_notifications:
                    notification = self.pending_notifications.pop(0)
                    
                    try:
                        # Send notification (implementation depends on platform)
                        success = await self._send_platform_notification(notification)
                        
                        if success:
                            notification.sent_at = datetime.utcnow()
                            await self.logging_service.log_info(
                                f"Desktop notification sent - ID: {notification.notification_id}"
                            )
                        else:
                            notification.retry_count += 1
                            if notification.retry_count < notification.max_retries:
                                # Re-queue for retry
                                self.pending_notifications.append(notification)
                            else:
                                await self.logging_service.log_error(
                                    f"Desktop notification failed after {notification.max_retries} retries"
                                )
                        
                        # Add to history
                        self.notification_history.append(notification)
                        
                        # Limit history size
                        if len(self.notification_history) > 1000:
                            self.notification_history = self.notification_history[-500:]
                        
                    except Exception as e:
                        logger.error(f"Error processing notification: {e}")
                
                # Sleep for 2 seconds
                await asyncio.sleep(2)
                
        except Exception as e:
            logger.error(f"Notification processor error: {e}")
    
    async def _send_native_notification(
        self,
        title: str,
        message: str,
        timeout: int = 10,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        icon_path: Optional[str] = None,
        sound_enabled: bool = True,
        test_mode: bool = False
    ) -> bool:
        """Send native desktop notification using platform-specific method"""
        try:
            if self.is_windows and self.win10toast and self.settings.windows_use_win10toast:
                # Use Windows 10 toast notifications
                await self._send_windows_toast(title, message, timeout, icon_path, sound_enabled)
                return True
                
            elif PLYER_AVAILABLE:
                # Use plyer for cross-platform support
                await self._send_plyer_notification(title, message, timeout, icon_path, sound_enabled)
                return True
                
            elif self.is_macos and self.settings.macos_use_osascript:
                # Use osascript for macOS
                await self._send_macos_notification(title, message, timeout, sound_enabled)
                return True
                
            elif self.is_linux and self.settings.linux_use_notify_send:
                # Use notify-send for Linux
                await self._send_linux_notification(title, message, timeout, icon_path, sound_enabled)
                return True
                
            else:
                if not test_mode:
                    logger.warning("No native notification method available")
                return False
                
        except Exception as e:
            if not test_mode:
                logger.error(f"Error sending native notification: {e}")
            return False
    
    async def _send_windows_toast(
        self,
        title: str,
        message: str,
        timeout: int,
        icon_path: Optional[str],
        sound_enabled: bool
    ):
        """Send Windows 10 toast notification"""
        try:
            def show_toast():
                self.win10toast.show_toast(
                    title,
                    message,
                    duration=timeout,
                    icon_path=icon_path if icon_path and Path(icon_path).exists() else None,
                    threaded=True
                )
            
            await asyncio.get_event_loop().run_in_executor(None, show_toast)
            
        except Exception as e:
            logger.error(f"Error sending Windows toast: {e}")
            raise
    
    async def _send_plyer_notification(
        self,
        title: str,
        message: str,
        timeout: int,
        icon_path: Optional[str],
        sound_enabled: bool
    ):
        """Send notification using plyer (cross-platform)"""
        try:
            def show_notification():
                kwargs = {
                    'title': title,
                    'message': message,
                    'timeout': timeout,
                    'app_name': self.settings.app_name
                }
                
                if icon_path and Path(icon_path).exists():
                    kwargs['app_icon'] = icon_path
                
                plyer_notification.notify(**kwargs)
            
            await asyncio.get_event_loop().run_in_executor(None, show_notification)
            
        except Exception as e:
            logger.error(f"Error sending plyer notification: {e}")
            raise
    
    async def _send_macos_notification(
        self,
        title: str,
        message: str,
        timeout: int,
        sound_enabled: bool
    ):
        """Send macOS notification using osascript"""
        try:
            # Build osascript command
            sound_option = " with sound name \"Glass\"" if sound_enabled else ""
            script = f'''
            display notification "{message}" with title "{title}"{sound_option}
            '''
            
            process = await asyncio.create_subprocess_exec(
                'osascript', '-e', script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.warning(f"osascript failed: {stderr.decode()}")
                raise Exception(f"osascript returned {process.returncode}")
                
        except Exception as e:
            logger.error(f"Error sending macOS notification: {e}")
            raise
    
    async def _send_linux_notification(
        self,
        title: str,
        message: str,
        timeout: int,
        icon_path: Optional[str],
        sound_enabled: bool
    ):
        """Send Linux notification using notify-send"""
        try:
            # Build notify-send command
            cmd = ['notify-send', title, message, f'--expire-time={timeout * 1000}']
            
            if icon_path and Path(icon_path).exists():
                cmd.extend(['--icon', icon_path])
            
            # Add urgency based on priority (notify-send supports: low, normal, critical)
            cmd.extend(['--urgency', 'normal'])
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.warning(f"notify-send failed: {stderr.decode()}")
                raise Exception(f"notify-send returned {process.returncode}")
                
        except Exception as e:
            logger.error(f"Error sending Linux notification: {e}")
            raise
    
    async def _send_platform_notification(self, notification: DesktopNotification) -> bool:
        """Send notification using best available method (native or web fallback)"""
        try:
            success = False
            
            # Try native notifications first if enabled
            if self.settings.use_native_notifications:
                try:
                    success = await self._send_native_notification(
                        title=notification.title,
                        message=notification.message,
                        timeout=notification.auto_close_time or self.settings.auto_close_time,
                        priority=notification.priority,
                        icon_path=notification.icon_path,
                        sound_enabled=notification.sound_enabled
                    )
                    
                    if success:
                        await self.logging_service.log_info(
                            f"Native desktop notification sent - ID: {notification.notification_id}"
                        )
                except Exception as e:
                    logger.warning(f"Native notification failed, falling back to web: {e}")
            
            # Fallback to web notifications (always store for frontend)
            if not success or not self.settings.use_native_notifications:
                notification_data = {
                    "id": notification.notification_id,
                    "title": notification.title,
                    "message": notification.message,
                    "icon": notification.icon_path,
                    "priority": notification.priority.value,
                    "sound": notification.sound_enabled,
                    "autoClose": notification.auto_close_time,
                    "clickAction": notification.click_action.value if notification.click_action else None,
                    "actionData": notification.action_data,
                    "timestamp": notification.created_at.isoformat()
                }
                
                # Store notification for frontend retrieval
                await self._store_notification_for_frontend(notification.user_id, notification_data)
                success = True
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending platform notification: {e}")
            return False
    
    async def _store_notification_for_frontend(self, user_id: str, notification_data: Dict[str, Any]):
        """Store notification data for frontend retrieval"""
        try:
            # Use user management service to store pending notification
            notifications = self.user_service.get_user_preference(user_id, "pending_notifications") or []
            notifications.append(notification_data)
            
            # Keep only last 10 pending notifications
            if len(notifications) > 10:
                notifications = notifications[-10:]
            
            await self.user_service.update_user_preferences(
                user_id, "pending_notifications", notifications
            )
            
        except Exception as e:
            logger.error(f"Error storing notification for frontend: {e}")
    
    async def get_pending_notifications(self, user_id: str) -> List[Dict[str, Any]]:
        """Get pending notifications for frontend"""
        try:
            notifications = self.user_service.get_user_preference(user_id, "pending_notifications") or []
            
            # Clear pending notifications after retrieval
            await self.user_service.update_user_preferences(user_id, "pending_notifications", [])
            
            return notifications
            
        except Exception as e:
            logger.error(f"Error getting pending notifications: {e}")
            return []
    
    async def cleanup(self):
        """Cleanup desktop notification service resources"""
        try:
            await self.logging_service.log_info("Desktop notification service cleaned up")
            
        except Exception as e:
            logger.error(f"Error during desktop notification service cleanup: {e}")


# Factory function for dependency injection
def get_desktop_notification_service(
    db: Session = None,
    settings: DesktopNotificationSettings = None
) -> DesktopNotificationService:
    """Factory function for creating desktop notification service"""
    if db is None:
        db = next(get_db())
    
    return DesktopNotificationService(db, settings)