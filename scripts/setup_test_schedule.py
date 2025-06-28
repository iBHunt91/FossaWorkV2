#!/usr/bin/env python3
"""
Setup Test Schedule - Creates a test schedule for timezone verification
"""

import httpx
import json

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "jcrenshaw@fossaltd.com"
PASSWORD = "J78r2@6pL"

def main():
    print("🔧 Setting up test schedule...")
    
    with httpx.Client(timeout=10.0) as client:
        # Login
        login_data = {"username": USERNAME, "password": PASSWORD}
        resp = client.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if resp.status_code != 200:
            print(f"❌ Login failed: {resp.text}")
            return False
        
        token = resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Logged in")
        
        # Check if schedule already exists
        resp = client.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
        if resp.status_code == 200 and resp.json():
            print("✅ Schedule already exists")
            return True
        
        # Create schedule
        schedule_data = {
            "schedule_type": "work_orders",
            "interval_hours": 2.0,
            "enabled": True
        }
        
        resp = client.post(f"{BASE_URL}/api/scraping-schedules/", 
                          headers=headers, json=schedule_data)
        if resp.status_code != 200:
            print(f"❌ Failed to create schedule: {resp.text}")
            return False
        
        print("✅ Test schedule created successfully")
        return True

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 Ready for timezone testing!")
        print("Now run: python scripts/live_user_test.py")
    else:
        print("\n❌ Setup failed")