#!/usr/bin/env python3
"""
Test script to verify zero-user setup and authentication flow
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_zero_user_flow():
    print("🔍 Testing Zero-User Authentication Flow")
    print("=" * 50)
    
    # Step 1: Check setup status
    print("\n1. Checking setup status...")
    try:
        response = requests.get(f"{BASE_URL}/api/setup/status")
        data = response.json()
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if not data.get("setup_required"):
            print("   ⚠️  Users already exist in the system!")
            print("   Run tools\\reset-database.bat to reset")
            return
        
        print("   ✅ System is in zero-user state")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        print("   Make sure the server is running!")
        return
    
    # Step 2: Test authentication check (should fail)
    print("\n2. Testing authentication check (should fail)...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/check")
        print(f"   Status Code: {response.status_code}")
        if response.status_code == 401:
            print("   ✅ Correctly returns 401 Unauthorized")
        else:
            print("   ⚠️  Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Step 3: Try to access protected route (should fail)
    print("\n3. Testing protected route access (should fail)...")
    try:
        response = requests.get(f"{BASE_URL}/api/users/me")
        print(f"   Status Code: {response.status_code}")
        if response.status_code == 401:
            print("   ✅ Correctly returns 401 Unauthorized")
        else:
            print("   ⚠️  Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Step 4: Show initialization instructions
    print("\n4. To create first user with WorkFossa credentials:")
    print("   Option A - Using API docs (interactive):")
    print("      1. Open http://localhost:8000/docs")
    print("      2. Find /api/setup/initialize")
    print("      3. Click 'Try it out'")
    print("      4. Enter your WorkFossa credentials")
    print("      5. Click 'Execute'")
    print("\n   Option B - Using cURL:")
    print('      curl -X POST http://localhost:8000/api/setup/initialize \\')
    print('        -H "Content-Type: application/json" \\')
    print('        -d \'{"username": "your@email.com", "password": "your_password"}\'')
    
    print("\n" + "=" * 50)
    print("✅ Zero-user authentication system is ready!")
    print("=" * 50)

if __name__ == "__main__":
    test_zero_user_flow()