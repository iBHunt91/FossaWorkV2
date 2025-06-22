#!/usr/bin/env python3
"""
Test all endpoints required by the Settings page
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_settings_endpoints():
    """Test all Settings page endpoints"""
    
    print("🔍 Testing Settings Page Endpoints")
    print("=" * 60)
    
    # First, login to get a token
    print("\n1. Authenticating...")
    import os
    login_data = {
        "username": os.getenv("TEST_USERNAME", "test@example.com"),
        "password": os.getenv("TEST_PASSWORD", "test_password")
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
            return
            
        auth_data = response.json()
        token = auth_data.get("access_token")
        user_id = auth_data.get("user", {}).get("id")
        print(f"✅ Authenticated as user: {user_id}")
        
        # Set up headers
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test all settings endpoints
        endpoints = [
            ("GET", f"/api/notifications/preferences", "Notification Preferences"),
            ("GET", f"/api/settings/smtp/{user_id}", "SMTP Settings"),
            ("GET", f"/api/settings/filters/{user_id}", "Work Order Filters"),
            ("GET", f"/api/settings/automation-delays/{user_id}", "Automation Delays"),
            ("GET", f"/api/settings/provers/{user_id}", "Prover Settings"),
            ("GET", f"/api/settings/browser/{user_id}", "Browser Settings"),
            ("GET", f"/api/settings/notification-display/{user_id}", "Notification Display"),
            ("GET", f"/api/settings/schedule/{user_id}", "Schedule Settings"),
        ]
        
        print("\n2. Testing Settings Endpoints:")
        all_passed = True
        
        for method, endpoint, name in endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
                
                if response.status_code == 200:
                    print(f"   ✅ {name}: {response.status_code}")
                    data = response.json()
                    if "settings" in data:
                        print(f"      - Has settings: {len(data['settings'])} fields")
                    elif "preferences" in data:
                        print(f"      - Has preferences: {len(data['preferences'])} fields")
                else:
                    print(f"   ❌ {name}: {response.status_code}")
                    print(f"      - Error: {response.text[:100]}...")
                    all_passed = False
                    
            except Exception as e:
                print(f"   ❌ {name}: Exception - {str(e)}")
                all_passed = False
        
        print("\n3. Summary:")
        if all_passed:
            print("   ✅ All Settings page endpoints are working!")
            print("   The Settings page should now load without errors.")
        else:
            print("   ⚠️  Some endpoints are still failing.")
            print("   Check the errors above and fix the remaining issues.")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_settings_endpoints()