#!/usr/bin/env python3
"""
Reset schedule to ensure clean state
"""

import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def reset_schedule():
    print("🔧 Resetting Schedule to Clean State")
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
        print(f"  Enabled: {schedule.enabled}")
        print()
        
        # Reset to clean state with NO active hours
        print("Resetting schedule...")
        schedule.interval_hours = 1.0
        schedule.active_hours = None
        schedule.enabled = True
        schedule.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(schedule)
        
        print(f"After reset:")
        print(f"  Interval: {schedule.interval_hours}")
        print(f"  Active Hours: {schedule.active_hours}")
        print(f"  Enabled: {schedule.enabled}")
        print()
        print("✅ Schedule reset complete!")
        print()
        print("⚠️  IMPORTANT: You must restart the backend server for this to take effect!")
        print("    The scheduler service caches the schedule in memory.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    reset_schedule()