#!/usr/bin/env python3
"""
Test script to debug schedule update issue
"""

import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def test_schedule_update():
    print("🔍 Testing Schedule Update")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Find the schedule
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not schedule:
            print("❌ Schedule not found!")
            return
            
        print(f"Current schedule state:")
        print(f"  ID: {schedule.id}")
        print(f"  Interval: {schedule.interval_hours}")
        print(f"  Active Hours: {schedule.active_hours}")
        print(f"  Active Hours Type: {type(schedule.active_hours)}")
        print(f"  Enabled: {schedule.enabled}")
        print()
        
        # Try to set active_hours to None
        print("Setting active_hours to None...")
        schedule.active_hours = None
        schedule.updated_at = datetime.utcnow()
        
        print(f"Before commit - active_hours: {schedule.active_hours}")
        
        # Commit the change
        db.commit()
        db.refresh(schedule)
        
        print(f"After commit - active_hours: {schedule.active_hours}")
        print(f"After commit - active_hours type: {type(schedule.active_hours)}")
        print()
        
        # Query again to verify
        print("Re-querying from database...")
        db.close()
        db = SessionLocal()
        
        schedule2 = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        print(f"After re-query - active_hours: {schedule2.active_hours}")
        print(f"After re-query - active_hours type: {type(schedule2.active_hours)}")
        
        if schedule2.active_hours is None:
            print("✅ Successfully set active_hours to None!")
        else:
            print("❌ Failed to set active_hours to None!")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_schedule_update()