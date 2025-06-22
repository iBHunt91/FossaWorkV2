#!/usr/bin/env python3
"""
Test the scraping history API endpoints including delete functionality
"""

import requests
import json
from datetime import datetime
import time


BASE_URL = "http://localhost:8000"
USERNAME = "test_user"
PASSWORD = "test_password"  # Update with actual test credentials


def login():
    """Login and get access token"""
    print("Logging in...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": USERNAME, "password": PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data["data"]["access_token"]
        print("✅ Login successful")
        return token
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None


def get_headers(token):
    """Get headers with authorization"""
    return {"Authorization": f"Bearer {token}"}


def test_get_history(token):
    """Test getting scraping history"""
    print("\n📋 Testing GET scraping history...")
    
    response = requests.get(
        f"{BASE_URL}/api/scraping-schedules/history/work_orders",
        headers=get_headers(token)
    )
    
    if response.status_code == 200:
        history = response.json()
        print(f"✅ Found {len(history)} history records")
        
        for idx, record in enumerate(history[:3]):  # Show first 3
            print(f"\nRecord {idx + 1}:")
            print(f"  ID: {record['id']}")
            print(f"  Started: {record['started_at']}")
            print(f"  Success: {record['success']}")
            print(f"  Items: {record['items_processed']}")
            print(f"  Trigger: {record.get('trigger_type', 'N/A')}")
            if record.get('error_message'):
                print(f"  Error: {record['error_message']}")
        
        return history
    else:
        print(f"❌ Failed to get history: {response.status_code} - {response.text}")
        return []


def test_trigger_manual_scrape(token):
    """Test triggering a manual scrape"""
    print("\n🚀 Testing manual scrape trigger...")
    
    response = requests.post(
        f"{BASE_URL}/api/scraping-schedules/trigger",
        headers=get_headers(token),
        json={
            "schedule_type": "work_orders",
            "ignore_schedule": True
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Manual scrape triggered: {result['message']}")
        return True
    else:
        print(f"❌ Failed to trigger scrape: {response.status_code} - {response.text}")
        return False


def test_delete_single_history(token, history_id):
    """Test deleting a single history record"""
    print(f"\n🗑️  Testing DELETE single history record (ID: {history_id})...")
    
    response = requests.delete(
        f"{BASE_URL}/api/scraping-schedules/history/{history_id}",
        headers=get_headers(token)
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Deleted history record: {result['message']}")
        return True
    else:
        print(f"❌ Failed to delete history: {response.status_code} - {response.text}")
        return False


def test_delete_all_history(token):
    """Test deleting all history records"""
    print("\n🗑️  Testing DELETE all history records...")
    
    # First check how many records exist
    history = test_get_history(token)
    if not history:
        print("No history records to delete")
        return False
    
    print(f"\n⚠️  About to delete {len(history)} history records")
    response = input("Continue? (y/n): ")
    
    if response.lower() != 'y':
        print("Cancelled")
        return False
    
    response = requests.delete(
        f"{BASE_URL}/api/scraping-schedules/history",
        headers=get_headers(token)
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Deleted all history: {result['message']}")
        return True
    else:
        print(f"❌ Failed to delete all history: {response.status_code} - {response.text}")
        return False


def test_manual_vs_scheduled(token):
    """Test that manual scrapes are marked differently from scheduled ones"""
    print("\n🔍 Checking manual vs scheduled scrapes...")
    
    history = test_get_history(token)
    
    manual_count = sum(1 for h in history if h.get('trigger_type') == 'manual')
    scheduled_count = sum(1 for h in history if h.get('trigger_type') == 'scheduled')
    
    print(f"\n📊 History breakdown:")
    print(f"  Manual scrapes: {manual_count}")
    print(f"  Scheduled scrapes: {scheduled_count}")
    print(f"  Total: {len(history)}")


def main():
    """Run all tests"""
    print("=" * 60)
    print("🧪 SCRAPING HISTORY API TEST")
    print("=" * 60)
    
    # Login
    token = login()
    if not token:
        print("Cannot proceed without authentication")
        return
    
    # Test 1: Get current history
    history = test_get_history(token)
    
    # Test 2: Check manual vs scheduled
    test_manual_vs_scheduled(token)
    
    # Test 3: Delete a single record (if any exist)
    if history:
        print("\n" + "=" * 40)
        print("Testing single record deletion...")
        test_delete_single_history(token, history[0]['id'])
        
        # Verify it was deleted
        print("\nVerifying deletion...")
        test_get_history(token)
    
    # Test 4: Trigger a manual scrape
    print("\n" + "=" * 40)
    response = input("Trigger a manual scrape? (y/n): ")
    if response.lower() == 'y':
        if test_trigger_manual_scrape(token):
            print("\nWaiting 5 seconds for scrape to complete...")
            time.sleep(5)
            
            # Check history again
            print("\nChecking for new manual scrape record...")
            test_get_history(token)
            test_manual_vs_scheduled(token)
    
    # Test 5: Delete all history (optional)
    print("\n" + "=" * 40)
    response = input("Test delete ALL history? (y/n): ")
    if response.lower() == 'y':
        test_delete_all_history(token)
        
        # Verify all deleted
        print("\nVerifying all deleted...")
        test_get_history(token)
    
    print("\n✅ All tests completed!")


if __name__ == "__main__":
    main()