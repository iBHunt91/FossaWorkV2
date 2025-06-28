#!/usr/bin/env python3
"""
Diagnose issues with settings and notifications endpoints
"""

import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def test_endpoints():
    """Test the problematic endpoints"""
    
    # First, login to get a token
    print("1. Testing login...")
    import os
    async with httpx.AsyncClient() as client:
        login_data = {
            "username": os.getenv("TEST_USERNAME", "test@example.com"),
            "password": os.getenv("TEST_PASSWORD", "test_password")
        }
        
        try:
            response = await client.post(f"{BASE_URL}/api/auth/login", json=login_data)
            print(f"Login response: {response.status_code}")
            
            if response.status_code == 200:
                auth_data = response.json()
                token = auth_data.get("access_token")
                user_id = auth_data.get("user", {}).get("id")
                print(f"Token obtained: {token[:20]}...")
                print(f"User ID: {user_id}")
                
                # Set up headers with auth token
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
                
                # Test notification preferences endpoint
                print("\n2. Testing notification preferences endpoint...")
                try:
                    response = await client.get(
                        f"{BASE_URL}/api/notifications/preferences",
                        headers=headers
                    )
                    print(f"Notification preferences response: {response.status_code}")
                    if response.status_code != 200:
                        print(f"Response text: {response.text}")
                    else:
                        print(f"Response data: {json.dumps(response.json(), indent=2)}")
                except Exception as e:
                    print(f"Error calling notification preferences: {e}")
                
                # Test SMTP settings endpoint
                print("\n3. Testing SMTP settings endpoint...")
                try:
                    response = await client.get(
                        f"{BASE_URL}/api/settings/smtp/{user_id}",
                        headers=headers
                    )
                    print(f"SMTP settings response: {response.status_code}")
                    if response.status_code != 200:
                        print(f"Response text: {response.text}")
                except Exception as e:
                    print(f"Error calling SMTP settings: {e}")
                
                # Test a known working endpoint for comparison
                print("\n4. Testing user preferences endpoint (for comparison)...")
                try:
                    response = await client.get(
                        f"{BASE_URL}/api/user-preferences",
                        headers=headers
                    )
                    print(f"User preferences response: {response.status_code}")
                    if response.status_code == 200:
                        print("User preferences endpoint works correctly")
                except Exception as e:
                    print(f"Error calling user preferences: {e}")
                    
            else:
                print(f"Login failed: {response.text}")
                
        except Exception as e:
            print(f"Connection error: {e}")
            print("Make sure the backend is running on port 8000")

if __name__ == "__main__":
    print("=== Settings Endpoints Diagnostic Tool ===")
    print(f"Testing endpoints at {BASE_URL}")
    print(f"Time: {datetime.now()}")
    print("=" * 40)
    
    asyncio.run(test_endpoints())