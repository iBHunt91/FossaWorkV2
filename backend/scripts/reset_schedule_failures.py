#!/usr/bin/env python3
"""
Reset consecutive failures for a scraping schedule
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def reset_schedule_failures(schedule_id: int = None):
    """Reset consecutive failures for schedule(s)"""
    
    db = SessionLocal()
    try:
        if schedule_id:
            # Reset specific schedule
            schedule = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.id == schedule_id
            ).first()
            
            if schedule:
                old_failures = schedule.consecutive_failures
                schedule.consecutive_failures = 0
                db.commit()
                print(f"✓ Reset schedule {schedule_id} failures from {old_failures} to 0")
                print(f"  User: {schedule.user_id}")
                print(f"  Type: {schedule.schedule_type}")
                print(f"  Enabled: {schedule.enabled}")
            else:
                print(f"✗ Schedule {schedule_id} not found")
        else:
            # List all schedules with failures
            schedules = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.consecutive_failures > 0
            ).all()
            
            if schedules:
                print(f"\nFound {len(schedules)} schedule(s) with failures:\n")
                for schedule in schedules:
                    print(f"ID: {schedule.id}")
                    print(f"  User: {schedule.user_id}")
                    print(f"  Type: {schedule.schedule_type}")
                    print(f"  Failures: {schedule.consecutive_failures}")
                    print(f"  Enabled: {schedule.enabled}")
                    print(f"  Last run: {schedule.last_run}")
                    print()
                
                # Ask to reset all
                response = input("Reset all failure counts? (y/N): ")
                if response.lower() == 'y':
                    for schedule in schedules:
                        schedule.consecutive_failures = 0
                    db.commit()
                    print(f"\n✓ Reset {len(schedules)} schedules")
            else:
                print("No schedules with failures found")
                
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        schedule_id = int(sys.argv[1])
        reset_schedule_failures(schedule_id)
    else:
        reset_schedule_failures()