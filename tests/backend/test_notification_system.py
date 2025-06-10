#!/usr/bin/env python3
"""
Test Notification System

Test the complete notification system including email, Pushover,
and integration with automation workflows.
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path

# Mock classes for testing without dependencies
class MockDB:
    """Mock database session"""
    pass

class MockUser:
    """Mock user for testing"""
    def __init__(self, user_id: str, email: str):
        self.user_id = user_id
        self.email = email

class MockUserService:
    """Mock user service"""
    def __init__(self):
        self.users = {
            "test_user": MockUser("test_user", "test@example.com")
        }
        self.preferences = {}
    
    def get_user(self, user_id: str):
        return self.users.get(user_id)
    
    def get_user_preference(self, user_id: str, key: str):
        return self.preferences.get(f"{user_id}_{key}")
    
    def set_user_preference(self, user_id: str, key: str, value):
        self.preferences[f"{user_id}_{key}"] = value

# Test data
TEST_AUTOMATION_DATA = {
    "station_name": "Wawa #001 Test Station",
    "job_id": "TEST_JOB_001",
    "work_order_id": "TEST_WO_001",
    "service_code": "2861",
    "dispenser_count": 4,
    "total_iterations": 20,
    "estimated_duration": 10,
    "start_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    "duration": "15 minutes",
    "forms_completed": 4,
    "dispensers_processed": 4,
    "success_rate": 100,
    "completion_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
}

TEST_FAILURE_DATA = {
    "station_name": "Circle K #002 Test Station",
    "job_id": "TEST_JOB_002",
    "work_order_id": "TEST_WO_002",
    "error_message": "Connection timeout to WorkFossa",
    "failure_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    "progress_percentage": 75,
    "retry_available": True
}

async def test_email_templates():
    """Test email notification templates"""
    print("📧 Testing Email Notification Templates")
    print("=" * 45)
    
    try:
        # Import with error handling
        try:
            from app.services.email_notification import EmailNotificationService, EmailSettings, NotificationType
        except ImportError as e:
            print(f"❌ Failed to import email service: {e}")
            return False
        
        # Create mock email settings
        email_settings = EmailSettings(
            smtp_server="smtp.gmail.com",
            smtp_port=587,
            username="test@example.com",
            password="test_password"
        )
        
        # Create service
        service = EmailNotificationService(MockDB(), email_settings)
        service.user_service = MockUserService()
        
        # Test template creation for different notification types
        test_cases = [
            (NotificationType.AUTOMATION_STARTED, TEST_AUTOMATION_DATA),
            (NotificationType.AUTOMATION_COMPLETED, TEST_AUTOMATION_DATA),
            (NotificationType.AUTOMATION_FAILED, TEST_FAILURE_DATA)
        ]
        
        for notification_type, data in test_cases:
            try:
                notification = await service._create_notification(
                    "test_user", notification_type, data, None
                )
                
                print(f"\n📨 {notification_type.value.title()}")
                print(f"  Subject: {notification.subject}")
                print(f"  HTML Length: {len(notification.html_content)} chars")
                print(f"  Text Length: {len(notification.text_content)} chars")
                print(f"  ✅ Template generated successfully")
                
                # Save HTML template for inspection
                template_file = Path(f"test_email_{notification_type.value}.html")
                template_file.write_text(notification.html_content)
                print(f"  📄 Saved template: {template_file}")
                
            except Exception as e:
                print(f"  ❌ Template creation failed: {e}")
                return False
        
        print(f"\n🎯 Email Templates: ✅ ALL PASSED")
        return True
        
    except Exception as e:
        print(f"❌ Email template test failed: {e}")
        return False

async def test_pushover_messages():
    """Test Pushover message creation"""
    print("\n📱 Testing Pushover Message Creation")
    print("=" * 42)
    
    try:
        # Import with error handling
        try:
            from app.services.pushover_notification import PushoverNotificationService, PushoverSettings
        except ImportError as e:
            print(f"❌ Failed to import Pushover service: {e}")
            return False
        
        # Create mock Pushover settings
        pushover_settings = PushoverSettings(
            api_token="test_token",
            user_key="test_user_key"
        )
        
        # Create service
        service = PushoverNotificationService(MockDB(), pushover_settings)
        service.user_service = MockUserService()
        
        # Test message creation for different types
        test_cases = [
            ("automation_started", TEST_AUTOMATION_DATA),
            ("automation_completed", TEST_AUTOMATION_DATA),
            ("automation_failed", TEST_FAILURE_DATA),
            ("automation_progress", {**TEST_AUTOMATION_DATA, "progress_percentage": 50, "current_dispenser": 2, "total_dispensers": 4}),
            ("daily_summary", {"successful_jobs": 5, "failed_jobs": 1, "dispensers_processed": 20})
        ]
        
        for message_type, data in test_cases:
            try:
                message = await service._create_message("test_user", message_type, data, None)
                
                if message:
                    print(f"\n📲 {message_type.title()}")
                    print(f"  Title: {message.title}")
                    print(f"  Message: {message.message[:100]}{'...' if len(message.message) > 100 else ''}")
                    print(f"  Priority: {message.priority.name}")
                    print(f"  Sound: {message.sound.value}")
                    print(f"  ✅ Message created successfully")
                else:
                    print(f"  ❌ Message creation returned None")
                    return False
                
            except Exception as e:
                print(f"  ❌ Message creation failed: {e}")
                return False
        
        print(f"\n🎯 Pushover Messages: ✅ ALL PASSED")
        return True
        
    except Exception as e:
        print(f"❌ Pushover message test failed: {e}")
        return False

async def test_notification_manager():
    """Test unified notification manager"""
    print("\n🔗 Testing Notification Manager")
    print("=" * 35)
    
    try:
        # Import with error handling
        try:
            from app.services.notification_manager import NotificationManager, NotificationTrigger
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
        except ImportError as e:
            print(f"❌ Failed to import notification manager: {e}")
            return False
        
        # Create mock settings
        email_settings = EmailSettings(
            smtp_server="smtp.gmail.com",
            smtp_port=587,
            username="test@example.com",
            password="test_password"
        )
        
        pushover_settings = PushoverSettings(
            api_token="test_token",
            user_key="test_user_key"
        )
        
        # Create manager
        manager = NotificationManager(MockDB(), email_settings, pushover_settings)
        manager.user_service = MockUserService()
        
        # Test preference management
        print("\n⚙️  Testing preference management...")
        test_prefs = {
            "email_enabled": True,
            "pushover_enabled": True,
            "automation_started": "email",
            "automation_completed": "both",
            "automation_failed": "both",
            "pushover_user_key": "test_key_123"
        }
        
        success = await manager.update_user_preferences("test_user", test_prefs)
        if success:
            print("  ✅ Preferences updated successfully")
        else:
            print("  ❌ Preference update failed")
            return False
        
        # Test getting preferences
        preferences = await manager._get_user_preferences("test_user")
        if preferences:
            print(f"  ✅ Preferences retrieved: {preferences.email_enabled}, {preferences.pushover_enabled}")
        else:
            print("  ❌ Failed to retrieve preferences")
            return False
        
        # Test trigger mapping
        print("\n🎯 Testing notification trigger mapping...")
        triggers_to_test = [
            NotificationTrigger.AUTOMATION_STARTED,
            NotificationTrigger.AUTOMATION_COMPLETED,
            NotificationTrigger.AUTOMATION_FAILED
        ]
        
        for trigger in triggers_to_test:
            channel = manager._get_trigger_channel(trigger, preferences)
            email_type = manager._trigger_to_email_type(trigger)
            print(f"  {trigger.value}: {channel.value} -> {email_type.value}")
        
        print(f"\n🎯 Notification Manager: ✅ ALL PASSED")
        return True
        
    except Exception as e:
        print(f"❌ Notification manager test failed: {e}")
        return False

async def test_notification_routes():
    """Test notification API route imports"""
    print("\n🌐 Testing Notification API Routes")
    print("=" * 38)
    
    try:
        # Test route imports
        try:
            from app.routes.notifications import router
            print("  ✅ Notification routes imported successfully")
        except ImportError as e:
            print(f"  ❌ Failed to import notification routes: {e}")
            return False
        
        # Test dependency imports
        try:
            from app.services.notification_manager import get_notification_manager
            print("  ✅ Notification manager factory imported successfully")
        except ImportError as e:
            print(f"  ❌ Failed to import notification manager factory: {e}")
            return False
        
        # Test model imports
        try:
            from app.routes.notifications import NotificationPreferencesRequest, TestNotificationRequest
            print("  ✅ Pydantic models imported successfully")
        except ImportError as e:
            print(f"  ❌ Failed to import Pydantic models: {e}")
            return False
        
        print(f"\n🎯 API Routes: ✅ ALL PASSED")
        return True
        
    except Exception as e:
        print(f"❌ API route test failed: {e}")
        return False

async def test_integration_workflow():
    """Test integration with automation workflow"""
    print("\n🔄 Testing Automation Integration")
    print("=" * 38)
    
    try:
        # Test integration service imports
        try:
            from app.services.form_automation_browser_integration import FormAutomationBrowserIntegration
            print("  ✅ Integration service imported successfully")
        except ImportError as e:
            print(f"  ❌ Failed to import integration service: {e}")
            return False
        
        # Create mock integration service
        try:
            integration = FormAutomationBrowserIntegration(MockDB())
            print(f"  ✅ Integration service created (notifications: {integration.notifications_enabled})")
        except Exception as e:
            print(f"  ⚠️  Integration service created with warnings: {e}")
        
        # Test notification helper method
        if hasattr(integration, '_send_automation_notification'):
            print("  ✅ Notification helper method available")
        else:
            print("  ❌ Notification helper method missing")
            return False
        
        print(f"\n🎯 Integration Workflow: ✅ ALL PASSED")
        return True
        
    except Exception as e:
        print(f"❌ Integration workflow test failed: {e}")
        return False

async def run_notification_tests():
    """Run all notification system tests"""
    print("🚀 Starting Notification System Tests")
    print("=" * 50)
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run test suites
    test_results = []
    
    test_results.append(await test_email_templates())
    test_results.append(await test_pushover_messages())
    test_results.append(await test_notification_manager())
    test_results.append(await test_notification_routes())
    test_results.append(await test_integration_workflow())
    
    # Summary
    print("\n" + "=" * 70)
    print("📈 Notification System Test Results:")
    
    test_names = [
        "Email Template Generation",
        "Pushover Message Creation",
        "Notification Manager",
        "API Route Imports",
        "Automation Integration"
    ]
    
    passed_count = 0
    for i, (test_name, result) in enumerate(zip(test_names, test_results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed_count += 1
    
    overall_success = passed_count == len(test_results)
    
    print(f"\nOverall Result: {passed_count}/{len(test_results)} tests passed")
    
    if overall_success:
        print("\n🎉 ALL NOTIFICATION TESTS PASSED!")
        print("✅ Email and Pushover notification system is working!")
        print("📧 HTML email templates generated successfully")
        print("📱 Pushover messages created with proper formatting")
        print("🔗 Integration with automation workflow ready")
        print("🌐 API routes for notification management available")
    else:
        print("\n⚠️  SOME NOTIFICATION TESTS FAILED!")
        print("❌ Review failed tests and fix issues before production use.")
    
    print("\n📝 Next Steps:")
    if overall_success:
        print("  1. ✅ Core notification system is working correctly")
        print("  2. 📧 Configure SMTP settings for email notifications")
        print("  3. 📱 Set up Pushover app and API tokens")
        print("  4. 🧪 Test with real email/Pushover credentials")
        print("  5. 🚀 Deploy notification system to production")
        print("  6. 👥 Configure user notification preferences")
    else:
        print("  1. 🔍 Review failed test output above")
        print("  2. 🛠️  Fix import and dependency issues")
        print("  3. 🔄 Re-run tests after fixes")
        print("  4. 📦 Install missing dependencies if needed")
    
    # Cleanup test files
    try:
        for file in Path(".").glob("test_email_*.html"):
            file.unlink()
        print("\n🧹 Test files cleaned up")
    except Exception:
        pass
    
    return overall_success

if __name__ == "__main__":
    asyncio.run(run_notification_tests())