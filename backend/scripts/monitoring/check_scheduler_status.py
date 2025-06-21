#!/usr/bin/env python3
"""
Check scheduler status and next run times for scheduled jobs.
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import sqlite3


def check_scheduler_status():
    """Check scheduler job status in the database."""
    # Database path - default location
    db_path = Path(__file__).parent.parent / "fossawork_v2.db"
    
    print(f"\n📊 Checking scheduler status...")
    print(f"Database: {db_path}")
    print(f"Current time (UTC): {datetime.utcnow()}")
    print(f"Current time (Local): {datetime.now()}")
    
    if not db_path.exists():
        print("❌ Database file does not exist!")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Check if scheduler tables exist
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'apscheduler%'
    """)
    tables = cursor.fetchall()
    
    print(f"\n📋 APScheduler tables found: {[t[0] for t in tables]}")
    
    # Check scheduled jobs
    try:
        cursor.execute("""
            SELECT id, next_run_time, job_state 
            FROM apscheduler_jobs
            ORDER BY next_run_time
        """)
        jobs = cursor.fetchall()
        
        print(f"\n🕒 Scheduled jobs ({len(jobs)} total):")
        for job_id, next_run_time, job_state in jobs:
            # Convert timestamp to datetime
            if next_run_time:
                # APScheduler stores timestamps as floats (seconds since epoch)
                next_run_dt = datetime.fromtimestamp(next_run_time, tz=timezone.utc)
                local_time = next_run_dt.astimezone()
                print(f"\n  Job ID: {job_id}")
                print(f"  Next run (UTC): {next_run_dt}")
                print(f"  Next run (Local): {local_time}")
                print(f"  Time until run: {next_run_dt - datetime.now(timezone.utc)}")
            else:
                print(f"\n  Job ID: {job_id}")
                print(f"  Next run: Not scheduled")
    except sqlite3.OperationalError as e:
        print(f"❌ Error querying jobs table: {e}")
    
    # Check scraping schedules
    try:
        cursor.execute("""
            SELECT id, user_id, schedule_type, interval_hours, active_hours_start, 
                   active_hours_end, enabled, last_run, next_run
            FROM scraping_schedules
            WHERE enabled = 1
        """)
        schedules = cursor.fetchall()
        
        print(f"\n📅 Active scraping schedules ({len(schedules)} total):")
        for row in schedules:
            (id, user_id, schedule_type, interval_hours, active_start, 
             active_end, enabled, last_run, next_run) = row
            
            print(f"\n  Schedule ID: {id}")
            print(f"  User ID: {user_id}")
            print(f"  Type: {schedule_type}")
            print(f"  Interval: {interval_hours} hours")
            
            if active_start is not None and active_end is not None:
                print(f"  Active hours: {active_start}:00 - {active_end}:00")
            else:
                print(f"  Active hours: 24/7")
            
            if last_run:
                last_run_dt = datetime.fromisoformat(last_run.replace('Z', '+00:00'))
                print(f"  Last run: {last_run_dt}")
            else:
                print(f"  Last run: Never")
            
            if next_run:
                next_run_dt = datetime.fromisoformat(next_run.replace('Z', '+00:00'))
                local_next = next_run_dt.astimezone()
                print(f"  Next run (UTC): {next_run_dt}")
                print(f"  Next run (Local): {local_next}")
                print(f"  Time until run: {next_run_dt - datetime.now(timezone.utc)}")
            else:
                print(f"  Next run: Not calculated")
                
    except sqlite3.OperationalError as e:
        print(f"❌ Error querying scraping_schedules table: {e}")
    
    # Check for timezone issues
    print(f"\n🌍 Timezone Information:")
    print(f"  System timezone: {datetime.now().astimezone().tzinfo}")
    print(f"  UTC offset: {datetime.now().astimezone().strftime('%z')}")
    
    # Check if scheduler service is running
    print(f"\n🔄 Checking if scheduler service is active...")
    print(f"  Note: This script only checks the database state.")
    print(f"  To verify the scheduler service is running, check:")
    print(f"  1. Backend logs for 'Scheduler started' messages")
    print(f"  2. Process list for uvicorn/FastAPI backend")
    print(f"  3. API endpoint: GET /api/scraping-schedules/status")
    
    conn.close()


if __name__ == "__main__":
    check_scheduler_status()