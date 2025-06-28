#!/usr/bin/env python3
"""
Trace the update process manually
"""

import sys
from pathlib import Path
from datetime import datetime
import asyncio

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
# from app.services.scheduler_service import scheduler_service

async def trace_update():
    print("🔍 Tracing Update Process")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Current state
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        print("Before update:")
        print(f"  Active Hours: {schedule.active_hours}")
        print()
        
        # Try to update directly
        print("Updating database directly to None...")
        schedule.active_hours = None
        schedule.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(schedule)
        
        print("After database update:")
        print(f"  Active Hours: {schedule.active_hours}")
        print(f"  Is None: {schedule.active_hours is None}")
        print()
        
        # Skip scheduler service check for now
        print("(Skipping scheduler service check)")
        
        # Re-query to confirm
        print("\nRe-querying database...")
        db2 = SessionLocal()
        schedule2 = db2.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        print(f"Final database state:")
        print(f"  Active Hours: {schedule2.active_hours}")
        print(f"  Is None: {schedule2.active_hours is None}")
        
        db2.close()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(trace_update())