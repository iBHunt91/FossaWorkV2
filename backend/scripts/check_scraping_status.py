#!/usr/bin/env python3
"""
Check current scraping status and recent history
"""
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, desc, text
from sqlalchemy.orm import sessionmaker
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.database import DATABASE_URL

# Create database connection
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_status():
    """Check current scraping status"""
    db = SessionLocal()
    try:
        print("📊 Current Scraping Status")
        print("=" * 60)
        
        # Check schedules
        print("\n📅 Active Schedules:")
        schedules = db.query(ScrapingSchedule).filter_by(enabled=True).all()
        for schedule in schedules:
            print(f"\nSchedule {schedule.id}:")
            print(f"  User: {schedule.user_id[:8]}...")
            print(f"  Interval: {schedule.interval_hours} hours")
            print(f"  Last Run: {schedule.last_run}")
            print(f"  Next Run: {schedule.next_run}")
            print(f"  Failures: {schedule.consecutive_failures}")
            
            # Check if should run now
            if schedule.next_run and schedule.next_run <= datetime.utcnow():
                print(f"  🚨 SHOULD RUN NOW! (next_run is in the past)")
        
        # Check recent history
        print("\n📜 Recent Scraping History (last 10):")
        histories = db.query(ScrapingHistory).order_by(
            desc(ScrapingHistory.started_at)
        ).limit(10).all()
        
        for history in histories:
            status = "✅" if history.success else "❌"
            print(f"\n{status} History {history.id}:")
            print(f"  User: {history.user_id[:8]}...")
            print(f"  Started: {history.started_at}")
            print(f"  Completed: {history.completed_at}")
            print(f"  Success: {history.success}")
            print(f"  Items: {history.items_processed}")
            if history.error_message:
                print(f"  Error: {history.error_message[:100]}...")
        
        # Check daemon process
        print("\n🔄 Daemon Process:")
        import subprocess
        try:
            result = subprocess.run(['pgrep', '-f', 'scheduler_daemon'], 
                                  capture_output=True, text=True)
            if result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                print(f"  ✅ Running (PID: {', '.join(pids)})")
                
                # Check last log entries
                if os.path.exists('scheduler_daemon.log'):
                    with open('scheduler_daemon.log', 'r') as f:
                        lines = f.readlines()
                        recent_lines = lines[-5:] if len(lines) >= 5 else lines
                        print("\n  Recent log entries:")
                        for line in recent_lines:
                            print(f"    {line.strip()}")
            else:
                print("  ❌ Not running!")
        except Exception as e:
            print(f"  ⚠️  Could not check process: {e}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_status()