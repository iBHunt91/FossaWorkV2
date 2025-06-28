#!/usr/bin/env python3
"""
Check recent scraping history to diagnose failures around 3:30 PM
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy import desc

sys.path.append(str(Path(__file__).parent.parent))

# Set environment
os.environ['SECRET_KEY'] = "Am7t7lXtMeZQJ48uYGgh2L0Uy7OzBnvEfGaqoXKPzcw"

from app.database import SessionLocal
from app.models.scraping_models import ScrapingHistory, ScrapingSchedule

def main():
    print("\n" + "="*80)
    print("🔍 CHECKING RECENT SCRAPING FAILURES")
    print("="*80)
    
    db = SessionLocal()
    try:
        # Get recent scraping history (last 24 hours)
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        
        recent_history = db.query(ScrapingHistory).filter(
            ScrapingHistory.started_at > cutoff_time
        ).order_by(desc(ScrapingHistory.started_at)).all()
        
        print(f"\n📊 Found {len(recent_history)} scraping attempts in the last 24 hours")
        
        # Group by success/failure
        failures = [h for h in recent_history if not h.success]
        successes = [h for h in recent_history if h.success]
        
        print(f"✅ Successful: {len(successes)}")
        print(f"❌ Failed: {len(failures)}")
        
        if failures:
            print("\n🚨 RECENT FAILURES:")
            print("-" * 80)
            
            for i, failure in enumerate(failures[:10], 1):  # Show last 10 failures
                duration = None
                if failure.completed_at and failure.started_at:
                    duration = (failure.completed_at - failure.started_at).total_seconds()
                
                print(f"\n{i}. Failed at: {failure.started_at}")
                print(f"   Duration: {duration:.1f}s" if duration else "   Duration: Unknown")
                print(f"   Items processed: {failure.items_processed or 0}")
                print(f"   Error message: {failure.error_message or 'No error message'}")
                print(f"   User ID: {failure.user_id}")
                
                # Look for patterns in error messages
                if failure.error_message:
                    error_lower = failure.error_message.lower()
                    if "timeout" in error_lower:
                        print("   ⚠️  TIMEOUT ERROR DETECTED")
                    elif "login" in error_lower:
                        print("   ⚠️  LOGIN ERROR DETECTED")
                    elif "navigation" in error_lower:
                        print("   ⚠️  NAVIGATION ERROR DETECTED")
                    elif "element" in error_lower or "selector" in error_lower:
                        print("   ⚠️  ELEMENT/SELECTOR ERROR DETECTED")
        
        # Check for failures around 3:30 PM (15:30)
        print("\n\n🕐 CHECKING FAILURES AROUND 3:30 PM:")
        print("-" * 80)
        
        # Convert to local time and check
        afternoon_failures = []
        for failure in failures:
            # Assuming UTC time, adjust if needed
            local_time = failure.started_at
            if 14 <= local_time.hour <= 17:  # 2 PM to 5 PM window
                afternoon_failures.append(failure)
        
        if afternoon_failures:
            print(f"Found {len(afternoon_failures)} failures between 2-5 PM:")
            for failure in afternoon_failures:
                print(f"\n   - {failure.started_at.strftime('%I:%M:%S %p')}")
                print(f"     Error: {failure.error_message or 'No error message'}")
        
        # Check schedule configuration
        print("\n\n📅 CHECKING SCHEDULE CONFIGURATION:")
        print("-" * 80)
        
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        for schedule in schedules:
            print(f"\nSchedule: {schedule.job_id}")
            print(f"  Type: {schedule.type}")
            print(f"  Interval: {schedule.interval_hours} hours")
            print(f"  Active hours: {schedule.active_hours}")
            print(f"  Last run: {schedule.last_run}")
            print(f"  Next run: {schedule.next_run}")
            
            # Check if schedule is overdue
            if schedule.next_run and schedule.next_run < datetime.utcnow():
                print(f"  ⚠️  SCHEDULE IS OVERDUE!")
        
    finally:
        db.close()
    
    print("\n" + "="*80)
    print("Diagnostics complete!")

if __name__ == "__main__":
    main()