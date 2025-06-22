#!/usr/bin/env python3
"""
Create a test schedule to see what date formats are returned.
"""

import requests
import json
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# API configuration
BASE_URL = "http://localhost:8000"
AUTH_USERNAME = os.getenv("TEST_USERNAME", "test@example.com")
AUTH_PASSWORD = os.getenv("TEST_PASSWORD", "test_password")

def get_auth_token():
    """Get authentication token from the API."""
    try:
        login_data = {
            "username": AUTH_USERNAME,
            "password": AUTH_PASSWORD
        }
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        
        if login_response.status_code == 200:
            token_data = login_response.json()
            return token_data.get("access_token")
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return None
    except Exception as e:
        print(f"❌ Failed to get auth token: {e}")
        return None

def main():
    """Create a test schedule."""
    print("🔧 Creating Test Schedule")
    print("=" * 60)
    
    # Get authentication token
    print("\n🔐 Getting authentication token...")
    token = get_auth_token()
    
    if not token:
        print("❌ Failed to authenticate. Exiting.")
        return
    
    print("✅ Authentication successful")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # Create a schedule
    print("\n📍 Creating a work_orders schedule...")
    
    schedule_data = {
        "schedule_type": "work_orders",
        "interval_hours": 1.0,
        "enabled": True,
        "active_hours": {
            "start": 8,
            "end": 17
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/scraping-schedules/",
            headers=headers,
            json=schedule_data
        )
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n✅ Schedule created successfully!")
            print(json.dumps(data, indent=2))
            
            # Now fetch the schedules to see date format
            print("\n📍 Fetching schedules to check date format...")
            
            get_response = requests.get(
                f"{BASE_URL}/api/scraping-schedules/",
                headers=headers
            )
            
            if get_response.status_code == 200:
                schedules = get_response.json()
                print("\n📋 Schedules:")
                print(json.dumps(schedules, indent=2))
                
                if schedules:
                    for schedule in schedules:
                        print(f"\n🔍 Analyzing schedule: {schedule.get('job_id')}")
                        for field in ['next_run', 'last_run']:
                            if field in schedule and schedule[field]:
                                print(f"  {field}: {schedule[field]}")
                                print(f"  {field} type: {type(schedule[field])}")
                                print(f"  {field} ends with Z: {schedule[field].endswith('Z')}")
                                
                                # Try to parse it
                                try:
                                    # Try parsing with Z suffix
                                    parsed = datetime.fromisoformat(schedule[field].replace('Z', '+00:00'))
                                    print(f"  ✅ Successfully parsed as ISO format with Z")
                                except:
                                    try:
                                        # Try without Z
                                        parsed = datetime.fromisoformat(schedule[field])
                                        print(f"  ✅ Successfully parsed as ISO format without Z")
                                    except Exception as e:
                                        print(f"  ❌ Failed to parse: {e}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()