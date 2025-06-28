#!/usr/bin/env python3
"""
Reset failure count for all schedules
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def reset_all_schedule_failures():
    """Reset consecutive failures for all schedules"""
    
    db = SessionLocal()
    try:
        # Get all schedules
        schedules = db.query(ScrapingSchedule).all()
        
        print(f"Found {len(schedules)} schedules")
        
        for schedule in schedules:
            old_failures = schedule.consecutive_failures
            schedule.consecutive_failures = 0
            print(f"Schedule {schedule.id}: Reset failures from {old_failures} to 0")
        
        db.commit()
        print("\n✅ All schedule failures have been reset!")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_all_schedule_failures()