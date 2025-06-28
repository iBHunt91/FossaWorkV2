#!/usr/bin/env python3
"""
Check database structure and scheduled tasks configuration.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
import json


def check_database_schedules():
    """Check database structure and scheduled tasks."""
    db_path = Path(__file__).parent.parent / "fossawork_v2.db"
    
    print(f"\n📊 Checking database schedules...")
    print(f"Database: {db_path}")
    print(f"Current time (Local): {datetime.now()}")
    print(f"Current time (UTC): {datetime.now(timezone.utc)}")
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get table structure
    print("\n📋 Table: scraping_schedules")
    cursor.execute("PRAGMA table_info(scraping_schedules)")
    columns = cursor.fetchall()
    print("Columns:")
    for col in columns:
        print(f"  - {col[1]} ({col[2]})")
    
    # Get all schedules
    print("\n📅 All scraping schedules:")
    cursor.execute("""
        SELECT * FROM scraping_schedules
        ORDER BY created_at DESC
    """)
    
    # Get column names
    col_names = [description[0] for description in cursor.description]
    schedules = cursor.fetchall()
    
    for schedule in schedules:
        print("\n" + "="*60)
        for i, col_name in enumerate(col_names):
            value = schedule[i]
            if col_name == 'schedule_config' and value:
                try:
                    value = json.dumps(json.loads(value), indent=2)
                except:
                    pass
            print(f"{col_name}: {value}")
    
    # Check APScheduler job details
    print("\n\n📋 APScheduler job details:")
    cursor.execute("""
        SELECT id, next_run_time, job_state 
        FROM apscheduler_jobs
    """)
    
    jobs = cursor.fetchall()
    for job_id, next_run_time, job_state_blob in jobs:
        print(f"\nJob ID: {job_id}")
        if next_run_time:
            next_run_dt = datetime.fromtimestamp(next_run_time, tz=timezone.utc)
            local_time = next_run_dt.astimezone()
            print(f"Next run (UTC): {next_run_dt}")
            print(f"Next run (Local): {local_time}")
        
        # Try to decode job state
        if job_state_blob:
            print(f"Job state size: {len(job_state_blob)} bytes")
            # APScheduler stores job state as pickled data, which is binary
            # We can't easily decode it without the proper APScheduler context
    
    conn.close()


if __name__ == "__main__":
    check_database_schedules()