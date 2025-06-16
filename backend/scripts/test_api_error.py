#!/usr/bin/env python3
"""
Test API error to diagnose 500 error
"""

import requests
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

def test_api():
    """Test the API endpoints"""
    print("🧪 Testing API Endpoints")
    print("=" * 50)
    
    # Test health check first
    try:
        response = requests.get("http://localhost:8000/health")
        print(f"✅ Health check: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
    
    # Test API docs
    try:
        response = requests.get("http://localhost:8000/docs")
        print(f"✅ API docs available: {response.status_code}")
    except Exception as e:
        print(f"❌ API docs failed: {e}")
    
    # Now test work orders endpoint without auth
    print("\n📋 Testing work orders endpoint without auth:")
    try:
        response = requests.get(
            "http://localhost:8000/api/v1/work-orders/",
            params={"user_id": "7bea3bdb7e8e303eacaba442bd824004"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
        
        if response.status_code == 500:
            print("\n❌ 500 Error Details:")
            try:
                error_detail = response.json()
                print(f"   {json.dumps(error_detail, indent=2)}")
            except:
                print(f"   Raw response: {response.text}")
    except Exception as e:
        print(f"❌ Request failed: {e}")
    
    # Test with a dummy token
    print("\n📋 Testing work orders endpoint with auth header:")
    try:
        response = requests.get(
            "http://localhost:8000/api/v1/work-orders/",
            params={"user_id": "7bea3bdb7e8e303eacaba442bd824004"},
            headers={"Authorization": "Bearer dummy-token"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
    except Exception as e:
        print(f"❌ Request failed: {e}")
    
    # Check if it's an auth issue
    print("\n🔐 Testing auth endpoint:")
    try:
        # Try login endpoint
        response = requests.post(
            "http://localhost:8000/api/v1/auth/login",
            json={
                "username": "test@example.com",
                "password": "test"
            }
        )
        print(f"   Login endpoint status: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
    except Exception as e:
        print(f"❌ Auth test failed: {e}")

if __name__ == "__main__":
    test_api()