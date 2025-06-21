#!/usr/bin/env python3
"""Fix overdue schedules by updating next_run times"""

import sqlite3
from datetime import datetime, timezone, timedelta
import json

def calculate_next_run(interval_hours, active_hours, last_run=None):
    """Calculate the next run time based on interval and active hours"""
    now = datetime.now(timezone.utc)
    
    # If no last run, use current time as base
    base_time = last_run if last_run else now
    
    # Calculate next run based on interval
    next_run = base_time + timedelta(hours=interval_hours)
    
    # If we have active hours, adjust to next valid hour
    if active_hours and 'start' in active_hours and 'end' in active_hours:
        start_hour = active_hours['start']
        end_hour = active_hours['end']
        
        # Check if next_run is within active hours
        if next_run.hour < start_hour:
            # Before active hours, move to start hour
            next_run = next_run.replace(hour=start_hour, minute=30, second=0, microsecond=0)
        elif next_run.hour >= end_hour:
            # After active hours, move to next day's start hour
            next_run = next_run.replace(hour=start_hour, minute=30, second=0, microsecond=0)
            next_run += timedelta(days=1)
        else:
            # Within active hours, round to next :30
            next_run = next_run.replace(minute=30, second=0, microsecond=0)
    else:
        # No active hours, just round to next :30
        next_run = next_run.replace(minute=30, second=0, microsecond=0)
    
    # If calculated time is in the past, move to next valid slot
    while next_run <= now:
        next_run += timedelta(hours=interval_hours)
        
        # Recheck active hours if applicable
        if active_hours and 'start' in active_hours and 'end' in active_hours:
            if next_run.hour < start_hour or next_run.hour >= end_hour:
                # Outside active hours, move to next day's start
                next_run = next_run.replace(hour=start_hour, minute=30, second=0, microsecond=0)
                if next_run <= now:
                    next_run += timedelta(days=1)
    
    return next_run

def fix_schedules():
    """Fix all overdue schedules"""
    conn = sqlite3.connect('fossawork_v2.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("=== FIXING OVERDUE SCHEDULES ===")
    print(f"Current UTC time: {datetime.now(timezone.utc)}")
    
    # Get all enabled schedules
    cursor.execute('''
        SELECT id, user_id, schedule_type, interval_hours, active_hours,
               enabled, last_run, next_run
        FROM scraping_schedules
        WHERE enabled = 1
    ''')
    
    schedules = cursor.fetchall()
    now = datetime.now(timezone.utc)
    
    for row in schedules:
        print(f"\nSchedule ID: {row['id']} (User: {row['user_id'][:8]}...)")
        
        # Parse active hours
        active_hours = None
        if row['active_hours']:
            try:
                active_hours = json.loads(row['active_hours'])
            except:
                pass
        
        # Parse last run
        last_run = None
        if row['last_run']:
            try:
                if 'Z' in row['last_run']:
                    last_run = datetime.fromisoformat(row['last_run'].replace('Z', '+00:00'))
                else:
                    last_run = datetime.fromisoformat(row['last_run']).replace(tzinfo=timezone.utc)
            except:
                pass
        
        # Parse current next_run
        current_next_run = None
        if row['next_run']:
            try:
                if 'Z' in row['next_run']:
                    current_next_run = datetime.fromisoformat(row['next_run'].replace('Z', '+00:00'))
                else:
                    current_next_run = datetime.fromisoformat(row['next_run']).replace(tzinfo=timezone.utc)
            except:
                pass
        
        print(f"  Current next_run: {current_next_run}")
        print(f"  Last run: {last_run}")
        print(f"  Interval: {row['interval_hours']} hours")
        print(f"  Active hours: {active_hours}")
        
        # Check if overdue
        if current_next_run and current_next_run < now:
            overdue_mins = (now - current_next_run).total_seconds() / 60
            print(f"  STATUS: OVERDUE by {overdue_mins:.1f} minutes!")
            
            # Calculate new next_run
            new_next_run = calculate_next_run(row['interval_hours'], active_hours, last_run)
            print(f"  NEW next_run: {new_next_run}")
            
            # Update in database
            cursor.execute('''
                UPDATE scraping_schedules
                SET next_run = ?
                WHERE id = ?
            ''', (new_next_run.isoformat(), row['id']))
            
            print(f"  ✅ Updated!")
        else:
            print(f"  STATUS: OK (not overdue)")
    
    conn.commit()
    conn.close()
    print("\n=== DONE ===")

if __name__ == "__main__":
    fix_schedules()