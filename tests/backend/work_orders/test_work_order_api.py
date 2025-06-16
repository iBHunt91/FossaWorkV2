#!/usr/bin/env python3
"""Test work order scraping via API endpoints"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

async def test_work_order_api():
    """Test work order scraping through API"""
    
    print("=" * 80)
    print("TESTING WORK ORDER API WITH NEW FIELDS")
    print("=" * 80)
    
    # Bruce's user ID
    user_id = '7bea3bdb7e8e303eacaba442bd824004'
    
    async with aiohttp.ClientSession() as session:
        try:
            # 1. Trigger work order scraping
            print("\n🚀 Triggering work order scraping...")
            async with session.post(f"{BASE_URL}/work-orders/scrape?user_id={user_id}") as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"✅ Scraping started: {result['message']}")
                else:
                    error = await resp.text()
                    print(f"❌ Error starting scrape: {error}")
                    return
            
            # 2. Monitor progress
            print("\n📊 Monitoring scraping progress...")
            completed = False
            while not completed:
                await asyncio.sleep(2)
                async with session.get(f"{BASE_URL}/work-orders/scrape/progress/{user_id}") as resp:
                    if resp.status == 200:
                        progress = await resp.json()
                        print(f"   {progress['phase']} - {progress['percentage']:.1f}% - {progress['message']}")
                        
                        if progress['status'] in ['completed', 'failed']:
                            completed = True
                            if progress['status'] == 'failed':
                                print(f"   ❌ Scraping failed: {progress.get('error', 'Unknown error')}")
                                return
                            else:
                                print(f"   ✅ Scraping completed! Found {progress['work_orders_found']} work orders")
            
            # 3. Get work orders and check new fields
            print("\n📋 Fetching work orders to verify new fields...")
            async with session.get(f"{BASE_URL}/work-orders?user_id={user_id}") as resp:
                if resp.status == 200:
                    work_orders = await resp.json()
                    print(f"✅ Retrieved {len(work_orders)} work orders")
                    
                    # Show details of first 3 work orders
                    for i, wo in enumerate(work_orders[:3], 1):
                        print(f"\n   {i}. Work Order W-{wo['external_id']}")
                        print(f"      Site: {wo['site_name']}")
                        print(f"      Store #: {wo.get('store_number', 'N/A')}")
                        print(f"      Address: {wo.get('address', 'N/A')}")
                        
                        # Check for new fields
                        print(f"      --- New Fields ---")
                        print(f"      Service Name: {wo.get('service_name', 'N/A')}")
                        print(f"      Service Items: {wo.get('service_items', 'N/A')}")
                        print(f"      Street: {wo.get('street', 'N/A')}")
                        print(f"      City/State: {wo.get('city_state', 'N/A')}")
                        print(f"      County: {wo.get('county', 'N/A')}")
                        print(f"      Created Date: {wo.get('created_date', 'N/A')}")
                        print(f"      Created By: {wo.get('created_by', 'N/A')}")
                        print(f"      Customer URL: {wo.get('customer_url', 'N/A')}")
                        
                        # Show scraped data if available
                        if wo.get('scraped_data'):
                            print(f"      📄 Scraped Data Available: {len(str(wo['scraped_data']))} characters")
                else:
                    error = await resp.text()
                    print(f"❌ Error fetching work orders: {error}")
                    
        except aiohttp.ClientConnectorError:
            print("❌ Could not connect to API. Is the backend running on port 8000?")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n✅ Test complete!")

if __name__ == "__main__":
    print("\n🚀 Starting Work Order API Test")
    print("   Make sure the backend is running on port 8000")
    print("   This will trigger actual scraping via the API")
    asyncio.run(test_work_order_api())