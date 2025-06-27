#!/usr/bin/env python3
"""
Desktop Notification Service Test Script

Tests the enhanced desktop notification service across all platforms
with both native and web notification support.
"""

import asyncio
import sys
import os
import platform
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent.parent))

from app.services.desktop_notification import (
    DesktopNotificationService, 
    DesktopNotificationSettings,
    NotificationPriority
)
from app.database import get_db
from app.services.logging_service import LoggingService

async def test_desktop_notifications():
    """Test desktop notification functionality"""
    print("🧪 Testing Desktop Notification Service")
    print("=" * 50)
    
    # Get database session
    db = next(get_db())
    
    # Test different settings configurations
    test_configs = [
        {
            "name": "Native Notifications (Default)",
            "settings": DesktopNotificationSettings(
                enabled=True,
                use_native_notifications=True,
                sound_enabled=True,
                auto_close_time=5
            )
        },
        {
            "name": "Web Notifications Only",
            "settings": DesktopNotificationSettings(
                enabled=True,
                use_native_notifications=False,
                sound_enabled=True,
                auto_close_time=5
            )
        },
        {
            "name": "Silent Notifications",
            "settings": DesktopNotificationSettings(
                enabled=True,
                use_native_notifications=True,
                sound_enabled=False,
                auto_close_time=3
            )
        }
    ]
    
    for config in test_configs:
        print(f"\n📋 Testing: {config['name']}")
        print("-" * 30)
        
        # Create service with test settings
        service = DesktopNotificationService(db, config['settings'])
        
        # Initialize service
        init_success = await service.initialize()
        print(f"✅ Service initialized: {init_success}")
        print(f"🔧 Platform: {service.platform}")
        print(f"🖥️  Native support: {service.native_support}")
        
        if not init_success:
            print("❌ Failed to initialize service")
            continue
        
        # Test notification types
        test_notifications = [
            {
                "type": "automation_started",
                "data": {
                    "station_name": "Shell Station #1234",
                    "job_count": 5,
                    "job_id": "AUTO_20241226_001"
                },
                "priority": NotificationPriority.NORMAL
            },
            {
                "type": "automation_completed", 
                "data": {
                    "station_name": "Shell Station #1234",
                    "successful_count": 4,
                    "total_count": 5,
                    "duration": "2 minutes 30 seconds"
                },
                "priority": NotificationPriority.HIGH
            },
            {
                "type": "automation_failed",
                "data": {
                    "station_name": "Mobil Station #5678",
                    "error_message": "Connection timeout - unable to access dispenser data"
                },
                "priority": NotificationPriority.CRITICAL
            },
            {
                "type": "schedule_change",
                "data": {
                    "change_count": 3,
                    "summary": "2 visits added, 1 visit removed"
                },
                "priority": NotificationPriority.NORMAL
            }
        ]
        
        user_id = "test_user_001"
        
        for i, notification in enumerate(test_notifications, 1):
            print(f"\n  📨 Test {i}/4: {notification['type']}")
            
            try:
                success = await service.send_automation_notification(
                    user_id=user_id,
                    notification_type=notification['type'],
                    data=notification['data'],
                    priority=notification['priority']
                )
                
                print(f"     ✅ Sent: {success}")
                
                # Wait between notifications
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"     ❌ Error: {str(e)}")
        
        # Test system alert
        print(f"\n  🚨 Test 5/5: System Alert")
        try:
            success = await service.send_system_alert(
                user_id=user_id,
                alert_message="System maintenance will begin in 10 minutes",
                priority=NotificationPriority.HIGH
            )
            print(f"     ✅ Sent: {success}")
        except Exception as e:
            print(f"     ❌ Error: {str(e)}")
        
        # Check pending notifications (web fallback)
        try:
            pending = await service.get_pending_notifications(user_id)
            print(f"  📥 Pending web notifications: {len(pending)}")
        except Exception as e:
            print(f"  ❌ Error getting pending: {str(e)}")
        
        # Cleanup
        await service.cleanup()
        print(f"🧹 Cleaned up {config['name']}")
        
        # Wait between test configurations
        await asyncio.sleep(3)

