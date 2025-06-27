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
    
    # Enhanced V2 email templates with V1 design patterns
    EMAIL_TEMPLATES = {
        NotificationType.AUTOMATION_STARTED: {
            "subject": "🚀 Automation Job Started - {station_name}",
            "html_template": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f7; 
            line-height: 1.6; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 600; 
        }
        .header p { 
            margin: 10px 0 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .content { 
            padding: 30px; 
        }
        .info-section { 
            background-color: #E8F5E9; 
            border-left: 4px solid #34C759; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .info-section h3 { 
            color: #34C759; 
            margin-top: 0; 
            margin-bottom: 15px; 
            font-size: 18px; 
        }
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
        }
        .detail-item {
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .detail-label {
            font-weight: 600;
            color: #495057;
            font-size: 14px;
            margin-bottom: 4px;
        }
        .detail-value {
            color: #212529;
            font-size: 16px;
        }
        .status-badge { 
            display: inline-block; 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-weight: 600; 
            font-size: 14px;
            background: #E8F5E9; 
            color: #34C759; 
            border: 1px solid #34C759;
        }
        .location-link {
            color: #007AFF;
            text-decoration: none;
            font-weight: 500;
        }
        .location-link:hover {
            text-decoration: underline;
        }
        .summary-box {
            background: #f0f0f0; 
            border-radius: 8px; 
            padding: 20px; 
            text-align: center; 
            margin: 30px 0;
            border: 1px solid #dee2e6;
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #6c757d; 
            border-top: 1px solid #dee2e6;
        }
        @media (max-width: 600px) {
            .detail-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Automation Job Started</h1>
            <p>Your automation task is now running</p>
        </div>
        <div class="content">
            <p>Hello {{user_name | default('User')}},</p>
            <p>Your automation job has been started successfully and is now processing.</p>
            
            <div class="info-section">
                <h3>✅ Job Details</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">📍 Station</div>
                        <div class="detail-value">{{station_name}}</div>
                        {% if location_address %}
                        <a href="https://maps.google.com/?q={{location_address | urlencode}}" class="location-link">View on Google Maps</a>
                        {% endif %}
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">🆔 Job ID</div>
                        <div class="detail-value">{{job_id}}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">📋 Work Order</div>
                        <div class="detail-value">{{work_order_id}}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">🔧 Service Code</div>
                        <div class="detail-value">{{service_code}} - {{service_name | default('Automation Task')}}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">⛽ Dispensers</div>
                        <div class="detail-value">{{dispenser_count}} dispensers</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">🔄 Total Iterations</div>
                        <div class="detail-value">{{total_iterations}}</div>
                    </div>
                </div>
                <p><strong>Status:</strong> <span class="status-badge">Started</span></p>
                <p><strong>Started At:</strong> {{start_time}}</p>
            </div>
            
            <div class="summary-box">
                <strong>📊 Progress Tracking:</strong> You will receive real-time updates as the automation progresses and a completion notification when finished.
            </div>
        </div>
        <div class="footer">
            <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
            <p>🔗 <a href="{{dashboard_url | default('#')}}" style="color: #007AFF;">View Dashboard</a> | 🛠️ <a href="{{settings_url | default('#')}}" style="color: #007AFF;">Notification Settings</a></p>
        </div>
    </div>
</body>
</html>"""
        },
        
        NotificationType.AUTOMATION_COMPLETED: {
            "subject": "✅ Automation Completed - {station_name}",
            "html_template": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f7; 
            line-height: 1.6; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #34C759 0%, #28A745 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 600; 
        }
        .header p { 
            margin: 10px 0 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .content { 
            padding: 30px; 
        }
        .success-section { 
            background-color: #E8F5E9; 
            border-left: 4px solid #34C759; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .success-section h3 { 
            color: #34C759; 
            margin-top: 0; 
            margin-bottom: 15px; 
            font-size: 18px; 
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        .stat-number {
            font-size: 24px;
            font-weight: 700;
            color: #34C759;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 14px;
            color: #6c757d;
            font-weight: 500;
        }
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
        }
        .detail-item {
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .detail-label {
            font-weight: 600;
            color: #495057;
            font-size: 14px;
            margin-bottom: 4px;
        }
        .detail-value {
            color: #212529;
            font-size: 16px;
        }
        .status-badge { 
            display: inline-block; 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-weight: 600; 
            font-size: 14px;
            background: #E8F5E9; 
            color: #34C759; 
            border: 1px solid #34C759;
        }
        .location-link {
            color: #007AFF;
            text-decoration: none;
            font-weight: 500;
        }
        .location-link:hover {
            text-decoration: underline;
        }
        .summary-box {
            background: #E8F5E9; 
            border-radius: 8px; 
            padding: 20px; 
            text-align: center; 
            margin: 30px 0;
            border: 1px solid #34C759;
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #6c757d; 
            border-top: 1px solid #dee2e6;
        }
        @media (max-width: 600px) {
            .detail-grid {
                grid-template-columns: 1fr;
            }
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Automation Completed</h1>
            <p>Your automation task finished successfully</p>
        </div>
        <div class="content">
            <p>Hello {{user_name | default('User')}},</p>
            <p>Excellent news! Your automation job has been completed successfully. All forms have been submitted to WorkFossa.</p>
            
            <div class="success-section">
                <h3>✅ Job Summary</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">📍 Station</div>
                        <div class="detail-value">{{station_name}}</div>
                        {% if location_address %}
                        <a href="https://maps.google.com/?q={{location_address | urlencode}}" class="location-link">View on Google Maps</a>
                        {% endif %}
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">🆔 Job ID</div>
                        <div class="detail-value">{{job_id}}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">📋 Work Order</div>
                        <div class="detail-value">{{work_order_id}}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">⏱️ Duration</div>
                        <div class="detail-value">{{duration}}</div>
                    </div>
                </div>
                <p><strong>Status:</strong> <span class="status-badge">Completed Successfully</span></p>
                <p><strong>Completed At:</strong> {{completion_time}}</p>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">{{dispensers_processed}}</div>
                    <div class="stat-label">Dispensers Processed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{{forms_completed}}</div>
                    <div class="stat-label">Forms Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{{total_iterations}}</div>
                    <div class="stat-label">Total Iterations</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{{success_rate}}%</div>
                    <div class="stat-label">Success Rate</div>
                </div>
            </div>
            
            <div class="summary-box">
                <strong>🎉 All Done!</strong> All {{forms_completed}} forms have been successfully submitted to WorkFossa. Your fuel dispenser testing automation is complete.
            </div>
        </div>
        <div class="footer">
            <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
            <p>🔗 <a href="{{dashboard_url | default('#')}}" style="color: #007AFF;">View Dashboard</a> | 📊 <a href="{{reports_url | default('#')}}" style="color: #007AFF;">View Reports</a></p>
        </div>
    </div>
</body>
</html>"""
        },
        
        NotificationType.AUTOMATION_FAILED: {
            "subject": "❌ Automation Failed - {station_name}",
            "html_template": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                        margin: 0; 
                        padding: 20px; 
                        background-color: #f5f5f7; 
                        line-height: 1.6; 
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background: white; 
                        border-radius: 12px; 
                        overflow: hidden; 
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
                    }
                    .header { 
                        background: linear-gradient(135deg, #FF3B30 0%, #DC2626 100%); 
                        color: white; 
                        padding: 30px; 
                        text-align: center; 
                    }
                    .header h1 { 
                        margin: 0; 
                        font-size: 28px; 
                        font-weight: 600; 
                    }
                    .header p { 
                        margin: 10px 0 0 0; 
                        opacity: 0.9; 
                        font-size: 16px; 
                    }
                    .content { 
                        padding: 30px; 
                    }
                    .error-section { 
                        background-color: #FFEBEE; 
                        border-left: 4px solid #FF3B30; 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin: 20px 0; 
                    }
                    .error-section h3 { 
                        color: #FF3B30; 
                        margin-top: 0; 
                        margin-bottom: 15px; 
                        font-size: 18px; 
                    }
                    .detail-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        margin: 15px 0;
                    }
                    .detail-item {
                        padding: 12px;
                        background: #f8f9fa;
                        border-radius: 6px;
                        border: 1px solid #e9ecef;
                    }
                    .detail-label {
                        font-weight: 600;
                        color: #495057;
                        font-size: 14px;
                        margin-bottom: 4px;
                    }
                    .detail-value {
                        color: #212529;
                        font-size: 16px;
                    }
                    .status-badge { 
                        display: inline-block; 
                        padding: 6px 12px; 
                        border-radius: 20px; 
                        font-weight: 600; 
                        font-size: 14px;
                        background: #FFEBEE; 
                        color: #FF3B30; 
                        border: 1px solid #FF3B30;
                    }
                    .error-message {
                        background: #FFF3E0;
                        border: 1px solid #FFB74D;
                        border-radius: 6px;
                        padding: 15px;
                        margin: 15px 0;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        color: #E65100;
                        overflow-wrap: break-word;
                    }
                    .progress-bar {
                        background: #e9ecef;
                        border-radius: 10px;
                        height: 20px;
                        margin: 10px 0;
                        overflow: hidden;
                    }
                    .progress-fill {
                        background: linear-gradient(90deg, #FF3B30 0%, #FF9500 100%);
                        height: 100%;
                        transition: width 0.3s ease;
                    }
                    .progress-text {
                        text-align: center;
                        margin-top: 5px;
                        font-size: 14px;
                        color: #6c757d;
                    }
                    .action-section {
                        background: #E3F2FD;
                        border-left: 4px solid #007AFF;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .action-section h3 {
                        color: #007AFF;
                        margin-top: 0;
                        margin-bottom: 15px;
                        font-size: 18px;
                    }
                    .location-link {
                        color: #007AFF;
                        text-decoration: none;
                        font-weight: 500;
                    }
                    .location-link:hover {
                        text-decoration: underline;
                    }
                    .footer { 
                        background: #f8f9fa; 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #6c757d; 
                        border-top: 1px solid #dee2e6;
                    }
                    @media (max-width: 600px) {
                        .detail-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>❌ Automation Failed</h1>
                        <p>Attention required for your automation task</p>
                    </div>
                    <div class="content">
                        <p>Hello {{user_name | default('User')}},</p>
                        <p>Unfortunately, your automation job has encountered an error and requires attention.</p>
                        
                        <div class="error-section">
                            <h3>❌ Failure Details</h3>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <div class="detail-label">📍 Station</div>
                                    <div class="detail-value">{{station_name}}</div>
                                    {% if location_address %}
                                    <a href="https://maps.google.com/?q={{location_address | urlencode}}" class="location-link">View on Google Maps</a>
                                    {% endif %}
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">🆔 Job ID</div>
                                    <div class="detail-value">{{job_id}}</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">📋 Work Order</div>
                                    <div class="detail-value">{{work_order_id}}</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">⏱️ Failed At</div>
                                    <div class="detail-value">{{failure_time}}</div>
                                </div>
                            </div>
                            <p><strong>Status:</strong> <span class="status-badge">Failed</span></p>
                            
                            {% if progress_percentage %}
                            <p><strong>Progress Before Failure:</strong></p>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: {{progress_percentage}}%"></div>
                            </div>
                            <div class="progress-text">{{progress_percentage}}% completed</div>
                            {% endif %}
                            
                            {% if error_message %}
                            <p><strong>Error Details:</strong></p>
                            <div class="error-message">{{error_message}}</div>
                            {% endif %}
                        </div>
                        
                        <div class="action-section">
                            <h3>🔧 Next Steps</h3>
                            {% if retry_available %}
                            <p><strong>Automatic Retry:</strong> The system will automatically retry this job in a few minutes.</p>
                            <p><strong>If Issues Persist:</strong></p>
                            <ul>
                                <li>Check your WorkFossa credentials are still valid</li>
                                <li>Verify your internet connection is stable</li>
                                <li>Ensure the work order still exists in WorkFossa</li>
                                <li>Contact support if the problem continues</li>
                            </ul>
                            {% else %}
                            <p><strong>Manual Review Required:</strong></p>
                            <ul>
                                <li>Review the error details above</li>
                                <li>Check the automation logs for more information</li>
                                <li>Manually restart the automation if needed</li>
                                <li>Contact support if you need assistance</li>
                            </ul>
                            {% endif %}
                        </div>
                    </div>
                    <div class="footer">
                        <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
                        <p>🔗 <a href="{{dashboard_url | default('#')}}" style="color: #007AFF;">View Dashboard</a> | 🛠️ <a href="{{support_url | default('#')}}" style="color: #007AFF;">Get Support</a></p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        NotificationType.DAILY_DIGEST: {
            "subject": "📊 Daily Automation Summary - {date}",
            "html_template": """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { 
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
margin: 0; 
padding: 20px; 
background-color: #f5f5f7; 
line-height: 1.6; 
}
.container { 
max-width: 700px; 
margin: 0 auto; 
background: white; 
border-radius: 12px; 
overflow: hidden; 
box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
}
.header { 
background: linear-gradient(135deg, #AF52DE 0%, #6F42C1 100%); 
color: white; 
padding: 30px; 
text-align: center; 
}
.header h1 { 
margin: 0; 
font-size: 28px; 
font-weight: 600; 
}
.header p { 
margin: 10px 0 0 0; 
opacity: 0.9; 
font-size: 16px; 
}
.content { 
padding: 30px; 
}
.summary-grid { 
display: grid; 
grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
gap: 15px; 
margin: 25px 0; 
}
.summary-card { 
background: #f8f9fa; 
border: 1px solid #e9ecef; 
border-radius: 8px; 
padding: 20px; 
text-align: center; 
transition: transform 0.2s ease;
}
.summary-card:hover {
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.summary-number { 
font-size: 32px; 
font-weight: 700; 
color: #AF52DE; 
margin-bottom: 8px;
}
.summary-label {
font-size: 14px;
color: #6c757d;
font-weight: 500;
}
.jobs-section { 
background: #f8f9fa; 
border-radius: 8px; 
padding: 20px; 
margin: 25px 0; 
border: 1px solid #e9ecef;
}
.jobs-section h3 {
color: #495057;
margin-top: 0;
margin-bottom: 15px;
font-size: 18px;
}
.job-item { 
padding: 12px 0; 
border-bottom: 1px solid #dee2e6; 
display: flex;
justify-content: space-between;
align-items: center;
}
.job-item:last-child {
border-bottom: none;
}
.job-name {
font-weight: 600;
color: #212529;
}
.job-status {
padding: 4px 8px;
border-radius: 12px;
font-size: 12px;
font-weight: 600;
}
.job-status.success {
background: #E8F5E9;
color: #34C759;
}
.job-status.failed {
background: #FFEBEE;
color: #FF3B30;
}
.job-time {
font-size: 14px;
color: #6c757d;
}
.performance-section {
background: linear-gradient(135deg, #E8F5E9 0%, #F0F9FF 100%);
border-radius: 8px;
padding: 20px;
margin: 25px 0;
text-align: center;
}
.footer { 
background: #f8f9fa; 
padding: 20px; 
text-align: center; 
font-size: 12px; 
color: #6c757d; 
border-top: 1px solid #dee2e6;
}
@media (max-width: 600px) {
.summary-grid {
grid-template-columns: repeat(2, 1fr);
}
.job-item {
flex-direction: column;
align-items: flex-start;
gap: 8px;
}
}
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>📊 Daily Automation Summary</h1>
<p>{{date}}</p>
</div>
<div class="content">
<p>Hello {{user_name | default('User')}},</p>
<p>Here's your daily automation activity summary for {{date}}:</p>

<div class="summary-grid">
<div class="summary-card">
<div class="summary-number">{{total_jobs}}</div>
<div class="summary-label">Total Jobs</div>
</div>
<div class="summary-card">
<div class="summary-number">{{successful_jobs}}</div>
<div class="summary-label">Successful</div>
</div>
<div class="summary-card">
<div class="summary-number">{{failed_jobs}}</div>
<div class="summary-label">Failed</div>
</div>
<div class="summary-card">
<div class="summary-number">{{dispensers_processed}}</div>
<div class="summary-label">Dispensers</div>
</div>
</div>

{% if recent_jobs %}
<div class="jobs-section">
<h3>📋 Recent Jobs</h3>
{% for job in recent_jobs %}
<div class="job-item">
<div>
<div class="job-name">{{job.station_name}}</div>
<div class="job-time">{{job.time}}</div>
</div>
<span class="job-status {{job.status | lower}}">{{job.status}}</span>
</div>
{% endfor %}
</div>
{% endif %}

{% if success_rate %}
<div class="performance-section">
<h3 style="margin-top: 0; color: #34C759;">🎯 Performance</h3>
<p><strong>Success Rate:</strong> {{success_rate}}%</p>
<p>Keep up the excellent work automating your fuel dispenser testing!</p>
</div>
{% endif %}
</div>
<div class="footer">
<p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
<p>🔗 <a href="{{dashboard_url | default('#')}}" style="color: #007AFF;">View Dashboard</a> | 📊 <a href="{{analytics_url | default('#')}}" style="color: #007AFF;">View Analytics</a></p>
</div>
</div>
</body>
</html>
"""
        },
        
        NotificationType.SCHEDULE_CHANGE: {
            "subject": "📅 Schedule Changes Detected - {change_count} updates",
            "html_template": """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { 
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
margin: 0; 
padding: 20px; 
background-color: #f5f5f7; 
line-height: 1.6; 
}
.container { 
max-width: 700px; 
margin: 0 auto; 
background: white; 
border-radius: 12px; 
overflow: hidden; 
box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
}
.header { 
background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%); 
color: white; 
padding: 30px; 
text-align: center; 
}
.header h1 { 
margin: 0; 
font-size: 28px; 
font-weight: 600; 
}
.header p { 
margin: 10px 0 0 0; 
opacity: 0.9; 
font-size: 16px; 
}
.content { 
padding: 30px; 
}
.change-section { 
border-radius: 8px; 
padding: 20px; 
margin: 20px 0; 
}
.added { 
background-color: #E8F5E9; 
border-left: 4px solid #34C759; 
}
.removed { 
background-color: #FFEBEE; 
border-left: 4px solid #FF3B30; 
}
.date-changed { 
background-color: #FFF3E0; 
border-left: 4px solid #FF9500; 
}
.swapped { 
background-color: #E3F2FD; 
border-left: 4px solid #007AFF; 
}
.replaced { 
background-color: #F3E5F5; 
border-left: 4px solid #AF52DE; 
}
.change-section h3 { 
margin-top: 0; 
margin-bottom: 15px; 
font-size: 18px; 
}
.added h3 { color: #34C759; }
.removed h3 { color: #FF3B30; }
.date-changed h3 { color: #FF9500; }
.swapped h3 { color: #007AFF; }
.replaced h3 { color: #AF52DE; }
.visit-item {
background: white;
border-radius: 6px;
padding: 15px;
margin: 15px 0;
border: 1px solid rgba(0,0,0,0.1);
}
.visit-name {
font-weight: 600;
font-size: 16px;
margin-bottom: 8px;
color: #212529;
}
.visit-details {
color: #495057;
line-height: 1.8;
}
.location-link {
color: #007AFF;
text-decoration: none;
font-weight: 500;
}
.location-link:hover {
text-decoration: underline;
}
.summary-box {
background: #f0f0f0; 
border-radius: 8px; 
padding: 20px; 
text-align: center; 
margin: 30px 0;
border: 1px solid #dee2e6;
}
.footer { 
background: #f8f9fa; 
padding: 20px; 
text-align: center; 
font-size: 12px; 
color: #6c757d; 
border-top: 1px solid #dee2e6;
}
.no-changes {
text-align: center;
padding: 40px;
color: #6c757d;
}
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>📅 Schedule Changes Detected</h1>
<p>Hello {{user_name | default('User')}}, here are your latest schedule updates</p>
</div>
<div class="content">
{% if added_visits %}
<div class="change-section added">
<h3>✅ Added Visits ({{added_visits | length}})</h3>
{% for visit in added_visits %}
<div class="visit-item">
<div class="visit-name">Visit #{{visit.id}} - {{visit.date}}</div>
<div class="visit-details">
📍 {{visit.customer_name}} - Store #{{visit.store_number}}<br>
📌 {{visit.address}}<br>
⛽ {{visit.dispenser_count}} dispensers | Job: {{visit.service_name}} ({{visit.service_code}})<br>
{% if visit.address %}
<a href="https://maps.google.com/?q={{visit.address | urlencode}}" class="location-link">View on Google Maps</a>
{% endif %}
</div>
</div>
{% endfor %}
</div>
{% endif %}

{% if removed_visits %}
<div class="change-section removed">
<h3>❌ Removed Visits ({{removed_visits | length}})</h3>
{% for visit in removed_visits %}
<div class="visit-item">
<div class="visit-name">Visit #{{visit.id}} - {{visit.date}}</div>
<div class="visit-details">
📍 {{visit.customer_name}} - Store #{{visit.store_number}}<br>
📌 {{visit.address}}<br>
⛽ {{visit.dispenser_count}} dispensers | Job: {{visit.service_name}} ({{visit.service_code}})
</div>
</div>
{% endfor %}
</div>
{% endif %}

{% if date_changed_visits %}
<div class="change-section date-changed">
<h3>📅 Date Changes ({{date_changed_visits | length}})</h3>
{% for visit in date_changed_visits %}
<div class="visit-item">
<div class="visit-name">Visit #{{visit.id}}</div>
<div class="visit-details">
<strong>Changed from:</strong> {{visit.old_date}} → {{visit.new_date}}<br>
📍 {{visit.customer_name}} - Store #{{visit.store_number}}<br>
📌 {{visit.address}}<br>
⛽ {{visit.dispenser_count}} dispensers | Job: {{visit.service_name}} ({{visit.service_code}})
</div>
</div>
{% endfor %}
</div>
{% endif %}

{% if swapped_visits %}
<div class="change-section swapped">
<h3>🔄 Swapped Visits ({{swapped_visits | length}})</h3>
{% for swap in swapped_visits %}
<div class="visit-item">
<div class="visit-details">
<strong>Swapped:</strong> Visit #{{swap.visit1_id}} ↔ Visit #{{swap.visit2_id}}<br>
<strong>Dates:</strong> {{swap.date1}} ↔ {{swap.date2}}
</div>
</div>
{% endfor %}
</div>
{% endif %}

{% if not (added_visits or removed_visits or date_changed_visits or swapped_visits) %}
<div class="no-changes">
<h3>✅ No Schedule Changes</h3>
<p>Your schedule is up to date with no recent changes.</p>
</div>
{% endif %}

<div class="summary-box">
<strong>📊 Summary:</strong> 
{{added_visits | length | default(0)}} visits added, 
{{removed_visits | length | default(0)}} visits removed, 
{{date_changed_visits | length | default(0)}} date changes,
{{swapped_visits | length | default(0)}} swaps
</div>
</div>
<div class="footer">
<p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
<p>🔗 <a href="{{schedule_url | default('#')}}" style="color: #007AFF;">View Full Schedule</a> | 🛠️ <a href="{{settings_url | default('#')}}" style="color: #007AFF;">Notification Settings</a></p>
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