#!/usr/bin/env python3
"""
Simple test to debug the demo-login endpoint error
"""
import asyncio
import requests
import json

async def test_demo_login():
    """Test the demo-login endpoint directly"""
    url = "http://localhost:8000/api/auth/demo-login"
    headers = {
        "Origin": "http://localhost:5173",
        "Content-Type": "application/json"
    }
    
    print("🧪 Testing demo-login endpoint...")
    print(f"URL: {url}")
    print(f"Headers: {headers}")
    
    try:
        response = requests.post(url, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Content: {response.text}")
        
        if response.status_code == 200:
            print("✅ Demo login successful!")
            data = response.json()
            print(f"Token received: {data.get('access_token', 'N/A')[:20]}...")
        else:
            print(f"❌ Demo login failed with {response.status_code}")
            
        # Also test the /health endpoint to confirm server is working
        print("\n🏥 Testing health endpoint...")
        health_response = requests.get("http://localhost:8000/health", headers={"Origin": "http://localhost:5173"})
        print(f"Health Status: {health_response.status_code}")
        if health_response.status_code == 200:
            print(f"Health Data: {health_response.json()}")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        
    # Also check if we can reach the regular login endpoint
    print("\n🔑 Testing regular login endpoint...")
    try:
        login_response = requests.post(
            "http://localhost:8000/api/auth/login",
            headers=headers,
            json={"username": "test@example.com", "password": "test123"},
            timeout=10
        )
        print(f"Regular login status: {login_response.status_code}")
        print(f"Regular login response: {login_response.text[:200]}")
    except Exception as e:
        print(f"Regular login failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_demo_login())