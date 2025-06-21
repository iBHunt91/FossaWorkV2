#!/usr/bin/env python3
"""
Fix scheduler to run at the top of the hour instead of arbitrary times.
This will reschedule the job to run at :00 minutes past each hour.
"""

import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sqlite3

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def fix_scheduler_timing():
    """Update the scheduler to run at the top of each hour."""
    db_path = Path(__file__).parent.parent / "fossawork_v2.db"
    
    print(f"\n🔧 Fixing scheduler timing...")
    print(f"Database: {db_path}")
    print(f"Current time: {datetime.now()}")
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get current job info
    cursor.execute("""
        SELECT id, next_run_time, job_state 
        FROM apscheduler_jobs
        WHERE id LIKE 'work_order_scrape_%'
    """)
    
    jobs = cursor.fetchall()
    
    for job_id, current_next_run, job_state in jobs:
        if current_next_run:
            # Convert to datetime
            current_dt = datetime.fromtimestamp(current_next_run, tz=timezone.utc)
            print(f"\n📍 Job: {job_id}")
            print(f"   Current next run: {current_dt}")
            
            # Calculate next top of hour
            now = datetime.now(timezone.utc)
            next_hour = now.replace(minute=0, second=0, microsecond=0)
            
            # If we're past the minute 0, go to next hour
            if now.minute > 0:
                next_hour += timedelta(hours=1)
            
            # Make sure it's at least 5 minutes in the future to avoid immediate execution
            if (next_hour - now).total_seconds() < 300:  # Less than 5 minutes
                next_hour += timedelta(hours=1)
            
            new_timestamp = next_hour.timestamp()
            
            print(f"   New next run: {next_hour}")
            print(f"   Time until run: {next_hour - now}")
            
            # Update the job's next_run_time
            cursor.execute("""
                UPDATE apscheduler_jobs 
                SET next_run_time = ? 
                WHERE id = ?
            """, (new_timestamp, job_id))
            
            print(f"   ✅ Updated to run at top of hour")
    
    # Also update the scraping_schedules table
    cursor.execute("""
        UPDATE scraping_schedules 
        SET next_run = ? 
        WHERE schedule_type = 'work_orders' AND enabled = 1
    """, (next_hour.isoformat(),))
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Scheduler fixed! Jobs will now run at the top of each hour.")
    print(f"Next run scheduled for: {next_hour.astimezone()}")
    
    # Remind about restarting the service
    print(f"\n⚠️  IMPORTANT: You need to restart the backend service for changes to take effect!")
    print(f"   Stop the backend (Ctrl+C) and start it again with:")
    print(f"   cd backend && uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    fix_scheduler_timing()