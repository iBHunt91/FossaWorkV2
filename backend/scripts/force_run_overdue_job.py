#!/usr/bin/env python3
"""
Force run any overdue scheduled jobs
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal, engine
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service, execute_work_order_scraping
from app.services.logging_service import get_logger

logger = get_logger("scheduler.force_run")

async def force_run_overdue_jobs():
    print("🔍 Checking for Overdue Jobs")
    print("=" * 50)
    
    # Initialize scheduler if needed
    if not scheduler_service.is_initialized:
        print("Initializing scheduler...")
        database_url = f"sqlite:///{engine.url.database}"
        await scheduler_service.initialize(database_url)
    
    # Check database for overdue schedules
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        overdue_schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True,
            ScrapingSchedule.next_run < now
        ).all()
        
        print(f"Found {len(overdue_schedules)} overdue schedules")
        
        for schedule in overdue_schedules:
            time_overdue = now - schedule.next_run
            print(f"\n📋 Schedule for user {schedule.user_id}:")
            print(f"   Type: {schedule.schedule_type}")
            print(f"   Next run was: {schedule.next_run}")
            print(f"   Overdue by: {time_overdue}")
            print(f"   Last run: {schedule.last_run}")
            
            if schedule.schedule_type == "work_orders":
                print(f"\n🚀 Forcing immediate execution...")
                try:
                    # Run the job directly
                    await execute_work_order_scraping(schedule.user_id)
                    print("✅ Job executed successfully!")
                    
                    # Update next run time
                    schedule.next_run = now + timedelta(hours=schedule.interval_hours)
                    schedule.last_run = now
                    db.commit()
                    print(f"   Next run updated to: {schedule.next_run}")
                    
                except Exception as e:
                    print(f"❌ Error executing job: {e}")
                    logger.error(f"Failed to force run job for user {schedule.user_id}", exc_info=True)
        
        if not overdue_schedules:
            print("\n✅ No overdue schedules found")
            
            # Show current schedules
            all_schedules = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.enabled == True
            ).all()
            
            if all_schedules:
                print("\nCurrent schedules:")
                for schedule in all_schedules:
                    print(f"- User {schedule.user_id}: Next run at {schedule.next_run}")
                    
    finally:
        db.close()
    
    # Shutdown scheduler
    if scheduler_service.is_initialized:
        await scheduler_service.shutdown()

if __name__ == "__main__":
    asyncio.run(force_run_overdue_jobs())