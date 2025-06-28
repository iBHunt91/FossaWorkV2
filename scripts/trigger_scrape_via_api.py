#!/usr/bin/env python3
"""
Trigger work order scraping through the API
This ensures we use the scheduler instance that's part of the FastAPI app
"""

import requests
import json
import sys
from datetime import datetime
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

# API configuration
API_BASE_URL = "http://localhost:8000"

def get_auth_token():
    """Get authentication token from stored credentials"""
    # Try to read from the test credentials file
    cred_file = Path(__file__).parent.parent / "data" / "test_credentials.json"
    
    if cred_file.exists():
        with open(cred_file, 'r') as f:
            creds = json.load(f)
            return creds.get('token')
    
    # Fallback: prompt for credentials
    print("No stored credentials found. Please provide login details:")
    username = input("Username: ")
    password = input("Password: ")
    
    # Login to get token
    response = requests.post(
        f"{API_BASE_URL}/api/auth/login",
        json={"username": username, "password": password}
    )
    
    if response.status_code == 200:
        data = response.json()
        return data.get('access_token')
    else:
        print(f"Login failed: {response.text}")
        return None

def trigger_scrape(token: str):
    """Trigger the scraping through API"""
    print("\n" + "="*80)
    print("🚀 TRIGGERING WORK ORDER SCRAPE VIA API")
    print("="*80)
    print(f"Time: {datetime.now()}")
    print("="*80)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Trigger the scrape
    print("\n📡 Sending API request to trigger scrape...")
    
    response = requests.post(
        f"{API_BASE_URL}/api/scraping-schedules/trigger",
        headers=headers,
        json={
            "schedule_type": "work_orders",
            "ignore_schedule": True
        }
    )
    
    print(f"\n📥 Response Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ Scraping triggered successfully!")
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check scraping progress
        print("\n📊 To monitor progress:")
        print("1. Check the Work Orders page in the UI")
        print("2. View logs at /logs/backend/")
        print("3. Check scheduler logs for execution details")
        
        return True
    else:
        print(f"\n❌ Failed to trigger scraping")
        print(f"Error: {response.text}")
        return False

def check_schedules(token: str):
    """Check current schedules via API"""
    print("\n📅 CHECKING CURRENT SCHEDULES:")
    print("-"*40)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(
        f"{API_BASE_URL}/api/scraping-schedules/",
        headers=headers
    )
    
    if response.status_code == 200:
        schedules = response.json()
        
        if schedules:
            for schedule in schedules:
                print(f"\nSchedule: {schedule['job_id']}")
                print(f"  Enabled: {schedule.get('enabled', False)}")
                print(f"  Next Run: {schedule.get('next_run', 'Not scheduled')}")
                print(f"  Interval: {schedule.get('interval_hours', 'N/A')} hours")
                
                # Check if overdue
                if schedule.get('next_run'):
                    next_run = datetime.fromisoformat(schedule['next_run'].replace('Z', '+00:00'))
                    now = datetime.now(next_run.tzinfo)
                    if next_run < now:
                        overdue_mins = (now - next_run).total_seconds() / 60
                        print(f"  ⚠️  OVERDUE by {overdue_mins:.1f} minutes!")
        else:
            print("No schedules found")
    else:
        print(f"Failed to get schedules: {response.text}")

def main():
    """Main function"""
    # Get authentication token
    token = get_auth_token()
    
    if not token:
        print("❌ Failed to authenticate")
        return
    
    print("\n✅ Authentication successful")
    
    # Check current schedules
    check_schedules(token)
    
    # Ask user to confirm
    print("\n" + "="*80)
    response = input("\n🔧 Trigger immediate work order scraping? (y/n): ")
    
    if response.lower() == 'y':
        success = trigger_scrape(token)
        
        if success:
            print("\n✅ Scraping job has been triggered!")
            print("\n💡 NEXT STEPS:")
            print("1. Monitor the Work Orders page for progress")
            print("2. Check /logs/backend/ for detailed execution logs")
            print("3. The scraping should complete within a few minutes")
    else:
        print("\n❌ Scraping cancelled")

if __name__ == "__main__":
    main()