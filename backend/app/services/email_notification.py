#!/usr/bin/env python3
"""
Simplified Email Notification Service

Desktop app appropriate email notifications with basic HTML templates.
Removed enterprise complexity for desktop tool use case.
"""

import asyncio
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class NotificationType(Enum):
    """Simplified notification types"""
    AUTOMATION_STARTED = "automation_started"
    AUTOMATION_COMPLETED = "automation_completed"
    AUTOMATION_FAILED = "automation_failed"
    ERROR_ALERT = "error_alert"


class NotificationPriority(Enum):
    """Simple priority system"""
    NORMAL = "normal"
    URGENT = "urgent"


@dataclass
class EmailSettings:
    """Email configuration settings"""
    smtp_server: str
    smtp_port: int
    username: str
    password: str
    use_tls: bool = True
    from_email: str = None
    from_name: str = "FossaWork Automation"
    
    def __post_init__(self):
        if not self.from_email:
            self.from_email = self.username


class EmailNotificationService:
    """Simplified email notification service"""
    
    # Simple email templates (under 100 lines each)
    EMAIL_TEMPLATES = {
        NotificationType.AUTOMATION_STARTED: {
            "subject": "🚀 Automation Started - {station_name}",
            "html_template": """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automation Started</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">🚀 Automation Started</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="color: #334155; margin: 0 0 15px 0; font-size: 18px;">{station_name}</h2>
            <p style="margin: 5px 0; color: #64748b;"><strong>Job ID:</strong> {job_id}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Service Code:</strong> {service_code}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Dispensers:</strong> {dispenser_count}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Started:</strong> {start_time}</p>
        </div>
        
        <div style="background-color: #dbeafe; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
            <p style="margin: 0; color: #1e40af;">✅ Automation job has started successfully and is now processing.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">FossaWork Automation System</p>
            <p style="margin: 5px 0 0 0;">{timestamp}</p>
        </div>
    </div>
</body>
</html>""",
            "text_template": """
AUTOMATION STARTED

Station: {station_name}
Job ID: {job_id}
Service Code: {service_code}
Dispensers: {dispenser_count}
Started: {start_time}

Status: Automation job has started successfully and is now processing.

---
FossaWork Automation System
{timestamp}
"""
        },
        
        NotificationType.AUTOMATION_COMPLETED: {
            "subject": "✅ Automation Completed - {station_name}",
            "html_template": """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automation Completed</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0; font-size: 24px;">✅ Automation Completed</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="color: #334155; margin: 0 0 15px 0; font-size: 18px;">{station_name}</h2>
            <p style="margin: 5px 0; color: #64748b;"><strong>Job ID:</strong> {job_id}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Service Code:</strong> {service_code}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Duration:</strong> {duration}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Forms Completed:</strong> {forms_completed}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Success Rate:</strong> {success_rate}%</p>
        </div>
        
        <div style="background-color: #d1fae5; padding: 15px; border-radius: 6px; border-left: 4px solid #059669;">
            <p style="margin: 0; color: #047857;">🎉 Automation completed successfully! All dispensers have been processed.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">FossaWork Automation System</p>
            <p style="margin: 5px 0 0 0;">{timestamp}</p>
        </div>
    </div>
</body>
</html>""",
            "text_template": """
AUTOMATION COMPLETED

Station: {station_name}
Job ID: {job_id}
Service Code: {service_code}
Duration: {duration}
Forms Completed: {forms_completed}
Success Rate: {success_rate}%

Status: Automation completed successfully! All dispensers have been processed.

---
FossaWork Automation System
{timestamp}
"""
        },
        
        NotificationType.AUTOMATION_FAILED: {
            "subject": "❌ Automation Failed - {station_name}",
            "html_template": """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automation Failed</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 24px;">❌ Automation Failed</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="color: #334155; margin: 0 0 15px 0; font-size: 18px;">{station_name}</h2>
            <p style="margin: 5px 0; color: #64748b;"><strong>Job ID:</strong> {job_id}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Service Code:</strong> {service_code}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Failed At:</strong> {failure_time}</p>
            <p style="margin: 5px 0; color: #64748b;"><strong>Progress:</strong> {progress_percentage}%</p>
        </div>
        
        <div style="background-color: #fee2e2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0; color: #991b1b; font-weight: bold;">⚠️ Error Details:</p>
            <p style="margin: 0; color: #991b1b;">{error_message}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">FossaWork Automation System</p>
            <p style="margin: 5px 0 0 0;">{timestamp}</p>
        </div>
    </div>
</body>
</html>""",
            "text_template": """
AUTOMATION FAILED

Station: {station_name}
Job ID: {job_id}
Service Code: {service_code}
Failed At: {failure_time}
Progress: {progress_percentage}%

Error: {error_message}

---
FossaWork Automation System
{timestamp}
"""
        },
        
        NotificationType.ERROR_ALERT: {
            "subject": "⚠️ System Alert - {error_type}",
            "html_template": """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Alert</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #d97706; margin: 0; font-size: 24px;">⚠️ System Alert</h1>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #d97706; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0; color: #92400e; font-weight: bold;">Alert Type: {error_type}</p>
            <p style="margin: 0; color: #92400e;">{error_message}</p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px;">
            <p style="margin: 0 0 10px 0; color: #64748b;"><strong>Time:</strong> {timestamp}</p>
            <p style="margin: 0; color: #64748b;"><strong>Component:</strong> {component}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">FossaWork Automation System</p>
        </div>
    </div>
</body>
</html>""",
            "text_template": """
SYSTEM ALERT

Alert Type: {error_type}
Error: {error_message}
Time: {timestamp}
Component: {component}

---
FossaWork Automation System
"""
        }
    }
    
    def __init__(self, email_settings: EmailSettings):
        self.email_settings = email_settings
        self.logger = logger
    
    async def send_automation_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        data: Dict[str, Any],
        priority: NotificationPriority = NotificationPriority.NORMAL
    ) -> bool:
        """Send automation notification email"""
        try:
            template = self.EMAIL_TEMPLATES.get(notification_type)
            if not template:
                self.logger.error(f"No template found for notification type: {notification_type}")
                return False
            
            # Add timestamp
            data['timestamp'] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            
            # Format subject and content
            subject = template["subject"].format(**data)
            html_content = template["html_template"].format(**data)
            text_content = template["text_template"].format(**data)
            
            # Get user email from user_id (simplified)
            to_email = self._get_user_email(user_id)
            if not to_email:
                self.logger.error(f"No email found for user: {user_id}")
                return False
            
            return await self._send_email(to_email, subject, html_content, text_content)
            
        except Exception as e:
            self.logger.error(f"Error sending automation notification: {e}")
            return False
    
    async def _send_email(self, to_email: str, subject: str, html_content: str, text_content: str) -> bool:
        """Send email using SMTP"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.email_settings.from_name} <{self.email_settings.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add text and HTML parts
            text_part = MIMEText(text_content, 'plain', 'utf-8')
            html_part = MIMEText(html_content, 'html', 'utf-8')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send email
            if self.email_settings.use_tls:
                server = smtplib.SMTP(self.email_settings.smtp_server, self.email_settings.smtp_port)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(self.email_settings.smtp_server, self.email_settings.smtp_port)
            
            server.login(self.email_settings.username, self.email_settings.password)
            server.send_message(msg)
            server.quit()
            
            self.logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to send email: {e}")
            return False
    
    def _get_user_email(self, user_id: str) -> Optional[str]:
        """Get user email from user_id - simplified implementation"""
        # In a real implementation, this would query the database
        # For now, return a placeholder
        import json
        from pathlib import Path
        
        try:
            # Try to get email from user settings
            settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
            if settings_path.exists():
                with open(settings_path, 'r') as f:
                    smtp_config = json.load(f)
                return smtp_config.get('from_email', smtp_config.get('username'))
        except:
            pass
        
        # Fallback to default
        return self.email_settings.from_email