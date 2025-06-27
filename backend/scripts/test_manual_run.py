#!/usr/bin/env python3
"""
Test manual run functionality by updating next_run in database
"""
import sys
import os
from datetime import datetime, timezone

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.scraping_models import ScrapingSchedule
from app.database import DATABASE_URL

# Create database connection
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def trigger_manual_run(schedule_id: int):
    """Set next_run to current time to trigger manual run"""
    db = SessionLocal()
    try:
        # Get the schedule
        schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
        if not schedule:
            print(f"❌ Schedule {schedule_id} not found")
            return False
            
        # Get current state
        print(f"\n📊 Current Schedule {schedule_id} state:")
        print(f"   Enabled: {schedule.enabled}")
        print(f"   Last Run: {schedule.last_run}")
        print(f"   Next Run: {schedule.next_run}")
        print(f"   Interval: {schedule.interval_hours} hours")
        
        # Set next_run to current time to trigger manual run
        current_time = datetime.now(timezone.utc)
        schedule.next_run = current_time
        db.commit()
        
        print(f"\n✅ Manual run triggered!")
        print(f"   Next Run set to: {schedule.next_run}")
        print(f"\n⏳ The scheduler daemon should pick this up within 60 seconds...")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Testing Manual Run Functionality")
    print("=" * 50)
    
    # Trigger manual run for schedule 1
    if trigger_manual_run(1):
        print("\n✅ Manual run triggered successfully!")
        print("📋 Check the daemon logs to verify execution")
        print("🔍 You can also check the scraping history in the database")
    else:
        print("\n❌ Failed to trigger manual run")