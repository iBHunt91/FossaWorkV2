#!/usr/bin/env python3
"""
Monitor scraping history to see if manual runs are executing
"""
import sys
import os
import time
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker
from app.models.scraping_models import ScrapingHistory, ScrapingSchedule
from app.database import DATABASE_URL

# Create database connection
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def monitor_history(duration_seconds=120):
    """Monitor scraping history for new entries"""
    start_time = datetime.now()
    last_check = datetime.now() - timedelta(minutes=5)  # Look back 5 minutes
    
    print("📊 Monitoring Scraping History")
    print("=" * 80)
    print(f"Started at: {start_time}")
    print(f"Looking for entries after: {last_check}")
    print(f"Will monitor for: {duration_seconds} seconds")
    print("=" * 80)
    
    seen_ids = set()
    
    while (datetime.now() - start_time).total_seconds() < duration_seconds:
        db = SessionLocal()
        try:
            # Get recent history entries
            histories = db.query(ScrapingHistory).filter(
                ScrapingHistory.started_at > last_check
            ).order_by(desc(ScrapingHistory.started_at)).limit(10).all()
            
            for history in histories:
                if history.id not in seen_ids:
                    seen_ids.add(history.id)
                    
                    # Get schedule info
                    schedule = db.query(ScrapingSchedule).filter_by(
                        user_id=history.user_id,
                        schedule_type=history.schedule_type
                    ).first()
                    
                    print(f"\n🆕 NEW SCRAPING ACTIVITY DETECTED!")
                    print(f"   ID: {history.id}")
                    print(f"   User: {history.user_id[:8]}...")
                    print(f"   Type: {history.schedule_type}")
                    print(f"   Trigger: {history.trigger_type}")
                    print(f"   Started: {history.started_at}")
                    print(f"   Completed: {history.completed_at}")
                    print(f"   Success: {history.success}")
                    print(f"   Items: {history.items_processed}")
                    print(f"   Duration: {history.duration_seconds}s")
                    if history.error_message:
                        print(f"   Error: {history.error_message}")
                    if schedule:
                        print(f"   Schedule ID: {schedule.id}")
                        print(f"   Next Run: {schedule.next_run}")
                    print("-" * 80)
            
            # Show current schedules state
            schedules = db.query(ScrapingSchedule).filter_by(enabled=True).all()
            status_line = "📅 Schedules: "
            for sched in schedules:
                next_run_str = sched.next_run.strftime("%H:%M:%S") if sched.next_run else "None"
                status_line += f"[{sched.id}: next={next_run_str}] "
            
            print(f"\r{status_line}", end="", flush=True)
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
        finally:
            db.close()
        
        time.sleep(5)  # Check every 5 seconds
    
    print(f"\n\n✅ Monitoring complete after {duration_seconds} seconds")

if __name__ == "__main__":
    # Monitor for 2 minutes
    monitor_history(120)