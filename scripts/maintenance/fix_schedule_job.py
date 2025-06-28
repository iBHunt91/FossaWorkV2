#!/usr/bin/env python3
"""
Fix schedule job that exists in database but not in scheduler
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service

async def fix_schedule():
    print("🔧 Fixing Schedule Job")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get the schedule from database
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not schedule:
            print("❌ No schedule found in database")
            return
            
        print(f"✅ Found schedule in database:")
        print(f"   - User ID: {schedule.user_id}")
        print(f"   - Interval: {schedule.interval_hours} hours")
        print(f"   - Active hours: {schedule.active_hours}")
        print(f"   - Enabled: {schedule.enabled}")
        
        # Check if scheduler is initialized
        if not scheduler_service or not scheduler_service.is_initialized:
            print("\n❌ Scheduler service not initialized")
            
            # Try to initialize it
            print("🚀 Attempting to initialize scheduler...")
            database_url = "sqlite:///./fossawork_v2.db"
            await scheduler_service.initialize(database_url)
            print("✅ Scheduler initialized")
        
        # Check if job exists in scheduler
        job_id = f"work_order_scrape_{schedule.user_id}"
        print(f"\n🔍 Checking for job {job_id} in scheduler...")
        
        if job_id in scheduler_service.active_jobs:
            print("✅ Job already exists in scheduler")
        else:
            print("❌ Job not found in scheduler, recreating...")
            
            # Recreate the job
            try:
                new_job_id = await scheduler_service.add_work_order_scraping_schedule(
                    user_id=schedule.user_id,
                    interval_hours=schedule.interval_hours,
                    active_hours=schedule.active_hours,
                    enabled=schedule.enabled
                )
                print(f"✅ Job recreated with ID: {new_job_id}")
                
                # Check the job details
                job = scheduler_service.scheduler.get_job(new_job_id)
                if job:
                    print(f"   - Next run: {job.next_run_time}")
                    print(f"   - Trigger: {job.trigger}")
                    
            except Exception as e:
                print(f"❌ Failed to recreate job: {e}")
                import traceback
                traceback.print_exc()
        
        # Now try to update it without active hours
        print("\n📝 Updating schedule to run every hour without active hours...")
        try:
            success = await scheduler_service.update_schedule(
                job_id=job_id,
                interval_hours=1.0,
                active_hours=None,  # No active hours restriction
                enabled=True
            )
            
            if success:
                print("✅ Schedule updated successfully!")
                
                # Check the updated job
                job = scheduler_service.scheduler.get_job(job_id)
                if job:
                    print(f"   - Next run: {job.next_run_time}")
                    print(f"   - Trigger: {job.trigger}")
            else:
                print("❌ Failed to update schedule")
                
        except Exception as e:
            print(f"❌ Error updating schedule: {e}")
            import traceback
            traceback.print_exc()
            
    finally:
        db.close()
        
        # Shutdown scheduler
        if scheduler_service and scheduler_service.is_initialized:
            await scheduler_service.shutdown()
            print("\n✅ Scheduler shutdown cleanly")

if __name__ == "__main__":
    asyncio.run(fix_schedule())