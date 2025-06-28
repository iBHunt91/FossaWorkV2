#!/usr/bin/env python3
"""
Manually create a scraping schedule in the database
This is a workaround until the backend server is restarted
"""

import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def create_schedule_for_bruce():
    """Create an hourly scraping schedule for Bruce"""
    
    print("📅 Creating Hourly Scraping Schedule")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        user_id = "7bea3bdb7e8e303eacaba442bd824004"  # Bruce's user ID
        
        # Check if schedule already exists
        existing = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if existing:
            print(f"❌ Schedule already exists for user")
            print(f"   - Schedule ID: {existing.id}")
            print(f"   - Interval: {existing.interval_hours} hours")
            print(f"   - Enabled: {existing.enabled}")
            
            # Update it to ensure it's enabled
            existing.enabled = True
            existing.interval_hours = 1.0
            existing.active_hours = {"start": 6, "end": 22}
            existing.updated_at = datetime.utcnow()
            db.commit()
            print(f"\n✅ Updated existing schedule to be enabled with 1 hour interval")
        else:
            # Create new schedule
            schedule = ScrapingSchedule(
                user_id=user_id,
                schedule_type="work_orders",
                interval_hours=1.0,
                active_hours={"start": 6, "end": 22},
                enabled=True,
                next_run=None
            )
            
            db.add(schedule)
            db.commit()
            
            print(f"✅ Schedule created successfully!")
            print(f"   - User ID: {user_id}")
            print(f"   - Type: work_orders")
            print(f"   - Interval: 1 hour")
            print(f"   - Active hours: 6 AM - 10 PM")
            print(f"   - Status: Enabled")
        
        print(f"\n📌 Note: This is just a database entry.")
        print(f"   The actual scheduling won't work until:")
        print(f"   1. The backend server is restarted")
        print(f"   2. APScheduler dependencies are installed")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_schedule_for_bruce()