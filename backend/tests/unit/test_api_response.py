#!/usr/bin/env python3
"""
Test API response directly
"""

import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.models.user_models import User

def test_api_response():
    print("🔍 Testing API Response Logic")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get the schedule directly from DB
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            print(f"Database values:")
            print(f"  ID: {schedule.id}")
            print(f"  Interval: {schedule.interval_hours}")
            print(f"  Active Hours: {schedule.active_hours}")
            print(f"  Active Hours Type: {type(schedule.active_hours)}")
            print(f"  Active Hours is None: {schedule.active_hours is None}")
            print(f"  Enabled: {schedule.enabled}")
            print()
            
            # Check what the API would return
            job_id = f"{schedule.schedule_type}_scrape_{schedule.user_id}"
            api_response = {
                "job_id": job_id,
                "user_id": schedule.user_id,
                "type": schedule.schedule_type,
                "enabled": schedule.enabled,
                "next_run": schedule.next_run.isoformat() if schedule.next_run else None,
                "pending": False,
                "interval_hours": schedule.interval_hours,
                "active_hours": schedule.active_hours
            }
            
            print(f"API would return:")
            print(f"  active_hours: {api_response['active_hours']}")
            print(f"  active_hours type: {type(api_response['active_hours'])}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_api_response()