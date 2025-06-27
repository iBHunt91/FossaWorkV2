#!/usr/bin/env python3
"""
Test creating a schedule with detailed error reporting
"""

import requests
import json

# Configuration
import os
BASE_URL = "http://localhost:8000"
USERNAME = os.getenv("TEST_USERNAME", "test@example.com")
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

def test_create_schedule(token):
    """Test creating a schedule with detailed output"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("\n📋 Testing schedule creation...")
    
    # Create request data
    create_data = {
        "schedule_type": "work_orders",
        "interval_hours": 1.0,
        "active_hours": {"start": 6, "end": 22},
        "enabled": True
    }
    
    print(f"\nRequest data:")
    print(json.dumps(create_data, indent=2))
    
    # Make request
    print(f"\nMaking POST request to {BASE_URL}/api/scraping-schedules/")
    response = requests.post(
        f"{BASE_URL}/api/scraping-schedules/", 
        headers=headers,
        json=create_data
    )
    
    print(f"\nResponse status: {response.status_code}")
    print(f"Response headers:")
    for key, value in response.headers.items():
        if key.lower() in ['content-type', 'content-length', 'server']:
            print(f"  {key}: {value}")
    
    print(f"\nResponse body:")
    try:
        # Try to parse as JSON
        data = response.json()
        print(json.dumps(data, indent=2))
    except:
        # If not JSON, print raw text
        print(response.text)
    
    # If we got a 500 error, check if there's more detail
    if response.status_code == 500:
        print("\n❌ Internal Server Error detected")
        print("This usually indicates:")
        print("  1. Missing dependencies (like APScheduler)")
        print("  2. Database connection issues")
        print("  3. Service initialization problems")

def main():
    """Run the test"""
    print("🧪 Detailed Schedule Creation Test")
    print("=" * 50)
    
    # Login
    token = login()
    if not token:
        print("❌ Cannot proceed without authentication")
        return
    
    # Test schedule creation
    test_create_schedule(token)

if __name__ == "__main__":
    main()