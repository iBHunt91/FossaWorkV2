#!/usr/bin/env python3
"""
Test script to verify the notification preferences endpoint is working
"""

import requests
import json
import sys

# API base URL
BASE_URL = "http://localhost:8000"

def test_notification_endpoint():
    """Test the notification preferences endpoint"""
    print("Testing notification preferences endpoint...")
    
    # First, let's try to access the endpoint without authentication
    print("\n1. Testing without authentication:")
    try:
        response = requests.get(f"{BASE_URL}/api/notifications/preferences/test-user-id")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Check if the endpoint is registered
    print("\n2. Checking OpenAPI docs for the endpoint:")
    try:
        response = requests.get(f"{BASE_URL}/openapi.json")
        if response.status_code == 200:
            openapi = response.json()
            notification_paths = [path for path in openapi.get("paths", {}) if "notifications" in path]
            print(f"   Found notification endpoints: {notification_paths}")
        else:
            print(f"   Could not fetch OpenAPI spec: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test the original endpoint without user_id
    print("\n3. Testing original endpoint (without user_id):")
    try:
        response = requests.get(f"{BASE_URL}/api/notifications/preferences")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    test_notification_endpoint()