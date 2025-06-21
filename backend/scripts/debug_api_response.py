#!/usr/bin/env python3
"""
Debug what the API is actually returning
"""

import sys
from pathlib import Path
from datetime import datetime
import json

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def debug_api_response():
    print("🔍 Debugging API Response")
    print("=" * 50)
    
    # Current times
    utc_now = datetime.utcnow()
    local_now = datetime.now()
    
    print(f"Current UTC time:   {utc_now}")
    print(f"Current local time: {local_now}")
    print()
    
    # Get schedule from database
    db = SessionLocal()
    try:
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            print("Database values:")
            print(f"  next_run: {schedule.next_run}")
            print(f"  next_run type: {type(schedule.next_run)}")
            print()
            
            # What the API returns
            job_id = f"work_orders_scrape_{schedule.user_id}"
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
            
            print("API response would be:")
            print(json.dumps(api_response, indent=2))
            print()
            
            # Check the actual time difference
            if schedule.next_run:
                time_diff = schedule.next_run - utc_now
                print(f"Time until next run (UTC): {time_diff}")
                print(f"That's {time_diff.total_seconds() / 60:.1f} minutes")
                print(f"Or {time_diff.total_seconds() / 3600:.1f} hours")
                
    finally:
        db.close()

if __name__ == "__main__":
    debug_api_response()