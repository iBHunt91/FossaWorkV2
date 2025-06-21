#!/usr/bin/env python3
"""
Debug schedule creation issue directly
"""

import sys
from pathlib import Path
import traceback

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.models.user_models import User
from datetime import datetime

def test_direct_schedule_creation():
    """Test creating a schedule directly in the database"""
    
    print("🔍 Testing Direct Schedule Creation")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get test user
        user_id = "7bea3bdb7e8e303eacaba442bd824004"  # Bruce's user ID
        
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        print(f"\n1. User lookup:")
        print(f"   - User ID: {user_id}")
        print(f"   - User found: {user is not None}")
        if user:
            print(f"   - Email: {user.email}")
        
        # Check existing schedules
        existing = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        print(f"\n2. Existing schedule check:")
        print(f"   - Existing schedule found: {existing is not None}")
        
        if existing:
            print(f"   - Schedule ID: {existing.id}")
            print(f"   - Enabled: {existing.enabled}")
            print(f"   - Interval: {existing.interval_hours} hours")
            return
        
        # Try to create a new schedule
        print(f"\n3. Creating new schedule...")
        
        schedule = ScrapingSchedule(
            user_id=user_id,
            schedule_type="work_orders",
            interval_hours=1.0,
            active_hours={"start": 6, "end": 22},
            enabled=True,
            next_run=None
        )
        
        print(f"   - Created schedule object")
        
        db.add(schedule)
        print(f"   - Added to session")
        
        db.commit()
        print(f"   - Committed to database")
        
        # Verify it was created
        created = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        print(f"\n4. Verification:")
        print(f"   - Schedule created: {created is not None}")
        if created:
            print(f"   - Schedule ID: {created.id}")
            print(f"   - User ID: {created.user_id}")
            print(f"   - Type: {created.schedule_type}")
            print(f"   - Enabled: {created.enabled}")
        
    except Exception as e:
        print(f"\n❌ Error occurred: {type(e).__name__}: {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

def main():
    """Run the test"""
    try:
        test_direct_schedule_creation()
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()