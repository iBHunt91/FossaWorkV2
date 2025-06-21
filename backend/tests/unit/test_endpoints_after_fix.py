#!/usr/bin/env python3
"""
Test if the notification and SMTP endpoints are working after fixes
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoints():
    """Test the endpoints that were throwing errors"""
    
    # First, we need to get a valid token
    # For testing, let's try to get one from the frontend localStorage
    # But since we can't access that, let's test without auth first
    
    print("Testing endpoints after fixes...\n")
    
    # Test health endpoint (no auth required)
    print("1. Health check:")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test if the routes are registered
    print("\n2. Testing if routes exist (will get 401 without auth):")
    
    endpoints = [
        "/api/notifications/preferences",
        "/api/settings/smtp/7bea3bdb7e8e303eacaba442bd824004",
        "/api/user-preferences"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            print(f"   {endpoint}: {response.status_code} - {response.reason}")
            
            # If we get 401, it means the endpoint exists but needs auth
            # If we get 500, there's still an error
            # If we get 404, the endpoint doesn't exist
            
            if response.status_code == 500:
                print(f"      Error details: {response.text[:200]}")
        except Exception as e:
            print(f"   {endpoint}: Connection error - {e}")

if __name__ == "__main__":
    test_endpoints()