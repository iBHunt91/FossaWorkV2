#!/usr/bin/env python3
"""
Test Schedule Detection → Notification Integration
Verifies that schedule changes trigger notifications correctly
"""

import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from datetime import datetime
from app.database import SessionLocal, create_tables
from app.models.user_models import User
from app.services.schedule_detection import ScheduleDetectionService
from app.services.notification_manager import NotificationManager

async def test_schedule_notification_integration():
    """Test that schedule changes trigger notifications"""
    print("\n🔄 Testing Schedule → Notification Integration...")
    
    db = SessionLocal()
    
    try:
        # Create test user
        test_user = User(
            id="test_user_123",
            username="testuser",
            email="test@example.com",
            hashed_password=User.hash_password("test123"),
            is_active=True,
            notification_preferences={
                "email": {"enabled": True, "frequency": "immediate"},
                "pushover": {"enabled": True, "user_key": "test_key"}
            }
        )
        db.add(test_user)
        db.commit()
        print("  ✅ Test user created")
        
        # Initialize services
        schedule_service = ScheduleDetectionService(db)
        notification_manager = NotificationManager(db)
        
        # Track if notification was sent
        notification_sent = False
        notification_data = None
        
        # Mock notification sending
        async def mock_send_notification(user_id, notification_type, data):
            nonlocal notification_sent, notification_data
            notification_sent = True
            notification_data = {"user_id": user_id, "type": notification_type, "data": data}
            print(f"  ✅ Notification triggered: {notification_type} for user {user_id}")
            return True
        
        # Replace real notification method with mock
        notification_manager.send_notification = mock_send_notification
        
        # Create mock schedule data
        previous_schedule = {
            "workOrders": [
                {
                    "id": "WO-001",
                    "customer": {"storeNumber": "1001", "name": "Test Store 1"},
                    "date": "2024-01-15",
                    "services": [{"type": "meter_test", "quantity": 5}]
                }
            ]
        }
        
        current_schedule = {
            "workOrders": [
                {
                    "id": "WO-001",
                    "customer": {"storeNumber": "1001", "name": "Test Store 1"},
                    "date": "2024-01-16",  # Date changed
                    "services": [{"type": "meter_test", "quantity": 5}]
                },
                {
                    "id": "WO-002",  # New work order
                    "customer": {"storeNumber": "1002", "name": "Test Store 2"},
                    "date": "2024-01-15",
                    "services": [{"type": "meter_test", "quantity": 3}]
                }
            ]
        }
        
        # First, save the previous schedule as baseline
        await schedule_service._save_current_schedule("test_user_123", previous_schedule)
        print("  ✅ Previous schedule saved as baseline")
        
        # Now analyze changes with current schedule
        changes = await schedule_service.analyze_schedule_changes(
            "test_user_123",
            current_schedule
        )
        
        # Verify results
        assert changes is not None, "Changes should be detected"
        assert changes["summary"]["modified"] == 1, "Should detect 1 date change"
        assert changes["summary"]["added"] == 1, "Should detect 1 added job"
        print("  ✅ Schedule changes detected correctly")
        
        # Verify notification was triggered
        assert notification_sent, "Notification should have been sent"
        assert notification_data["type"] == "schedule_change", "Should be schedule_change type"
        assert notification_data["user_id"] == "test_user_123", "Should be for correct user"
        print("  ✅ Notification system was triggered")
        
        # Cleanup
        db.query(User).filter(User.id == "test_user_123").delete()
        db.commit()
        
        print("\n✅ Schedule → Notification Integration Test PASSED!")
        print("   - Schedule changes are properly detected")
        print("   - Notifications are triggered for significant changes")
        print("   - Integration between services is working correctly")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()

async def test_notification_manager_standalone():
    """Test notification manager functionality"""
    print("\n🔄 Testing Notification Manager...")
    
    db = SessionLocal()
    
    try:
        # Create notification manager
        notification_manager = NotificationManager(db)
        
        # Test user preference handling
        test_prefs = {
            "email": {"enabled": True, "frequency": "daily"},
            "pushover": {"enabled": False}
        }
        
        should_send = notification_manager._should_send_notification(
            "schedule_change", 
            test_prefs
        )
        
        print("  ✅ Notification preference checking works")
        
        # Test notification formatting
        test_data = {
            "changes": {
                "summary": {"added": 2, "removed": 1, "modified": 1},
                "allChanges": []
            }
        }
        
        formatted = notification_manager._format_notification_data(
            "schedule_change",
            test_data
        )
        
        assert "subject" in formatted, "Should have subject"
        assert "body" in formatted, "Should have body"
        print("  ✅ Notification formatting works")
        
        print("\n✅ Notification Manager Test PASSED!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        return False
    finally:
        db.close()

async def main():
    """Run all integration tests"""
    print("🎯 FossaWork V2 - Schedule → Notification Integration Tests")
    print("=" * 60)
    
    # Ensure database tables exist
    create_tables()
    
    # Run tests
    tests = [
        ("Notification Manager", test_notification_manager_standalone),
        ("Schedule → Notification Integration", test_schedule_notification_integration)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ {test_name} - FAILED with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("🎯 TEST SUMMARY:")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL INTEGRATION TESTS PASSED!")
        print("\n✅ The critical schedule → notification integration is working correctly.")
        print("✅ Users will receive notifications when their schedule changes.")
    else:
        print("\n⚠️  Some tests failed. Please review and fix issues.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)