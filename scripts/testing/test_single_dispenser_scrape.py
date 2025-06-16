#!/usr/bin/env python3
"""
Test script to verify single job dispenser scraping
"""
import asyncio
import aiohttp
import json
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

async def get_work_orders(token):
    """Get list of work orders"""
    headers = {"Authorization": f"Bearer {token}"}
    
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BASE_URL}/api/work-orders/?user_id={USER_ID}", headers=headers) as resp:
            if resp.status != 200:
                text = await resp.text()
                print(f"❌ Failed to get work orders: {text}")
                return []
            
            return await resp.json()

async def scrape_dispensers_for_work_order(token, work_order_id):
    """Trigger dispenser scraping for a work order"""
    headers = {"Authorization": f"Bearer {token}"}
    
    async with aiohttp.ClientSession() as session:
        print(f"\n🔧 Triggering dispenser scrape for work order: {work_order_id}")
        
        url = f"{BASE_URL}/api/work-orders/{work_order_id}/scrape-dispensers?user_id={USER_ID}"
        async with session.post(url, headers=headers) as resp:
            if resp.status != 200:
                text = await resp.text()
                print(f"❌ Failed to start scraping: {text}")
                return None
            
            data = await resp.json()
            print(f"✅ Scraping started: {data['message']}")
            return data

async def wait_for_scraping_completion(token, work_order_id, max_wait=60):
    """Wait for scraping to complete and get updated work order"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"⏳ Waiting for scraping to complete (max {max_wait}s)...")
    
    start_time = datetime.now()
    while (datetime.now() - start_time).seconds < max_wait:
        await asyncio.sleep(3)
        
        async with aiohttp.ClientSession() as session:
            url = f"{BASE_URL}/api/work-orders/{work_order_id}?user_id={USER_ID}"
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    work_order = await resp.json()
                    
                    # Check if dispensers have been scraped
                    if work_order.get("dispensers") and len(work_order["dispensers"]) > 0:
                        print(f"✅ Scraping completed! Found {len(work_order['dispensers'])} dispensers")
                        return work_order
        
        print(".", end="", flush=True)
    
    print(f"\n⚠️  Scraping may still be in progress (waited {max_wait}s)")
    return None

def display_dispenser_info(dispenser):
    """Display dispenser information in a formatted way"""
    print(f"\n  📊 Dispenser {dispenser['dispenser_number']}:")
    print(f"     Make: {dispenser.get('make', 'N/A')}")
    print(f"     Model: {dispenser.get('model', 'N/A')}")
    print(f"     Serial: {dispenser.get('serial_number', 'N/A')}")
    
    # Display fuel grades
    fuel_grades_list = dispenser.get('fuel_grades_list') or dispenser.get('grades_list', [])
    if fuel_grades_list:
        print(f"     Fuel Grades (List): {', '.join(fuel_grades_list)}")
    else:
        print(f"     Fuel Grades (List): Not available")
    
    # Also show raw fuel_grades object
    fuel_grades = dispenser.get('fuel_grades', {})
    if fuel_grades:
        print(f"     Fuel Grades (Raw): {json.dumps(fuel_grades, indent=8)}")

async def main():
    """Main test function"""
    print("🚀 Single Job Dispenser Scrape Test")
    print("=" * 50)
    
    if not USERNAME or not PASSWORD:
        print("❌ Please set WORKFOSSA_USERNAME and WORKFOSSA_PASSWORD environment variables")
        return
    
    # Login
    token = await login()
    if not token:
        return
    
    # Get work orders
    work_orders = await get_work_orders(token)
    if not work_orders:
        print("❌ No work orders found")
        return
    
    print(f"\n📋 Found {len(work_orders)} work orders")
    
    # Find a work order without dispensers or let user choose
    candidates = []
    for wo in work_orders[:10]:  # Check first 10
        dispenser_count = len(wo.get('dispensers', []))
        has_customer_url = bool(wo.get('customer_url'))
        
        print(f"\n  - {wo['external_id']} at {wo['site_name']}")
        print(f"    Dispensers: {dispenser_count}, Has Customer URL: {has_customer_url}")
        
        if has_customer_url:
            candidates.append(wo)
    
    if not candidates:
        print("\n❌ No work orders with customer URLs found")
        return
    
    # Use the first candidate
    work_order = candidates[0]
    print(f"\n✅ Selected work order: {work_order['external_id']} at {work_order['site_name']}")
    
    # Trigger dispenser scraping
    result = await scrape_dispensers_for_work_order(token, work_order['id'])
    if not result:
        return
    
    # Wait for completion
    updated_wo = await wait_for_scraping_completion(token, work_order['id'])
    if not updated_wo:
        return
    
    # Display results
    print(f"\n📊 Dispenser Scraping Results")
    print("=" * 50)
    print(f"Work Order: {updated_wo['external_id']}")
    print(f"Site: {updated_wo['site_name']}")
    print(f"Total Dispensers: {len(updated_wo['dispensers'])}")
    
    # Display each dispenser
    for dispenser in updated_wo['dispensers']:
        display_dispenser_info(dispenser)
    
    print("\n✅ Test completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())