#!/usr/bin/env python3
"""
Email Notification Service

V1-compatible email notification system with modern architecture.
Supports automation job notifications, schedule change alerts, digest reports,
and error notifications with HTML templates and user preferences.
"""

import asyncio
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
import json
import logging
from pathlib import Path
from jinja2 import Template
from sqlalchemy.orm import Session

from ..services.logging_service import LoggingService
from ..services.user_management import UserManagementService
from ..database import get_db

logger = logging.getLogger(__name__)


class NotificationType(Enum):
    """Types of email notifications"""
    AUTOMATION_STARTED = "automation_started"
    AUTOMATION_COMPLETED = "automation_completed"
    AUTOMATION_FAILED = "automation_failed"
    SCHEDULE_CHANGE = "schedule_change"
    DAILY_DIGEST = "daily_digest"
    WEEKLY_SUMMARY = "weekly_summary"
    ERROR_ALERT = "error_alert"
    SYSTEM_MAINTENANCE = "system_maintenance"


class NotificationPriority(Enum):
    """Notification priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class EmailNotification:
    """Email notification structure"""
    notification_id: str
    user_id: str
    notification_type: NotificationType
    priority: NotificationPriority
    subject: str
    html_content: str
    text_content: str
    data: Dict[str, Any]
    created_at: datetime
    scheduled_for: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3


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
    """V1-compatible email notification service"""
    
    # V1-compatible email templates
    EMAIL_TEMPLATES = {
        NotificationType.AUTOMATION_STARTED: {
            "subject": "🚀 Automation Job Started - {station_name}",
            "html_template": """
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { background: #2c5aa0; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .info-box { background: #e8f4fd; border-left: 4px solid #2c5aa0; padding: 15px; margin: 15px 0; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
                    .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
                    .status.started { background: #d1ecf1; color: #0c5460; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚀 Automation Job Started</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>Your automation job has been started successfully.</p>
                        
                        <div class="info-box">
                            <h3>Job Details</h3>
                            <p><strong>Station:</strong> {{station_name}}</p>
                            <p><strong>Job ID:</strong> {{job_id}}</p>
                            <p><strong>Work Order:</strong> {{work_order_id}}</p>
                            <p><strong>Service Code:</strong> {{service_code}}</p>
                            <p><strong>Dispensers:</strong> {{dispenser_count}}</p>
                            <p><strong>Total Iterations:</strong> {{total_iterations}}</p>
                            <p><strong>Status:</strong> <span class="status started">Started</span></p>
                            <p><strong>Started:</strong> {{start_time}}</p>
                        </div>
                        
                        <p>You will receive another notification when the job completes.</p>
                    </div>
                    <div class="footer">
                        <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        NotificationType.AUTOMATION_COMPLETED: {
            "subject": "✅ Automation Completed - {station_name}",
            "html_template": """
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .info-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
                    .stats-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin: 15px 0; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
                    .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
                    .status.completed { background: #d4edda; color: #155724; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Automation Completed</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>Your automation job has been completed successfully!</p>
                        
                        <div class="info-box">
                            <h3>Job Summary</h3>
                            <p><strong>Station:</strong> {{station_name}}</p>
                            <p><strong>Job ID:</strong> {{job_id}}</p>
                            <p><strong>Work Order:</strong> {{work_order_id}}</p>
                            <p><strong>Status:</strong> <span class="status completed">Completed</span></p>
                            <p><strong>Duration:</strong> {{duration}}</p>
                        </div>
                        
                        <div class="stats-box">
                            <h3>Automation Statistics</h3>
                            <p><strong>Dispensers Processed:</strong> {{dispensers_processed}}</p>
                            <p><strong>Forms Completed:</strong> {{forms_completed}}</p>
                            <p><strong>Total Iterations:</strong> {{total_iterations}}</p>
                            <p><strong>Success Rate:</strong> {{success_rate}}%</p>
                        </div>
                        
                        <p>All forms have been submitted successfully to WorkFossa.</p>
                    </div>
                    <div class="footer">
                        <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        NotificationType.AUTOMATION_FAILED: {
            "subject": "❌ Automation Failed - {station_name}",
            "html_template": """
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .error-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 15px 0; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
                    .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
                    .status.failed { background: #f8d7da; color: #721c24; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>❌ Automation Failed</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>Unfortunately, your automation job has failed and requires attention.</p>
                        
                        <div class="error-box">
                            <h3>Failure Details</h3>
                            <p><strong>Station:</strong> {{station_name}}</p>
                            <p><strong>Job ID:</strong> {{job_id}}</p>
                            <p><strong>Work Order:</strong> {{work_order_id}}</p>
                            <p><strong>Status:</strong> <span class="status failed">Failed</span></p>
                            <p><strong>Error:</strong> {{error_message}}</p>
                            <p><strong>Failed At:</strong> {{failure_time}}</p>
                            <p><strong>Progress:</strong> {{progress_percentage}}% completed</p>
                        </div>
                        
                        {% if retry_available %}
                        <p><strong>Next Steps:</strong> The system will automatically retry this job. If the issue persists, please check your WorkFossa credentials and internet connection.</p>
                        {% else %}
                        <p><strong>Next Steps:</strong> Please review the error and manually restart the automation if needed.</p>
                        {% endif %}
                    </div>
                    <div class="footer">
                        <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        NotificationType.DAILY_DIGEST: {
            "subject": "📊 Daily Automation Summary - {date}",
            "html_template": """
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { background: #6f42c1; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
                    .summary-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; text-align: center; }
                    .summary-number { font-size: 24px; font-weight: bold; color: #6f42c1; }
                    .job-list { background: #f8f9fa; border-radius: 4px; padding: 15px; margin: 15px 0; }
                    .job-item { padding: 8px 0; border-bottom: 1px solid #dee2e6; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📊 Daily Automation Summary</h1>
                        <p>{{date}}</p>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>Here's your daily automation activity summary:</p>
                        
                        <div class="summary-grid">
                            <div class="summary-card">
                                <div class="summary-number">{{total_jobs}}</div>
                                <div>Total Jobs</div>
                            </div>
                            <div class="summary-card">
                                <div class="summary-number">{{successful_jobs}}</div>
                                <div>Successful</div>
                            </div>
                            <div class="summary-card">
                                <div class="summary-number">{{failed_jobs}}</div>
                                <div>Failed</div>
                            </div>
                            <div class="summary-card">
                                <div class="summary-number">{{dispensers_processed}}</div>
                                <div>Dispensers</div>
                            </div>
                        </div>
                        
                        {% if recent_jobs %}
                        <div class="job-list">
                            <h3>Recent Jobs</h3>
                            {% for job in recent_jobs %}
                            <div class="job-item">
                                <strong>{{job.station_name}}</strong> - {{job.status}} ({{job.time}})
                            </div>
                            {% endfor %}
                        </div>
                        {% endif %}
                        
                        <p>Keep up the great work automating your fuel dispenser testing!</p>
                    </div>
                    <div class="footer">
                        <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
                    </div>
                </div>
            </body>
            </html>
            """
        }
    }
    
    def __init__(self, db: Session, email_settings: EmailSettings):
        self.db = db
        self.email_settings = email_settings
        self.logging_service = LoggingService()
        self.user_service = UserManagementService()
        self.pending_notifications: List[EmailNotification] = []
        
    async def send_automation_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        job_data: Dict[str, Any],
        priority: NotificationPriority = NotificationPriority.NORMAL
    ) -> bool:
        """Send automation-related notification"""
        try:
            # Get user preferences
            user = self.user_service.get_user(user_id)
            if not user:
                logger.warning(f"User {user_id} not found for notification")
                return False
            
            # Check if user wants this type of notification
            email_prefs = self.user_service.get_user_preference(user_id, "email_notifications")
            if email_prefs and not email_prefs.get(notification_type.value, True):
                logger.info(f"User {user_id} has disabled {notification_type.value} notifications")
                return True  # Not an error, just disabled
            
            # Generate notification content
            notification = await self._create_notification(
                user_id, notification_type, job_data, priority
            )
            
            # Send notification
            success = await self._send_notification(notification)
            
            if success:
                await self.logging_service.log_info(
                    f"Email notification sent to {user.email}: {notification_type.value}"
                )
            else:
                await self.logging_service.log_error(
                    f"Failed to send email notification to {user.email}: {notification_type.value}"
                )
            
            return success
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending automation notification: {str(e)}"
            )
            return False
    
    async def send_daily_digest(self, user_id: str, digest_data: Dict[str, Any]) -> bool:
        """Send daily digest notification"""
        try:
            notification = await self._create_notification(
                user_id, 
                NotificationType.DAILY_DIGEST,
                digest_data,
                NotificationPriority.LOW
            )
            
            return await self._send_notification(notification)
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Error sending daily digest: {str(e)}"
            )
            return False
    
    async def _create_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        data: Dict[str, Any],
        priority: NotificationPriority
    ) -> EmailNotification:
        """Create notification with rendered content"""
        
        template_config = self.EMAIL_TEMPLATES.get(notification_type)
        if not template_config:
            raise ValueError(f"No template found for notification type: {notification_type}")
        
        # Add common template variables
        template_data = {
            **data,
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "user_id": user_id
        }
        
        # Render subject
        subject = template_config["subject"].format(**template_data)
        
        # Render HTML content
        html_template = Template(template_config["html_template"])
        html_content = html_template.render(**template_data)
        
        # Create text version (simplified)
        text_content = self._html_to_text(html_content)
        
        notification = EmailNotification(
            notification_id=f"{notification_type.value}_{user_id}_{datetime.utcnow().timestamp()}",
            user_id=user_id,
            notification_type=notification_type,
            priority=priority,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            data=data,
            created_at=datetime.utcnow()
        )
        
        return notification
    
    async def _send_notification(self, notification: EmailNotification) -> bool:
        """Send email notification via SMTP"""
        try:
            # Get user email
            user = self.user_service.get_user(notification.user_id)
            if not user:
                logger.error(f"User {notification.user_id} not found")
                return False
            
            # Create email message
            message = MIMEMultipart("alternative")
            message["Subject"] = notification.subject
            message["From"] = f"{self.email_settings.from_name} <{self.email_settings.from_email}>"
            message["To"] = user.email
            
            # Add text and HTML parts
            text_part = MIMEText(notification.text_content, "plain")
            html_part = MIMEText(notification.html_content, "html")
            
            message.attach(text_part)
            message.attach(html_part)
            
            # Send email
            context = ssl.create_default_context()
            
            with smtplib.SMTP(self.email_settings.smtp_server, self.email_settings.smtp_port) as server:
                if self.email_settings.use_tls:
                    server.starttls(context=context)
                
                server.login(self.email_settings.username, self.email_settings.password)
                server.send_message(message)
            
            notification.sent_at = datetime.utcnow()
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
            notification.failed_at = datetime.utcnow()
            notification.retry_count += 1
            return False
    
    def _html_to_text(self, html_content: str) -> str:
        """Convert HTML content to plain text"""
        # Simple HTML to text conversion
        import re
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', html_content)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Clean up
        text = text.strip()
        
        return text
    
    async def process_pending_notifications(self):
        """Process queued notifications with retry logic"""
        for notification in self.pending_notifications[:]:
            if notification.retry_count >= notification.max_retries:
                self.pending_notifications.remove(notification)
                await self.logging_service.log_error(
                    f"Notification {notification.notification_id} exceeded max retries"
                )
                continue
            
            success = await self._send_notification(notification)
            if success:
                self.pending_notifications.remove(notification)
    
    async def cleanup(self):
        """Cleanup email service resources"""
        await self.logging_service.log_info("Email notification service cleaned up")


# Factory function for dependency injection
def get_email_notification_service(db: Session = None, email_settings: EmailSettings = None) -> EmailNotificationService:
    """Factory function for creating email notification service"""
    if db is None:
        db = next(get_db())
    
    if email_settings is None:
        # Default settings (should be configured via environment)
        email_settings = EmailSettings(
            smtp_server="smtp.gmail.com",
            smtp_port=587,
            username="fossawork@example.com",
            password="app_specific_password",
            from_name="FossaWork Automation"
        )
    
    return EmailNotificationService(db, email_settings)