#!/usr/bin/env python3
"""
Test that single job dispenser scraping properly decodes fuel grade codes
"""
import asyncio
import aiohttp
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

# Configuration
BASE_URL = "http://localhost:8000"
USER_ID = "1"  # Update with actual user ID
USERNAME = os.getenv("WORKFOSSA_USERNAME", "")
PASSWORD = os.getenv("WORKFOSSA_PASSWORD", "")

async def login():
    """Login and get auth token"""
    async with aiohttp.ClientSession() as session:
        login_data = {
            "username": USERNAME,
            "password": PASSWORD
        }
        
        print(f"🔐 Logging in as {USERNAME}...")
        async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as resp:
            if resp.status != 200:
                text = await resp.text()
                print(f"❌ Login failed: {text}")
                return None
            
            data = await resp.json()
            print("✅ Login successful")
            return data["access_token"]

async def test_single_scrape():
    """Test single job dispenser scraping with fuel grade decoding"""
    print("🧪 Testing Single Job Dispenser Scrape - Fuel Grade Decoding")
    print("=" * 60)
    
    if not USERNAME or not PASSWORD:
        print("❌ Please set WORKFOSSA_USERNAME and WORKFOSSA_PASSWORD environment variables")
        return
    
    # Login
    token = await login()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get work orders
    print("\n📋 Fetching work orders...")
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BASE_URL}/api/work-orders/?user_id={USER_ID}", headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to get work orders")
                return
            
            work_orders = await resp.json()
    
    # Find a work order with customer URL
    test_wo = None
    for wo in work_orders[:20]:
        if wo.get('customer_url'):
            test_wo = wo
            break
    
    if not test_wo:
        print("❌ No work orders with customer URLs found")
        return
    
    print(f"\n✅ Selected work order: {test_wo['external_id']} at {test_wo['site_name']}")
    print(f"   Current dispensers: {len(test_wo.get('dispensers', []))}")
    
    # Trigger single job dispenser scrape
    print(f"\n🔧 Triggering single job dispenser scrape...")
    async with aiohttp.ClientSession() as session:
        url = f"{BASE_URL}/api/work-orders/{test_wo['id']}/scrape-dispensers?user_id={USER_ID}"
        async with session.post(url, headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to start scraping")
                return
            
            result = await resp.json()
            print(f"✅ {result['message']}")
    
    # Wait for scraping to complete
    print("\n⏳ Waiting for scraping to complete...")
    await asyncio.sleep(10)
    
    # Get updated work order
    async with aiohttp.ClientSession() as session:
        url = f"{BASE_URL}/api/work-orders/{test_wo['id']}?user_id={USER_ID}"
        async with session.get(url, headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to get updated work order")
                return
            
            updated_wo = await resp.json()
    
    # Check dispensers
    print(f"\n📊 Dispenser Scraping Results:")
    print(f"   Total dispensers: {len(updated_wo.get('dispensers', []))}")
    
    if updated_wo.get('dispensers'):
        print("\n📋 Fuel Grade Decoding Check:")
        for disp in updated_wo['dispensers']:
            disp_num = disp['dispenser_number']
            fuel_grades = disp.get('fuel_grades', {})
            fuel_grades_list = disp.get('fuel_grades_list', [])
            grades_list = disp.get('grades_list', [])
            
            print(f"\n   Dispenser {disp_num}:")
            print(f"     fuel_grades_list: {fuel_grades_list}")
            print(f"     grades_list: {grades_list}")
            
            # Check if we have proper grade names (not codes)
            final_grades = fuel_grades_list or grades_list
            if final_grades:
                has_codes = any(g.isdigit() and len(g) == 4 for g in final_grades)
                if has_codes:
                    print(f"     ❌ Still has fuel grade codes!")
                else:
                    print(f"     ✅ Fuel grades properly decoded!")
            else:
                print(f"     ⚠️  No fuel grades found")
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    asyncio.run(test_single_scrape())