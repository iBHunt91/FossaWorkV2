#!/usr/bin/env python3
"""Monitor scheduler status in real-time"""

import time
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory

def clear_screen():
    """Clear the terminal screen"""
    print("\033[2J\033[H", end="")

def monitor_scheduler():
    """Monitor scheduler status"""
    
    while True:
        clear_screen()
        
        print("="*80)
        print(f"🔍 SCHEDULER MONITOR - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)
        print(f"Current UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}")
        print("Press Ctrl+C to exit")
        print("="*80)
        
        db = SessionLocal()
        try:
            # Get schedules
            schedules = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.enabled == True
            ).all()
            
            print("\n📅 ACTIVE SCHEDULES:")
            print("-"*60)
            
            for schedule in schedules:
                print(f"\nUser: {schedule.user_id[:8]}...")
                print(f"  Interval: Every {schedule.interval_hours} hour(s)")
                
                if schedule.active_hours:
                    print(f"  Active: {schedule.active_hours['start']}:00 - {schedule.active_hours['end']}:00")
                else:
                    print(f"  Active: 24/7")
                
                # Next run status
                if schedule.next_run:
                    next_run_utc = schedule.next_run.replace(tzinfo=timezone.utc) if schedule.next_run.tzinfo is None else schedule.next_run
                    time_diff = (next_run_utc - datetime.now(timezone.utc)).total_seconds()
                    
                    if time_diff < 0:
                        print(f"  Next Run: ⚠️  OVERDUE by {abs(time_diff)/60:.1f} minutes!")
                    elif time_diff < 60:
                        print(f"  Next Run: 🔴 In {time_diff:.0f} seconds!")
                    elif time_diff < 300:
                        print(f"  Next Run: 🟡 In {time_diff/60:.1f} minutes")
                    else:
                        print(f"  Next Run: 🟢 {schedule.next_run.strftime('%H:%M:%S')} ({time_diff/60:.0f} min)")
                
                # Last run status
                if schedule.last_run:
                    last_run_utc = schedule.last_run.replace(tzinfo=timezone.utc) if schedule.last_run.tzinfo is None else schedule.last_run
                    time_since = (datetime.now(timezone.utc) - last_run_utc).total_seconds()
                    print(f"  Last Run: {schedule.last_run.strftime('%H:%M:%S')} ({time_since/60:.0f} min ago)")
                else:
                    print(f"  Last Run: Never")
            
            # Recent history
            print("\n📜 RECENT RUNS (Last 3):")
            print("-"*60)
            
            history = db.query(ScrapingHistory).order_by(
                ScrapingHistory.started_at.desc()
            ).limit(3).all()
            
            for h in history:
                started_utc = h.started_at.replace(tzinfo=timezone.utc) if h.started_at.tzinfo is None else h.started_at
                time_ago = (datetime.now(timezone.utc) - started_utc).total_seconds() / 60
                
                status = "✅" if h.success else "❌"
                print(f"\n{status} {h.started_at.strftime('%H:%M:%S')} ({time_ago:.0f} min ago)")
                print(f"   User: {h.user_id[:8]}...")
                print(f"   Items: {h.items_processed} | Duration: {(h.completed_at - h.started_at).total_seconds():.1f}s")
                
        finally:
            db.close()
        
        # Wait 5 seconds before refresh
        time.sleep(5)

if __name__ == "__main__":
    try:
        monitor_scheduler()
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped.")