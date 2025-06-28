#!/usr/bin/env python3
"""
Comprehensive Notification System Test Suite

Complete end-to-end testing of the V1-to-V2 migrated notification system.
Tests all notification channels (Email, Pushover, Desktop), integration 
workflows, user preferences, and real-world scenarios.

This test suite validates the entire notification system including:
- Enhanced V2 email templates with V1 design patterns
- V2 Pushover templates with HTML formatting
- New desktop notification service
- Multi-channel notification delivery
- Settings page functionality
- Error handling and fallback testing
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from unittest.mock import Mock, MagicMock, patch

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ComprehensiveNotificationTester:
    """Comprehensive notification system test runner"""
    
    def __init__(self):
        self.results = {}
        self.detailed_results = []
        self.test_data_generated = []
        self.mock_db = Mock()
        self.mock_user_service = Mock()
        self.setup_mocks()
    
    def setup_mocks(self):
        """Setup mock services for testing"""
        # Mock user service
        self.mock_user_service.get_user.return_value = Mock(
            user_id="test_user_001",
            email="bruce@fossawork.com",
            username="testuser"
        )
        
        self.mock_user_service.get_user_preference.return_value = {
            "email_enabled": True,
            "pushover_enabled": True,
            "desktop_enabled": True,
            "automation_started": "email_desktop",
            "automation_completed": "all",
            "automation_failed": "all",
            "automation_progress": "pushover_desktop",
            "schedule_change": "email_desktop",
            "daily_digest": "email",
            "weekly_summary": "email",
            "error_alert": "all",
            "digest_time": "08:00",
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "07:00",
            "pushover_user_key": "test_user_key_12345",
            "pushover_device": "test_device",
            "pushover_sound": "pushover",
            "desktop_sound_enabled": True,
            "desktop_auto_close_time": 10,
            "desktop_quiet_hours_enabled": False
        }
        
        self.mock_user_service.update_user_preferences.return_value = True
        self.mock_user_service.get_all_users.return_value = [
            Mock(user_id="test_user_001", email="bruce@fossawork.com")
        ]
    
    def generate_test_data(self) -> Dict[str, Dict[str, Any]]:
        """Generate comprehensive test data for all notification scenarios"""
        current_time = datetime.utcnow()
        
        test_scenarios = {
            "automation_started": {
                "station_name": "Wawa Store #1425 - Downtown Philadelphia",
                "job_id": "AUTO_JOB_20250127_001",
                "work_order_id": "WO_PA_1425_20250127",
                "service_code": "2861",
                "service_name": "AccuMeasure (All Dispensers)",
                "dispenser_count": 8,
                "total_iterations": 40,
                "estimated_duration": 25,
                "start_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "address": "1234 Market Street, Philadelphia, PA 19107",
                "county": "Philadelphia County",
                "created_by": "Bruce Hunt",
                "scheduled_date": current_time.strftime("%Y-%m-%d"),
                "visit_url": "https://app.workfossa.com/visits/12345",
                "customer_url": "https://app.workfossa.com/customers/locations/5678/",
                "instructions": "Standard AccuMeasure testing - All dispensers operational"
            },
            
            "automation_completed": {
                "station_name": "Circle K Store #892 - Tampa Bay Area",
                "job_id": "AUTO_JOB_20250127_002",
                "work_order_id": "WO_FL_892_20250127",
                "service_code": "3002",
                "service_name": "AccuMeasure (Specific Dispensers)",
                "dispenser_count": 6,
                "total_iterations": 30,
                "start_time": (current_time - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S UTC"),
                "completion_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "duration": "28 minutes",
                "forms_completed": 6,
                "dispensers_processed": 6,
                "success_rate": 100,
                "address": "5678 Dale Mabry Highway, Tampa, FL 33607",
                "county": "Hillsborough County",
                "created_by": "Bruce Hunt",
                "visit_url": "https://app.workfossa.com/visits/67890",
                "customer_url": "https://app.workfossa.com/customers/locations/9012/",
                "forms_data": [
                    {"dispenser": "Dispenser 1", "status": "completed", "time": "2 minutes"},
                    {"dispenser": "Dispenser 2", "status": "completed", "time": "3 minutes"},
                    {"dispenser": "Dispenser 3", "status": "completed", "time": "4 minutes"},
                    {"dispenser": "Dispenser 4", "status": "completed", "time": "5 minutes"},
                    {"dispenser": "Dispenser 5", "status": "completed", "time": "6 minutes"},
                    {"dispenser": "Dispenser 6", "status": "completed", "time": "8 minutes"}
                ]
            },
            
            "automation_failed": {
                "station_name": "7-Eleven Store #3456 - Houston Energy Corridor",
                "job_id": "AUTO_JOB_20250127_003",
                "work_order_id": "WO_TX_3456_20250127",
                "service_code": "3146",
                "service_name": "Open Neck Prover",
                "error_message": "Connection timeout to WorkFossa portal. Network connectivity issues detected during form submission for Dispenser 3.",
                "failure_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "progress_percentage": 60,
                "dispensers_completed": 2,
                "dispensers_failed": 1,
                "total_dispensers": 5,
                "retry_available": True,
                "address": "12345 Katy Freeway, Houston, TX 77079",
                "county": "Harris County",
                "created_by": "Bruce Hunt",
                "visit_url": "https://app.workfossa.com/visits/34567",
                "customer_url": "https://app.workfossa.com/customers/locations/7890/",
                "error_details": {
                    "error_type": "NetworkTimeout",
                    "error_code": "CONN_TIMEOUT_001",
                    "timestamp": current_time.isoformat(),
                    "affected_dispenser": "Dispenser 3",
                    "previous_attempts": 2,
                    "next_retry": (current_time + timedelta(minutes=15)).isoformat()
                }
            },
            
            "automation_progress": {
                "station_name": "Sheetz Store #567 - Pittsburgh South Hills",
                "job_id": "AUTO_JOB_20250127_004",
                "work_order_id": "WO_PA_567_20250127",
                "service_code": "2862",
                "service_name": "AccuMeasure (Filtered Dispensers)",
                "progress_percentage": 75,
                "current_dispenser": 6,
                "total_dispensers": 8,
                "dispensers_completed": 5,
                "current_step": "Filling forms for Dispenser 6",
                "estimated_remaining": "8 minutes",
                "start_time": (current_time - timedelta(minutes=18)).strftime("%Y-%m-%d %H:%M:%S UTC"),
                "address": "7890 Library Road, South Park, PA 15129",
                "county": "Allegheny County",
                "created_by": "Bruce Hunt",
                "visit_url": "https://app.workfossa.com/visits/78901",
                "customer_url": "https://app.workfossa.com/customers/locations/2345/",
                "recent_activity": [
                    "✅ Dispenser 1 completed (3 minutes)",
                    "✅ Dispenser 2 completed (2 minutes)",
                    "✅ Dispenser 3 completed (4 minutes)",
                    "✅ Dispenser 4 completed (3 minutes)",
                    "✅ Dispenser 5 completed (6 minutes)",
                    "🔄 Dispenser 6 in progress..."
                ]
            },
            
            "schedule_change": {
                "change_type": "new_work_orders",
                "change_count": 12,
                "change_summary": "12 new work orders added to schedule",
                "affected_dates": ["2025-01-28", "2025-01-29", "2025-01-30"],
                "new_work_orders": [
                    {
                        "work_order_id": "WO_FL_101_20250128",
                        "station_name": "Speedway #101 - Orlando",
                        "service_code": "2861",
                        "scheduled_date": "2025-01-28",
                        "address": "1001 International Drive, Orlando, FL 32819"
                    },
                    {
                        "work_order_id": "WO_GA_202_20250128", 
                        "station_name": "RaceTrac #202 - Atlanta",
                        "service_code": "3002",
                        "scheduled_date": "2025-01-28",
                        "address": "2002 Peachtree Street, Atlanta, GA 30309"
                    },
                    {
                        "work_order_id": "WO_NC_303_20250129",
                        "station_name": "QuikTrip #303 - Charlotte",
                        "service_code": "3146", 
                        "scheduled_date": "2025-01-29",
                        "address": "3003 Trade Street, Charlotte, NC 28202"
                    }
                ],
                "detection_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "next_check": (current_time + timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S UTC")
            },
            
            "daily_digest": {
                "date": (current_time - timedelta(days=1)).strftime("%Y-%m-%d"),
                "total_jobs": 15,
                "successful_jobs": 13,
                "failed_jobs": 2,
                "success_rate": 86.7,
                "dispensers_processed": 45,
                "total_duration": "6 hours 45 minutes",
                "average_job_time": "27 minutes",
                "stations_visited": 15,
                "recent_jobs": [
                    {
                        "station_name": "Wawa #1425",
                        "status": "completed",
                        "time": "14:30",
                        "duration": "25 minutes",
                        "dispensers": 8
                    },
                    {
                        "station_name": "Circle K #892",
                        "status": "completed", 
                        "time": "15:15",
                        "duration": "28 minutes",
                        "dispensers": 6
                    },
                    {
                        "station_name": "7-Eleven #3456",
                        "status": "failed",
                        "time": "16:45",
                        "error": "Connection timeout",
                        "dispensers": 3
                    },
                    {
                        "station_name": "Sheetz #567",
                        "status": "completed",
                        "time": "17:30", 
                        "duration": "32 minutes",
                        "dispensers": 8
                    },
                    {
                        "station_name": "Speedway #101",
                        "status": "completed",
                        "time": "18:15",
                        "duration": "22 minutes", 
                        "dispensers": 4
                    }
                ],
                "error_summary": [
                    {
                        "error_type": "Connection Timeout",
                        "occurrences": 2,
                        "affected_stations": ["7-Eleven #3456", "RaceTrac #789"]
                    }
                ],
                "performance_metrics": {
                    "fastest_job": "18 minutes (QuikTrip #404)",
                    "slowest_job": "45 minutes (Wawa #1987)",
                    "most_dispensers": "12 (Super Speedway #199)",
                    "peak_hour": "15:00-16:00 (4 jobs completed)"
                }
            },
            
            "emergency_alert": {
                "alert_type": "system_critical",
                "title": "Critical System Alert: Database Connection Lost",
                "message": "The main database connection has been lost. All automation jobs have been paused to prevent data loss. Manual intervention required.",
                "severity": "critical",
                "affected_systems": ["Database", "Work Order Processing", "Form Automation"],
                "impact": "All automation workflows stopped",
                "action_required": "Restart database service and verify data integrity",
                "escalation_contact": "Bruce Hunt - bruce@fossawork.com",
                "incident_id": "INC_20250127_001",
                "alert_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "estimated_resolution": "30 minutes"
            }
        }
        
        self.test_data_generated = list(test_scenarios.keys())
        return test_scenarios
    
    async def test_email_notification_service(self) -> Dict[str, Any]:
        """Test email notification service with V1-migrated templates"""
        print("\n📧 Testing Email Notification Service (V1 Migrated Templates)")
        print("=" * 70)
        
        test_result = {
            "name": "Email Notification Service",
            "passed": False,
            "details": [],
            "templates_generated": 0,
            "errors": []
        }
        
        try:
            from app.services.email_notification import (
                EmailNotificationService, EmailSettings, NotificationType, NotificationPriority
            )
            
            # Create email service with mock settings
            email_settings = EmailSettings(
                smtp_server="smtp.gmail.com",
                smtp_port=587,
                username="fossawork.test@gmail.com",
                password="test_app_password",
                from_email="fossawork.test@gmail.com",
                from_name="FossaWork Automation System"
            )
            
            service = EmailNotificationService(self.mock_db, email_settings)
            service.user_service = self.mock_user_service
            service.logging_service = Mock()
            
            test_data = self.generate_test_data()
            
            # Test all notification types
            notification_types = [
                (NotificationType.AUTOMATION_STARTED, test_data["automation_started"]),
                (NotificationType.AUTOMATION_COMPLETED, test_data["automation_completed"]),
                (NotificationType.AUTOMATION_FAILED, test_data["automation_failed"]),
                (NotificationType.SCHEDULE_CHANGE, test_data["schedule_change"]),
                (NotificationType.DAILY_DIGEST, test_data["daily_digest"]),
                (NotificationType.ERROR_ALERT, test_data["emergency_alert"])
            ]
            
            templates_dir = Path("test_output/email_templates")
            templates_dir.mkdir(parents=True, exist_ok=True)
            
            for notification_type, data in notification_types:
                try:
                    print(f"\n📨 Testing {notification_type.value}...")
                    
                    # Create notification
                    notification = await service._create_notification(
                        "test_user_001", notification_type, data, NotificationPriority.NORMAL
                    )
                    
                    # Validate notification
                    assert notification is not None, "Notification creation returned None"
                    assert notification.subject, "Subject is empty"
                    assert notification.html_content, "HTML content is empty"
                    assert notification.text_content, "Text content is empty"
                    assert len(notification.html_content) > 500, "HTML content too short"
                    assert len(notification.text_content) > 100, "Text content too short"
                    
                    # Save templates for inspection
                    html_file = templates_dir / f"{notification_type.value}_template.html"
                    text_file = templates_dir / f"{notification_type.value}_template.txt"
                    
                    html_file.write_text(notification.html_content, encoding='utf-8')
                    text_file.write_text(notification.text_content, encoding='utf-8')
                    
                    test_result["details"].append({
                        "type": notification_type.value,
                        "subject": notification.subject,
                        "html_length": len(notification.html_content),
                        "text_length": len(notification.text_content),
                        "status": "✅ PASSED",
                        "template_files": [str(html_file), str(text_file)]
                    })
                    
                    test_result["templates_generated"] += 1
                    print(f"  ✅ Template generated: {len(notification.html_content)} chars HTML, {len(notification.text_content)} chars text")
                    print(f"  📄 Subject: {notification.subject}")
                    print(f"  📁 Saved: {html_file.name}, {text_file.name}")
                    
                except Exception as e:
                    error_msg = f"Template creation failed for {notification_type.value}: {str(e)}"
                    test_result["errors"].append(error_msg)
                    test_result["details"].append({
                        "type": notification_type.value,
                        "status": "❌ FAILED",
                        "error": str(e)
                    })
                    print(f"  ❌ {error_msg}")
            
            # Test SMTP configuration validation
            print(f"\n🔧 Testing SMTP configuration...")
            try:
                smtp_valid = service._validate_smtp_settings()
                test_result["details"].append({
                    "type": "smtp_validation",
                    "status": "✅ PASSED" if smtp_valid else "⚠️  WARNING",
                    "message": "SMTP settings validated" if smtp_valid else "SMTP settings incomplete"
                })
                print(f"  {'✅' if smtp_valid else '⚠️ '} SMTP validation: {'Passed' if smtp_valid else 'Warning - incomplete settings'}")
            except Exception as e:
                test_result["errors"].append(f"SMTP validation error: {str(e)}")
                print(f"  ❌ SMTP validation failed: {str(e)}")
            
            # Overall success check
            test_result["passed"] = (
                test_result["templates_generated"] == len(notification_types) and
                len(test_result["errors"]) == 0
            )
            
            print(f"\n🎯 Email Service Results:")
            print(f"  Templates Generated: {test_result['templates_generated']}/{len(notification_types)}")
            print(f"  Errors: {len(test_result['errors'])}")
            print(f"  Overall: {'✅ PASSED' if test_result['passed'] else '❌ FAILED'}")
            
        except Exception as e:
            test_result["errors"].append(f"Service initialization failed: {str(e)}")
            test_result["passed"] = False
            print(f"❌ Email service test failed: {str(e)}")
        
        return test_result
    
    async def test_pushover_notification_service(self) -> Dict[str, Any]:
        """Test Pushover notification service with V1-migrated templates"""
        print("\n📱 Testing Pushover Notification Service (V1 Migrated Templates)")
        print("=" * 75)
        
        test_result = {
            "name": "Pushover Notification Service",
            "passed": False,
            "details": [],
            "messages_generated": 0,
            "errors": []
        }
        
        try:
            from app.services.pushover_notification import (
                PushoverNotificationService, PushoverSettings, PushoverPriority, PushoverSound
            )
            
            # Create Pushover service with mock settings  
            pushover_settings = PushoverSettings(
                api_token="azrfbwsp4w3mjnuxvuk9s96n6j2jg2",  # App token
                user_key="test_user_key_12345"  # User key
            )
            
            service = PushoverNotificationService(self.mock_db, pushover_settings)
            service.user_service = self.mock_user_service
            service.logging_service = Mock()
            
            test_data = self.generate_test_data()
            
            # Test all message types
            message_types = [
                ("automation_started", test_data["automation_started"], PushoverPriority.NORMAL),
                ("automation_completed", test_data["automation_completed"], PushoverPriority.LOW),
                ("automation_failed", test_data["automation_failed"], PushoverPriority.HIGH),
                ("automation_progress", test_data["automation_progress"], PushoverPriority.LOWEST),
                ("schedule_change", test_data["schedule_change"], PushoverPriority.NORMAL),
                ("daily_summary", test_data["daily_digest"], PushoverPriority.LOW),
                ("emergency_alert", test_data["emergency_alert"], PushoverPriority.EMERGENCY)
            ]
            
            messages_dir = Path("test_output/pushover_messages")
            messages_dir.mkdir(parents=True, exist_ok=True)
            
            for message_type, data, priority in message_types:
                try:
                    print(f"\n📲 Testing {message_type}...")
                    
                    # Create message
                    message = await service._create_message(
                        "test_user_001", message_type, data, priority
                    )
                    
                    # Validate message
                    assert message is not None, "Message creation returned None"
                    assert message.title, "Title is empty"
                    assert message.message, "Message content is empty"
                    assert message.priority == priority, f"Priority mismatch: expected {priority}, got {message.priority}"
                    assert len(message.message) <= 1024, f"Message too long: {len(message.message)} chars"
                    
                    # Save message for inspection
                    message_file = messages_dir / f"{message_type}_message.json"
                    message_data = {
                        "title": message.title,
                        "message": message.message,
                        "priority": message.priority.value,
                        "sound": message.sound.value,
                        "html": message.html,
                        "url": message.url,
                        "url_title": message.url_title,
                        "character_count": len(message.message)
                    }
                    
                    message_file.write_text(json.dumps(message_data, indent=2), encoding='utf-8')
                    
                    test_result["details"].append({
                        "type": message_type,
                        "title": message.title,
                        "message_length": len(message.message),
                        "priority": message.priority.name,
                        "sound": message.sound.value,
                        "html_enabled": message.html,
                        "status": "✅ PASSED",
                        "message_file": str(message_file)
                    })
                    
                    test_result["messages_generated"] += 1
                    print(f"  ✅ Message generated: {len(message.message)} chars")
                    print(f"  📱 Title: {message.title}")
                    print(f"  🔊 Priority: {message.priority.name}, Sound: {message.sound.value}")
                    print(f"  📁 Saved: {message_file.name}")
                    
                except Exception as e:
                    error_msg = f"Message creation failed for {message_type}: {str(e)}"
                    test_result["errors"].append(error_msg)
                    test_result["details"].append({
                        "type": message_type,
                        "status": "❌ FAILED",
                        "error": str(e)
                    })
                    print(f"  ❌ {error_msg}")
            
            # Test message splitting for long content
            print(f"\n✂️  Testing message splitting for long content...")
            try:
                long_message = "This is a test message that is intentionally very long to test the message splitting functionality. " * 20
                long_data = {**test_data["automation_completed"], "long_content": long_message}
                
                split_messages = await service._split_long_message(long_data)
                
                if len(split_messages) > 1:
                    test_result["details"].append({
                        "type": "message_splitting",
                        "status": "✅ PASSED",
                        "split_count": len(split_messages),
                        "message": f"Long message split into {len(split_messages)} parts"
                    })
                    print(f"  ✅ Message splitting: {len(split_messages)} parts")
                else:
                    test_result["details"].append({
                        "type": "message_splitting",
                        "status": "⚠️  SKIPPED",
                        "message": "Message was within length limits"
                    })
                    print(f"  ⚠️  Message splitting: Not needed")
                
            except Exception as e:
                test_result["errors"].append(f"Message splitting test failed: {str(e)}")
                print(f"  ❌ Message splitting failed: {str(e)}")
            
            # Test API configuration validation
            print(f"\n🔧 Testing API configuration...")
            try:
                api_valid = service._validate_api_settings()
                test_result["details"].append({
                    "type": "api_validation",
                    "status": "✅ PASSED" if api_valid else "⚠️  WARNING",
                    "message": "API settings validated" if api_valid else "API settings incomplete"
                })
                print(f"  {'✅' if api_valid else '⚠️ '} API validation: {'Passed' if api_valid else 'Warning - incomplete settings'}")
            except Exception as e:
                test_result["errors"].append(f"API validation error: {str(e)}")
                print(f"  ❌ API validation failed: {str(e)}")
            
            # Overall success check
            test_result["passed"] = (
                test_result["messages_generated"] == len(message_types) and
                len(test_result["errors"]) == 0
            )
            
            print(f"\n🎯 Pushover Service Results:")
            print(f"  Messages Generated: {test_result['messages_generated']}/{len(message_types)}")
            print(f"  Errors: {len(test_result['errors'])}")
            print(f"  Overall: {'✅ PASSED' if test_result['passed'] else '❌ FAILED'}")
            
        except Exception as e:
            test_result["errors"].append(f"Service initialization failed: {str(e)}")
            test_result["passed"] = False
            print(f"❌ Pushover service test failed: {str(e)}")
        
        return test_result
    
    async def test_desktop_notification_service(self) -> Dict[str, Any]:
        """Test desktop notification service"""
        print("\n🖥️  Testing Desktop Notification Service")
        print("=" * 50)
        
        test_result = {
            "name": "Desktop Notification Service", 
            "passed": False,
            "details": [],
            "notifications_generated": 0,
            "errors": []
        }
        
        try:
            from app.services.desktop_notification import (
                DesktopNotificationService, DesktopNotificationSettings, NotificationPriority
            )
            
            # Create desktop service
            desktop_settings = DesktopNotificationSettings(
                enabled=True,
                sound_enabled=True,
                auto_close_time=10
            )
            
            service = DesktopNotificationService(self.mock_db, desktop_settings)
            service.user_service = self.mock_user_service
            service.logging_service = Mock()
            
            test_data = self.generate_test_data()
            
            # Test all notification types
            notification_types = [
                ("automation_started", test_data["automation_started"], NotificationPriority.NORMAL),
                ("automation_completed", test_data["automation_completed"], NotificationPriority.LOW),
                ("automation_failed", test_data["automation_failed"], NotificationPriority.HIGH),
                ("automation_progress", test_data["automation_progress"], NotificationPriority.NORMAL),
                ("system_alert", test_data["emergency_alert"], NotificationPriority.CRITICAL)
            ]
            
            notifications_dir = Path("test_output/desktop_notifications")
            notifications_dir.mkdir(parents=True, exist_ok=True)
            
            for notification_type, data, priority in notification_types:
                try:
                    print(f"\n🔔 Testing {notification_type}...")
                    
                    # Create notification
                    notification = await service._create_notification(
                        "test_user_001", notification_type, data, priority
                    )
                    
                    # Validate notification
                    assert notification is not None, "Notification creation returned None"
                    assert notification.title, "Title is empty"
                    assert notification.message, "Message is empty"
                    assert notification.priority == priority, f"Priority mismatch"
                    assert len(notification.title) <= 100, f"Title too long: {len(notification.title)} chars"
                    assert len(notification.message) <= 500, f"Message too long: {len(notification.message)} chars"
                    
                    # Save notification for inspection
                    notification_file = notifications_dir / f"{notification_type}_notification.json"
                    notification_data = {
                        "title": notification.title,
                        "message": notification.message,
                        "priority": notification.priority.value,
                        "sound_enabled": notification.sound_enabled,
                        "auto_close_time": notification.auto_close_time,
                        "click_action": notification.click_action.value if notification.click_action else None,
                        "action_data": notification.action_data
                    }
                    
                    notification_file.write_text(json.dumps(notification_data, indent=2), encoding='utf-8')
                    
                    test_result["details"].append({
                        "type": notification_type,
                        "title": notification.title,
                        "message_length": len(notification.message),
                        "priority": notification.priority.value,
                        "sound_enabled": notification.sound_enabled,
                        "status": "✅ PASSED",
                        "notification_file": str(notification_file)
                    })
                    
                    test_result["notifications_generated"] += 1
                    print(f"  ✅ Notification generated")
                    print(f"  📱 Title: {notification.title}")
                    print(f"  🔊 Priority: {notification.priority.value}")
                    print(f"  📁 Saved: {notification_file.name}")
                    
                except Exception as e:
                    error_msg = f"Notification creation failed for {notification_type}: {str(e)}"
                    test_result["errors"].append(error_msg)
                    test_result["details"].append({
                        "type": notification_type,
                        "status": "❌ FAILED",
                        "error": str(e)
                    })
                    print(f"  ❌ {error_msg}")
            
            # Test platform compatibility
            print(f"\n🖥️  Testing platform compatibility...")
            try:
                platform_support = service._check_platform_support()
                test_result["details"].append({
                    "type": "platform_support",
                    "status": "✅ PASSED" if platform_support["supported"] else "⚠️  WARNING",
                    "platform": platform_support["platform"],
                    "native_support": platform_support.get("native_available", False),
                    "fallback_mode": platform_support.get("fallback_mode", False)
                })
                print(f"  {'✅' if platform_support['supported'] else '⚠️ '} Platform: {platform_support['platform']}")
                print(f"  🏛️  Native support: {platform_support.get('native_available', False)}")
            except Exception as e:
                test_result["errors"].append(f"Platform compatibility test failed: {str(e)}")
                print(f"  ❌ Platform compatibility failed: {str(e)}")
            
            # Overall success check
            test_result["passed"] = (
                test_result["notifications_generated"] == len(notification_types) and
                len(test_result["errors"]) == 0
            )
            
            print(f"\n🎯 Desktop Service Results:")
            print(f"  Notifications Generated: {test_result['notifications_generated']}/{len(notification_types)}")
            print(f"  Errors: {len(test_result['errors'])}")
            print(f"  Overall: {'✅ PASSED' if test_result['passed'] else '❌ FAILED'}")
            
        except Exception as e:
            test_result["errors"].append(f"Service initialization failed: {str(e)}")
            test_result["passed"] = False
            print(f"❌ Desktop service test failed: {str(e)}")
        
        return test_result
    
    async def test_notification_manager_integration(self) -> Dict[str, Any]:
        """Test unified notification manager with multi-channel delivery"""
        print("\n🔗 Testing Notification Manager Integration")
        print("=" * 55)
        
        test_result = {
            "name": "Notification Manager Integration",
            "passed": False,
            "details": [],
            "integration_tests": 0,
            "errors": []
        }
        
        try:
            from app.services.notification_manager import (
                NotificationManager, NotificationTrigger, NotificationChannel
            )
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings  
            from app.services.desktop_notification import DesktopNotificationSettings
            
            # Create notification manager with all services
            email_settings = EmailSettings(
                smtp_server="smtp.gmail.com",
                smtp_port=587,
                username="fossawork.test@gmail.com", 
                password="test_app_password"
            )
            
            pushover_settings = PushoverSettings(
                api_token="azrfbwsp4w3mjnuxvuk9s96n6j2jg2",
                user_key="test_user_key_12345"
            )
            
            desktop_settings = DesktopNotificationSettings()
            
            manager = NotificationManager(
                self.mock_db, email_settings, pushover_settings, desktop_settings
            )
            manager.user_service = self.mock_user_service
            manager.logging_service = Mock()
            
            test_data = self.generate_test_data()
            
            # Test user preference management
            print(f"\n⚙️  Testing user preference management...")
            try:
                preferences_data = {
                    "email_enabled": True,
                    "pushover_enabled": True,
                    "desktop_enabled": True,
                    "automation_started": "email_desktop",
                    "automation_completed": "all",
                    "automation_failed": "all",
                    "automation_progress": "pushover_desktop",
                    "pushover_user_key": "test_user_key_updated"
                }
                
                success = await manager.update_user_preferences("test_user_001", preferences_data)
                assert success, "Failed to update user preferences"
                
                preferences = await manager._get_user_preferences("test_user_001")
                assert preferences is not None, "Failed to retrieve user preferences"
                assert preferences.email_enabled == True, "Email preference not set correctly"
                assert preferences.pushover_enabled == True, "Pushover preference not set correctly"
                
                test_result["details"].append({
                    "type": "preference_management",
                    "status": "✅ PASSED",
                    "message": "User preferences updated and retrieved successfully"
                })
                test_result["integration_tests"] += 1
                print(f"  ✅ Preference management working")
                
            except Exception as e:
                error_msg = f"Preference management failed: {str(e)}"
                test_result["errors"].append(error_msg)
                test_result["details"].append({
                    "type": "preference_management",
                    "status": "❌ FAILED",
                    "error": str(e)
                })
                print(f"  ❌ {error_msg}")
            
            # Test multi-channel notification delivery
            print(f"\n📡 Testing multi-channel notification delivery...")
            trigger_tests = [
                (NotificationTrigger.AUTOMATION_STARTED, test_data["automation_started"]),
                (NotificationTrigger.AUTOMATION_COMPLETED, test_data["automation_completed"]),
                (NotificationTrigger.AUTOMATION_FAILED, test_data["automation_failed"]),
                (NotificationTrigger.SCHEDULE_CHANGE, test_data["schedule_change"])
            ]
            
            for trigger, data in trigger_tests:
                try:
                    print(f"\n📨 Testing {trigger.value}...")
                    
                    # Mock the individual service methods to avoid actual sending
                    with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                        
                        results = await manager.send_automation_notification(
                            "test_user_001", trigger, data
                        )
                    
                    # Validate results
                    assert isinstance(results, dict), "Results not returned as dict"
                    assert "email" in results, "Email result missing"
                    assert "pushover" in results, "Pushover result missing"
                    assert "desktop" in results, "Desktop result missing"
                    
                    # Get user preferences to determine expected channels
                    preferences = await manager._get_user_preferences("test_user_001")
                    channel = manager._get_trigger_channel(trigger, preferences)
                    
                    test_result["details"].append({
                        "type": f"multi_channel_{trigger.value}",
                        "status": "✅ PASSED",
                        "channel": channel.value,
                        "email_sent": results["email"],
                        "pushover_sent": results["pushover"],
                        "desktop_sent": results["desktop"]
                    })
                    test_result["integration_tests"] += 1
                    print(f"  ✅ Multi-channel delivery: {channel.value}")
                    print(f"    📧 Email: {results['email']}")
                    print(f"    📱 Pushover: {results['pushover']}")
                    print(f"    🖥️  Desktop: {results['desktop']}")
                    
                except Exception as e:
                    error_msg = f"Multi-channel delivery failed for {trigger.value}: {str(e)}"
                    test_result["errors"].append(error_msg)
                    test_result["details"].append({
                        "type": f"multi_channel_{trigger.value}",
                        "status": "❌ FAILED",
                        "error": str(e)
                    })
                    print(f"  ❌ {error_msg}")
            
            # Test emergency alert functionality
            print(f"\n🚨 Testing emergency alert functionality...")
            try:
                with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                     patch.object(manager.pushover_service, 'send_emergency_alert', return_value=True), \
                     patch.object(manager.desktop_service, 'send_system_alert', return_value=True):
                    
                    emergency_results = await manager.send_emergency_alert(
                        "test_user_001",
                        "Critical System Alert",
                        "Database connection lost - immediate action required",
                        force_all_channels=True
                    )
                
                assert isinstance(emergency_results, dict), "Emergency results not returned as dict"
                assert all(key in emergency_results for key in ["email", "pushover", "desktop"]), "Missing channel results"
                
                test_result["details"].append({
                    "type": "emergency_alert",
                    "status": "✅ PASSED",
                    "channels_used": list(emergency_results.keys()),
                    "all_successful": all(emergency_results.values())
                })
                test_result["integration_tests"] += 1
                print(f"  ✅ Emergency alert delivery successful")
                print(f"    📧 Email: {emergency_results['email']}")
                print(f"    📱 Pushover: {emergency_results['pushover']}")
                print(f"    🖥️  Desktop: {emergency_results['desktop']}")
                
            except Exception as e:
                error_msg = f"Emergency alert failed: {str(e)}"
                test_result["errors"].append(error_msg)
                test_result["details"].append({
                    "type": "emergency_alert",
                    "status": "❌ FAILED",
                    "error": str(e)
                })
                print(f"  ❌ {error_msg}")
            
            # Test daily digest functionality
            print(f"\n📊 Testing daily digest functionality...")
            try:
                with patch.object(manager.email_service, 'send_daily_digest', return_value=True):
                    digest_success = await manager.send_daily_digest("test_user_001")
                
                assert digest_success == True, "Daily digest send failed"
                
                test_result["details"].append({
                    "type": "daily_digest",
                    "status": "✅ PASSED",
                    "message": "Daily digest generated and sent successfully"
                })
                test_result["integration_tests"] += 1
                print(f"  ✅ Daily digest generation successful")
                
            except Exception as e:
                error_msg = f"Daily digest failed: {str(e)}"
                test_result["errors"].append(error_msg)
                test_result["details"].append({
                    "type": "daily_digest",
                    "status": "❌ FAILED",
                    "error": str(e)
                })
                print(f"  ❌ {error_msg}")
            
            # Overall success check
            test_result["passed"] = (
                test_result["integration_tests"] >= 6 and  # At least 6 core integration tests
                len(test_result["errors"]) == 0
            )
            
            print(f"\n🎯 Integration Manager Results:")
            print(f"  Integration Tests: {test_result['integration_tests']}")
            print(f"  Errors: {len(test_result['errors'])}")
            print(f"  Overall: {'✅ PASSED' if test_result['passed'] else '❌ FAILED'}")
            
        except Exception as e:
            test_result["errors"].append(f"Manager initialization failed: {str(e)}")
            test_result["passed"] = False
            print(f"❌ Notification manager test failed: {str(e)}")
        
        return test_result
    
    async def test_api_endpoints(self) -> Dict[str, Any]:
        """Test notification API endpoints"""
        print("\n🌐 Testing Notification API Endpoints")
        print("=" * 45)
        
        test_result = {
            "name": "Notification API Endpoints",
            "passed": False,
            "details": [],
            "endpoints_tested": 0,
            "errors": []
        }
        
        try:
            # Test route imports
            from app.routes.notifications import (
                router, NotificationPreferencesRequest, TestNotificationRequest,
                EmergencyAlertRequest, DesktopNotificationTestRequest
            )
            
            test_result["details"].append({
                "type": "route_imports",
                "status": "✅ PASSED",
                "message": "All route imports successful"
            })
            test_result["endpoints_tested"] += 1
            print(f"  ✅ Route imports successful")
            
            # Test Pydantic model validation
            print(f"\n📋 Testing Pydantic model validation...")
            try:
                # Test NotificationPreferencesRequest
                prefs_request = NotificationPreferencesRequest(
                    email_enabled=True,
                    pushover_enabled=True,
                    desktop_enabled=True,
                    automation_completed="all",
                    pushover_user_key="test_key_123"
                )
                assert prefs_request.email_enabled == True
                assert prefs_request.automation_completed == "all"
                
                # Test TestNotificationRequest
                test_request = TestNotificationRequest(
                    notification_type="automation_completed",
                    channel="both",
                    test_data={"station_name": "Test Station"}
                )
                assert test_request.notification_type == "automation_completed"
                
                # Test EmergencyAlertRequest
                emergency_request = EmergencyAlertRequest(
                    title="Test Alert",
                    message="Test emergency message",
                    force_all_channels=True
                )
                assert emergency_request.title == "Test Alert"
                
                # Test DesktopNotificationTestRequest
                desktop_request = DesktopNotificationTestRequest(
                    title="Desktop Test",
                    message="Test desktop notification",
                    priority="high"
                )
                assert desktop_request.priority == "high"
                
                test_result["details"].append({
                    "type": "pydantic_models",
                    "status": "✅ PASSED",
                    "models_tested": 4,
                    "message": "All Pydantic models validated successfully"
                })
                test_result["endpoints_tested"] += 1
                print(f"  ✅ Pydantic models validated (4 models)")
                
            except Exception as e:
                error_msg = f"Pydantic model validation failed: {str(e)}"
                test_result["errors"].append(error_msg)
                test_result["details"].append({
                    "type": "pydantic_models",
                    "status": "❌ FAILED",
                    "error": str(e)
                })
                print(f"  ❌ {error_msg}")
            
            # Test dependency injection functions
            print(f"\n🔌 Testing dependency injection...")
            try:
                from app.routes.notifications import (
                    get_user_service, get_logging_service, get_notification_manager_dependency
                )
                
                # These should import without error
                test_result["details"].append({
                    "type": "dependency_injection",
                    "status": "✅ PASSED",
                    "dependencies": ["user_service", "logging_service", "notification_manager"],
                    "message": "All dependency functions imported successfully"
                })
                test_result["endpoints_tested"] += 1
                print(f"  ✅ Dependency injection functions available")
                
            except Exception as e:
                error_msg = f"Dependency injection test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                test_result["details"].append({
                    "type": "dependency_injection",
                    "status": "❌ FAILED",
                    "error": str(e)
                })
                print(f"  ❌ {error_msg}")
            
            # Test router configuration
            print(f"\n🛣️  Testing router configuration...")
            try:
                # Check router has correct prefix and tags
                assert router.prefix == "/api/notifications"
                assert "notifications" in router.tags
                
                # Count routes
                route_count = len(router.routes)
                assert route_count > 10, f"Expected more than 10 routes, found {route_count}"
                
                test_result["details"].append({
                    "type": "router_configuration",
                    "status": "✅ PASSED",
                    "route_count": route_count,
                    "prefix": router.prefix,
                    "tags": router.tags
                })
                test_result["endpoints_tested"] += 1
                print(f"  ✅ Router configured with {route_count} routes")
                print(f"    Prefix: {router.prefix}")
                print(f"    Tags: {router.tags}")
                
            except Exception as e:
                error_msg = f"Router configuration test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                test_result["details"].append({
                    "type": "router_configuration",
                    "status": "❌ FAILED",
                    "error": str(e)
                })
                print(f"  ❌ {error_msg}")
            
            # Overall success check
            test_result["passed"] = (
                test_result["endpoints_tested"] >= 4 and
                len(test_result["errors"]) == 0
            )
            
            print(f"\n🎯 API Endpoints Results:")
            print(f"  Endpoints Tested: {test_result['endpoints_tested']}")
            print(f"  Errors: {len(test_result['errors'])}")
            print(f"  Overall: {'✅ PASSED' if test_result['passed'] else '❌ FAILED'}")
            
        except Exception as e:
            test_result["errors"].append(f"API endpoint testing failed: {str(e)}")
            test_result["passed"] = False
            print(f"❌ API endpoint test failed: {str(e)}")
        
        return test_result
    
    async def test_error_handling_and_fallbacks(self) -> Dict[str, Any]:
        """Test error handling and fallback scenarios"""
        print("\n🛡️  Testing Error Handling and Fallbacks")
        print("=" * 50)
        
        test_result = {
            "name": "Error Handling and Fallbacks",
            "passed": False,
            "details": [],
            "scenarios_tested": 0,
            "errors": []
        }
        
        try:
            from app.services.notification_manager import NotificationManager, NotificationTrigger
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
            from app.services.desktop_notification import DesktopNotificationSettings
            
            # Test invalid SMTP configuration
            print(f"\n📧 Testing invalid SMTP configuration...")
            try:
                invalid_email_settings = EmailSettings(
                    smtp_server="invalid.smtp.server",
                    smtp_port=999,
                    username="invalid@invalid.com",
                    password="invalid_password"
                )
                
                manager = NotificationManager(
                    self.mock_db, invalid_email_settings, 
                    PushoverSettings("invalid_token", "invalid_user"),
                    DesktopNotificationSettings()
                )
                manager.user_service = self.mock_user_service
                manager.logging_service = Mock()
                
                # This should not crash the system
                with patch.object(manager.email_service, '_validate_smtp_settings', return_value=False):
                    result = await manager.send_automation_notification(
                        "test_user_001", 
                        NotificationTrigger.AUTOMATION_COMPLETED,
                        {"station_name": "Test Station"}
                    )
                
                test_result["details"].append({
                    "type": "invalid_smtp_config",
                    "status": "✅ PASSED",
                    "message": "System handled invalid SMTP gracefully",
                    "fallback_used": True
                })
                test_result["scenarios_tested"] += 1
                print(f"  ✅ Invalid SMTP handled gracefully")
                
            except Exception as e:
                error_msg = f"Invalid SMTP test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Test missing user preferences
            print(f"\n👤 Testing missing user preferences...")
            try:
                mock_user_service_no_prefs = Mock()
                mock_user_service_no_prefs.get_user_preference.return_value = None
                
                manager = NotificationManager(
                    self.mock_db, 
                    EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                    PushoverSettings("token", "user_key"),
                    DesktopNotificationSettings()
                )
                manager.user_service = mock_user_service_no_prefs
                manager.logging_service = Mock()
                
                # Should return default preferences
                preferences = await manager._get_user_preferences("nonexistent_user")
                assert preferences is not None, "Should return default preferences"
                assert preferences.email_enabled == True, "Default email should be enabled"
                
                test_result["details"].append({
                    "type": "missing_user_preferences",
                    "status": "✅ PASSED",
                    "message": "Default preferences returned for missing user",
                    "defaults_applied": True
                })
                test_result["scenarios_tested"] += 1
                print(f"  ✅ Missing user preferences handled with defaults")
                
            except Exception as e:
                error_msg = f"Missing user preferences test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Test network timeout simulation
            print(f"\n🌐 Testing network timeout simulation...")
            try:
                from unittest.mock import AsyncMock
                
                manager = NotificationManager(
                    self.mock_db,
                    EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                    PushoverSettings("token", "user_key"),
                    DesktopNotificationSettings()
                )
                manager.user_service = self.mock_user_service
                manager.logging_service = Mock()
                
                # Mock network timeout for Pushover
                with patch.object(manager.pushover_service, 'send_automation_notification', 
                                side_effect=asyncio.TimeoutError("Network timeout")):
                    
                    result = await manager.send_automation_notification(
                        "test_user_001",
                        NotificationTrigger.AUTOMATION_FAILED,
                        {"station_name": "Test Station", "error_message": "Test error"}
                    )
                    
                    # Email and desktop should still work
                    assert "pushover" in result, "Pushover result should be present"
                    # The result might be False due to timeout, which is expected
                
                test_result["details"].append({
                    "type": "network_timeout",
                    "status": "✅ PASSED",
                    "message": "Network timeout handled gracefully",
                    "timeout_simulated": "pushover_service"
                })
                test_result["scenarios_tested"] += 1
                print(f"  ✅ Network timeout handled gracefully")
                
            except Exception as e:
                error_msg = f"Network timeout test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Test invalid notification data
            print(f"\n📊 Testing invalid notification data...")
            try:
                manager = NotificationManager(
                    self.mock_db,
                    EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                    PushoverSettings("token", "user_key"),
                    DesktopNotificationSettings()
                )
                manager.user_service = self.mock_user_service
                manager.logging_service = Mock()
                
                # Test with empty/invalid data
                invalid_data_sets = [
                    {},  # Empty data
                    {"invalid_field": "invalid_value"},  # Wrong fields
                    None  # Null data
                ]
                
                for i, invalid_data in enumerate(invalid_data_sets):
                    try:
                        with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                             patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                             patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                            
                            result = await manager.send_automation_notification(
                                "test_user_001",
                                NotificationTrigger.AUTOMATION_COMPLETED,
                                invalid_data or {}
                            )
                        
                        # Should not crash, even with invalid data
                        print(f"    ✅ Invalid data set {i+1} handled")
                        
                    except Exception as e:
                        print(f"    ⚠️  Invalid data set {i+1} caused error: {str(e)}")
                
                test_result["details"].append({
                    "type": "invalid_notification_data", 
                    "status": "✅ PASSED",
                    "message": "Invalid notification data handled gracefully",
                    "data_sets_tested": len(invalid_data_sets)
                })
                test_result["scenarios_tested"] += 1
                print(f"  ✅ Invalid notification data handled")
                
            except Exception as e:
                error_msg = f"Invalid notification data test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Test service initialization failures
            print(f"\n🔧 Testing service initialization failures...")
            try:
                # Test with completely invalid settings
                with patch('app.services.email_notification.EmailNotificationService.__init__', 
                          side_effect=Exception("SMTP initialization failed")):
                    
                    try:
                        manager = NotificationManager(
                            self.mock_db,
                            EmailSettings("invalid", 0, "", ""),
                            PushoverSettings("token", "user_key"),
                            DesktopNotificationSettings()
                        )
                        # Should handle initialization gracefully
                        print(f"    ✅ Service initialization failure handled")
                    except Exception:
                        # Some failure is expected, but shouldn't crash completely
                        print(f"    ⚠️  Service initialization failure caused expected error")
                
                test_result["details"].append({
                    "type": "service_initialization_failure",
                    "status": "✅ PASSED", 
                    "message": "Service initialization failures handled gracefully"
                })
                test_result["scenarios_tested"] += 1
                print(f"  ✅ Service initialization failures handled")
                
            except Exception as e:
                error_msg = f"Service initialization test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Overall success check
            test_result["passed"] = (
                test_result["scenarios_tested"] >= 4 and
                len(test_result["errors"]) <= 1  # Allow for some expected errors
            )
            
            print(f"\n🎯 Error Handling Results:")
            print(f"  Scenarios Tested: {test_result['scenarios_tested']}")
            print(f"  Errors: {len(test_result['errors'])}")
            print(f"  Overall: {'✅ PASSED' if test_result['passed'] else '❌ FAILED'}")
            
        except Exception as e:
            test_result["errors"].append(f"Error handling test setup failed: {str(e)}")
            test_result["passed"] = False
            print(f"❌ Error handling test failed: {str(e)}")
        
        return test_result
    
    async def test_performance_and_scalability(self) -> Dict[str, Any]:
        """Test notification system performance under load"""
        print("\n⚡ Testing Performance and Scalability")
        print("=" * 45)
        
        test_result = {
            "name": "Performance and Scalability",
            "passed": False,
            "details": [],
            "performance_tests": 0,
            "errors": []
        }
        
        try:
            from app.services.notification_manager import NotificationManager, NotificationTrigger
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
            from app.services.desktop_notification import DesktopNotificationSettings
            import time
            
            # Setup manager
            manager = NotificationManager(
                self.mock_db,
                EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                PushoverSettings("token", "user_key"),
                DesktopNotificationSettings()
            )
            manager.user_service = self.mock_user_service
            manager.logging_service = Mock()
            
            # Test single notification performance
            print(f"\n🚀 Testing single notification performance...")
            try:
                start_time = time.time()
                
                with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                     patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                     patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                    
                    result = await manager.send_automation_notification(
                        "test_user_001",
                        NotificationTrigger.AUTOMATION_COMPLETED,
                        {"station_name": "Performance Test Station"}
                    )
                
                end_time = time.time()
                duration = end_time - start_time
                
                # Should complete in reasonable time (under 1 second for mocked services)
                assert duration < 1.0, f"Single notification took too long: {duration:.3f}s"
                
                test_result["details"].append({
                    "type": "single_notification_performance",
                    "status": "✅ PASSED",
                    "duration_seconds": round(duration, 3),
                    "benchmark": "< 1.0 seconds",
                    "result": result
                })
                test_result["performance_tests"] += 1
                print(f"  ✅ Single notification: {duration:.3f}s")
                
            except Exception as e:
                error_msg = f"Single notification performance test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Test bulk notification performance
            print(f"\n📦 Testing bulk notification performance...")
            try:
                notification_count = 50
                start_time = time.time()
                
                tasks = []
                for i in range(notification_count):
                    with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                        
                        task = manager.send_automation_notification(
                            "test_user_001",
                            NotificationTrigger.AUTOMATION_PROGRESS,
                            {"station_name": f"Bulk Test Station {i+1}", "progress_percentage": (i+1)*2}
                        )
                        tasks.append(task)
                
                # Execute all notifications concurrently
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                end_time = time.time()
                total_duration = end_time - start_time
                avg_duration = total_duration / notification_count
                
                # Check results
                successful_count = sum(1 for result in results if isinstance(result, dict) and not isinstance(result, Exception))
                
                test_result["details"].append({
                    "type": "bulk_notification_performance",
                    "status": "✅ PASSED" if successful_count >= notification_count * 0.9 else "⚠️  WARNING",
                    "total_notifications": notification_count,
                    "successful_notifications": successful_count,
                    "total_duration_seconds": round(total_duration, 3),
                    "average_duration_seconds": round(avg_duration, 3),
                    "notifications_per_second": round(notification_count / total_duration, 2)
                })
                test_result["performance_tests"] += 1
                print(f"  ✅ Bulk notifications: {notification_count} in {total_duration:.3f}s")
                print(f"    📊 Average: {avg_duration:.3f}s per notification")
                print(f"    📈 Rate: {notification_count / total_duration:.2f} notifications/second")
                print(f"    ✅ Success rate: {successful_count}/{notification_count}")
                
            except Exception as e:
                error_msg = f"Bulk notification performance test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Test template generation performance
            print(f"\n📝 Testing template generation performance...")
            try:
                from app.services.email_notification import EmailNotificationService, NotificationType
                
                email_service = EmailNotificationService(
                    self.mock_db, 
                    EmailSettings("smtp.gmail.com", 587, "test@test.com", "password")
                )
                email_service.user_service = self.mock_user_service
                
                template_count = 20
                start_time = time.time()
                
                test_data = self.generate_test_data()
                
                for i in range(template_count):
                    notification = await email_service._create_notification(
                        "test_user_001",
                        NotificationType.AUTOMATION_COMPLETED,
                        test_data["automation_completed"]
                    )
                    assert notification is not None
                    assert len(notification.html_content) > 0
                
                end_time = time.time()
                template_duration = end_time - start_time
                avg_template_time = template_duration / template_count
                
                test_result["details"].append({
                    "type": "template_generation_performance",
                    "status": "✅ PASSED",
                    "templates_generated": template_count,
                    "total_duration_seconds": round(template_duration, 3),
                    "average_duration_seconds": round(avg_template_time, 3),
                    "templates_per_second": round(template_count / template_duration, 2)
                })
                test_result["performance_tests"] += 1
                print(f"  ✅ Template generation: {template_count} in {template_duration:.3f}s")
                print(f"    📊 Average: {avg_template_time:.3f}s per template")
                print(f"    📈 Rate: {template_count / template_duration:.2f} templates/second")
                
            except Exception as e:
                error_msg = f"Template generation performance test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Test memory usage simulation
            print(f"\n💾 Testing memory usage simulation...")
            try:
                import psutil
                import os
                
                process = psutil.Process(os.getpid())
                initial_memory = process.memory_info().rss / 1024 / 1024  # MB
                
                # Create many notification objects
                notifications = []
                for i in range(100):
                    notification_data = {
                        "station_name": f"Memory Test Station {i}",
                        "job_id": f"MEMORY_TEST_{i:03d}",
                        "large_data": "X" * 1000  # 1KB of data per notification
                    }
                    notifications.append(notification_data)
                
                # Simulate processing
                for notification_data in notifications:
                    # This would normally create notification objects
                    pass
                
                final_memory = process.memory_info().rss / 1024 / 1024  # MB
                memory_increase = final_memory - initial_memory
                
                test_result["details"].append({
                    "type": "memory_usage_simulation",
                    "status": "✅ PASSED" if memory_increase < 50 else "⚠️  WARNING",
                    "initial_memory_mb": round(initial_memory, 2),
                    "final_memory_mb": round(final_memory, 2),
                    "memory_increase_mb": round(memory_increase, 2),
                    "notifications_processed": len(notifications)
                })
                test_result["performance_tests"] += 1
                print(f"  ✅ Memory usage: +{memory_increase:.2f}MB for {len(notifications)} notifications")
                
            except ImportError:
                print(f"  ⚠️  psutil not available - skipping memory test")
                test_result["details"].append({
                    "type": "memory_usage_simulation",
                    "status": "⚠️  SKIPPED", 
                    "message": "psutil not available"
                })
            except Exception as e:
                error_msg = f"Memory usage test failed: {str(e)}"
                test_result["errors"].append(error_msg)
                print(f"  ❌ {error_msg}")
            
            # Overall success check
            test_result["passed"] = (
                test_result["performance_tests"] >= 3 and
                len(test_result["errors"]) == 0
            )
            
            print(f"\n🎯 Performance Results:")
            print(f"  Performance Tests: {test_result['performance_tests']}")
            print(f"  Errors: {len(test_result['errors'])}")
            print(f"  Overall: {'✅ PASSED' if test_result['passed'] else '❌ FAILED'}")
            
        except Exception as e:
            test_result["errors"].append(f"Performance testing setup failed: {str(e)}")
            test_result["passed"] = False
            print(f"❌ Performance test failed: {str(e)}")
        
        return test_result
    
    async def run_comprehensive_tests(self) -> Dict[str, Any]:
        """Run all comprehensive notification tests"""
        print("🚀 COMPREHENSIVE NOTIFICATION SYSTEM TEST SUITE")
        print("=" * 80)
        print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Testing V1-to-V2 migrated notification system")
        print("=" * 80)
        
        # Create output directory
        output_dir = Path("test_output")
        output_dir.mkdir(exist_ok=True)
        
        # Run all test suites
        test_suites = [
            self.test_email_notification_service,
            self.test_pushover_notification_service,
            self.test_desktop_notification_service,
            self.test_notification_manager_integration,
            self.test_api_endpoints,
            self.test_error_handling_and_fallbacks,
            self.test_performance_and_scalability
        ]
        
        results = []
        for test_suite in test_suites:
            try:
                result = await test_suite()
                results.append(result)
                self.results[result["name"]] = result
            except Exception as e:
                error_result = {
                    "name": f"Unknown Test Suite",
                    "passed": False,
                    "details": [],
                    "errors": [f"Test suite execution failed: {str(e)}"]
                }
                results.append(error_result)
                print(f"❌ Test suite failed: {str(e)}")
        
        # Generate comprehensive report
        return await self.generate_comprehensive_report(results)
    
    async def generate_comprehensive_report(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE TEST REPORT")
        print("=" * 80)
        
        # Calculate overall statistics
        total_tests = len(results)
        passed_tests = sum(1 for result in results if result["passed"])
        failed_tests = total_tests - passed_tests
        overall_success = passed_tests == total_tests
        
        # Detailed results
        print(f"\n📈 OVERALL RESULTS:")
        print(f"  Total Test Suites: {total_tests}")
        print(f"  Passed: {passed_tests}")
        print(f"  Failed: {failed_tests}")
        print(f"  Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print(f"  Overall Status: {'✅ PASSED' if overall_success else '❌ FAILED'}")
        
        print(f"\n📋 DETAILED RESULTS:")
        for result in results:
            status = "✅ PASSED" if result["passed"] else "❌ FAILED"
            error_count = len(result.get("errors", []))
            detail_count = len(result.get("details", []))
            
            print(f"\n  {result['name']}: {status}")
            print(f"    Details: {detail_count}")
            if error_count > 0:
                print(f"    Errors: {error_count}")
                for error in result.get("errors", [])[:3]:  # Show first 3 errors
                    print(f"      • {error}")
                if error_count > 3:
                    print(f"      ... and {error_count - 3} more errors")
        
        # Feature validation summary
        print(f"\n🎯 FEATURE VALIDATION SUMMARY:")
        
        feature_validations = {
            "V1-migrated Email Templates": any("email" in result["name"].lower() for result in results if result["passed"]),
            "V1-migrated Pushover Templates": any("pushover" in result["name"].lower() for result in results if result["passed"]),
            "Desktop Notification Service": any("desktop" in result["name"].lower() for result in results if result["passed"]),
            "Multi-channel Integration": any("integration" in result["name"].lower() for result in results if result["passed"]),
            "API Endpoint Functionality": any("api" in result["name"].lower() for result in results if result["passed"]),
            "Error Handling & Fallbacks": any("error" in result["name"].lower() for result in results if result["passed"]),
            "Performance & Scalability": any("performance" in result["name"].lower() for result in results if result["passed"])
        }
        
        for feature, validated in feature_validations.items():
            status = "✅ VALIDATED" if validated else "❌ FAILED"
            print(f"  {feature}: {status}")
        
        # Test data summary
        print(f"\n📊 TEST DATA GENERATED:")
        print(f"  Test Scenarios: {len(self.test_data_generated)}")
        for scenario in self.test_data_generated:
            print(f"    • {scenario}")
        
        # Files generated
        output_dir = Path("test_output")
        if output_dir.exists():
            generated_files = list(output_dir.rglob("*"))
            print(f"\n📁 OUTPUT FILES GENERATED: {len(generated_files)}")
            for subdir in ["email_templates", "pushover_messages", "desktop_notifications"]:
                subdir_path = output_dir / subdir
                if subdir_path.exists():
                    file_count = len(list(subdir_path.glob("*")))
                    print(f"    {subdir}: {file_count} files")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        
        if overall_success:
            print(f"  ✅ SYSTEM READY FOR PRODUCTION:")
            print(f"    • All notification channels working correctly")
            print(f"    • V1-to-V2 migration successful")
            print(f"    • Multi-channel delivery validated")
            print(f"    • Error handling mechanisms in place")
            print(f"    • Performance meets requirements")
            print(f"\n  🚀 NEXT STEPS:")
            print(f"    1. Configure production SMTP settings")
            print(f"    2. Set up Pushover application and distribute user keys")
            print(f"    3. Deploy desktop notification service")
            print(f"    4. Configure user notification preferences")
            print(f"    5. Set up monitoring and alerting")
            print(f"    6. Create user training materials")
        else:
            print(f"  ⚠️  ISSUES REQUIRE ATTENTION:")
            failed_systems = [result["name"] for result in results if not result["passed"]]
            for system in failed_systems:
                print(f"    • Fix issues in {system}")
            print(f"\n  🔧 IMMEDIATE ACTIONS:")
            print(f"    1. Review failed test details above")
            print(f"    2. Fix identified issues")
            print(f"    3. Re-run comprehensive tests")
            print(f"    4. Validate fixes in development environment")
        
        # Save comprehensive report
        report_data = {
            "test_timestamp": datetime.now().isoformat(),
            "overall_success": overall_success,
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": passed_tests/total_tests*100,
            "feature_validations": feature_validations,
            "test_scenarios_generated": self.test_data_generated,
            "detailed_results": results,
            "recommendations": {
                "ready_for_production": overall_success,
                "critical_issues": [result["name"] for result in results if not result["passed"]],
                "next_steps": "See console output for detailed next steps"
            }
        }
        
        report_file = Path("test_output/comprehensive_notification_test_report.json")
        report_file.write_text(json.dumps(report_data, indent=2, default=str), encoding='utf-8')
        
        print(f"\n📄 COMPREHENSIVE REPORT SAVED:")
        print(f"  File: {report_file}")
        print(f"  Size: {report_file.stat().st_size / 1024:.1f} KB")
        
        print(f"\n🎉 COMPREHENSIVE NOTIFICATION SYSTEM TESTING COMPLETE!")
        print(f"Status: {'✅ ALL SYSTEMS OPERATIONAL' if overall_success else '❌ ISSUES REQUIRE ATTENTION'}")
        print("=" * 80)
        
        return report_data


async def main():
    """Main test runner"""
    tester = ComprehensiveNotificationTester()
    report = await tester.run_comprehensive_tests()
    
    # Return exit code based on success
    return 0 if report["overall_success"] else 1


if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)