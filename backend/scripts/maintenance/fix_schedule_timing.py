#!/usr/bin/env python3
"""
Fix the scheduler to run at :30 past each hour
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service

async def fix_schedule_timing():
    print("🔧 Fixing Schedule Timing to Run at :30 Past Each Hour")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    job_id = f"work_order_scrape_{user_id}"
    
    # Check if scheduler is initialized
    if not scheduler_service.is_initialized:
        print("❌ Scheduler service not initialized")
        print("Please ensure the backend is running first")
        return
    
    # Get current schedule from database
    db = SessionLocal()
    try:
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not schedule:
            print("❌ No schedule found in database")
            return
            
        print(f"\n📊 Current Schedule:")
        print(f"   Enabled: {schedule.enabled}")
        print(f"   Interval: {schedule.interval_hours} hours")
        print(f"   Active Hours: {schedule.active_hours}")
        
    finally:
        db.close()
    
    # Check current job in scheduler
    job = scheduler_service.scheduler.get_job(job_id)
    if job:
        print(f"\n🕐 Current APScheduler Job:")
        print(f"   Next Run: {job.next_run_time}")
        print(f"   Trigger: {job.trigger}")
    else:
        print(f"\n❌ No job found in scheduler with ID: {job_id}")
        return
    
    # Update the schedule to use consistent timing
    print(f"\n🔄 Updating schedule to run at :30 past each hour...")
    
    success = await scheduler_service.update_schedule(
        job_id=job_id,
        interval_hours=schedule.interval_hours,
        active_hours=schedule.active_hours,
        enabled=schedule.enabled
    )
    
    if success:
        print("✅ Schedule updated successfully!")
        
        # Check new timing
        job = scheduler_service.scheduler.get_job(job_id)
        if job:
            print(f"\n🕐 New Schedule:")
            print(f"   Next Run: {job.next_run_time}")
            print(f"   Trigger: {job.trigger}")
            
            # Convert to local time for clarity
            if job.next_run_time:
                next_run_utc = job.next_run_time
                if next_run_utc.tzinfo is None:
                    next_run_utc = next_run_utc.replace(tzinfo=timezone.utc)
                
                # Convert to Eastern time (UTC-4 for EDT)
                eastern_offset = timedelta(hours=-4)
                next_run_local = next_run_utc + eastern_offset
                print(f"   Next Run (EDT): {next_run_local.strftime('%Y-%m-%d %I:%M:%S %p')} EDT")
                
                # Show next few runs
                print(f"\n📅 Upcoming Runs (EDT):")
                current = next_run_utc
                for i in range(5):
                    if current:
                        local = current + eastern_offset
                        print(f"   {i+1}. {local.strftime('%Y-%m-%d %I:%M:%S %p')} EDT")
                        current = current + timedelta(hours=1)
    else:
        print("❌ Failed to update schedule")

async def main():
    # Initialize scheduler if needed
    from app.core.config import settings
    
    if not scheduler_service.is_initialized:
        print("Initializing scheduler service...")
        await scheduler_service.initialize(settings.DATABASE_URL)
    
    await fix_schedule_timing()

if __name__ == "__main__":
    asyncio.run(main())