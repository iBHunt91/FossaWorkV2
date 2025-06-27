#!/usr/bin/env python3
"""Test script for filter widget API endpoints"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from dateutil import tz

async def test_filter_widget():
    """Test the filter widget API endpoints"""
    
    # Configuration
    BASE_URL = "http://localhost:8000"
    USER_ID = "test-user-id"  # Replace with actual user ID
    
    # Calculate date ranges
    today = datetime.now(tz.UTC)
    current_week_start = today - timedelta(days=today.weekday())  # Monday
    current_week_end = current_week_start + timedelta(days=6)  # Sunday
    next_week_start = current_week_start + timedelta(days=7)
    next_week_end = current_week_end + timedelta(days=7)
    
    print(f"Testing Filter Widget API")
    print(f"Current Week: {current_week_start.date()} to {current_week_end.date()}")
    print(f"Next Week: {next_week_start.date()} to {next_week_end.date()}")
    print("-" * 50)
    
    async with aiohttp.ClientSession() as session:
        # First, we need to get an auth token
        # For testing, you'll need to provide actual credentials
        print("\n1. Testing authentication...")
        auth_data = {
            "username": "your_username",  # Replace with actual username
            "password": "your_password"   # Replace with actual password
        }
        
        try:
            async with session.post(f"{BASE_URL}/api/auth/login", json=auth_data) as resp:
                if resp.status == 200:
                    auth_response = await resp.json()
                    token = auth_response.get("access_token")
                    print("✅ Authentication successful")
                else:
                    print(f"❌ Authentication failed: {resp.status}")
                    print(await resp.text())
                    return
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return
        
        # Set up headers with auth token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: Get work orders for current week
        print("\n2. Testing work orders API with date filters...")
        params = {
            "user_id": USER_ID,
            "start_date": current_week_start.isoformat(),
            "end_date": current_week_end.isoformat()
        }
        
        try:
            async with session.get(f"{BASE_URL}/api/v1/work-orders", params=params, headers=headers) as resp:
                if resp.status == 200:
                    work_orders = await resp.json()
                    print(f"✅ Current week work orders: {len(work_orders)} found")
                    
                    # Show first work order if any
                    if work_orders:
                        wo = work_orders[0]
                        print(f"   First work order: {wo.get('external_id')} - {wo.get('site_name')}")
                        print(f"   Scheduled: {wo.get('scheduled_date')}")
                else:
                    print(f"❌ Work orders API failed: {resp.status}")
                    print(await resp.text())
                    return
        except Exception as e:
            print(f"❌ Work orders API error: {e}")
            return
        
        # Test 2: Calculate filters for current week
        if work_orders:
            print("\n3. Testing filter calculation API...")
            
            # Prepare work orders for filter calculation
            filter_data = {
                "workOrders": [
                    {
                        "jobId": wo.get("external_id", wo.get("id")),
                        "storeNumber": wo.get("store_number", ""),
                        "customerName": wo.get("site_name", "").split("#")[0].strip() if wo.get("site_name") else "",
                        "serviceCode": wo.get("service_code", ""),
                        "serviceName": wo.get("service_name", ""),
                        "scheduledDate": wo.get("scheduled_date", ""),
                        "address": wo.get("address", "")
                    }
                    for wo in work_orders
                ],
                "dispensers": [],
                "overrides": {}
            }
            
            try:
                async with session.post(f"{BASE_URL}/api/v1/filters/calculate", json=filter_data, headers=headers) as resp:
                    if resp.status == 200:
                        filter_result = await resp.json()
                        print(f"✅ Filter calculation successful")
                        print(f"   Total filters needed: {filter_result.get('totalFilters', 0)}")
                        print(f"   Total boxes needed: {filter_result.get('totalBoxes', 0)}")
                        print(f"   Warnings: {len(filter_result.get('warnings', []))}")
                        
                        # Show top filters
                        summary = filter_result.get('summary', [])
                        if summary:
                            print(f"\n   Top filters:")
                            for i, filter_item in enumerate(summary[:3]):
                                print(f"   {i+1}. {filter_item.get('description')}: {filter_item.get('quantity')}")
                    else:
                        print(f"❌ Filter calculation failed: {resp.status}")
                        print(await resp.text())
                except Exception as e:
                    print(f"❌ Filter calculation error: {e}")
        else:
            print("\n3. Skipping filter calculation (no work orders found)")
        
        # Test 3: Get work orders for next week
        print("\n4. Testing next week work orders...")
        params = {
            "user_id": USER_ID,
            "start_date": next_week_start.isoformat(),
            "end_date": next_week_end.isoformat()
        }
        
        try:
            async with session.get(f"{BASE_URL}/api/v1/work-orders", params=params, headers=headers) as resp:
                if resp.status == 200:
                    next_week_orders = await resp.json()
                    print(f"✅ Next week work orders: {len(next_week_orders)} found")
                else:
                    print(f"❌ Next week work orders failed: {resp.status}")
        except Exception as e:
            print(f"❌ Next week work orders error: {e}")
    
    print("\n" + "-" * 50)
    print("Test completed!")

if __name__ == "__main__":
    asyncio.run(test_filter_widget())