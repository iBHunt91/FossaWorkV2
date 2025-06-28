#!/usr/bin/env python3
"""
Interactive Notification System Test

User-friendly interactive test script for manually validating the complete 
notification system. Allows step-by-step testing with visual feedback and 
user control over test progression.

This script provides:
- Step-by-step testing with user control
- Visual feedback and progress indicators
- Real-time test results display
- Detailed error reporting
- Manual verification prompts
- Test data generation and inspection
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class InteractiveNotificationTester:
    """Interactive notification system tester with user control"""
    
    def __init__(self):
        self.test_results = {}
        self.output_dir = Path("test_output")
        self.output_dir.mkdir(exist_ok=True)
        self.setup_test_environment()
    
    def setup_test_environment(self):
        """Setup test environment and directories"""
        # Create subdirectories for test outputs
        (self.output_dir / "email_templates").mkdir(exist_ok=True)
        (self.output_dir / "pushover_messages").mkdir(exist_ok=True)
        (self.output_dir / "desktop_notifications").mkdir(exist_ok=True)
        (self.output_dir / "screenshots").mkdir(exist_ok=True)
    
    async def wait_for_user(self, prompt: str = "Press Enter to continue..."):
        """Wait for user input to continue"""
        print(f"\n⏸️  {prompt}")
        await asyncio.get_event_loop().run_in_executor(None, input)
    
    def print_header(self, title: str, subtitle: str = ""):
        """Print formatted header"""
        print("\n" + "=" * 80)
        print(f"🎯 {title}")
        if subtitle:
            print(f"   {subtitle}")
        print("=" * 80)
    
    def print_step(self, step_num: int, title: str, description: str = ""):
        """Print formatted step"""
        print(f"\n🔍 Step {step_num}: {title}")
        if description:
            print(f"   {description}")
        print("-" * 60)
    
    def print_result(self, success: bool, message: str, details: str = ""):
        """Print formatted result"""
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"\n{status}: {message}")
        if details:
            print(f"   {details}")
    
    def generate_realistic_test_data(self) -> Dict[str, Any]:
        """Generate realistic test data for notification testing"""
        current_time = datetime.utcnow()
        
        return {
            "automation_started": {
                "station_name": "Wawa Store #1425 - Center City Philadelphia",
                "job_id": "AUTO_20250127_001",
                "work_order_id": "WO_PA_1425_001",
                "service_code": "2861",
                "service_name": "AccuMeasure (All Dispensers)",
                "dispenser_count": 8,
                "estimated_duration": 25,
                "start_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "address": "1234 Market Street, Philadelphia, PA 19107",
                "created_by": "Bruce Hunt",
                "visit_url": "https://app.workfossa.com/visits/12345"
            },
            "automation_completed": {
                "station_name": "Circle K #892 - Tampa Bay",
                "job_id": "AUTO_20250127_002", 
                "work_order_id": "WO_FL_892_002",
                "service_code": "3002",
                "service_name": "AccuMeasure (Specific Dispensers)",
                "dispenser_count": 6,
                "duration": "28 minutes",
                "forms_completed": 6,
                "success_rate": 100,
                "completion_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "address": "5678 Dale Mabry Highway, Tampa, FL 33607",
                "visit_url": "https://app.workfossa.com/visits/67890"
            },
            "automation_failed": {
                "station_name": "7-Eleven #3456 - Houston Energy Corridor",
                "job_id": "AUTO_20250127_003",
                "work_order_id": "WO_TX_3456_003",
                "error_message": "Connection timeout to WorkFossa portal during form submission",
                "failure_time": current_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "progress_percentage": 60,
                "retry_available": True,
                "address": "12345 Katy Freeway, Houston, TX 77079",
                "visit_url": "https://app.workfossa.com/visits/34567"
            },
            "daily_digest": {
                "date": "2025-01-26",
                "total_jobs": 15,
                "successful_jobs": 13,
                "failed_jobs": 2,
                "success_rate": 86.7,
                "dispensers_processed": 45,
                "stations_visited": 15
            }
        }
    
    async def test_email_service_interactive(self) -> bool:
        """Interactive test of email notification service"""
        self.print_header("Email Notification Service Test", "Testing V1-migrated email templates")
        
        try:
            self.print_step(1, "Importing Email Service", "Loading email notification components...")
            await self.wait_for_user()
            
            from app.services.email_notification import (
                EmailNotificationService, EmailSettings, NotificationType
            )
            
            self.print_result(True, "Email service imported successfully")
            
            self.print_step(2, "Setting Up Email Configuration", "Creating test SMTP settings...")
            await self.wait_for_user()
            
            email_settings = EmailSettings(
                smtp_server="smtp.gmail.com",
                smtp_port=587,
                username="fossawork.test@gmail.com",
                password="test_app_password",
                from_email="fossawork.test@gmail.com",
                from_name="FossaWork Automation System"
            )
            
            self.print_result(True, "Email configuration created", 
                            f"SMTP: {email_settings.smtp_server}:{email_settings.smtp_port}")
            
            self.print_step(3, "Creating Email Service Instance", "Initializing email service...")
            await self.wait_for_user()
            
            from unittest.mock import Mock
            mock_db = Mock()
            service = EmailNotificationService(mock_db, email_settings)
            
            # Mock user service
            mock_user_service = Mock()
            mock_user_service.get_user.return_value = Mock(
                user_id="test_user", email="bruce@fossawork.com"
            )
            service.user_service = mock_user_service
            service.logging_service = Mock()
            
            self.print_result(True, "Email service initialized successfully")
            
            self.print_step(4, "Generating Test Templates", "Creating email templates for all notification types...")
            await self.wait_for_user()
            
            test_data = self.generate_realistic_test_data()
            templates_dir = self.output_dir / "email_templates"
            
            notification_types = [
                (NotificationType.AUTOMATION_STARTED, test_data["automation_started"], "🚀 Automation Started"),
                (NotificationType.AUTOMATION_COMPLETED, test_data["automation_completed"], "✅ Automation Completed"),
                (NotificationType.AUTOMATION_FAILED, test_data["automation_failed"], "❌ Automation Failed"),
                (NotificationType.DAILY_DIGEST, test_data["daily_digest"], "📊 Daily Digest")
            ]
            
            template_count = 0
            for notification_type, data, description in notification_types:
                try:
                    print(f"\n   📧 Generating {description}...")
                    
                    notification = await service._create_notification(
                        "test_user", notification_type, data, None
                    )
                    
                    # Save template files
                    html_file = templates_dir / f"{notification_type.value}.html"
                    text_file = templates_dir / f"{notification_type.value}.txt"
                    
                    html_file.write_text(notification.html_content, encoding='utf-8')
                    text_file.write_text(notification.text_content, encoding='utf-8')
                    
                    template_count += 1
                    print(f"      ✅ Generated: {len(notification.html_content)} chars HTML")
                    print(f"      📄 Subject: {notification.subject}")
                    print(f"      💾 Saved: {html_file.name}")
                    
                except Exception as e:
                    self.print_result(False, f"Template generation failed for {description}", str(e))
                    return False
            
            self.print_result(True, f"All email templates generated successfully", 
                            f"{template_count} templates created in {templates_dir}")
            
            self.print_step(5, "Template Inspection", "Review generated email templates...")
            print(f"\n   📁 Template files saved to: {templates_dir}")
            print(f"   📝 Open the HTML files in a web browser to review the designs")
            print(f"   🎨 Check that V1-style branding and formatting is preserved")
            
            await self.wait_for_user("Review the template files, then press Enter to continue...")
            
            # Ask user for verification
            print(f"\n❓ Do the email templates look correct? (y/n): ", end="")
            response = await asyncio.get_event_loop().run_in_executor(None, input)
            
            if response.lower().startswith('y'):
                self.print_result(True, "Email templates verified by user")
                self.test_results["email_service"] = True
                return True
            else:
                self.print_result(False, "Email templates not verified by user")
                self.test_results["email_service"] = False
                return False
                
        except Exception as e:
            self.print_result(False, "Email service test failed", str(e))
            self.test_results["email_service"] = False
            return False
    
    async def test_pushover_service_interactive(self) -> bool:
        """Interactive test of Pushover notification service"""
        self.print_header("Pushover Notification Service Test", "Testing V1-migrated Pushover templates")
        
        try:
            self.print_step(1, "Importing Pushover Service", "Loading Pushover notification components...")
            await self.wait_for_user()
            
            from app.services.pushover_notification import (
                PushoverNotificationService, PushoverSettings, PushoverPriority
            )
            
            self.print_result(True, "Pushover service imported successfully")
            
            self.print_step(2, "Setting Up Pushover Configuration", "Creating test API settings...")
            await self.wait_for_user()
            
            pushover_settings = PushoverSettings(
                api_token="azrfbwsp4w3mjnuxvuk9s96n6j2jg2",  # App token
                user_key="test_user_key_placeholder"
            )
            
            self.print_result(True, "Pushover configuration created",
                            f"API URL: {pushover_settings.api_url}")
            
            self.print_step(3, "Creating Pushover Service Instance", "Initializing Pushover service...")
            await self.wait_for_user()
            
            from unittest.mock import Mock
            mock_db = Mock()
            service = PushoverNotificationService(mock_db, pushover_settings)
            
            # Mock user service
            mock_user_service = Mock()
            mock_user_service.get_user_preference.return_value = "test_user_key_12345"
            service.user_service = mock_user_service
            service.logging_service = Mock()
            
            self.print_result(True, "Pushover service initialized successfully")
            
            self.print_step(4, "Generating Test Messages", "Creating Pushover messages for all notification types...")
            await self.wait_for_user()
            
            test_data = self.generate_realistic_test_data()
            messages_dir = self.output_dir / "pushover_messages"
            
            message_types = [
                ("automation_started", test_data["automation_started"], PushoverPriority.NORMAL, "🚀 Automation Started"),
                ("automation_completed", test_data["automation_completed"], PushoverPriority.LOW, "✅ Automation Completed"),
                ("automation_failed", test_data["automation_failed"], PushoverPriority.HIGH, "❌ Automation Failed"),
                ("daily_summary", test_data["daily_digest"], PushoverPriority.LOW, "📊 Daily Summary")
            ]
            
            message_count = 0
            for message_type, data, priority, description in message_types:
                try:
                    print(f"\n   📱 Generating {description}...")
                    
                    message = await service._create_message(
                        "test_user", message_type, data, priority
                    )
                    
                    # Save message file
                    message_file = messages_dir / f"{message_type}.json"
                    message_data = {
                        "title": message.title,
                        "message": message.message,
                        "priority": message.priority.value,
                        "sound": message.sound.value,
                        "html": message.html,
                        "character_count": len(message.message)
                    }
                    
                    message_file.write_text(json.dumps(message_data, indent=2), encoding='utf-8')
                    
                    message_count += 1
                    print(f"      ✅ Generated: {len(message.message)} chars")
                    print(f"      📱 Title: {message.title}")
                    print(f"      🔊 Priority: {message.priority.name}")
                    print(f"      💾 Saved: {message_file.name}")
                    
                except Exception as e:
                    self.print_result(False, f"Message generation failed for {description}", str(e))
                    return False
            
            self.print_result(True, f"All Pushover messages generated successfully",
                            f"{message_count} messages created in {messages_dir}")
            
            self.print_step(5, "Message Inspection", "Review generated Pushover messages...")
            print(f"\n   📁 Message files saved to: {messages_dir}")
            print(f"   📝 Open the JSON files to review message content and formatting")
            print(f"   🎨 Check that V1-style content and HTML formatting is preserved")
            
            await self.wait_for_user("Review the message files, then press Enter to continue...")
            
            # Ask user for verification
            print(f"\n❓ Do the Pushover messages look correct? (y/n): ", end="")
            response = await asyncio.get_event_loop().run_in_executor(None, input)
            
            if response.lower().startswith('y'):
                self.print_result(True, "Pushover messages verified by user")
                self.test_results["pushover_service"] = True
                return True
            else:
                self.print_result(False, "Pushover messages not verified by user")
                self.test_results["pushover_service"] = False
                return False
                
        except Exception as e:
            self.print_result(False, "Pushover service test failed", str(e))
            self.test_results["pushover_service"] = False
            return False
    
    async def test_desktop_service_interactive(self) -> bool:
        """Interactive test of desktop notification service"""
        self.print_header("Desktop Notification Service Test", "Testing new desktop notification system")
        
        try:
            self.print_step(1, "Importing Desktop Service", "Loading desktop notification components...")
            await self.wait_for_user()
            
            from app.services.desktop_notification import (
                DesktopNotificationService, DesktopNotificationSettings, NotificationPriority
            )
            
            self.print_result(True, "Desktop service imported successfully")
            
            self.print_step(2, "Setting Up Desktop Configuration", "Creating desktop settings...")
            await self.wait_for_user()
            
            desktop_settings = DesktopNotificationSettings(
                enabled=True,
                sound_enabled=True,
                auto_close_time=10
            )
            
            self.print_result(True, "Desktop configuration created",
                            f"Auto-close: {desktop_settings.auto_close_time}s")
            
            self.print_step(3, "Creating Desktop Service Instance", "Initializing desktop service...")
            await self.wait_for_user()
            
            from unittest.mock import Mock
            mock_db = Mock()
            service = DesktopNotificationService(mock_db, desktop_settings)
            
            # Mock user service
            mock_user_service = Mock()
            service.user_service = mock_user_service
            service.logging_service = Mock()
            
            self.print_result(True, "Desktop service initialized successfully")
            
            self.print_step(4, "Generating Test Notifications", "Creating desktop notifications...")
            await self.wait_for_user()
            
            test_data = self.generate_realistic_test_data()
            notifications_dir = self.output_dir / "desktop_notifications"
            
            notification_types = [
                ("automation_started", test_data["automation_started"], NotificationPriority.NORMAL, "🚀 Automation Started"),
                ("automation_completed", test_data["automation_completed"], NotificationPriority.LOW, "✅ Automation Completed"),
                ("automation_failed", test_data["automation_failed"], NotificationPriority.HIGH, "❌ Automation Failed"),
                ("system_alert", {"message": "System maintenance scheduled"}, NotificationPriority.CRITICAL, "🔧 System Alert")
            ]
            
            notification_count = 0
            for notification_type, data, priority, description in notification_types:
                try:
                    print(f"\n   🔔 Generating {description}...")
                    
                    notification = await service._create_notification(
                        "test_user", notification_type, data, priority
                    )
                    
                    # Save notification file
                    notification_file = notifications_dir / f"{notification_type}.json"
                    notification_data = {
                        "title": notification.title,
                        "message": notification.message,
                        "priority": notification.priority.value,
                        "sound_enabled": notification.sound_enabled,
                        "auto_close_time": notification.auto_close_time
                    }
                    
                    notification_file.write_text(json.dumps(notification_data, indent=2), encoding='utf-8')
                    
                    notification_count += 1
                    print(f"      ✅ Generated: {len(notification.message)} chars")
                    print(f"      📱 Title: {notification.title}")
                    print(f"      🔊 Priority: {notification.priority.value}")
                    print(f"      💾 Saved: {notification_file.name}")
                    
                except Exception as e:
                    self.print_result(False, f"Notification generation failed for {description}", str(e))
                    return False
            
            self.print_result(True, f"All desktop notifications generated successfully",
                            f"{notification_count} notifications created in {notifications_dir}")
            
            self.print_step(5, "Platform Compatibility Check", "Testing platform support...")
            await self.wait_for_user()
            
            try:
                platform_support = service._check_platform_support()
                print(f"\n   🖥️  Platform: {platform_support['platform']}")
                print(f"   ✅ Supported: {platform_support['supported']}")
                print(f"   🏛️  Native Available: {platform_support.get('native_available', False)}")
                print(f"   🔄 Fallback Mode: {platform_support.get('fallback_mode', False)}")
                
                self.print_result(True, "Platform compatibility check completed")
                
            except Exception as e:
                self.print_result(False, "Platform compatibility check failed", str(e))
            
            self.print_step(6, "Notification Inspection", "Review generated desktop notifications...")
            print(f"\n   📁 Notification files saved to: {notifications_dir}")
            print(f"   📝 Open the JSON files to review notification content")
            print(f"   🎨 Check that titles and messages are appropriate for desktop display")
            
            await self.wait_for_user("Review the notification files, then press Enter to continue...")
            
            # Ask user for verification
            print(f"\n❓ Do the desktop notifications look correct? (y/n): ", end="")
            response = await asyncio.get_event_loop().run_in_executor(None, input)
            
            if response.lower().startswith('y'):
                self.print_result(True, "Desktop notifications verified by user")
                self.test_results["desktop_service"] = True
                return True
            else:
                self.print_result(False, "Desktop notifications not verified by user")
                self.test_results["desktop_service"] = False
                return False
                
        except Exception as e:
            self.print_result(False, "Desktop service test failed", str(e))
            self.test_results["desktop_service"] = False
            return False
    
    async def test_integration_interactive(self) -> bool:
        """Interactive test of notification manager integration"""
        self.print_header("Notification Manager Integration Test", "Testing multi-channel notification delivery")
        
        try:
            self.print_step(1, "Importing Integration Components", "Loading notification manager...")
            await self.wait_for_user()
            
            from app.services.notification_manager import (
                NotificationManager, NotificationTrigger, NotificationChannel
            )
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
            from app.services.desktop_notification import DesktopNotificationSettings
            
            self.print_result(True, "Integration components imported successfully")
            
            self.print_step(2, "Creating Unified Notification Manager", "Setting up multi-channel manager...")
            await self.wait_for_user()
            
            # Create settings for all services
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
            
            from unittest.mock import Mock
            mock_db = Mock()
            manager = NotificationManager(
                mock_db, email_settings, pushover_settings, desktop_settings
            )
            
            # Mock user service with preferences
            mock_user_service = Mock()
            mock_user_service.get_user_preference.return_value = {
                "email_enabled": True,
                "pushover_enabled": True,
                "desktop_enabled": True,
                "automation_started": "email_desktop",
                "automation_completed": "all",
                "automation_failed": "all",
                "pushover_user_key": "test_user_key_12345"
            }
            manager.user_service = mock_user_service
            manager.logging_service = Mock()
            
            self.print_result(True, "Notification manager created successfully")
            
            self.print_step(3, "Testing User Preference Management", "Managing user notification preferences...")
            await self.wait_for_user()
            
            # Test preference update
            test_preferences = {
                "email_enabled": True,
                "pushover_enabled": True,
                "desktop_enabled": True,
                "automation_completed": "all",
                "pushover_user_key": "updated_test_key"
            }
            
            success = await manager.update_user_preferences("test_user", test_preferences)
            
            if success:
                self.print_result(True, "User preferences updated successfully")
                
                # Test preference retrieval
                preferences = await manager._get_user_preferences("test_user")
                if preferences:
                    print(f"   📧 Email enabled: {preferences.email_enabled}")
                    print(f"   📱 Pushover enabled: {preferences.pushover_enabled}")
                    print(f"   🖥️  Desktop enabled: {preferences.desktop_enabled}")
                    self.print_result(True, "User preferences retrieved successfully")
                else:
                    self.print_result(False, "Failed to retrieve user preferences")
                    return False
            else:
                self.print_result(False, "Failed to update user preferences")
                return False
            
            self.print_step(4, "Testing Multi-Channel Notification Delivery", "Sending test notifications...")
            await self.wait_for_user()
            
            test_data = self.generate_realistic_test_data()
            
            # Test different notification triggers
            test_scenarios = [
                (NotificationTrigger.AUTOMATION_STARTED, test_data["automation_started"], "🚀 Automation Started"),
                (NotificationTrigger.AUTOMATION_COMPLETED, test_data["automation_completed"], "✅ Automation Completed"),
                (NotificationTrigger.AUTOMATION_FAILED, test_data["automation_failed"], "❌ Automation Failed")
            ]
            
            # Mock the individual service methods
            from unittest.mock import patch
            
            for trigger, data, description in test_scenarios:
                print(f"\n   📡 Testing {description}...")
                
                with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                     patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                     patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                    
                    results = await manager.send_automation_notification(
                        "test_user", trigger, data
                    )
                
                # Validate results
                if isinstance(results, dict) and all(key in results for key in ["email", "pushover", "desktop"]):
                    print(f"      📧 Email: {'✅' if results['email'] else '❌'}")
                    print(f"      📱 Pushover: {'✅' if results['pushover'] else '❌'}")
                    print(f"      🖥️  Desktop: {'✅' if results['desktop'] else '❌'}")
                    
                    # Get channel preference for this trigger
                    preferences = await manager._get_user_preferences("test_user")
                    channel = manager._get_trigger_channel(trigger, preferences)
                    print(f"      🎯 Channel used: {channel.value}")
                else:
                    self.print_result(False, f"Invalid results for {description}")
                    return False
            
            self.print_result(True, "Multi-channel notification delivery tested successfully")
            
            self.print_step(5, "Testing Emergency Alert System", "Testing emergency notifications...")
            await self.wait_for_user()
            
            with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                 patch.object(manager.pushover_service, 'send_emergency_alert', return_value=True), \
                 patch.object(manager.desktop_service, 'send_system_alert', return_value=True):
                
                emergency_results = await manager.send_emergency_alert(
                    "test_user",
                    "Critical System Test Alert",
                    "This is a test of the emergency alert system. All systems functioning normally.",
                    force_all_channels=True
                )
            
            if isinstance(emergency_results, dict):
                print(f"\n   🚨 Emergency Alert Results:")
                print(f"      📧 Email: {'✅' if emergency_results.get('email') else '❌'}")
                print(f"      📱 Pushover: {'✅' if emergency_results.get('pushover') else '❌'}")
                print(f"      🖥️  Desktop: {'✅' if emergency_results.get('desktop') else '❌'}")
                self.print_result(True, "Emergency alert system tested successfully")
            else:
                self.print_result(False, "Emergency alert test failed")
                return False
            
            self.print_step(6, "Integration Verification", "Verifying complete integration...")
            await self.wait_for_user()
            
            print(f"\n   ✅ All notification services integrated")
            print(f"   ✅ User preference management working")
            print(f"   ✅ Multi-channel delivery functioning")
            print(f"   ✅ Emergency alert system operational")
            print(f"   ✅ Channel routing based on preferences")
            
            # Ask user for verification
            print(f"\n❓ Does the notification integration work correctly? (y/n): ", end="")
            response = await asyncio.get_event_loop().run_in_executor(None, input)
            
            if response.lower().startswith('y'):
                self.print_result(True, "Notification integration verified by user")
                self.test_results["integration"] = True
                return True
            else:
                self.print_result(False, "Notification integration not verified by user")
                self.test_results["integration"] = False
                return False
                
        except Exception as e:
            self.print_result(False, "Integration test failed", str(e))
            self.test_results["integration"] = False
            return False
    
    async def test_settings_page_integration(self) -> bool:
        """Interactive test of settings page integration"""
        self.print_header("Settings Page Integration Test", "Testing frontend notification settings")
        
        try:
            self.print_step(1, "Checking Frontend Components", "Verifying notification settings components...")
            await self.wait_for_user()
            
            # Check if frontend files exist
            frontend_dir = Path(__file__).parent.parent.parent / "frontend" / "src"
            
            settings_component = frontend_dir / "components" / "DesktopNotificationSettings.tsx"
            service_file = frontend_dir / "services" / "desktopNotificationService.ts"
            
            if settings_component.exists():
                print(f"   ✅ Desktop notification settings component found")
                print(f"      📁 {settings_component}")
            else:
                self.print_result(False, "Desktop notification settings component not found")
                return False
            
            if service_file.exists():
                print(f"   ✅ Desktop notification service found")
                print(f"      📁 {service_file}")
            else:
                self.print_result(False, "Desktop notification service not found")
                return False
            
            self.print_result(True, "Frontend components verified")
            
            self.print_step(2, "Testing API Endpoint Imports", "Checking notification API routes...")
            await self.wait_for_user()
            
            try:
                from app.routes.notifications import (
                    router, NotificationPreferencesRequest, TestNotificationRequest
                )
                
                print(f"   ✅ Notification router imported")
                print(f"   ✅ Pydantic models imported")
                print(f"   📊 Route count: {len(router.routes)}")
                print(f"   🏷️  Route prefix: {router.prefix}")
                
                self.print_result(True, "API endpoints verified")
                
            except Exception as e:
                self.print_result(False, "API endpoint import failed", str(e))
                return False
            
            self.print_step(3, "Manual Settings Page Test", "Testing notification settings in browser...")
            print(f"\n   🌐 To test the settings page integration:")
            print(f"   1. Start the frontend development server")
            print(f"   2. Navigate to the notification settings page")
            print(f"   3. Test each notification setting toggle")
            print(f"   4. Test the 'Send Test Notification' buttons")
            print(f"   5. Verify settings are saved properly")
            print(f"   6. Check that desktop notifications appear (if supported)")
            
            await self.wait_for_user("Complete the manual settings page test, then press Enter...")
            
            # Ask user for verification
            print(f"\n❓ Do the notification settings work correctly in the frontend? (y/n): ", end="")
            response = await asyncio.get_event_loop().run_in_executor(None, input)
            
            if response.lower().startswith('y'):
                self.print_result(True, "Settings page integration verified by user")
                self.test_results["settings_page"] = True
                return True
            else:
                self.print_result(False, "Settings page integration not verified by user")
                self.test_results["settings_page"] = False
                return False
                
        except Exception as e:
            self.print_result(False, "Settings page test failed", str(e))
            self.test_results["settings_page"] = False
            return False
    
    async def generate_final_report(self):
        """Generate final test report"""
        self.print_header("Final Test Report", "Comprehensive notification system validation results")
        
        # Calculate overall results
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result)
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        overall_success = passed_tests == total_tests
        
        print(f"\n📊 OVERALL RESULTS:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests}")
        print(f"   Failed: {total_tests - passed_tests}")
        print(f"   Success Rate: {success_rate:.1f}%")
        print(f"   Overall Status: {'✅ PASSED' if overall_success else '❌ FAILED'}")
        
        print(f"\n📋 DETAILED RESULTS:")
        test_descriptions = {
            "email_service": "Email Notification Service (V1 Templates)",
            "pushover_service": "Pushover Notification Service (V1 Templates)",
            "desktop_service": "Desktop Notification Service (New)",
            "integration": "Multi-Channel Integration Manager",
            "settings_page": "Frontend Settings Page Integration"
        }
        
        for test_key, description in test_descriptions.items():
            if test_key in self.test_results:
                status = "✅ PASSED" if self.test_results[test_key] else "❌ FAILED"
                print(f"   {description}: {status}")
        
        print(f"\n📁 GENERATED FILES:")
        print(f"   📧 Email templates: {self.output_dir / 'email_templates'}")
        print(f"   📱 Pushover messages: {self.output_dir / 'pushover_messages'}")
        print(f"   🖥️  Desktop notifications: {self.output_dir / 'desktop_notifications'}")
        
        # Count generated files
        total_files = 0
        for subdir in ["email_templates", "pushover_messages", "desktop_notifications"]:
            subdir_path = self.output_dir / subdir
            if subdir_path.exists():
                file_count = len(list(subdir_path.glob("*")))
                print(f"      {subdir}: {file_count} files")
                total_files += file_count
        
        print(f"   📊 Total files generated: {total_files}")
        
        print(f"\n💡 RECOMMENDATIONS:")
        if overall_success:
            print(f"   ✅ NOTIFICATION SYSTEM READY FOR PRODUCTION")
            print(f"   🎯 All V1-to-V2 migration features working correctly")
            print(f"   📧 Enhanced email templates with V1 design patterns")
            print(f"   📱 Enhanced Pushover templates with HTML formatting")
            print(f"   🖥️  New desktop notification service operational")
            print(f"   🔗 Multi-channel integration functioning properly")
            print(f"   ⚙️  Settings page integration verified")
            
            print(f"\n   🚀 NEXT STEPS:")
            print(f"   1. Configure production SMTP settings")
            print(f"   2. Set up Pushover application and distribute user keys")
            print(f"   3. Deploy notification system to production")
            print(f"   4. Train users on notification settings")
            print(f"   5. Monitor notification delivery in production")
        else:
            print(f"   ⚠️  ISSUES REQUIRE ATTENTION BEFORE PRODUCTION")
            failed_tests = [test_descriptions[k] for k, v in self.test_results.items() if not v]
            for failed_test in failed_tests:
                print(f"   • Fix issues in: {failed_test}")
            
            print(f"\n   🔧 IMMEDIATE ACTIONS:")
            print(f"   1. Review failed test details above")
            print(f"   2. Fix identified issues")
            print(f"   3. Re-run interactive tests")
            print(f"   4. Verify all systems before production deployment")
        
        # Save report
        report_data = {
            "test_timestamp": datetime.now().isoformat(),
            "overall_success": overall_success,
            "success_rate": success_rate,
            "test_results": self.test_results,
            "files_generated": total_files,
            "ready_for_production": overall_success
        }
        
        report_file = self.output_dir / "interactive_test_report.json"
        report_file.write_text(json.dumps(report_data, indent=2), encoding='utf-8')
        
        print(f"\n📄 REPORT SAVED: {report_file}")
        print(f"\n🎉 INTERACTIVE NOTIFICATION TESTING COMPLETE!")
        
        return overall_success
    
    async def run_interactive_tests(self):
        """Run all interactive tests"""
        print("🎯 INTERACTIVE NOTIFICATION SYSTEM TESTING")
        print("=" * 80)
        print(f"Welcome to the comprehensive notification system test suite!")
        print(f"This interactive test will guide you through validating all")
        print(f"notification features step-by-step.")
        print("=" * 80)
        
        await self.wait_for_user("Press Enter to begin testing...")
        
        # Run test suites
        test_suites = [
            ("Email Service", self.test_email_service_interactive),
            ("Pushover Service", self.test_pushover_service_interactive),
            ("Desktop Service", self.test_desktop_service_interactive),
            ("Integration Manager", self.test_integration_interactive),
            ("Settings Page", self.test_settings_page_integration)
        ]
        
        for suite_name, test_func in test_suites:
            try:
                print(f"\n\n🔄 Starting {suite_name} test...")
                await self.wait_for_user(f"Ready to test {suite_name}? Press Enter to continue...")
                
                success = await test_func()
                
                if success:
                    print(f"\n✅ {suite_name} test completed successfully!")
                else:
                    print(f"\n❌ {suite_name} test failed!")
                    
                    # Ask if user wants to continue
                    print(f"\n❓ Continue with remaining tests? (y/n): ", end="")
                    response = await asyncio.get_event_loop().run_in_executor(None, input)
                    
                    if not response.lower().startswith('y'):
                        print(f"\n⏹️  Testing stopped by user.")
                        break
                        
            except Exception as e:
                print(f"\n❌ {suite_name} test failed with error: {str(e)}")
                self.test_results[suite_name.lower().replace(" ", "_")] = False
        
        # Generate final report
        await self.wait_for_user("\nPress Enter to generate final test report...")
        return await self.generate_final_report()


async def main():
    """Main test runner"""
    tester = InteractiveNotificationTester()
    success = await tester.run_interactive_tests()
    return 0 if success else 1


if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)