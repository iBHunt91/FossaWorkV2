#!/usr/bin/env python3
"""
Diagnose the scheduler service initialization issue
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.scheduler_service import scheduler_service
from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory

async def test_scheduler_service():
    """Test scheduler service functionality"""
    
    print("🔍 Testing Scheduler Service")
    print("=" * 50)
    
    # Check initial state
    print(f"\n1. Initial state:")
    print(f"   - Is initialized: {scheduler_service.is_initialized}")
    print(f"   - Scheduler exists: {scheduler_service.scheduler is not None}")
    print(f"   - Active jobs: {len(scheduler_service.active_jobs)}")
    
    # Test getting all schedules before initialization
    print(f"\n2. Testing get_all_schedules before init:")
    schedules = await scheduler_service.get_all_schedules()
    print(f"   - Result: {len(schedules)} schedules")
    
    # Initialize the scheduler
    print(f"\n3. Initializing scheduler...")
    try:
        database_url = "sqlite:///./fossawork_v2.db"
        await scheduler_service.initialize(database_url)
        print(f"   ✅ Scheduler initialized successfully")
    except Exception as e:
        print(f"   ❌ Failed to initialize: {e}")
        return
    
    # Check state after initialization
    print(f"\n4. State after initialization:")
    print(f"   - Is initialized: {scheduler_service.is_initialized}")
    print(f"   - Scheduler exists: {scheduler_service.scheduler is not None}")
    print(f"   - Scheduler running: {scheduler_service.scheduler.running if scheduler_service.scheduler else 'N/A'}")
    print(f"   - Active jobs: {len(scheduler_service.active_jobs)}")
    
    # Test adding a schedule
    print(f"\n5. Testing add_work_order_scraping_schedule:")
    try:
        user_id = "test_user_123"
        job_id = await scheduler_service.add_work_order_scraping_schedule(
            user_id=user_id,
            interval_hours=1.0,
            active_hours={"start": 6, "end": 22},
            enabled=True
        )
        print(f"   ✅ Schedule added successfully")
        print(f"   - Job ID: {job_id}")
    except Exception as e:
        print(f"   ❌ Failed to add schedule: {e}")
        import traceback
        traceback.print_exc()
    
    # Get all schedules
    print(f"\n6. Getting all schedules:")
    schedules = await scheduler_service.get_all_schedules()
    print(f"   - Found {len(schedules)} schedules")
    for schedule in schedules:
        print(f"   - {schedule.get('job_id')}: {schedule.get('type')} (enabled: {schedule.get('enabled')})")
    
    # Check database
    print(f"\n7. Checking database:")
    db = SessionLocal()
    try:
        db_schedules = db.query(ScrapingSchedule).all()
        print(f"   - Found {len(db_schedules)} schedules in DB")
        for s in db_schedules:
            print(f"     - User: {s.user_id}, Type: {s.schedule_type}, Enabled: {s.enabled}")
    finally:
        db.close()
    
    # Shutdown
    print(f"\n8. Shutting down scheduler...")
    await scheduler_service.shutdown()
    print(f"   ✅ Scheduler shut down")

async def main():
    """Run the diagnostic tests"""
    try:
        await test_scheduler_service()
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())