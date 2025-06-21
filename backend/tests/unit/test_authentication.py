#!/usr/bin/env python3
"""
Test script to verify authentication is working properly
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_public_endpoints():
    """Test that public endpoints work without auth"""
    print("\n🔍 Testing public endpoints (should work without auth)...")
    
    public_endpoints = [
        "/",
        "/health",
        "/api/auth/check",
        "/api/setup/status"
    ]
    
    for endpoint in public_endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            print(f"✅ {endpoint}: {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: Failed - {str(e)}")

def test_protected_endpoints():
    """Test that protected endpoints require auth"""
    print("\n🔍 Testing protected endpoints (should fail without auth)...")
    
    protected_endpoints = [
        "/api/v1/users",
        "/api/v1/work-orders?user_id=test",
        "/api/v1/credentials/workfossa?user_id=test",
        "/api/v1/automation/sessions",
        "/api/settings/smtp/test"
    ]
    
    for endpoint in protected_endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            if response.status_code == 401:
                print(f"✅ {endpoint}: Properly protected (401)")
            else:
                print(f"❌ {endpoint}: NOT PROTECTED! Got {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: Failed - {str(e)}")

def test_login_and_auth():
    """Test login and authenticated requests"""
    print("\n🔍 Testing login and authenticated requests...")
    
    # Test with dummy credentials (will fail but should get proper error)
    login_data = {
        "username": "test@example.com",
        "password": "testpassword"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        print(f"Login attempt: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✅ Got token: {token[:20]}...")
            
            # Test authenticated request
            headers = {"Authorization": f"Bearer {token}"}
            
            # Try to access protected endpoint
            response = requests.get(
                f"{BASE_URL}/api/v1/work-orders?user_id={data.get('user_id')}",
                headers=headers
            )
            print(f"✅ Authenticated request: {response.status_code}")
        else:
            print(f"Login failed (expected with test credentials): {response.text}")
            
    except Exception as e:
        print(f"❌ Login test failed: {str(e)}")

def check_middleware_active():
    """Check if authentication middleware is active"""
    print("\n🔍 Checking if authentication middleware is active...")
    
    # Try to access a protected endpoint without auth header
    response = requests.get(f"{BASE_URL}/api/v1/users")
    
    if response.status_code == 401:
        print("✅ Authentication middleware is ACTIVE")
        
        # Check for proper auth header requirement
        if "WWW-Authenticate" in response.headers:
            print(f"✅ Proper WWW-Authenticate header: {response.headers['WWW-Authenticate']}")
    else:
        print(f"❌ Authentication middleware may NOT be active! Got {response.status_code}")

def main():
    """Run all authentication tests"""
    print("🔐 Testing FossaWork V2 Authentication System")
    print(f"Base URL: {BASE_URL}")
    print("-" * 50)
    
    check_middleware_active()
    test_public_endpoints()
    test_protected_endpoints()
    test_login_and_auth()
    
    print("\n" + "=" * 50)
    print("🏁 Authentication tests complete!")
    print("\nIMPORTANT FINDINGS:")
    print("- Authentication middleware should block all non-public endpoints")
    print("- All sensitive endpoints should return 401 without valid JWT")
    print("- Only login, health, and setup endpoints should be public")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        BASE_URL = sys.argv[1]
    main()