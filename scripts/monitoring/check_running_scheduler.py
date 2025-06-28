#!/usr/bin/env python3
"""Check if the scheduler is actually running in the FastAPI app"""

import asyncio
import aiohttp
import json
from datetime import datetime

async def check_scheduler():
    """Check scheduler status via API"""
    
    # Get auth token (you may need to adjust this)
    auth_url = "http://localhost:8000/api/auth/test-token"
    
    async with aiohttp.ClientSession() as session:
        # Try to get scheduler info from logs
        try:
            # Check backend logs for scheduler info
            logs_url = "http://localhost:8000/api/v1/logs/stats"
            headers = {}
            
            async with session.get(logs_url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print("✅ API is running")
                    print(f"Log stats: {json.dumps(data, indent=2)}")
                else:
                    print(f"❌ API returned status {resp.status}")
                    
        except aiohttp.ClientConnectorError:
            print("❌ Cannot connect to API at http://localhost:8000")
            print("   Is the backend running?")
            return
            
        # Try to check scraping schedules
        try:
            schedules_url = "http://localhost:8000/api/scraping-schedules/"
            
            # You'll need a valid auth token here
            # For now, let's see if we can access without auth
            async with session.get(schedules_url) as resp:
                if resp.status == 401:
                    print("\n⚠️  Need authentication to check schedules")
                elif resp.status == 200:
                    data = await resp.json()
                    print(f"\n✅ Schedules: {json.dumps(data, indent=2)}")
                    
        except Exception as e:
            print(f"\n❌ Error checking schedules: {e}")

print("=" * 60)
print("CHECKING RUNNING SCHEDULER")
print("=" * 60)
print(f"Time: {datetime.now()}")
print("-" * 60)

# Check if backend is running
print("\n1. Checking if backend is running...")
import subprocess
result = subprocess.run(['lsof', '-i', ':8000'], capture_output=True, text=True)
if result.stdout:
    print("✅ Backend is running on port 8000")
    print(result.stdout)
else:
    print("❌ Backend is NOT running on port 8000")
    print("   Start it with: uvicorn app.main:app --reload --port 8000")

# Run async check
print("\n2. Checking API endpoints...")
asyncio.run(check_scheduler())

print("\n" + "=" * 60)