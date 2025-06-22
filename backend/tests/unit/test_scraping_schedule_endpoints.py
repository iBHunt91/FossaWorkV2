#!/usr/bin/env python3
"""
Test the scraping schedule endpoints
"""

import requests
import json
from datetime import datetime

# Configuration
import os
BASE_URL = os.getenv("TEST_API_URL", "http://localhost:8000")
USERNAME = os.getenv("TEST_USERNAME", "test_user")
PASSWORD = os.getenv("TEST_PASSWORD", "test_password")

def login():
    """Login and get auth token"""
    print("🔐 Logging in...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": USERNAME, "password": PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Login successful")
        return data.get("access_token")
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def test_scraping_schedules(token):
    """Test scraping schedule endpoints"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n📋 Testing scraping schedule endpoints...")
    
    # Test 1: Get existing schedules
    print("\n1. GET /api/scraping-schedules/")
    response = requests.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        schedules = response.json()
        print(f"✅ Found {len(schedules)} schedules")
        for schedule in schedules:
            print(f"  - Job ID: {schedule.get('job_id')}")
            print(f"    Type: {schedule.get('type')}")
            print(f"    Enabled: {schedule.get('enabled')}")
            print(f"    Next run: {schedule.get('next_run')}")
    else:
        print(f"❌ Error: {response.text}")
    
    # Test 2: Create a new schedule
    print("\n2. POST /api/scraping-schedules/")
    create_data = {
        "schedule_type": "work_orders",
        "interval_hours": 1.0,
        "active_hours": {"start": 6, "end": 22},
        "enabled": True
    }
    response = requests.post(
        f"{BASE_URL}/api/scraping-schedules/", 
        headers=headers,
        json=create_data
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Schedule created successfully")
        print(f"   Job ID: {data.get('job_id')}")
        return data.get('job_id')
    else:
        print(f"❌ Error: {response.text}")
        # If schedule already exists, get it
        if response.status_code == 400 and "already exists" in response.text:
            print("   Schedule already exists, fetching existing schedule...")
            response = requests.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
            if response.status_code == 200:
                schedules = response.json()
                for schedule in schedules:
                    if schedule.get('type') == 'work_orders':
                        return schedule.get('job_id')
    
    # Test 3: Get scraping history
    print("\n3. GET /api/scraping-schedules/history/work_orders")
    response = requests.get(
        f"{BASE_URL}/api/scraping-schedules/history/work_orders",
        headers=headers
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        history = response.json()
        print(f"✅ Found {len(history)} history entries")
        for entry in history[:3]:  # Show first 3
            print(f"  - Started: {entry.get('started_at')}")
            print(f"    Success: {entry.get('success')}")
            print(f"    Items: {entry.get('items_processed')}")
    else:
        print(f"❌ Error: {response.text}")
    
    # Test 4: Trigger manual scrape
    print("\n4. POST /api/scraping-schedules/trigger")
    trigger_data = {
        "schedule_type": "work_orders",
        "ignore_schedule": True
    }
    response = requests.post(
        f"{BASE_URL}/api/scraping-schedules/trigger",
        headers=headers,
        json=trigger_data
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {data.get('message')}")
    else:
        print(f"❌ Error: {response.text}")

def main():
    """Run all tests"""
    print("🧪 Testing Scraping Schedule Endpoints")
    print("=" * 50)
    
    # Login
    token = login()
    if not token:
        print("❌ Cannot proceed without authentication")
        return
    
    # Test scraping schedules
    test_scraping_schedules(token)
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    main()