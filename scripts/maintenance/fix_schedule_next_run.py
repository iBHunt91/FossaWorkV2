#!/usr/bin/env python3
"""
Fix the schedule's next_run time to be in the future
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def fix_schedule_next_run():
    print("🔧 Fixing Schedule Next Run Time")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get the schedule
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not schedule:
            print("❌ Schedule not found!")
            return
            
        print(f"Current state:")
        print(f"  Next Run: {schedule.next_run}")
        print(f"  Last Run: {schedule.last_run}")
        print(f"  Interval: {schedule.interval_hours} hours")
        print(f"  Active Hours: {schedule.active_hours}")
        print()
        
        # Calculate new next run time
        now = datetime.utcnow()
        
        if schedule.active_hours is None:
            # Simple interval-based scheduling
            # If we have a last run, add interval to it
            if schedule.last_run:
                # Keep adding intervals until we get a future time
                next_run = schedule.last_run + timedelta(hours=schedule.interval_hours)
                while next_run < now:
                    next_run += timedelta(hours=schedule.interval_hours)
            else:
                # No last run, just schedule for interval from now
                next_run = now + timedelta(hours=schedule.interval_hours)
        else:
            # Active hours scheduling
            start_hour = schedule.active_hours.get('start', 6)
            end_hour = schedule.active_hours.get('end', 22)
            
            # If we're within active hours, next run is in interval_hours
            if start_hour <= now.hour < end_hour:
                next_run = now + timedelta(hours=schedule.interval_hours)
            else:
                # Outside active hours, next run is at start of next active period
                if now.hour >= end_hour:
                    # Past end time today, schedule for tomorrow
                    next_day = now + timedelta(days=1)
                    next_run = next_day.replace(hour=start_hour, minute=0, second=0, microsecond=0)
                else:
                    # Before start time today
                    next_run = now.replace(hour=start_hour, minute=0, second=0, microsecond=0)
        
        print(f"Updating next run to: {next_run}")
        schedule.next_run = next_run
        schedule.updated_at = now
        
        db.commit()
        db.refresh(schedule)
        
        print()
        print(f"✅ Schedule updated!")
        print(f"  New Next Run: {schedule.next_run}")
        print()
        
        # Check if we should run immediately
        time_since_last = now - schedule.last_run if schedule.last_run else None
        if time_since_last and time_since_last.total_seconds() > (schedule.interval_hours * 3600):
            print(f"⚠️  It's been {time_since_last} since last run")
            print(f"    (more than the {schedule.interval_hours} hour interval)")
            print(f"    You should trigger a manual scrape!")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    fix_schedule_next_run()