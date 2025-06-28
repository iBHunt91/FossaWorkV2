#!/usr/bin/env python3
"""
Check current schedules in the database and their next run times
"""

import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def check_schedules():
    print("📊 Current Schedules in Database")
    print("=" * 80)
    
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.schedule_type == "work_orders"
        ).all()
        
        if not schedules:
            print("No schedules found in database")
            return
        
        now = datetime.utcnow()
        print(f"Current UTC time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        for schedule in schedules:
            print(f"User ID: {schedule.user_id}")
            print(f"  Enabled: {schedule.enabled}")
            print(f"  Interval: {schedule.interval_hours} hours")
            print(f"  Active Hours: {schedule.active_hours}")
            print(f"  Last Run: {schedule.last_run}")
            print(f"  Next Run: {schedule.next_run}")
            
            if schedule.next_run:
                # Calculate time difference
                if schedule.next_run > now:
                    diff = schedule.next_run - now
                    hours = diff.total_seconds() / 3600
                    print(f"  Time until next: {hours:.1f} hours")
                else:
                    diff = now - schedule.next_run
                    hours = diff.total_seconds() / 3600
                    print(f"  ⚠️  OVERDUE by: {hours:.1f} hours")
            else:
                print(f"  ⚠️  No next run time set!")
            
            print(f"  Updated At: {schedule.updated_at}")
            print()
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_schedules()