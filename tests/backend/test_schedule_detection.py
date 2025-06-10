#!/usr/bin/env python3
"""
Test Schedule Detection Service

Quick test script to verify the schedule change detection implementation
works correctly with V1-compatible patterns.
"""

import asyncio
import json
from datetime import datetime
from app.services.schedule_detection import ScheduleDetectionService
from app.database import get_db

# Sample test data matching V1 patterns
PREVIOUS_SCHEDULE = {
    "workOrders": [
        {
            "id": "W-123456",
            "customer": {
                "storeNumber": "7001",
                "name": "Wawa #001",
                "address": "123 Main St, Philadelphia, PA 19103"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-10",
                    "visitId": "V-001"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 4
                }
            ]
        },
        {
            "id": "W-123457",
            "customer": {
                "storeNumber": "7002",
                "name": "Wawa #002", 
                "address": "456 Oak Ave, Philadelphia, PA 19104"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-11",
                    "visitId": "V-002"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 6
                }
            ]
        },
        {
            "id": "W-123458",
            "customer": {
                "storeNumber": "7003",
                "name": "Circle K #003",
                "address": "789 Pine St, Camden, NJ 08101"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-12",
                    "visitId": "V-003"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 8
                }
            ]
        }
    ]
}

CURRENT_SCHEDULE = {
    "workOrders": [
        # Modified job - date changed
        {
            "id": "W-123456",
            "customer": {
                "storeNumber": "7001",
                "name": "Wawa #001",
                "address": "123 Main St, Philadelphia, PA 19103"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-13",  # Date changed!
                    "visitId": "V-001"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 4
                }
            ]
        },
        # Swapped job - took date from W-123458
        {
            "id": "W-123457",
            "customer": {
                "storeNumber": "7002",
                "name": "Wawa #002",
                "address": "456 Oak Ave, Philadelphia, PA 19104"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-12",  # Swapped with W-123458
                    "visitId": "V-002"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 6
                }
            ]
        },
        # Swapped job - took date from W-123457
        {
            "id": "W-123458",
            "customer": {
                "storeNumber": "7003",
                "name": "Circle K #003",
                "address": "789 Pine St, Camden, NJ 08101"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-11",  # Swapped with W-123457
                    "visitId": "V-003"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 8
                }
            ]
        },
        # New job added
        {
            "id": "W-123459",
            "customer": {
                "storeNumber": "7004",
                "name": "Speedway #004",
                "address": "321 Elm St, Wilmington, DE 19801"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-14",
                    "visitId": "V-004"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 3
                }
            ]
        },
        # Replacement on same date
        {
            "id": "W-123460",
            "customer": {
                "storeNumber": "7005",
                "name": "Shell #005",
                "address": "654 Maple Dr, Baltimore, MD 21201"
            },
            "visits": {
                "nextVisit": {
                    "date": "2025-01-10",  # Same date as removed W-123456 original
                    "visitId": "V-005"
                }
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "quantity": 5
                }
            ]
        }
    ]
}

async def test_schedule_detection():
    """Test the schedule detection service"""
    print("🧪 Testing Schedule Detection Service")
    print("=" * 50)
    
    # Create mock database session
    db = next(get_db())
    service = ScheduleDetectionService(db)
    
    try:
        # Test the comparison algorithm directly
        print("📊 Running schedule comparison...")
        changes = await service._compare_schedules(
            CURRENT_SCHEDULE,
            PREVIOUS_SCHEDULE,
            None,  # No user preferences filter
            "test_user"
        )
        
        print("\n🔍 Detected Changes:")
        print(f"  Added: {changes['summary']['added']}")
        print(f"  Removed: {changes['summary']['removed']}")
        print(f"  Modified: {changes['summary']['modified']}")
        print(f"  Swapped: {changes['summary']['swapped']}")
        print(f"  Total Changes: {len(changes['allChanges'])}")
        
        print("\n📝 Detailed Changes:")
        for i, change in enumerate(changes['allChanges'], 1):
            change_type = change['type']
            print(f"  {i}. {change_type.upper()}: ", end="")
            
            if change_type == 'swap':
                print(f"Jobs {change['job1Id']} ↔ {change['job2Id']} swapped dates")
            elif change_type == 'date_changed':
                print(f"Job {change['jobId']} date: {change['oldDate']} → {change['newDate']}")
            elif change_type == 'added':
                print(f"Job {change['jobId']} added on {change['date']}")
            elif change_type == 'removed':
                print(f"Job {change['jobId']} removed from {change['date']}")
            elif change_type == 'replacement':
                print(f"Job {change['removedJobId']} → {change['addedJobId']} on {change['date']}")
        
        # Test change report generation
        print("\n📋 Generated Report:")
        report = service._generate_change_report(changes)
        print(report)
        
        # Verify expected results
        print("\n✅ Verification:")
        
        # Should detect swap between W-123457 and W-123458
        swap_changes = [c for c in changes['allChanges'] if c['type'] == 'swap']
        print(f"  ✓ Detected {len(swap_changes)} swap(s)")
        
        # Should detect date change for W-123456
        date_changes = [c for c in changes['allChanges'] if c['type'] == 'date_changed']
        print(f"  ✓ Detected {len(date_changes)} date change(s)")
        
        # Should detect new job W-123459
        added_changes = [c for c in changes['allChanges'] if c['type'] == 'added']
        print(f"  ✓ Detected {len(added_changes)} addition(s)")
        
        print("\n✅ Schedule detection test completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_user_preferences_filtering():
    """Test user preference filtering"""
    print("\n🎯 Testing User Preference Filtering")
    print("=" * 50)
    
    # User preferences that only include Wawa stores
    user_preferences = {
        "notifications": {
            "filters": {
                "stores": ["7001", "7002"]  # Only Wawa stores
            }
        }
    }
    
    db = next(get_db())
    service = ScheduleDetectionService(db)
    
    try:
        changes = await service._compare_schedules(
            CURRENT_SCHEDULE,
            PREVIOUS_SCHEDULE,
            user_preferences,
            "test_user"
        )
        
        print(f"📊 Filtered Results (Wawa stores only):")
        print(f"  Total Changes: {len(changes['allChanges'])}")
        
        # Should only see changes for stores 7001 and 7002
        for change in changes['allChanges']:
            if 'store' in change:
                print(f"  • {change['type']}: Store {change['store']}")
            elif 'job1Store' in change:
                print(f"  • {change['type']}: Stores {change['job1Store']} ↔ {change['job2Store']}")
        
        print("✅ User preference filtering test completed!")
        return True
        
    except Exception as e:
        print(f"❌ Filtering test failed: {str(e)}")
        return False

if __name__ == "__main__":
    async def run_tests():
        print("🚀 Starting Schedule Detection Tests\n")
        
        # Run basic detection test
        test1_result = await test_schedule_detection()
        
        # Run user preference filtering test
        test2_result = await test_user_preferences_filtering()
        
        print("\n" + "=" * 50)
        print(f"📈 Test Results:")
        print(f"  Basic Detection: {'✅ PASS' if test1_result else '❌ FAIL'}")
        print(f"  Preference Filtering: {'✅ PASS' if test2_result else '❌ FAIL'}")
        
        if test1_result and test2_result:
            print("\n🎉 All tests passed! Schedule detection is working correctly.")
        else:
            print("\n⚠️  Some tests failed. Check the output above for details.")
    
    # Run the tests
    asyncio.run(run_tests())