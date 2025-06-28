#!/usr/bin/env python3
"""
Trigger an immediate scrape if the next run time has passed
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta
import asyncio

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

async def check_and_trigger_scrape():
    print("🔍 Checking Schedule Status")
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
            
        print(f"Current time: {datetime.utcnow()}")
        print(f"Next run: {schedule.next_run}")
        print(f"Last run: {schedule.last_run}")
        print(f"Enabled: {schedule.enabled}")
        print()
        
        # Check if next run is in the past
        if schedule.next_run and schedule.next_run < datetime.utcnow():
            time_diff = datetime.utcnow() - schedule.next_run
            print(f"⚠️  Next run is {time_diff} in the past!")
            print("The scheduler should have triggered this as a missed job.")
            print()
            
            # Calculate what the next run should be
            if schedule.active_hours is None:
                # Simple interval-based scheduling
                next_run = datetime.utcnow() + timedelta(hours=schedule.interval_hours)
                print(f"With interval of {schedule.interval_hours} hours, next run should be: {next_run}")
            else:
                print("Active hours scheduling is more complex...")
                
            print()
            print("Options:")
            print("1. Manually trigger a scrape via the API")
            print("2. Update the schedule to reset next_run time")
            print("3. Check if the scheduler service is running properly")
            
        else:
            print("✅ Next run is in the future - schedule looks correct")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(check_and_trigger_scrape())