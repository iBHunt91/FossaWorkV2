#!/usr/bin/env python3
"""
Check the actual next run time for the schedule
"""

import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import time

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from apscheduler.triggers.cron import CronTrigger

def check_schedule():
    print("🔍 Checking Schedule Next Run Time")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get the schedule
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            print(f"✅ Found schedule:")
            print(f"   - User ID: {schedule.user_id}")
            print(f"   - Interval: {schedule.interval_hours} hours")
            print(f"   - Active hours: {schedule.active_hours}")
            print(f"   - Enabled: {schedule.enabled}")
            print(f"   - Next run (DB): {schedule.next_run}")
            
            # Calculate what the next run should be
            if schedule.active_hours:
                print(f"\n📅 Calculating next run based on cron trigger...")
                
                # Create the same trigger the scheduler uses
                trigger = CronTrigger(
                    hour=f"{schedule.active_hours['start']}-{schedule.active_hours['end']-1}",
                    minute=0,
                    timezone='UTC'
                )
                
                # Get current time in UTC
                now_utc = datetime.now(timezone.utc)
                print(f"   - Current time (UTC): {now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                
                # Get current time in local timezone
                now_local = datetime.now()
                print(f"   - Current time (Local): {now_local.strftime('%Y-%m-%d %H:%M:%S')}")
                
                # Get next run time
                next_run = trigger.get_next_fire_time(None, now_utc)
                if next_run:
                    print(f"   - Next run (UTC): {next_run.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                    
                    # Convert UTC to local time (rough conversion)
                    utc_offset = round((now_local - now_utc.replace(tzinfo=None)).total_seconds() / 3600)
                    next_run_local = next_run.replace(tzinfo=None) + timedelta(hours=utc_offset)
                    print(f"   - Next run (Local, UTC{utc_offset:+d}): {next_run_local.strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    # Check if it's today or tomorrow
                    if next_run_local.date() == now_local.date():
                        print(f"\n✅ Next run is TODAY at {next_run_local.strftime('%I:%M %p')}")
                    else:
                        print(f"\n⏰ Next run is TOMORROW at {next_run_local.strftime('%I:%M %p')}")
                    
                    # Show all runs for the next 24 hours
                    print(f"\n📋 Upcoming runs (next 24 hours):")
                    current = now_utc
                    for i in range(24):
                        next_time = trigger.get_next_fire_time(None, current)
                        if next_time and (next_time - now_utc).total_seconds() < 86400:
                            local_time = next_time.replace(tzinfo=None) + timedelta(hours=utc_offset)
                            print(f"   - {local_time.strftime('%Y-%m-%d %I:%M %p')}")
                            current = next_time
                        else:
                            break
                        
        else:
            print("❌ No schedule found")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_schedule()