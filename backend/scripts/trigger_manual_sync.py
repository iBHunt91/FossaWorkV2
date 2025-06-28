#!/usr/bin/env python3
"""
Manually trigger a sync to test browser visibility
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
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "bruce.hunt@owlservices.com",
        "password": "Arl1ngt0n!"
    })
    
    if response.status_code == 200:
        data = response.json()
        TOKEN = data["access_token"]
        print("✓ Login successful")
        return True
    else:
        print(f"✗ Login failed: {response.status_code} - {response.text}")
        return False

def trigger_sync():
    """Trigger manual sync"""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    # Get schedules first
    response = requests.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
    
    if response.status_code == 200:
        schedules = response.json()
        if schedules:
            schedule_id = schedules[0]['id']
            print(f"✓ Found schedule {schedule_id}")
            
            # Trigger manual run
            response = requests.post(
                f"{BASE_URL}/api/scraping-schedules/{schedule_id}/run", 
                headers=headers
            )
            
            if response.status_code == 200:
                print("✓ Manual sync triggered!")
                print("🔍 Watch for browser window if 'Show browser during sync' is enabled")
                print("⏰ The scheduler will pick up the job within 60 seconds")
            else:
                print(f"✗ Failed to trigger sync: {response.status_code} - {response.text}")
        else:
            print("✗ No schedules found")
    else:
        print(f"✗ Failed to get schedules: {response.status_code} - {response.text}")

def main():
    print("Triggering Manual Sync")
    print("=" * 50)
    
    # Login
    if not login():
        return
    
    # Trigger sync
    trigger_sync()
    
    print("\nDone! Check scheduler_daemon.log for execution details.")

if __name__ == "__main__":
    main()