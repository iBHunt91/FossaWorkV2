#!/usr/bin/env python3
"""Test complete authentication flow"""

import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:8000"

def test_setup_status():
    """Test /api/setup/status endpoint"""
    print("\n1. Testing setup status...")
    url = f"{BASE_URL}/api/setup/status"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"   Setup required: {data['setup_required']}")
            print(f"   User count: {data['user_count']}")
            return data
    except Exception as e:
        print(f"   Error: {e}")
        return None

def test_login(username, password):
    """Test /api/auth/login endpoint"""
    print(f"\n2. Testing login for {username}...")
    url = f"{BASE_URL}/api/auth/login"
    
    data = {
        "username": username,
        "password": password
    }
    
    headers = {
        "Content-Type": "application/json",
        "Origin": "http://localhost:5173"
    }
    
    try:
        req = urllib.request.Request(url, 
                                    data=json.dumps(data).encode('utf-8'),
                                    headers=headers,
                                    method='POST')
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            print(f"   Success! User ID: {result['user_id']}")
            print(f"   Token: {result['access_token'][:20]}...")
            return result
    except urllib.error.HTTPError as e:
        print(f"   HTTP Error {e.code}: {e.read().decode()}")
        return None
    except Exception as e:
        print(f"   Error: {e}")
        return None

def test_auth_check():
    """Test /api/auth/check endpoint"""
    print("\n3. Testing auth check...")
    url = f"{BASE_URL}/api/auth/check"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"   Has users: {data['has_users']}")
            print(f"   User count: {data['user_count']}")
            print(f"   Requires setup: {data['requires_setup']}")
            return data
    except Exception as e:
        print(f"   Error: {e}")
        return None

def test_protected_endpoint(token):
    """Test accessing a protected endpoint with token"""
    print("\n4. Testing protected endpoint with token...")
    url = f"{BASE_URL}/api/auth/me"
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"   User info retrieved:")
            print(f"   - ID: {data['id']}")
            print(f"   - Email: {data['email']}")
            print(f"   - Created: {data['created_at']}")
            return data
    except urllib.error.HTTPError as e:
        print(f"   HTTP Error {e.code}: {e.read().decode()}")
        return None
    except Exception as e:
        print(f"   Error: {e}")
        return None

def main():
    """Run complete authentication flow test"""
    print("=== Testing Complete Authentication Flow ===")
    
    # Test credentials
    test_username = "bruce.hunt@owlservices.com"
    test_password = "Crompco0511"
    
    # Check server status
    print("\nChecking if server is running...")
    try:
        req = urllib.request.Request(f"{BASE_URL}/health")
        with urllib.request.urlopen(req, timeout=2) as response:
            print("✓ Server is running")
    except:
        print("✗ Server is not running. Please start the backend server.")
        return
    
    # Test setup status
    setup_status = test_setup_status()
    if not setup_status:
        print("Failed to get setup status")
        return
    
    # Test login
    login_result = test_login(test_username, test_password)
    if not login_result:
        print("Login failed")
        return
    
    # Test auth check
    test_auth_check()
    
    # Test protected endpoint
    test_protected_endpoint(login_result['access_token'])
    
    print("\n=== All tests completed successfully! ===")
    print("\nYou should now be able to:")
    print("1. Navigate to http://localhost:5173")
    print("2. Enter your WorkFossa credentials")
    print("3. Successfully login and access the dashboard")

if __name__ == "__main__":
    main()