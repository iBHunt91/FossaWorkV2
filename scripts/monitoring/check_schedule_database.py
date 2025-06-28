#!/usr/bin/env python3
"""
Check what's actually in the schedule database
"""

import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def check_schedule_db():
    print("🔍 Checking Schedule Database")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).all()
        
        print(f"Total schedules: {len(schedules)}")
        print()
        
        for schedule in schedules:
            print(f"Schedule ID: {schedule.id}")
            print(f"  User ID: {schedule.user_id}")
            print(f"  Type: {schedule.schedule_type}")
            print(f"  Interval: {schedule.interval_hours} hours")
            print(f"  Active Hours: {schedule.active_hours}")
            print(f"  Enabled: {schedule.enabled}")
            print(f"  Created: {schedule.created_at}")
            print(f"  Updated: {schedule.updated_at}")
            print(f"  Last Run: {schedule.last_run}")
            print(f"  Next Run: {schedule.next_run}")
            print()
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_schedule_db()