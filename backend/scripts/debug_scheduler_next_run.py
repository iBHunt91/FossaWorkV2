#!/usr/bin/env python3
"""Debug scheduler next run time issue"""

import sqlite3
from datetime import datetime, timezone, timedelta
import json
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.scheduler_service import scheduler_service
from app.database import get_connection_string

def check_database_state():
    """Check current database state"""
    conn = sqlite3.connect('fossawork_v2.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("=== DATABASE STATE ===")
    
    # Check scraping schedules
    cursor.execute('''
        SELECT id, user_id, schedule_type, interval_hours, active_hours,
               enabled, last_run, next_run, consecutive_failures
        FROM scraping_schedules
        WHERE enabled = 1
        ORDER BY id DESC
    ''')
    
    schedules = cursor.fetchall()
    now = datetime.now(timezone.utc)
    
    for row in schedules:
        print(f"\nSchedule ID: {row['id']}")
        print(f"  User: {row['user_id']}")
        print(f"  Type: {row['schedule_type']}")
        print(f"  Interval: {row['interval_hours']} hours")
        
        if row['active_hours']:
            active = json.loads(row['active_hours'])
            print(f"  Active Hours: {active}")
        
        if row['next_run']:
            try:
                if 'Z' in row['next_run']:
                    next_run = datetime.fromisoformat(row['next_run'].replace('Z', '+00:00'))
                else:
                    next_run = datetime.fromisoformat(row['next_run']).replace(tzinfo=timezone.utc)
                print(f"  Next Run: {next_run}")
                diff = (next_run - now).total_seconds()
                if diff < 0:
                    print(f"  STATUS: OVERDUE by {abs(diff)/60:.1f} minutes!")
                else:
                    print(f"  STATUS: In {diff/60:.1f} minutes")
            except Exception as e:
                print(f"  Next Run: {row['next_run']} (parse error: {e})")
        
        if row['last_run']:
            try:
                if 'Z' in row['last_run']:
                    last_run = datetime.fromisoformat(row['last_run'].replace('Z', '+00:00'))
                else:
                    last_run = datetime.fromisoformat(row['last_run']).replace(tzinfo=timezone.utc)
                print(f"  Last Run: {last_run}")
                print(f"  Time since: {(now - last_run).total_seconds()/60:.1f} minutes")
            except Exception as e:
                print(f"  Last Run: {row['last_run']} (parse error: {e})")
    
    # Check recent history
    print("\n\n=== RECENT SCRAPING HISTORY ===")
    cursor.execute('''
        SELECT user_id, started_at, completed_at, success, items_processed, error_message
        FROM scraping_history
        WHERE started_at > datetime('now', '-2 hours')
        ORDER BY started_at DESC
        LIMIT 10
    ''')
    
    history = cursor.fetchall()
    for row in history:
        started = datetime.fromisoformat(row['started_at']).replace(tzinfo=timezone.utc)
        print(f"\n{started} - User: {row['user_id'][:8]}...")
        print(f"  Success: {row['success']}, Items: {row['items_processed']}")
        if row['error_message']:
            print(f"  Error: {row['error_message']}")
    
    conn.close()

async def check_scheduler_state():
    """Check current scheduler state"""
    print("\n\n=== SCHEDULER SERVICE STATE ===")
    
    if not scheduler_service:
        print("ERROR: Scheduler service not loaded!")
        return
    
    print(f"Initialized: {scheduler_service.is_initialized}")
    
    if scheduler_service.is_initialized:
        print(f"Active Jobs: {len(scheduler_service.active_jobs)}")
        
        if hasattr(scheduler_service, 'scheduler') and scheduler_service.scheduler:
            print(f"Scheduler Running: {scheduler_service.scheduler.running}")
            print(f"Scheduler State: {scheduler_service.scheduler.state}")
            
            # Get all jobs
            jobs = scheduler_service.scheduler.get_jobs()
            print(f"\nTotal Jobs in Scheduler: {len(jobs)}")
            
            now = datetime.now(timezone.utc)
            for job in jobs:
                print(f"\nJob: {job.id}")
                print(f"  Name: {job.name}")
                print(f"  Trigger: {job.trigger}")
                print(f"  Next Run: {job.next_run_time}")
                if job.next_run_time:
                    diff = (job.next_run_time - now).total_seconds()
                    if diff < 0:
                        print(f"  STATUS: OVERDUE by {abs(diff)/60:.1f} minutes!")
                        print(f"  SHOULD HAVE RUN AT: {job.next_run_time}")
                    else:
                        print(f"  STATUS: Will run in {diff/60:.1f} minutes")
                print(f"  Pending: {job.pending}")
                print(f"  Coalesce: {job.coalesce}")
                print(f"  Misfire Grace Time: {job.misfire_grace_time}")

async def fix_next_run_times():
    """Update next_run times in database to match scheduler"""
    print("\n\n=== FIXING NEXT_RUN TIMES ===")
    
    if not scheduler_service or not hasattr(scheduler_service, 'scheduler'):
        print("ERROR: No scheduler available!")
        return
    
    conn = sqlite3.connect('fossawork_v2.db')
    cursor = conn.cursor()
    
    # Get all jobs from scheduler
    jobs = scheduler_service.scheduler.get_jobs()
    
    for job in jobs:
        if job.id.startswith('work_order_scrape_'):
            user_id = job.id.replace('work_order_scrape_', '')
            
            if job.next_run_time:
                next_run_str = job.next_run_time.isoformat()
                print(f"\nUpdating schedule for user {user_id[:8]}...")
                print(f"  Next run: {next_run_str}")
                
                cursor.execute('''
                    UPDATE scraping_schedules
                    SET next_run = ?
                    WHERE user_id = ? AND schedule_type = 'work_orders'
                ''', (next_run_str, user_id))
                
                print(f"  Updated {cursor.rowcount} rows")
    
    conn.commit()
    conn.close()
    print("\nDatabase updated successfully!")

async def trigger_overdue_jobs():
    """Force trigger any severely overdue jobs"""
    print("\n\n=== CHECKING FOR OVERDUE JOBS TO TRIGGER ===")
    
    if not scheduler_service or not hasattr(scheduler_service, 'scheduler'):
        print("ERROR: No scheduler available!")
        return
    
    jobs = scheduler_service.scheduler.get_jobs()
    now = datetime.now(timezone.utc)
    
    for job in jobs:
        if job.next_run_time:
            diff = (now - job.next_run_time).total_seconds()
            if diff > 600:  # More than 10 minutes overdue
                print(f"\nJob {job.id} is {diff/60:.1f} minutes overdue!")
                print(f"Would you like to trigger it manually? (y/n): ", end='')
                
                # For automated script, we'll skip manual input
                print("n (automated)")
                # If you want to trigger: job.modify(next_run_time=datetime.now(timezone.utc))

async def main():
    """Main debug function"""
    print(f"Current UTC time: {datetime.now(timezone.utc)}")
    print(f"Current local time: {datetime.now()}")
    
    # Check database state
    check_database_state()
    
    # Initialize scheduler if needed
    if scheduler_service and not scheduler_service.is_initialized:
        print("\n\nInitializing scheduler service...")
        await scheduler_service.initialize(get_connection_string())
    
    # Check scheduler state
    await check_scheduler_state()
    
    # Fix next run times
    await fix_next_run_times()
    
    # Check for overdue jobs
    await trigger_overdue_jobs()

if __name__ == "__main__":
    asyncio.run(main())