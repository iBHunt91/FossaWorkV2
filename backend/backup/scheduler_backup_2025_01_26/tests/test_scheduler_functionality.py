#!/usr/bin/env python3
"""
Test scheduler functionality with robust logging
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
import time

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal, engine
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.scheduler_service import scheduler_service
from app.services.logging_service import get_logger

logger = get_logger("scheduler.test")

async def test_scheduler():
    print("🔍 Testing Scheduler Functionality")
    print("=" * 50)
    
    # Check if scheduler is available
    print("1. Checking scheduler availability...")
    if scheduler_service is None:
        print("❌ Scheduler service is None - not imported")
        return
    
    print("✅ Scheduler service imported")
    print(f"   Type: {type(scheduler_service).__name__}")
    print(f"   Is initialized: {getattr(scheduler_service, 'is_initialized', False)}")
    
    # Initialize scheduler if needed
    if not scheduler_service.is_initialized:
        print("\n2. Initializing scheduler...")
        try:
            database_url = f"sqlite:///{engine.url.database}"
            await scheduler_service.initialize(database_url)
            print("✅ Scheduler initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize scheduler: {e}")
            return
    else:
        print("\n2. Scheduler already initialized")
    
    # Check scheduler properties
    print("\n3. Checking scheduler properties...")
    if hasattr(scheduler_service, 'scheduler'):
        scheduler = scheduler_service.scheduler
        if scheduler:
            print(f"✅ APScheduler instance found")
            print(f"   Running: {scheduler.running if hasattr(scheduler, 'running') else 'Unknown'}")
            print(f"   State: {scheduler.state if hasattr(scheduler, 'state') else 'Unknown'}")
            
            # Get all jobs
            if hasattr(scheduler, 'get_jobs'):
                jobs = scheduler.get_jobs()
                print(f"   Active jobs: {len(jobs)}")
                for job in jobs:
                    print(f"     - {job.id}: Next run at {job.next_run_time}")
        else:
            print("⚠️  No APScheduler instance (using mock scheduler)")
    else:
        print("⚠️  No scheduler attribute (using mock scheduler)")
    
    # Check active jobs in service
    print("\n4. Checking active jobs in service...")
    if hasattr(scheduler_service, 'active_jobs'):
        print(f"   Jobs tracked: {len(scheduler_service.active_jobs)}")
        for job_id, job_info in scheduler_service.active_jobs.items():
            print(f"   - {job_id}:")
            print(f"     User: {job_info.get('user_id')}")
            print(f"     Enabled: {job_info.get('enabled')}")
            print(f"     Type: {job_info.get('type')}")
    
    # Check database schedules
    print("\n5. Checking database schedules...")
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).all()
        print(f"   Found {len(schedules)} schedules in database")
        for schedule in schedules:
            print(f"   - User {schedule.user_id}:")
            print(f"     Type: {schedule.schedule_type}")
            print(f"     Interval: {schedule.interval_hours} hours")
            print(f"     Active hours: {schedule.active_hours}")
            print(f"     Enabled: {schedule.enabled}")
            print(f"     Next run: {schedule.next_run}")
            print(f"     Last run: {schedule.last_run}")
            
            # Check if it should run now
            if schedule.next_run and schedule.next_run < datetime.utcnow():
                time_diff = datetime.utcnow() - schedule.next_run
                print(f"     ⚠️  OVERDUE by {time_diff}")
    finally:
        db.close()
    
    # Test creating a test schedule
    print("\n6. Testing schedule creation...")
    test_user_id = "test_scheduler_12345"
    try:
        job_id = await scheduler_service.add_work_order_scraping_schedule(
            user_id=test_user_id,
            interval_hours=0.0167,  # 1 minute for testing
            active_hours=None,
            enabled=True
        )
        print(f"✅ Created test schedule: {job_id}")
        
        # Wait a moment
        await asyncio.sleep(2)
        
        # Check if it's scheduled
        if hasattr(scheduler_service, 'scheduler') and scheduler_service.scheduler:
            job = scheduler_service.scheduler.get_job(job_id)
            if job:
                print(f"   Next run: {job.next_run_time}")
                print(f"   Trigger: {job.trigger}")
            else:
                print("   ⚠️  Job not found in scheduler")
        
        # Clean up test schedule
        print("\n7. Cleaning up test schedule...")
        await scheduler_service.remove_schedule(job_id)
        print("✅ Test schedule removed")
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 50)
    print("Summary:")
    if hasattr(scheduler_service, 'scheduler') and scheduler_service.scheduler:
        print("✅ REAL SCHEDULER is active - jobs will run automatically")
    else:
        print("⚠️  MOCK SCHEDULER is active - jobs won't run automatically")
        print("   You need to manually trigger scrapes or use an external scheduler")

async def main():
    await test_scheduler()
    
    # Keep running for a bit to see if any jobs execute
    print("\nWaiting 10 seconds to see if any jobs execute...")
    await asyncio.sleep(10)
    
    # Shutdown
    if scheduler_service and scheduler_service.is_initialized:
        await scheduler_service.shutdown()
        print("\nScheduler shut down")

if __name__ == "__main__":
    asyncio.run(main())