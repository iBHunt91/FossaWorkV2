#!/usr/bin/env python3
"""
Check the scraping status endpoint to see what date values are being returned.
This helps debug date formatting issues in the scraping status API.
"""

import requests
import json
from datetime import datetime
import sys
import os
import base64

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# API configuration
BASE_URL = "http://localhost:8000"
USER_ID = "7bea3bdb7e8e303eacaba442bd824004"

# Authentication - using basic auth for testing
AUTH_USERNAME = "brucehunt"  # Replace with actual username
AUTH_PASSWORD = "admin"      # Replace with actual password

def check_date_validity(date_string):
    """Check if a date string is valid and parseable."""
    if not date_string:
        return False, "Empty or None"
    
    # Try common date formats
    formats = [
        "%Y-%m-%dT%H:%M:%S.%f",  # ISO with microseconds
        "%Y-%m-%dT%H:%M:%S",      # ISO without microseconds
        "%Y-%m-%d %H:%M:%S.%f",   # Space separator with microseconds
        "%Y-%m-%d %H:%M:%S",      # Space separator without microseconds
    ]
    
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_string, fmt)
            return True, f"Valid ({fmt})"
        except ValueError:
            continue
    
    return False, "Invalid format"

def get_auth_token():
    """Get authentication token from the API."""
    try:
        # First, try to login
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
    """Check the scraping status endpoint."""
    print("🔍 Checking Scraping Schedules Endpoints")
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
    
    # First, get all schedules
    print("\n📍 Checking GET /api/scraping-schedules/")
    try:
        response = requests.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
        
        # Print raw response
        print("\n📥 Raw Response:")
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print("\n📄 Raw Content:")
        print(response.text)
        
        if response.status_code == 200:
            try:
                data = response.json()
                
                print("\n📊 Parsed JSON:")
                print(json.dumps(data, indent=2))
                
                # Check date fields
                print("\n📅 Date Field Analysis:")
                date_fields = ['last_run', 'next_run', 'created_at', 'updated_at']
                
                for field in date_fields:
                    if field in data:
                        value = data[field]
                        is_valid, status = check_date_validity(value)
                        emoji = "✅" if is_valid else "❌"
                        print(f"{emoji} {field}: {value} - {status}")
                    else:
                        print(f"⚠️  {field}: Not present in response")
                
                # Check if it's an array of schedules
                if isinstance(data, list):
                    print(f"\n📋 Found {len(data)} schedules")
                    for i, schedule in enumerate(data):
                        print(f"\n--- Schedule {i + 1} ---")
                        print(f"Job ID: {schedule.get('job_id', 'N/A')}")
                        print(f"Type: {schedule.get('type', 'N/A')}")
                        print(f"Enabled: {schedule.get('enabled', 'N/A')}")
                        print(f"Interval Hours: {schedule.get('interval_hours', 'N/A')}")
                        print(f"Active Hours: {schedule.get('active_hours', 'N/A')}")
                        
                        # Check date fields
                        for field in ['next_run', 'last_run']:
                            if field in schedule:
                                value = schedule[field]
                                is_valid, status = check_date_validity(value)
                                emoji = "✅" if is_valid else "❌"
                                print(f"{emoji} {field}: {value} - {status}")
                        
                        # If we have a job_id, get specific schedule details
                        if schedule.get('job_id'):
                            print(f"\n📍 Getting specific schedule: {schedule['job_id']}")
                            try:
                                detail_response = requests.get(
                                    f"{BASE_URL}/api/scraping-schedules/{schedule['job_id']}", 
                                    headers=headers
                                )
                                if detail_response.status_code == 200:
                                    detail_data = detail_response.json()
                                    print(f"✅ Got schedule details")
                                    for field in ['next_run', 'last_run']:
                                        if field in detail_data:
                                            value = detail_data[field]
                                            is_valid, status = check_date_validity(value)
                                            emoji = "✅" if is_valid else "❌"
                                            print(f"  {emoji} Detail {field}: {value} - {status}")
                                else:
                                    print(f"❌ Failed to get schedule details: {detail_response.status_code}")
                            except Exception as e:
                                print(f"❌ Error getting schedule details: {e}")
                
            except json.JSONDecodeError as e:
                print(f"\n❌ Failed to parse JSON: {e}")
                print("Response might not be valid JSON")
        else:
            print(f"\n❌ Request failed with status {response.status_code}")
            if response.text:
                print(f"Error response: {response.text}")
    
    except requests.ConnectionError:
        print("\n❌ Failed to connect to the API")
        print("Make sure the backend server is running on port 8000")
    except Exception as e:
        print(f"\n❌ Unexpected error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    main()