async def test_platform_specific_features():
    """Test platform-specific notification features"""
    print(f"\n🖥️  Platform-Specific Tests")
    print("=" * 30)
    
    system = platform.system()
    print(f"Operating System: {system}")
    
    # Test native notification detection
    db = next(get_db())
    service = DesktopNotificationService(db)
    
    print(f"Native Support Detection: {service.native_support}")
    
    # Test direct native notification sending
    try:
        if system == "Windows":
            print("Testing Windows-specific notifications...")
            # Would test win10toast if available
            
        elif system == "Darwin":  # macOS
            print("Testing macOS-specific notifications...")
            # Test osascript
            success = await service._send_macos_notification(
                title="macOS Test",
                message="Testing native macOS notifications",
                timeout=5,
                sound_enabled=True
            )
            print(f"✅ macOS osascript test: {success}")
            
        elif system == "Linux":
            print("Testing Linux-specific notifications...")
            # Test notify-send
            success = await service._send_linux_notification(
                title="Linux Test",
                message="Testing native Linux notifications",
                timeout=5,
                icon_path=None,
                sound_enabled=True
            )
            print(f"✅ Linux notify-send test: {success}")
            
    except Exception as e:
        print(f"❌ Platform-specific test failed: {e}")

async def test_notification_manager_integration():
    """Test integration with the notification manager"""
    print(f"\n🔗 Notification Manager Integration Test")
    print("=" * 40)
    
    try:
        from app.services.notification_manager import (
            NotificationManager, 
            NotificationTrigger,
            get_notification_manager
        )
        from app.services.email_notification import EmailSettings
        from app.services.pushover_notification import PushoverSettings
        
        # Create notification manager with desktop support
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
        
        desktop_settings = DesktopNotificationSettings(
            enabled=True,
            use_native_notifications=True,
            sound_enabled=True
        )
        
        db = next(get_db())
        manager = NotificationManager(db, email_settings, pushover_settings, desktop_settings)
        
        # Initialize manager
        init_success = await manager.initialize()
        print(f"✅ Notification Manager initialized: {init_success}")
        
        # Test automation notification through manager
        test_data = {
            "station_name": "Integration Test Station",
            "job_id": "INT_TEST_001",
            "work_order_id": "W-123456",
            "dispensers_processed": 8,
            "duration": "1 minute 45 seconds"
        }
        
        result = await manager.send_automation_notification(
            user_id="integration_test_user",
            trigger=NotificationTrigger.AUTOMATION_COMPLETED,
            data=test_data
        )
        
        print(f"✅ Multi-channel notification sent: {result}")
        print(f"   Email: {result.get('email', False)}")
        print(f"   Pushover: {result.get('pushover', False)}") 
        print(f"   Desktop: {result.get('desktop', False)}")
        
        # Cleanup
        await manager.cleanup()
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")

def print_installation_guide():
    """Print installation guide for native notification libraries"""
    print(f"\n📦 Installation Guide for Enhanced Desktop Notifications")
    print("=" * 55)
    
    print("For best native notification support, install these packages:")
    print()
    print("🐍 Cross-platform (recommended):")
    print("   pip install plyer")
    print()
    print("🪟 Windows enhanced notifications:")
    print("   pip install win10toast")
    print()
    print("🐧 Linux requirements:")
    print("   sudo apt-get install libnotify-bin  # Ubuntu/Debian")
    print("   sudo yum install libnotify           # CentOS/RHEL")
    print()
    print("🍎 macOS:")
    print("   No additional packages needed (uses osascript)")
    print()
    
    # Check current installation status
    try:
        import plyer
        print("✅ plyer is installed")
    except ImportError:
        print("❌ plyer is NOT installed")
    
    try:
        import win10toast
        print("✅ win10toast is installed (Windows)")
    except ImportError:
        if platform.system() == "Windows":
            print("❌ win10toast is NOT installed (Windows)")
        else:
            print("ℹ️  win10toast not needed (non-Windows)")

async def main():
    """Main test execution"""
    print("🔔 Desktop Notification Service Test Suite")
    print("==========================================")
    print()
    
    # Print installation guide
    print_installation_guide()
    
    try:
        # Test basic functionality
        await test_desktop_notifications()
        
        # Test platform-specific features
        await test_platform_specific_features()
        
        # Test notification manager integration
        await test_notification_manager_integration()
        
        print(f"\n🎉 All tests completed!")
        print("Check your desktop for notifications that were sent.")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Run the test suite
    asyncio.run(main())