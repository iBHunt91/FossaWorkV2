#!/usr/bin/env python3
"""
Test script to verify schedule next_run times are properly set
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime
import requests

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def test_schedule_next_run():
    print("🔍 Testing Schedule Next Run Times")
    print("=" * 50)
    
    # Test via API
    base_url = "http://localhost:8000"
    
    # Login first (you'll need to update these credentials)
    login_data = {
        "username": "test",  # Update with your test username
        "password": "test"   # Update with your test password
    }
    
    print("\n1️⃣ Logging in...")
    try:
        login_response = requests.post(f"{base_url}/api/auth/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful")
    except Exception as e:
        print(f"❌ Failed to connect to API: {e}")
        print("Make sure the backend is running on port 8000")
        return
    
    # Get schedules
    print("\n2️⃣ Fetching schedules...")
    try:
        schedules_response = requests.get(f"{base_url}/api/scraping-schedules/", headers=headers)
        if schedules_response.status_code != 200:
            print(f"❌ Failed to fetch schedules: {schedules_response.text}")
            return
        
        schedules = schedules_response.json()
        print(f"✅ Found {len(schedules)} schedules")
        
        for schedule in schedules:
            print(f"\n📋 Schedule: {schedule['job_id']}")
            print(f"   Type: {schedule['type']}")
            print(f"   Enabled: {schedule['enabled']}")
            print(f"   Next Run: {schedule.get('next_run', 'NOT SET')}")
            print(f"   Interval: {schedule.get('interval_hours', 'N/A')} hours")
            print(f"   Active Hours: {schedule.get('active_hours', 'N/A')}")
            
            if not schedule.get('next_run'):
                print("   ⚠️  WARNING: No next_run time set!")
    except Exception as e:
        print(f"❌ Error fetching schedules: {e}")
        return
    
    # Test update
    if schedules:
        print("\n3️⃣ Testing schedule update...")
        schedule = schedules[0]
        update_data = {
            "enabled": schedule['enabled'],
            "interval_hours": schedule.get('interval_hours', 1),
            "active_hours": schedule.get('active_hours')
        }
        
        try:
            update_response = requests.put(
                f"{base_url}/api/scraping-schedules/{schedule['job_id']}", 
                json=update_data,
                headers=headers
            )
            
            if update_response.status_code == 200:
                print("✅ Schedule updated successfully")
                
                # Fetch again to check next_run
                schedules_response = requests.get(f"{base_url}/api/scraping-schedules/", headers=headers)
                if schedules_response.status_code == 200:
                    updated_schedules = schedules_response.json()
                    for s in updated_schedules:
                        if s['job_id'] == schedule['job_id']:
                            print(f"\n📋 Updated Schedule:")
                            print(f"   Next Run: {s.get('next_run', 'NOT SET')}")
                            if s.get('next_run'):
                                print("   ✅ Next run time is now set!")
                            else:
                                print("   ❌ Next run time is still missing!")
            else:
                print(f"❌ Update failed: {update_response.text}")
        except Exception as e:
            print(f"❌ Error updating schedule: {e}")
    
    print("\n✅ Test complete")

if __name__ == "__main__":
    asyncio.run(test_schedule_next_run())