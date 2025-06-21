#!/usr/bin/env python3
"""
Test script to verify scheduler service initialization and logging
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Configure logging to see all messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

async def test_scheduler_initialization():
    """Test scheduler service initialization with comprehensive logging"""
    
    print("\n" + "="*80)
    print("SCHEDULER SERVICE INITIALIZATION TEST")
    print("="*80 + "\n")
    
    # Test 1: Import scheduler service
    print("1. Testing scheduler service import...")
    scheduler_service = None
    scheduler_type = None
    
    try:
        from app.services.scheduler_service import scheduler_service
        scheduler_type = "FULL (APScheduler)"
        print("✓ Successfully imported full scheduler service (APScheduler)")
    except ImportError as e:
        print(f"✗ Failed to import full scheduler service: {e}")
        print("  Falling back to simple scheduler...")
        try:
            from app.services.simple_scheduler_service import simple_scheduler_service as scheduler_service
            scheduler_type = "SIMPLE (Database-only)"
            print("✓ Successfully imported simple scheduler service")
        except ImportError as e2:
            print(f"✗ Failed to import any scheduler service: {e2}")
            return
    
    if not scheduler_service:
        print("\n❌ FAILED: No scheduler service available")
        return
    
    print(f"\n2. Scheduler Type: {scheduler_type}")
    print(f"   - Is initialized: {getattr(scheduler_service, 'is_initialized', False)}")
    print(f"   - Has scheduler: {hasattr(scheduler_service, 'scheduler')}")
    
    # Test 2: Initialize scheduler
    print("\n3. Testing scheduler initialization...")
    database_url = "sqlite:///./test_scheduler.db"
    
    try:
        await scheduler_service.initialize(database_url)
        print(f"✓ Scheduler initialized successfully")
        print(f"   - Is initialized: {scheduler_service.is_initialized}")
        print(f"   - Scheduler running: {scheduler_service.scheduler.running if scheduler_service.scheduler else 'N/A'}")
    except Exception as e:
        print(f"✗ Failed to initialize scheduler: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Test 3: Add a test schedule
    print("\n4. Testing schedule creation...")
    test_user_id = "test_user_123"
    
    try:
        job_id = await scheduler_service.add_work_order_scraping_schedule(
            user_id=test_user_id,
            interval_hours=2.0,
            active_hours={"start": 8, "end": 18},
            enabled=True
        )
        print(f"✓ Successfully created schedule with job ID: {job_id}")
    except Exception as e:
        print(f"✗ Failed to create schedule: {e}")
        import traceback
        traceback.print_exc()
    
    # Test 4: Get schedule status
    print("\n5. Testing schedule status retrieval...")
    try:
        if 'job_id' in locals():
            status = await scheduler_service.get_schedule_status(job_id)
            if status:
                print(f"✓ Schedule status retrieved:")
                for key, value in status.items():
                    print(f"   - {key}: {value}")
            else:
                print("✗ No status returned for job")
    except Exception as e:
        print(f"✗ Failed to get schedule status: {e}")
    
    # Test 5: Get all schedules
    print("\n6. Testing get all schedules...")
    try:
        schedules = await scheduler_service.get_all_schedules()
        print(f"✓ Retrieved {len(schedules)} schedules")
        for i, schedule in enumerate(schedules):
            print(f"   Schedule {i+1}: {schedule.get('job_id', 'Unknown')}")
    except Exception as e:
        print(f"✗ Failed to get all schedules: {e}")
    
    # Test 6: Update schedule
    print("\n7. Testing schedule update...")
    try:
        if 'job_id' in locals():
            success = await scheduler_service.update_schedule(
                job_id=job_id,
                interval_hours=1.0,
                enabled=False
            )
            print(f"✓ Schedule update {'successful' if success else 'failed'}")
    except Exception as e:
        print(f"✗ Failed to update schedule: {e}")
    
    # Test 7: Remove schedule
    print("\n8. Testing schedule removal...")
    try:
        if 'job_id' in locals():
            success = await scheduler_service.remove_schedule(job_id)
            print(f"✓ Schedule removal {'successful' if success else 'failed'}")
    except Exception as e:
        print(f"✗ Failed to remove schedule: {e}")
    
    # Test 8: Shutdown
    print("\n9. Testing scheduler shutdown...")
    try:
        await scheduler_service.shutdown()
        print("✓ Scheduler shutdown successfully")
    except Exception as e:
        print(f"✗ Failed to shutdown scheduler: {e}")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    # Run the test
    asyncio.run(test_scheduler_initialization())