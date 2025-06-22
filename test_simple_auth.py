#!/usr/bin/env python3
"""
Simple test to check auth endpoints
"""
import requests

def test_auth_endpoints():
    base_url = "http://localhost:8000"
    headers = {"Origin": "http://localhost:5173", "Content-Type": "application/json"}
    
    # Test available endpoints
    endpoints = [
        "/",
        "/health", 
        "/api/v1/status",
        "/api/auth/check"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", headers=headers, timeout=5)
            print(f"✅ {endpoint}: {response.status_code}")
            if response.status_code == 200:
                print(f"   Response: {response.text[:100]}...")
        except Exception as e:
            print(f"❌ {endpoint}: {e}")
    
    # Test demo-login specifically
    print(f"\n🧪 Testing demo-login...")
    try:
        response = requests.post(f"{base_url}/api/auth/demo-login", headers=headers, timeout=5)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_auth_endpoints()