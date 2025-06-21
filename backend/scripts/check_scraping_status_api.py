#!/usr/bin/env python3
"""
Check the scraping status API response
"""

import httpx
import asyncio
import json

async def check_status():
    print("🔍 Checking Scraping Status API")
    print("=" * 50)
    
    # Login first
    async with httpx.AsyncClient() as client:
        # Login
        login_resp = await client.post(
            "http://localhost:8000/api/auth/login",
            data={
                "username": "bruce.hunt@owlservices.com",
                "password": "Crompco0511"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if login_resp.status_code != 200:
            print(f"❌ Login failed: {login_resp.status_code}")
            print(f"Response: {login_resp.text}")
            return
            
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get scraping status
        print("\n1. Getting scraping status...")
        status_resp = await client.get(
            "http://localhost:8000/api/scraping-schedules/status",
            headers=headers
        )
        
        print(f"Status Code: {status_resp.status_code}")
        print(f"\nRaw Response:")
        print(json.dumps(status_resp.json(), indent=2))
        
        if status_resp.status_code == 200:
            data = status_resp.json()
            
            # Check date fields
            if "next_run" in data:
                print(f"\n2. Checking next_run date:")
                print(f"   Raw value: {data['next_run']}")
                print(f"   Type: {type(data['next_run'])}")
                
                if data['next_run']:
                    # Try to parse in Python
                    from datetime import datetime
                    try:
                        dt = datetime.fromisoformat(data['next_run'].replace('Z', '+00:00'))
                        print(f"   ✅ Valid datetime: {dt}")
                    except Exception as e:
                        print(f"   ❌ Invalid datetime: {e}")
            
            if "last_run" in data:
                print(f"\n3. Checking last_run date:")
                print(f"   Raw value: {data['last_run']}")
                print(f"   Type: {type(data['last_run'])}")

if __name__ == "__main__":
    asyncio.run(check_status())