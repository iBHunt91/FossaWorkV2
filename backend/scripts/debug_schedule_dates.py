#!/usr/bin/env python3
"""
Debug schedule dates directly from database
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from datetime import datetime

def check_schedule_dates():
    print("🔍 Checking Schedule Dates in Database")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    db = SessionLocal()
    try:
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not schedule:
            print("❌ No schedule found")
            return
            
        print(f"\n📊 Schedule found:")
        print(f"   ID: {schedule.id}")
        print(f"   Enabled: {schedule.enabled}")
        print(f"   Interval: {schedule.interval_hours} hours")
        
        print(f"\n📅 Date fields:")
        print(f"   next_run: {schedule.next_run}")
        print(f"   next_run type: {type(schedule.next_run)}")
        print(f"   next_run repr: {repr(schedule.next_run)}")
        
        if schedule.next_run:
            # Check if it's a valid datetime
            if isinstance(schedule.next_run, datetime):
                print(f"   ✅ Valid datetime object")
                print(f"   ISO format: {schedule.next_run.isoformat()}")
                print(f"   With Z: {schedule.next_run.isoformat() + 'Z'}")
            else:
                print(f"   ❌ Not a datetime object!")
        
        print(f"\n   last_run: {schedule.last_run}")
        print(f"   last_run type: {type(schedule.last_run)}")
        
        # Check what the API endpoint would return
        print(f"\n🌐 What the API would return:")
        api_response = {
            "enabled": schedule.enabled,
            "interval_hours": schedule.interval_hours,
            "active_hours": schedule.active_hours,
            "next_run": schedule.next_run.isoformat() + 'Z' if schedule.next_run else None,
            "last_run": schedule.last_run.isoformat() + 'Z' if schedule.last_run else None,
            "consecutive_failures": schedule.consecutive_failures,
            "is_running": False,
            "schedule_type": "work_orders"
        }
        
        import json
        print(json.dumps(api_response, indent=2))
        
    finally:
        db.close()

if __name__ == "__main__":
    check_schedule_dates()