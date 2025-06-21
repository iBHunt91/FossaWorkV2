#!/usr/bin/env python3
"""Test script to verify hourly scraping endpoints are working"""

import asyncio
import aiohttp
import json
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_USER = {
    "username": "testuser",
    "password": "testpass123"
}

async def test_endpoints():
    """Test the scraping schedule endpoints"""
    
    async with aiohttp.ClientSession() as session:
        print("🔍 Testing Scraping Schedule Endpoints\n")
        
        # 1. Login to get auth token
        print("1. Logging in...")
        try:
            login_data = {
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            }
            
            async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as resp:
                if resp.status == 200:
                    auth_data = await resp.json()
                    token = auth_data.get("access_token")
                    headers = {"Authorization": f"Bearer {token}"}
                    print("✅ Login successful")
                else:
                    print(f"❌ Login failed: {resp.status}")
                    return
        except Exception as e:
            print(f"❌ Connection error: {e}")
            print("\n⚠️  Make sure the backend server is running!")
            print("   Run: cd backend && uvicorn app.main:app --reload --port 8000")
            return
        
        # 2. Test GET schedules
        print("\n2. Getting existing schedules...")
        try:
            async with session.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers) as resp:
                if resp.status == 200:
                    schedules = await resp.json()
                    print(f"✅ Found {len(schedules)} schedules")
                    if schedules:
                        print(f"   - Schedule ID: {schedules[0]['id']}")
                        print(f"   - Enabled: {schedules[0]['enabled']}")
                        print(f"   - Interval: {schedules[0]['interval_hours']} hours")
                else:
                    print(f"❌ Failed to get schedules: {resp.status}")
                    error = await resp.text()
                    print(f"   Error: {error}")
        except Exception as e:
            print(f"❌ Error getting schedules: {e}")
        
        # 3. Test POST create schedule
        print("\n3. Creating new schedule...")
        try:
            schedule_data = {
                "interval_hours": 1.0,
                "enabled": True,
                "active_hours": {
                    "start": 8,
                    "end": 18
                }
            }
            
            async with session.post(f"{BASE_URL}/api/scraping-schedules/", 
                                  json=schedule_data, 
                                  headers=headers) as resp:
                if resp.status == 200:
                    new_schedule = await resp.json()
                    print("✅ Schedule created successfully")
                    print(f"   - Schedule ID: {new_schedule['id']}")
                    print(f"   - Next run: {new_schedule.get('next_run', 'Not scheduled')}")
                    schedule_id = new_schedule['id']
                else:
                    print(f"❌ Failed to create schedule: {resp.status}")
                    error = await resp.text()
                    print(f"   Error: {error}")
                    return
        except Exception as e:
            print(f"❌ Error creating schedule: {e}")
            return
        
        # 4. Test GET history
        print("\n4. Getting scraping history...")
        try:
            async with session.get(f"{BASE_URL}/api/scraping-schedules/history/work_orders?limit=5", 
                                 headers=headers) as resp:
                if resp.status == 200:
                    history = await resp.json()
                    print(f"✅ Found {len(history)} history entries")
                    for entry in history[:3]:
                        print(f"   - {entry.get('started_at', 'Unknown time')}: "
                              f"{entry.get('status', 'Unknown status')} "
                              f"({entry.get('items_processed', 0)} items)")
                else:
                    print(f"❌ Failed to get history: {resp.status}")
        except Exception as e:
            print(f"❌ Error getting history: {e}")
        
        # 5. Test manual trigger
        print("\n5. Triggering manual scrape...")
        try:
            async with session.post(f"{BASE_URL}/api/scraping-schedules/{schedule_id}/trigger", 
                                  headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print("✅ Manual scrape triggered")
                    print(f"   Message: {result.get('message', 'Success')}")
                else:
                    print(f"❌ Failed to trigger scrape: {resp.status}")
        except Exception as e:
            print(f"❌ Error triggering scrape: {e}")
        
        # 6. Test DELETE schedule
        print("\n6. Cleaning up test schedule...")
        try:
            async with session.delete(f"{BASE_URL}/api/scraping-schedules/{schedule_id}", 
                                    headers=headers) as resp:
                if resp.status == 200:
                    print("✅ Test schedule deleted")
                else:
                    print(f"❌ Failed to delete schedule: {resp.status}")
        except Exception as e:
            print(f"❌ Error deleting schedule: {e}")
        
        print("\n✨ Testing complete!")
        print("\nNext steps:")
        print("1. If all tests passed, the backend is ready")
        print("2. Check the frontend at http://localhost:5173")
        print("3. Navigate to Settings > Scraping to configure schedules")
        print("4. Check the sidebar for the scraping status indicator")

if __name__ == "__main__":
    asyncio.run(test_endpoints())