#!/usr/bin/env python3
"""
Test what the GET /api/scraping-schedules/ endpoint returns
"""

import sys
from pathlib import Path
import json

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

# Try to import scheduler service
try:
    from app.services.scheduler_service import scheduler_service
    has_scheduler = True
except:
    scheduler_service = None
    has_scheduler = False

def test_get_schedules_response():
    print("🔍 Testing GET Schedules Response")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # First, check database directly
    print("1. Database values:")
    db = SessionLocal()
    try:
        db_schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id
        ).first()
        
        if db_schedule:
            print(f"  Type: {db_schedule.schedule_type}")
            print(f"  Interval: {db_schedule.interval_hours}")
            print(f"  Active Hours: {db_schedule.active_hours}")
            print(f"  Enabled: {db_schedule.enabled}")
            print()
            
            # What the API would return from database only
            job_id = f"{db_schedule.schedule_type}_scrape_{db_schedule.user_id}"
            db_response = {
                "job_id": job_id,
                "user_id": db_schedule.user_id,
                "type": db_schedule.schedule_type,
                "enabled": db_schedule.enabled,
                "next_run": db_schedule.next_run.isoformat() if db_schedule.next_run else None,
                "pending": False,
                "interval_hours": db_schedule.interval_hours,
                "active_hours": db_schedule.active_hours
            }
            
            print("2. Database-only API response would be:")
            print(json.dumps(db_response, indent=2))
            print()
            
            # Check scheduler if available
            if has_scheduler and scheduler_service:
                print("3. Scheduler service status:")
                print(f"  Is initialized: {getattr(scheduler_service, 'is_initialized', False)}")
                
                if hasattr(scheduler_service, 'is_initialized') and scheduler_service.is_initialized:
                    # Try to get runtime info
                    if hasattr(scheduler_service, 'get_all_schedules'):
                        try:
                            all_schedules = scheduler_service.get_all_schedules()
                            print(f"  All schedules: {all_schedules}")
                            
                            # Find user's schedule
                            user_schedules = [s for s in all_schedules if s.get("user_id") == user_id]
                            if user_schedules:
                                runtime_schedule = user_schedules[0]
                                print(f"\n  Runtime schedule:")
                                print(json.dumps(runtime_schedule, indent=4))
                                
                                # This is what happens in the API route
                                print(f"\n4. After merging with database values:")
                                runtime_schedule['interval_hours'] = db_schedule.interval_hours
                                runtime_schedule['active_hours'] = db_schedule.active_hours
                                print(json.dumps(runtime_schedule, indent=4))
                        except Exception as e:
                            print(f"  Error getting schedules: {e}")
                else:
                    print("  Scheduler not initialized")
            else:
                print("3. Scheduler service not available")
                
    finally:
        db.close()

if __name__ == "__main__":
    test_get_schedules_response()