#!/usr/bin/env python3
"""
Test API and capture detailed error
"""

import requests
import json

def test_api():
    """Test the API with detailed logging"""
    print("🧪 Testing API with detailed logging")
    print("=" * 50)
    
    # Test with a fresh login first
    print("\n1️⃣ Testing fresh login...")
    
    login_url = "http://localhost:8000/api/auth/login"
    login_data = {
        "username": "test@example.com",  
        "password": "test123"
    }
    
    try:
        response = requests.post(login_url, json=login_data)
        print(f"Login attempt status: {response.status_code}")
        print(f"Response: {response.text[:500]}...")
    except Exception as e:
        print(f"Login error: {e}")
    
    # Now let's make a direct curl call to see the exact error
    print("\n2️⃣ Testing work orders endpoint directly...")
    print("\nRun this curl command in a new terminal to see the full error:")
    print("""
curl -X GET "http://localhost:8000/api/v1/work-orders/?user_id=7bea3bdb7e8e303eacaba442bd824004" \\
  -H "Accept: application/json" \\
  -H "Authorization: Bearer fake-token" \\
  -v 2>&1 | grep -A 20 -B 5 "500"
""")
    
    # Test the actual endpoint
    print("\n3️⃣ Testing without auth to see error structure...")
    try:
        response = requests.get(
            "http://localhost:8000/api/v1/work-orders/",
            params={"user_id": "7bea3bdb7e8e303eacaba442bd824004"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 500:
            print(f"⚠️  500 Error Response:")
            print(response.text)
        else:
            print(f"Response: {response.text[:200]}...")
    except Exception as e:
        print(f"Request error: {e}")
    
    # Check API docs for auth info
    print("\n4️⃣ Checking API documentation...")
    print("Open in browser: http://localhost:8000/docs")
    print("Look for the /api/v1/work-orders/ endpoint")
    print("Check if it shows authentication required")

if __name__ == "__main__":
    test_api()