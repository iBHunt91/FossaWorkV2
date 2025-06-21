#!/usr/bin/env python3
"""
Test the full update flow to find where active_hours gets reset
"""

import sys
from pathlib import Path
from datetime import datetime
import time

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def check_schedule_state(label):
    """Check and print the current schedule state"""
    db = SessionLocal()
    try:
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            print(f"{label}:")
            print(f"  Active Hours: {schedule.active_hours}")
            print(f"  Updated At: {schedule.updated_at}")
            return schedule.active_hours
    finally:
        db.close()

def update_schedule_like_api():
    """Update the schedule like the API would"""
    db = SessionLocal()
    try:
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            print("\nUpdating schedule (API-style)...")
            print(f"  Setting active_hours to None")
            schedule.active_hours = None
            schedule.interval_hours = 1.0
            schedule.enabled = True
            schedule.updated_at = datetime.utcnow()
            
            print(f"  Before commit: active_hours = {schedule.active_hours}")
            db.commit()
            print(f"  After commit: active_hours = {schedule.active_hours}")
            
            # Refresh from database
            db.refresh(schedule)
            print(f"  After refresh: active_hours = {schedule.active_hours}")
            
    finally:
        db.close()

def main():
    print("🔍 Testing Full Update Flow")
    print("=" * 50)
    
    # Check initial state
    initial_state = check_schedule_state("1. Initial state")
    print()
    
    # Update like the API would
    update_schedule_like_api()
    print()
    
    # Check immediately after
    check_schedule_state("2. Immediately after update")
    print()
    
    # Wait a bit and check again
    print("Waiting 2 seconds...")
    time.sleep(2)
    check_schedule_state("3. After 2 seconds")
    print()
    
    # One more check
    print("Waiting another 3 seconds...")
    time.sleep(3)
    final_state = check_schedule_state("4. Final state")
    
    print()
    print("=" * 50)
    if final_state is None:
        print("✅ Active hours remained None!")
    else:
        print(f"❌ Active hours changed back to: {final_state}")

if __name__ == "__main__":
    main()