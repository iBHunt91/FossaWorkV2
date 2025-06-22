#!/usr/bin/env python3
"""Diagnose SMTP settings endpoint issue"""

import requests
import json

def test_endpoint():
    """Test various aspects of the SMTP endpoint"""
    import os
    
    base_url = "http://localhost:8000"
    user_id = os.getenv("TEST_USER_ID", "7bea3bdb7e8e303eacaba442bd824004")  # Known user ID
    
    print("🔍 Testing SMTP Settings Endpoint Diagnosis")
    print("=" * 60)
    
    # Test 1: Basic connectivity
    print("\n1. Testing basic connectivity...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"✅ Health check: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        print("   Server may not be running or is stuck")
        return
    
    # Test 2: OPTIONS request (CORS preflight)
    print("\n2. Testing CORS preflight (OPTIONS)...")
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization"
    }
    try:
        response = requests.options(
            f"{base_url}/api/settings/smtp/{user_id}",
            headers=headers,
            timeout=5
        )
        print(f"✅ OPTIONS response: {response.status_code}")
        print("   CORS headers:")
        for header, value in response.headers.items():
            if header.lower().startswith('access-control'):
                print(f"   - {header}: {value}")
    except Exception as e:
        print(f"❌ OPTIONS request failed: {e}")
    
    # Test 3: GET without auth
    print("\n3. Testing GET without authentication...")
    try:
        response = requests.get(
            f"{base_url}/api/settings/smtp/{user_id}",
            timeout=5
        )
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:200]}...")
    except Exception as e:
        print(f"❌ GET request failed: {e}")
    
    # Test 4: Login and get token
    print("\n4. Testing authentication...")
    login_data = {
        "username": os.getenv("TEST_USERNAME", "test@example.com"),
        "password": os.getenv("TEST_PASSWORD", "test_password")
    }
    try:
        response = requests.post(
            f"{base_url}/api/auth/login",
            json=login_data,
            timeout=10
        )
        print(f"Login response: {response.status_code}")
        if response.status_code == 200:
            token = response.json().get("access_token")
            print("✅ Got authentication token")
            
            # Test 5: GET with auth
            print("\n5. Testing GET with authentication...")
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(
                f"{base_url}/api/settings/smtp/{user_id}",
                headers=headers,
                timeout=5
            )
            print(f"Response status: {response.status_code}")
            print(f"Response text: {response.text}")
            if response.status_code == 200:
                print(f"Response body: {json.dumps(response.json(), indent=2)}")
        else:
            print(f"❌ Login failed: {response.text}")
    except Exception as e:
        print(f"❌ Auth test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_endpoint()