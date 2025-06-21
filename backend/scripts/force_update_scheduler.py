#!/usr/bin/env python3
"""
Force update the scheduler through the API
"""

import asyncio
import aiohttp
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def force_update_scheduler():
    print("🔄 Force Update Scheduler")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    job_id = f"work_order_scrape_{user_id}"
    api_base = "http://localhost:8000"
    
    async with aiohttp.ClientSession() as session:
        # Update the schedule via API
        print("📝 Updating schedule via API...")
        update_data = {
            "interval_hours": 0.0167,  # 1 minute
            "active_hours": None,      # No restriction
            "enabled": True
        }
        
        try:
            async with session.put(
                f"{api_base}/api/scraping-schedules/{job_id}",
                json=update_data,
                headers={"X-User-ID": user_id}
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print("✅ Schedule updated successfully!")
                    print(f"   Message: {result.get('message')}")
                else:
                    text = await resp.text()
                    print(f"❌ Failed to update schedule: {resp.status} - {text}")
                    return
        except Exception as e:
            print(f"❌ Error updating schedule: {e}")
            return
        
        # Get the updated schedule
        print("\n🔍 Checking updated schedule...")
        try:
            async with session.get(
                f"{api_base}/api/scraping-schedules/{job_id}",
                headers={"X-User-ID": user_id}
            ) as resp:
                if resp.status == 200:
                    schedule = await resp.json()
                    print("✅ Current schedule:")
                    print(f"   - Job ID: {schedule.get('job_id')}")
                    print(f"   - Enabled: {schedule.get('enabled')}")
                    print(f"   - Next run: {schedule.get('next_run')}")
                    print(f"   - Interval: {schedule.get('interval_hours')} hours")
                    print(f"   - Active hours: {schedule.get('active_hours')}")
                else:
                    print(f"❌ Failed to get schedule: {resp.status}")
        except Exception as e:
            print(f"❌ Error getting schedule: {e}")
    
    print("\n✅ Done! Check the backend logs to see if the scheduler picks up the change.")

if __name__ == "__main__":
    asyncio.run(force_update_scheduler())