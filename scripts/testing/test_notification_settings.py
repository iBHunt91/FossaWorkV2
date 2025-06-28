#!/usr/bin/env python3
"""Test notification settings API endpoints"""

import requests
import json

# API base URL
BASE_URL = "http://localhost:8000"

# Test user ID
USER_ID = "8ef6a734a1b1afeada6d9b6128b54664"

def test_get_notification_preferences():
    """Test getting notification preferences"""
    print("\n1. Testing GET notification preferences...")
    try:
        response = requests.get(f"{BASE_URL}/api/notifications/preferences")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_get_smtp_settings():
    """Test getting SMTP settings"""
    print("\n2. Testing GET SMTP settings...")
    try:
        response = requests.get(f"{BASE_URL}/api/settings/smtp/{USER_ID}")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_update_notification_preferences():
    """Test updating notification preferences"""
    print("\n3. Testing UPDATE notification preferences...")
    
    test_preferences = {
        "email_enabled": True,
        "pushover_enabled": True,
        "pushover_user_key": "test_key_123",
        "pushover_device": "",
        "pushover_sound": "pushover",
        "automation_started": "both",
        "automation_completed": "both",
        "automation_failed": "both"
    }
    
    try:
        response = requests.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=test_preferences
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    print("Testing Notification Settings API Endpoints")
    print("=" * 50)
    
    # Run tests
    tests = [
        ("Get Notification Preferences", test_get_notification_preferences),
        ("Get SMTP Settings", test_get_smtp_settings),
        ("Update Notification Preferences", test_update_notification_preferences),
    ]
    
    results = []
    for test_name, test_func in tests:
        success = test_func()
        results.append((test_name, success))
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY:")
    print("=" * 50)
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name}: {status}")

if __name__ == "__main__":
    main()