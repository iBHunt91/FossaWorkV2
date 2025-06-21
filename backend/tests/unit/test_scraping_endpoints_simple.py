#!/usr/bin/env python3
"""Simple test script to verify hourly scraping endpoints"""

import requests
import json
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8000"

def test_endpoints():
    """Test the scraping schedule endpoints"""
    
    print("🔍 Testing Scraping Schedule Endpoints\n")
    
    # 1. Check if server is running
    print("1. Checking server status...")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=2)
        if response.status_code == 200:
            print("✅ Server is running")
        else:
            print("✅ Server is responding (status: {})".format(response.status_code))
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server!")
        print("\n⚠️  Make sure the backend server is running!")
        print("   Run: cd backend && uvicorn app.main:app --reload --port 8000")
        return
    except Exception as e:
        print(f"⚠️  Server check failed: {e}")
        print("   Continuing with tests...")
    
    # 2. Test without auth (should fail)
    print("\n2. Testing endpoint without auth...")
    try:
        response = requests.get(f"{BASE_URL}/api/scraping-schedules/")
        if response.status_code == 401:
            print("✅ Auth required (as expected)")
        else:
            print(f"⚠️  Unexpected status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # 3. Login with test credentials
    print("\n3. Testing with mock auth...")
    print("⚠️  Note: Real auth would require valid WorkFossa credentials")
    
    # For now, let's just check if the endpoints are registered
    print("\n4. Checking if endpoints are registered...")
    endpoints_to_check = [
        ("GET", "/api/scraping-schedules/"),
        ("POST", "/api/scraping-schedules/"),
        ("GET", "/api/scraping-schedules/history/work_orders"),
        ("GET", "/api/scraping-schedules/{id}"),
        ("PUT", "/api/scraping-schedules/{id}"),
        ("DELETE", "/api/scraping-schedules/{id}"),
        ("POST", "/api/scraping-schedules/{id}/trigger"),
    ]
    
    for method, endpoint in endpoints_to_check:
        try:
            if "{id}" in endpoint:
                test_endpoint = endpoint.replace("{id}", "test-id")
            else:
                test_endpoint = endpoint
                
            url = f"{BASE_URL}{test_endpoint}"
            
            if method == "GET":
                response = requests.get(url)
            elif method == "POST":
                response = requests.post(url, json={})
            elif method == "PUT":
                response = requests.put(url, json={})
            elif method == "DELETE":
                response = requests.delete(url)
            
            if response.status_code == 401:
                print(f"✅ {method:6} {endpoint:40} - Auth required")
            elif response.status_code == 404:
                print(f"❌ {method:6} {endpoint:40} - Not found (endpoint not registered)")
            else:
                print(f"⚠️  {method:6} {endpoint:40} - Status: {response.status_code}")
                
        except Exception as e:
            print(f"❌ {method:6} {endpoint:40} - Error: {str(e)[:50]}")
    
    print("\n✨ Testing complete!")
    print("\nIf you see 404 errors above, the endpoints are not registered.")
    print("This means the backend needs to be restarted to load the new routes.")
    print("\nNext steps:")
    print("1. Restart the backend server")
    print("2. Run this test again to verify endpoints are working")
    print("3. Check the frontend at http://localhost:5173")

if __name__ == "__main__":
    test_endpoints()