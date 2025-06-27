#!/usr/bin/env python3
"""
Test the API endpoint to see what the frontend receives
"""

import sys
from pathlib import Path
import asyncio
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def test_api():
    print("🧪 Testing Frontend API Response")
    print("=" * 80)
    
    # Simulate API call
    try:
        # You would need to replace this with actual auth token
        # For now, let's just check the database directly
        from app.database import SessionLocal
        from app.models.scraping_models import ScrapingSchedule
        
        db = SessionLocal()
        try:
            schedules = db.query(ScrapingSchedule).filter(
                    ScrapingSchedule.schedule_type == "work_orders"
                ).all()
                
                print("Database Schedules:")
                for schedule in schedules:
                    print(f"\nUser: {schedule.user_id}")
                    print(f"  Enabled: {schedule.enabled}")
                    print(f"  Interval Hours: {schedule.interval_hours}")
                    print(f"  Active Hours: {schedule.active_hours}")
                    print(f"  Next Run: {schedule.next_run}")
                    print(f"  Last Run: {schedule.last_run}")
                    
                    # Simulate what the API would return
                    job_id = f"work_order_scrape_{schedule.user_id}"
                    api_response = {
                        "job_id": job_id,
                        "user_id": schedule.user_id,
                        "type": schedule.schedule_type,
                        "enabled": schedule.enabled,
                        "next_run": schedule.next_run.isoformat() + 'Z' if schedule.next_run else None,
                        "pending": False,
                        "interval_hours": schedule.interval_hours,
                        "active_hours": schedule.active_hours
                    }
                    
                    print("\nAPI Response Format:")
                    print(f"  job_id: {api_response['job_id']}")
                    print(f"  enabled: {api_response['enabled']}")
                    print(f"  next_run: {api_response['next_run']}")
                    print(f"  interval_hours: {api_response['interval_hours']}")
                    print(f"  active_hours: {api_response['active_hours']}")
                    
                    # Test the frontend calculation logic
                    if api_response['next_run']:
                        next_run_date = datetime.fromisoformat(api_response['next_run'].replace('Z', '+00:00'))
                        now = datetime.now(next_run_date.tzinfo)
                        diff_ms = (next_run_date - now).total_seconds() * 1000
                        diff_mins = int(diff_ms / 60000)
                        
                        print(f"\nFrontend Calculation:")
                        print(f"  Next run date: {next_run_date}")
                        print(f"  Current time: {now}")
                        print(f"  Difference (ms): {diff_ms}")
                        print(f"  Difference (minutes): {diff_mins}")
                        
                        if diff_ms < 0:
                            print(f"  Display: 'Any moment...'")
                        elif diff_mins < 1:
                            print(f"  Display: 'Less than a minute'")
                        elif diff_mins < 60:
                            print(f"  Display: '{diff_mins} min'")
                        else:
                            hours = diff_mins // 60
                            mins = diff_mins % 60
                            if hours < 24:
                                if mins > 0:
                                    print(f"  Display: '{hours}h {mins}m'")
                                else:
                                    print(f"  Display: '{hours} hour{'s' if hours > 1 else ''}'")
                            else:
                                days = hours // 24
                                print(f"  Display: 'in {days} days'")
                    
            finally:
                db.close()
                
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api())