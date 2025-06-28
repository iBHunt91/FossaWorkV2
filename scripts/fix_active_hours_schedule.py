#!/usr/bin/env python3
"""
Script to fix the active hours scheduling issue by triggering a schedule update
"""
import asyncio
import sys
import os
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service

async def fix_active_hours_schedule():
    """Fix the active hours scheduling issue"""
    
    print("=" * 60)
    print("Fixing Active Hours Schedule")
    print("=" * 60)
    
    # Initialize the scheduler service
    # Use the same database URL as defined in database.py
    database_url = "sqlite:///./fossawork_v2.db"
    
    print("Initializing scheduler service...")
    await scheduler_service.initialize(database_url)
    
    # Get the current schedule from database
    db = SessionLocal()
    try:
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not schedule:
            print("❌ No schedule found in database")
            return
            
        print(f"✅ Found schedule for user: {schedule.user_id}")
        print(f"   Interval hours: {schedule.interval_hours}")
        print(f"   Active hours: {schedule.active_hours}")
        print(f"   Enabled: {schedule.enabled}")
        
        job_id = f"work_order_scrape_{schedule.user_id}"
        
        # Update the schedule to apply the fix
        print("\n🔧 Updating schedule to apply active hours fix...")
        
        success = await scheduler_service.update_schedule(
            job_id=job_id,
            interval_hours=schedule.interval_hours,
            active_hours=schedule.active_hours,
            enabled=schedule.enabled
        )
        
        if success:
            print("✅ Schedule updated successfully!")
            
            # Get the updated schedule status
            status = await scheduler_service.get_schedule_status(job_id)
            if status and status.get('next_run'):
                next_run = datetime.fromisoformat(status['next_run'].replace('Z', '+00:00'))
                next_run_hour = next_run.hour
                
                if schedule.active_hours:
                    active_start = schedule.active_hours.get('start', 0)
                    active_end = schedule.active_hours.get('end', 24)
                    
                    print(f"\n📅 Next run scheduled for: {next_run}")
                    print(f"   Hour: {next_run_hour}:30")
                    
                    if active_start <= next_run_hour < active_end:
                        print(f"✅ Next run is within active hours ({active_start}:00 - {active_end}:00)")
                    else:
                        print(f"❌ Next run is still outside active hours!")
        else:
            print("❌ Failed to update schedule")
            
    finally:
        db.close()
    
    # Shutdown scheduler
    await scheduler_service.shutdown()
    
    print("\n" + "=" * 60)
    print("Fix applied. Please restart the backend service for changes to take full effect.")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(fix_active_hours_schedule())