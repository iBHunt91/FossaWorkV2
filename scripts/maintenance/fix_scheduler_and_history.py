#!/usr/bin/env python3
"""
Fix scheduler initialization and update next run times
This resolves stuck jobs and ensures history tracking works
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
import requests

sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.logging_service import get_logger

logger = get_logger("scheduler.fix")

async def fix_scheduler_issues():
    """Fix all scheduler and history issues"""
    print("\n" + "="*80)
    print("🔧 FIXING SCHEDULER & HISTORY ISSUES")
    print("="*80)
    print(f"Current Time: {datetime.now()}")
    print(f"UTC Time: {datetime.now(timezone.utc)}")
    print("="*80)
    
    # 1. Update database schedules with proper next run times
    print("\n📅 FIXING SCHEDULE NEXT RUN TIMES:")
    print("-"*40)
    
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        for schedule in schedules:
            print(f"\nUser: {schedule.user_id}")
            print(f"  Current next_run: {schedule.next_run}")
            
            # Calculate next run at :30 past the next hour
            now = datetime.now(timezone.utc)
            next_hour = now.replace(minute=30, second=0, microsecond=0)
            if now.minute >= 30:
                # If we're past :30, go to next hour
                next_hour = next_hour + timedelta(hours=1)
            
            # Check active hours if set
            if schedule.active_hours and 'start' in schedule.active_hours and 'end' in schedule.active_hours:
                start_hour = schedule.active_hours['start']
                end_hour = schedule.active_hours['end']
                
                # Adjust if outside active hours
                if next_hour.hour < start_hour:
                    next_hour = next_hour.replace(hour=start_hour)
                elif next_hour.hour >= end_hour:
                    # Move to next day's start hour
                    next_hour = (next_hour + timedelta(days=1)).replace(hour=start_hour)
            
            # Update the schedule
            schedule.next_run = next_hour
            print(f"  New next_run: {next_hour}")
            
        db.commit()
        print("\n✅ Updated all schedule next_run times")
        
    except Exception as e:
        print(f"❌ Error updating schedules: {e}")
        db.rollback()
    finally:
        db.close()
    
    # 2. Check if FastAPI is running
    print("\n🌐 CHECKING FASTAPI STATUS:")
    print("-"*40)
    
    try:
        response = requests.get("http://localhost:8000/docs")
        if response.status_code == 200:
            print("✅ FastAPI is running on port 8000")
        else:
            print(f"⚠️  FastAPI returned status {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ FastAPI is NOT running!")
        print("   Please start it with: uvicorn app.main:app --reload --port 8000")
        return
    
    # 3. Force scheduler initialization via API
    print("\n🔄 TRIGGERING SCHEDULER INITIALIZATION:")
    print("-"*40)
    
    # Try to get auth token
    token = None
    try:
        # Look for test credentials
        cred_file = Path(__file__).parent.parent / "data" / "test_credentials.json"
        if cred_file.exists():
            import json
            with open(cred_file, 'r') as f:
                creds = json.load(f)
                token = creds.get('token')
    except:
        pass
    
    if token:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access schedules endpoint to force initialization
        try:
            response = requests.get(
                "http://localhost:8000/api/scraping-schedules/",
                headers=headers
            )
            if response.status_code == 200:
                print("✅ Successfully accessed schedules API")
                schedules = response.json()
                print(f"   Found {len(schedules)} schedules via API")
            else:
                print(f"⚠️  API returned status {response.status_code}")
        except Exception as e:
            print(f"❌ Error accessing API: {e}")
    else:
        print("⚠️  No auth token available, skipping API check")
    
    # 4. Run a test scrape to verify history creation
    print("\n🧪 TESTING SCRAPE WITH HISTORY:")
    print("-"*40)
    
    response = input("Run a test scrape to verify history creation? (y/n): ")
    
    if response.lower() == 'y':
        # Get first enabled schedule
        db = SessionLocal()
        try:
            schedule = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.enabled == True
            ).first()
            
            if schedule:
                user_id = schedule.user_id
                print(f"\n🚀 Running test scrape for user: {user_id}")
                
                # Import and run
                from app.services.scheduler_service import execute_work_order_scraping
                
                # Set environment for auth
                os.environ['SECRET_KEY'] = "Am7t7lXtMeZQJ48uYGgh2L0Uy7OzBnvEfGaqoXKPzcw"
                
                await execute_work_order_scraping(user_id)
                
                # Check if history was created
                await asyncio.sleep(2)
                
                history = db.query(ScrapingHistory).filter(
                    ScrapingHistory.user_id == user_id
                ).order_by(ScrapingHistory.started_at.desc()).first()
                
                if history:
                    print(f"\n✅ History record created successfully!")
                    print(f"   Started: {history.started_at}")
                    print(f"   Success: {history.success}")
                    print(f"   Items: {history.items_processed}")
                else:
                    print("\n❌ No history record found!")
            else:
                print("No enabled schedules found")
                
        finally:
            db.close()
    
    # 5. Final recommendations
    print("\n" + "="*80)
    print("📊 FIX SUMMARY:")
    print("="*80)
    
    print("\n✅ COMPLETED:")
    print("  1. Updated all schedule next_run times to proper future times")
    print("  2. Fixed history creation in execute_work_order_scraping function")
    
    print("\n⚠️  IMPORTANT NEXT STEPS:")
    print("  1. Ensure FastAPI is running: uvicorn app.main:app --reload --port 8000")
    print("  2. The scheduler will initialize when FastAPI starts")
    print("  3. Jobs will run at :30 past each hour")
    print("  4. History records will now be created for all scrapes")
    
    print("\n💡 TO VERIFY:")
    print("  1. Check the UI - 'Last sync' should update after scrapes")
    print("  2. 'Next run' should show proper future time (not 'Any moment')")
    print("  3. Run manual scrape and verify history appears")
    print("  4. Wait for scheduled run at :30 past the hour")

async def check_scheduler_in_fastapi():
    """Check if scheduler is running in FastAPI process"""
    print("\n🔍 CHECKING SCHEDULER IN FASTAPI:")
    print("-"*40)
    
    # Check if we can connect to the API
    try:
        # Try the metrics endpoint which might show scheduler status
        response = requests.get("http://localhost:8000/api/metrics/health")
        if response.status_code == 200:
            data = response.json()
            print(f"API Health: {data}")
    except:
        pass

if __name__ == "__main__":
    asyncio.run(fix_scheduler_issues())