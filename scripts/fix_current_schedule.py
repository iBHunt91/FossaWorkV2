#!/usr/bin/env python3
"""
Fix the current schedule's next run time to match the scheduler
"""

import sys
from pathlib import Path
from datetime import datetime
import asyncio
import os

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service

async def fix_current_schedule():
    print("🔧 Fixing Current Schedule Next Run Time")
    print("=" * 80)
    
    # Initialize scheduler if needed
    if not scheduler_service.is_initialized:
        print("Initializing scheduler...")
        database_url = os.getenv("DATABASE_URL", "sqlite:///./fossawork_v2.db")
        await scheduler_service.initialize(database_url)
    
    db = SessionLocal()
    try:
        # Get all schedules
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.schedule_type == "work_orders"
        ).all()
        
        print(f"Found {len(schedules)} schedules to check")
        print()
        
        for schedule in schedules:
            print(f"User: {schedule.user_id}")
            print(f"  Enabled: {schedule.enabled}")
            print(f"  Interval: {schedule.interval_hours} hours")
            print(f"  Active Hours: {schedule.active_hours}")
            print(f"  Current Next Run (DB): {schedule.next_run}")
            
            # Get the job from scheduler
            job_id = f"work_order_scrape_{schedule.user_id}"
            job = scheduler_service.scheduler.get_job(job_id) if scheduler_service.scheduler else None
            
            if job:
                print(f"  Scheduler Next Run: {job.next_run_time}")
                
                # Update database to match scheduler
                if job.next_run_time:
                    new_next_run = job.next_run_time.replace(tzinfo=None)
                    if schedule.next_run != new_next_run:
                        print(f"  ⚠️  Mismatch detected! Updating database...")
                        schedule.next_run = new_next_run
                        schedule.updated_at = datetime.utcnow()
                        print(f"  ✅ Updated next_run to: {schedule.next_run}")
                    else:
                        print(f"  ✅ Next run times match")
                else:
                    print(f"  ⚠️  Job has no next run time")
            else:
                print(f"  ⚠️  No job found in scheduler")
                
                # If enabled but no job, we might need to recreate it
                if schedule.enabled:
                    print(f"  🔄 Recreating job in scheduler...")
                    try:
                        job_id = await scheduler_service.add_work_order_scraping_schedule(
                            user_id=schedule.user_id,
                            interval_hours=schedule.interval_hours,
                            active_hours=schedule.active_hours,
                            enabled=schedule.enabled,
                            is_restore=True
                        )
                        print(f"  ✅ Job recreated with ID: {job_id}")
                        
                        # Get the new job and update database
                        job = scheduler_service.scheduler.get_job(job_id)
                        if job and job.next_run_time:
                            schedule.next_run = job.next_run_time.replace(tzinfo=None)
                            schedule.updated_at = datetime.utcnow()
                            print(f"  ✅ Updated next_run to: {schedule.next_run}")
                    except Exception as e:
                        print(f"  ❌ Failed to recreate job: {e}")
            
            print()
        
        # Commit all changes
        db.commit()
        print("✅ All schedules updated successfully!")
        
        # Show final state
        print("\nFinal Schedule State:")
        print("-" * 80)
        for schedule in schedules:
            db.refresh(schedule)
            print(f"User: {schedule.user_id}")
            print(f"  Next Run: {schedule.next_run}")
            
            if schedule.next_run:
                now = datetime.utcnow()
                if schedule.next_run > now:
                    diff = schedule.next_run - now
                    hours = diff.total_seconds() / 3600
                    print(f"  Time until next: {hours:.1f} hours")
                else:
                    diff = now - schedule.next_run
                    hours = diff.total_seconds() / 3600
                    print(f"  ⚠️  OVERDUE by: {hours:.1f} hours")
            print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(fix_current_schedule())