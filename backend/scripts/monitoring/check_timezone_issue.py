#!/usr/bin/env python3
"""
Check timezone issue with scheduler
"""

import sys
from pathlib import Path
from datetime import datetime
# import pytz

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def check_timezone_issue():
    print("🕐 Checking Timezone Issue")
    print("=" * 50)
    
    # Show current times
    utc_now = datetime.utcnow()
    local_now = datetime.now()
    
    print(f"UTC time:   {utc_now}")
    print(f"Local time: {local_now}")
    print(f"Difference: {local_now - utc_now}")
    print()
    
    # Check schedule in database
    db = SessionLocal()
    try:
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            print(f"Schedule in database:")
            print(f"  Last Run: {schedule.last_run} (stored as UTC)")
            print(f"  Next Run: {schedule.next_run} (stored as UTC)")
            print()
            
            # Calculate when it should actually run
            if schedule.last_run:
                expected_next = schedule.last_run + timedelta(hours=schedule.interval_hours)
                print(f"  Expected Next Run: {expected_next} UTC")
                
                # Convert to local time for display
                from datetime import timezone
                if schedule.next_run:
                    # Assume Eastern Time (EDT = UTC-4)
                    edt_offset = timedelta(hours=-4)
                    next_run_local = schedule.next_run + edt_offset
                    print(f"  Next Run in EDT: {next_run_local}")
                    
                    # Time until next run
                    time_until = schedule.next_run - utc_now
                    print(f"  Time until next run: {time_until}")
                    
    finally:
        db.close()

if __name__ == "__main__":
    from datetime import timedelta
    check_timezone_issue()