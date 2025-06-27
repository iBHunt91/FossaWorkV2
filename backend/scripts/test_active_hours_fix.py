#!/usr/bin/env python3
"""
Test script to verify active hours scheduling fix
"""
import asyncio
import sys
import os
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.scheduler_service import scheduler_service

async def test_active_hours_fix():
    """Test that active hours are properly respected in scheduling"""
    
    print("=" * 60)
    print("Testing Active Hours Fix")
    print("=" * 60)
    
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
        print(f"   Current next_run: {schedule.next_run}")
        
        # Check if active hours are set
        if schedule.active_hours:
            active_start = schedule.active_hours.get('start', 0)
            active_end = schedule.active_hours.get('end', 24)
            print(f"\n📅 Active hours: {active_start}:00 - {active_end}:00")
            
            # Calculate expected hours based on interval
            expected_hours = []
            current_hour = active_start
            while current_hour < active_end:
                expected_hours.append(current_hour)
                current_hour += int(schedule.interval_hours)
            
            print(f"   Expected run hours: {expected_hours}")
            
            # Check if next_run is within active hours
            if schedule.next_run:
                next_run_hour = schedule.next_run.hour
                if active_start <= next_run_hour < active_end:
                    print(f"✅ Next run at {next_run_hour}:30 is within active hours")
                else:
                    print(f"❌ Next run at {next_run_hour}:30 is OUTSIDE active hours!")
                    print(f"   This is the bug - scheduler is ignoring active hours restriction")
        else:
            print("\n⚠️  No active hours restriction - runs 24/7")
            
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("To fix this issue, the scheduler needs to be restarted")
    print("or the schedule needs to be updated via the UI")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_active_hours_fix())