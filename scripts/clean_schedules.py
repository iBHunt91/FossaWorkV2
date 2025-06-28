#!/usr/bin/env python3
"""
Clean up existing schedules to test fresh
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def clean_schedules():
    """Remove all schedules from database"""
    
    print("🧹 Cleaning schedules from database")
    
    db = SessionLocal()
    try:
        # Count existing schedules
        count = db.query(ScrapingSchedule).count()
        print(f"Found {count} schedules")
        
        if count > 0:
            # Delete all schedules
            db.query(ScrapingSchedule).delete()
            db.commit()
            print(f"✅ Deleted {count} schedules")
        else:
            print("✅ No schedules to delete")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_schedules()