#!/usr/bin/env python3
"""
Test scheduler by setting it to run at the next minute
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def test_next_minute_schedule():
    print("🕐 Testing Scheduler - Next Minute Run")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get the schedule
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not schedule:
            print("❌ No schedule found")
            return
        
        print(f"✅ Found schedule for user: {schedule.user_id}")
        print(f"   - Current interval: {schedule.interval_hours} hours")
        print(f"   - Active hours: {schedule.active_hours}")
        print(f"   - Enabled: {schedule.enabled}")
        print(f"   - Last run: {schedule.last_run}")
        
        # Update to run every minute for testing
        print("\n📝 Updating schedule to run every minute...")
        schedule.interval_hours = 0.0167  # 1 minute = 0.0167 hours
        schedule.active_hours = None  # Remove active hours restriction
        schedule.enabled = True
        
        db.commit()
        print("✅ Schedule updated!")
        
        # Calculate next run
        now = datetime.utcnow()
        next_minute = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
        print(f"\n⏰ Current time (UTC): {now.strftime('%H:%M:%S')}")
        print(f"⏰ Next run should be: {next_minute.strftime('%H:%M:%S')}")
        print(f"\n🔄 The scheduler should pick up this change and run at the next minute.")
        print("Watch the backend logs to see if it runs!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_next_minute_schedule()