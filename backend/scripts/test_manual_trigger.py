#!/usr/bin/env python3
"""
Test the manual trigger endpoint
"""

import sys
import asyncio
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import httpx
from datetime import datetime

async def test_manual_trigger():
    print("🔍 Testing Manual Trigger Endpoint")
    print("=" * 50)
    
    # API configuration
    base_url = "http://localhost:8000"
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # First, we need to login to get a token
    print("\n1. Logging in to get authentication token...")
    
    async with httpx.AsyncClient() as client:
        # Login
        login_response = await client.post(
            f"{base_url}/api/auth/login",
            json={
                "email": "bruce.hunt@owlservices.com",
                "password": "Crompco0511"
            }
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return
            
        login_data = login_response.json()
        token = login_data.get("access_token")
        print(f"✅ Login successful, got token")
        
        # Set authorization header
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        # Test the manual trigger endpoint
        print("\n2. Testing manual trigger endpoint...")
        
        trigger_response = await client.post(
            f"{base_url}/api/scraping-schedules/trigger",
            headers=headers,
            json={
                "schedule_type": "work_orders",
                "ignore_schedule": True
            }
        )
        
        print(f"Response status: {trigger_response.status_code}")
        print(f"Response body: {trigger_response.json()}")
        
        if trigger_response.status_code == 200:
            print("\n✅ Manual trigger successful!")
            data = trigger_response.json()
            print(f"Message: {data.get('message')}")
            print(f"Timestamp: {data.get('timestamp')}")
            print("\nThe scheduled job should now be running in the background.")
            print("Check the logs and work orders page to see the results.")
        else:
            print(f"\n❌ Manual trigger failed: {trigger_response.status_code}")
            print(f"Error: {trigger_response.json()}")

if __name__ == "__main__":
    asyncio.run(test_manual_trigger())