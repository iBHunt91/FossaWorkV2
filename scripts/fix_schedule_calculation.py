#!/usr/bin/env python3
"""
Fix the schedule next run time calculation issue when active hours is disabled
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service
from apscheduler.triggers.cron import CronTrigger
import asyncio

def calculate_proper_next_run(interval_hours: float, active_hours: dict = None, last_run: datetime = None) -> datetime:
    """
    Calculate the proper next run time based on configuration
    """
    now = datetime.utcnow()
    
    if active_hours is None:
        # No active hours restriction - simple interval-based scheduling
        print(f"  No active hours restriction - using simple interval of {interval_hours} hours")
        
        # We want to run at consistent times (e.g., :30 past each hour)
        # Find the next scheduled time slot
        if interval_hours == 1:
            # Every hour at 30 minutes past
            if now.minute >= 30:
                # Next hour
                next_run = now.replace(minute=30, second=0, microsecond=0) + timedelta(hours=1)
            else:
                # This hour
                next_run = now.replace(minute=30, second=0, microsecond=0)
        else:
            # For other intervals, calculate based on hours from midnight
            hours_since_midnight = now.hour + (now.minute / 60)
            next_slot = 0
            while next_slot < 24:
                if next_slot > hours_since_midnight:
                    break
                next_slot += interval_hours
            
            if next_slot >= 24:
                # Next day
                next_run = (now + timedelta(days=1)).replace(hour=0, minute=30, second=0, microsecond=0)
            else:
                # Today
                hour = int(next_slot)
                next_run = now.replace(hour=hour, minute=30, second=0, microsecond=0)
    else:
        # Active hours restriction
        start_hour = active_hours.get('start', 6)
        end_hour = active_hours.get('end', 22)
        print(f"  Active hours: {start_hour}:00 - {end_hour}:00")
        
        # Check if we're within active hours
        if start_hour <= now.hour < end_hour:
            # Within active hours - calculate next slot
            if now.minute >= 30:
                next_hour = now.hour + 1
            else:
                next_hour = now.hour
            
            # Check if next slot is still within active hours
            if next_hour < end_hour:
                next_run = now.replace(hour=next_hour, minute=30, second=0, microsecond=0)
            else:
                # Next run is tomorrow at start hour
                next_run = (now + timedelta(days=1)).replace(hour=start_hour, minute=30, second=0, microsecond=0)
        else:
            # Outside active hours
            if now.hour >= end_hour:
                # Past end time today, schedule for tomorrow
                next_run = (now + timedelta(days=1)).replace(hour=start_hour, minute=30, second=0, microsecond=0)
            else:
                # Before start time today
                next_run = now.replace(hour=start_hour, minute=30, second=0, microsecond=0)
    
    # Ensure next run is in the future
    while next_run <= now:
        next_run += timedelta(hours=interval_hours)
    
    return next_run

async def fix_schedule_next_run():
    print("🔧 Fixing Schedule Next Run Time Calculation")
    print("=" * 60)
    
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
            print(f"  Current state:")
            print(f"    Enabled: {schedule.enabled}")
            print(f"    Interval: {schedule.interval_hours} hours")
            print(f"    Active Hours: {schedule.active_hours}")
            print(f"    Next Run (DB): {schedule.next_run}")
            print(f"    Last Run: {schedule.last_run}")
            
            # Calculate what the next run should be
            calculated_next_run = calculate_proper_next_run(
                interval_hours=schedule.interval_hours,
                active_hours=schedule.active_hours,
                last_run=schedule.last_run
            )
            
            print(f"  Calculated next run: {calculated_next_run}")
            
            # Check if scheduler has this job
            job_id = f"work_order_scrape_{schedule.user_id}"
            if scheduler_service and scheduler_service.is_initialized:
                job = scheduler_service.scheduler.get_job(job_id)
                if job:
                    print(f"  Scheduler next run: {job.next_run_time}")
                    
                    # Update the job if needed
                    if schedule.enabled and job.next_run_time:
                        # Check if we need to update the trigger
                        needs_update = False
                        
                        # For jobs without active hours, ensure they use consistent timing
                        if schedule.active_hours is None:
                            # Should be using CronTrigger for consistent :30 timing
                            if not isinstance(job.trigger, CronTrigger):
                                needs_update = True
                                print(f"  ⚠️  Job has wrong trigger type: {type(job.trigger).__name__}")
                        
                        if needs_update:
                            print(f"  🔄 Updating job trigger...")
                            
                            # Create proper trigger
                            if schedule.active_hours is None:
                                if schedule.interval_hours == 1:
                                    trigger = CronTrigger(minute=30, timezone='UTC')
                                else:
                                    hours = []
                                    hour = 0
                                    while hour < 24:
                                        hours.append(str(hour))
                                        hour += int(schedule.interval_hours)
                                    trigger = CronTrigger(
                                        hour=','.join(hours),
                                        minute=30,
                                        timezone='UTC'
                                    )
                            else:
                                trigger = CronTrigger(
                                    hour=f"{schedule.active_hours['start']}-{schedule.active_hours['end']-1}",
                                    minute=30,
                                    timezone='UTC'
                                )
                            
                            job.reschedule(trigger=trigger)
                            print(f"  ✅ Job trigger updated")
                            
                            # Get new next run time
                            job = scheduler_service.scheduler.get_job(job_id)
                            if job and job.next_run_time:
                                schedule.next_run = job.next_run_time.replace(tzinfo=None)
                else:
                    print(f"  ⚠️  No job found in scheduler")
                    if schedule.enabled:
                        # Set the calculated next run
                        schedule.next_run = calculated_next_run
            else:
                print(f"  ⚠️  Scheduler not available")
                # Set the calculated next run
                schedule.next_run = calculated_next_run
            
            # Update the database
            schedule.updated_at = datetime.utcnow()
            print(f"  ✅ Updated next_run to: {schedule.next_run}")
            print()
        
        db.commit()
        print("✅ All schedules updated successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Initialize scheduler if needed
    if not scheduler_service.is_initialized:
        print("Initializing scheduler service...")
        from app.core.config import settings
        asyncio.run(scheduler_service.initialize(settings.DATABASE_URL))
    
    # Run the fix
    asyncio.run(fix_schedule_next_run())