#!/usr/bin/env python3
"""
Test script to verify schedule time display fixes
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from datetime import datetime, timezone

# Configuration
BASE_URL = "http://localhost:8000"
TOKEN = None  # Will be set after login

def login():
    """Login and get JWT token"""
    global TOKEN
    
    # Hardcoded test credentials - replace with actual if needed
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "bruce.hunt@owlservices.com",
        "password": "Arl1ngt0n!"  # Replace with actual password
    })
    
    if response.status_code == 200:
        data = response.json()
        TOKEN = data["access_token"]
        print("✓ Login successful")
        return True
    else:
        print(f"✗ Login failed: {response.status_code} - {response.text}")
        return False

def get_schedules():
    """Get scraping schedules and check time format"""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    response = requests.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
    
    if response.status_code == 200:
        schedules = response.json()
        print(f"\n✓ Found {len(schedules)} schedule(s)\n")
        
        for schedule in schedules:
            print(f"Schedule {schedule['id']}:")
            print(f"  Enabled: {schedule['enabled']}")
            print(f"  Interval: {schedule['interval_hours']} hours")
            print(f"  Last Run: {schedule['last_run']}")
            print(f"  Next Run: {schedule['next_run']}")
            print(f"  Status: {schedule['status']}")
            
            # Check if times have UTC suffix
            if schedule['next_run']:
                if schedule['next_run'].endswith('Z'):
                    print("  ✓ Next run has UTC suffix")
                else:
                    print("  ✗ Next run missing UTC suffix!")
                    
                # Calculate time difference
                try:
                    next_run_time = datetime.fromisoformat(schedule['next_run'].replace('Z', '+00:00'))
                    now = datetime.now(timezone.utc)
                    diff = next_run_time - now
                    hours = diff.total_seconds() / 3600
                    minutes = (diff.total_seconds() % 3600) / 60
                    print(f"  Time until next run: {int(hours)}h {int(minutes)}m")
                except Exception as e:
                    print(f"  Error parsing time: {e}")
            
            print()
    else:
        print(f"✗ Failed to get schedules: {response.status_code} - {response.text}")

def get_history(schedule_id):
    """Get schedule history to check time formats"""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    response = requests.get(
        f"{BASE_URL}/api/scraping-schedules/{schedule_id}/history?limit=3", 
        headers=headers
    )
    
    if response.status_code == 200:
        history = response.json()
        print(f"\nHistory for schedule {schedule_id} ({len(history)} entries):")
        
        for entry in history:
            print(f"\n  Entry {entry['id']}:")
            print(f"    Started: {entry['started_at']}")
            print(f"    Completed: {entry['completed_at']}")
            
            # Check UTC suffix
            if entry['started_at'].endswith('Z'):
                print("    ✓ Started time has UTC suffix")
            else:
                print("    ✗ Started time missing UTC suffix!")

def main():
    print("Testing Schedule Time Display Fix")
    print("=" * 50)
    
    # Login
    if not login():
        return
    
    # Get schedules
    get_schedules()
    
    # Get history for first schedule
    headers = {"Authorization": f"Bearer {TOKEN}"}
    response = requests.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
    if response.status_code == 200:
        schedules = response.json()
        if schedules:
            get_history(schedules[0]['id'])

if __name__ == "__main__":
    main()