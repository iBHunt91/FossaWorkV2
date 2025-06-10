#!/usr/bin/env python3
"""Test script to verify the backend fixes"""

import requests
import json

def test_backend_endpoints():
    base_url = "http://localhost:8000"
    
    # Test 1: Health check
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"✅ Health check: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False
    
    # Test 2: User preferences endpoint (this was missing)
    try:
        response = requests.get(f"{base_url}/api/v1/users/demo-user/preferences", timeout=5)
        print(f"✅ User preferences: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except requests.exceptions.RequestException as e:
        print(f"❌ User preferences failed: {e}")
    
    # Test 3: WorkFossa credentials endpoint
    try:
        response = requests.get(f"{base_url}/api/v1/credentials/workfossa?user_id=demo-user", timeout=5)
        print(f"✅ WorkFossa credentials: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except requests.exceptions.RequestException as e:
        print(f"❌ WorkFossa credentials failed: {e}")
    
    print("\n🎯 Backend API endpoint tests completed!")

if __name__ == "__main__":
    print("🔍 Testing FossaWork V2 Backend API endpoints...")
    test_backend_endpoints()