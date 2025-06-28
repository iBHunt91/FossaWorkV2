#!/usr/bin/env python3
"""
Initialize and start the scheduler service
This script ensures the scheduler is properly running
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service, execute_work_order_scraping
from app.services.logging_service import get_logger

logger = get_logger("scheduler.initializer")

async def initialize_scheduler():
    """Initialize and start the scheduler service"""
    print("\n" + "="*80)
    print("🚀 INITIALIZING SCHEDULER SERVICE")
    print("="*80)
    print(f"Time: {datetime.now()}")
    print(f"UTC Time: {datetime.now(timezone.utc)}")
    print("="*80)
    
    # 1. Check current state
    print("\n📊 CURRENT STATE:")
    print(f"  Is initialized: {scheduler_service.is_initialized}")
    print(f"  Scheduler exists: {scheduler_service.scheduler is not None}")
    
    if scheduler_service.scheduler:
        print(f"  Is running: {scheduler_service.scheduler.running}")
    
    # 2. Initialize if needed
    if not scheduler_service.is_initialized:
        print("\n🔧 Initializing scheduler...")
        try:
            db_url = "sqlite:///fossawork_v2.db"
            await scheduler_service.initialize(db_url)
            print("✅ Scheduler initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize scheduler: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        print("\n✅ Scheduler already initialized")
    
    # 3. Verify scheduler is running
    if scheduler_service.scheduler and not scheduler_service.scheduler.running:
        print("\n🔄 Starting scheduler...")
        scheduler_service.scheduler.start()
        print("✅ Scheduler started")
    
    # 4. Check and re-register jobs
    print("\n📝 CHECKING JOBS:")
    jobs = scheduler_service.scheduler.get_jobs()
    print(f"  Current jobs: {len(jobs)}")
    
    for job in jobs:
        print(f"    - {job.id}: Next run at {job.next_run_time}")
    
    # 5. Register missing jobs
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        print(f"\n  Found {len(schedules)} enabled schedules in database")
        
        for schedule in schedules:
            job_id = f"work_order_scrape_{schedule.user_id}"
            
            # Check if job exists
            existing_job = scheduler_service.scheduler.get_job(job_id)
            
            if not existing_job:
                print(f"\n  ⚠️  Job missing for user {schedule.user_id}, registering...")
                try:
                    await scheduler_service.add_work_order_scraping_schedule(
                        user_id=schedule.user_id,
                        interval_hours=schedule.interval_hours,
                        active_hours=schedule.active_hours,
                        enabled=True,
                        is_restore=True
                    )
                    print(f"  ✅ Job registered successfully")
                except Exception as e:
                    print(f"  ❌ Failed to register job: {e}")
            else:
                print(f"  ✅ Job exists for user {schedule.user_id}")
                print(f"     Next run: {existing_job.next_run_time}")
                
                # Check if job is overdue
                if existing_job.next_run_time and existing_job.next_run_time < datetime.now(timezone.utc):
                    overdue_minutes = (datetime.now(timezone.utc) - existing_job.next_run_time).total_seconds() / 60
                    print(f"     ⚠️  OVERDUE by {overdue_minutes:.1f} minutes!")
                    
                    # Force immediate execution for severely overdue jobs
                    if overdue_minutes > 60:
                        print(f"     🚀 Triggering immediate execution (overdue > 60 minutes)")
                        asyncio.create_task(execute_work_order_scraping(schedule.user_id))
                        
                        # Reschedule for future
                        from apscheduler.triggers.cron import CronTrigger
                        trigger = CronTrigger(minute=30, timezone='UTC')
                        existing_job.reschedule(trigger=trigger)
                        print(f"     📅 Rescheduled to run at :30 past each hour")
    
    finally:
        db.close()
    
    # 6. Final status
    print("\n✅ SCHEDULER STATUS:")
    print(f"  Initialized: {scheduler_service.is_initialized}")
    print(f"  Running: {scheduler_service.scheduler.running if scheduler_service.scheduler else False}")
    
    jobs = scheduler_service.scheduler.get_jobs()
    print(f"  Active jobs: {len(jobs)}")
    
    print("\n📅 NEXT SCHEDULED RUNS:")
    for job in jobs:
        if job.next_run_time:
            time_until = (job.next_run_time - datetime.now(timezone.utc)).total_seconds() / 60
            if time_until < 0:
                print(f"  {job.id}: OVERDUE by {abs(time_until):.1f} minutes")
            else:
                print(f"  {job.id}: in {time_until:.1f} minutes ({job.next_run_time})")
    
    return True

async def monitor_scheduler(duration_minutes=5):
    """Monitor scheduler for a period to ensure it's working"""
    print(f"\n📊 MONITORING SCHEDULER FOR {duration_minutes} MINUTES...")
    print("-"*40)
    
    start_time = datetime.now()
    check_interval = 30  # seconds
    
    while (datetime.now() - start_time).total_seconds() < duration_minutes * 60:
        await asyncio.sleep(check_interval)
        
        # Check scheduler status
        if not scheduler_service.scheduler or not scheduler_service.scheduler.running:
            print(f"\n❌ SCHEDULER STOPPED! Attempting restart...")
            await initialize_scheduler()
        else:
            jobs = scheduler_service.scheduler.get_jobs()
            print(f"\n✅ [{datetime.now().strftime('%H:%M:%S')}] Scheduler running with {len(jobs)} jobs")
            
            # Check for overdue jobs
            for job in jobs:
                if job.next_run_time and job.next_run_time < datetime.now(timezone.utc):
                    overdue_minutes = (datetime.now(timezone.utc) - job.next_run_time).total_seconds() / 60
                    print(f"  ⚠️  {job.id} is overdue by {overdue_minutes:.1f} minutes")

async def main():
    """Main function"""
    # Initialize scheduler
    success = await initialize_scheduler()
    
    if success:
        print("\n" + "="*80)
        response = input("\n📊 Would you like to monitor the scheduler for 5 minutes? (y/n): ")
        
        if response.lower() == 'y':
            await monitor_scheduler(5)
    
    print("\n✅ Scheduler initialization complete")
    print("\n⚠️  NOTE: The scheduler should be running as part of the main FastAPI app.")
    print("    This script is for troubleshooting and manual intervention only.")

if __name__ == "__main__":
    asyncio.run(main())