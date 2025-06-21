#!/usr/bin/env python3
"""
Clean up duplicate schedules in the database
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime
from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def clean_duplicates():
    print("🧹 Cleaning Duplicate Schedules")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get all schedules
        all_schedules = db.query(ScrapingSchedule).all()
        print(f"Total schedules found: {len(all_schedules)}")
        
        # Group by user_id and schedule_type
        schedule_groups = {}
        for schedule in all_schedules:
            key = (schedule.user_id, schedule.schedule_type)
            if key not in schedule_groups:
                schedule_groups[key] = []
            schedule_groups[key].append(schedule)
        
        # Find duplicates
        duplicates_removed = 0
        for key, schedules in schedule_groups.items():
            if len(schedules) > 1:
                user_id, schedule_type = key
                print(f"\n⚠️  Found {len(schedules)} schedules for user {user_id}, type {schedule_type}")
                
                # Keep the most recent one
                schedules.sort(key=lambda s: s.created_at or datetime.min, reverse=True)
                keep = schedules[0]
                print(f"   Keeping schedule created at: {keep.created_at}")
                
                # Delete the rest
                for schedule in schedules[1:]:
                    print(f"   Deleting duplicate created at: {schedule.created_at}")
                    db.delete(schedule)
                    duplicates_removed += 1
        
        if duplicates_removed > 0:
            db.commit()
            print(f"\n✅ Removed {duplicates_removed} duplicate schedules")
        else:
            print("\n✅ No duplicates found")
        
        # Show final count
        final_count = db.query(ScrapingSchedule).count()
        print(f"\nFinal schedule count: {final_count}")
        
        # Show all remaining schedules
        print("\n📋 Remaining schedules:")
        remaining = db.query(ScrapingSchedule).all()
        for schedule in remaining:
            print(f"   - User: {schedule.user_id[:8]}..., Type: {schedule.schedule_type}, "
                  f"Interval: {schedule.interval_hours}h, Enabled: {schedule.enabled}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_duplicates()