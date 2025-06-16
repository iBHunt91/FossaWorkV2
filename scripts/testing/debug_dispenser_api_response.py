#!/usr/bin/env python3
"""
Debug what data is being returned by the API for dispensers
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

async def debug_api_response():
    """Debug what the API is returning for dispensers"""
    print("🔍 Debugging Dispenser API Response")
    print("=" * 70)
    
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
    
    # Find a work order with dispensers
    test_wo = None
    for wo in work_orders:
        if wo.get('dispensers') and len(wo['dispensers']) > 0:
            test_wo = wo
            break
    
    if not test_wo:
        print("❌ No work orders with dispensers found")
        return
    
    print(f"\n✅ Found work order with dispensers: {test_wo['external_id']} at {test_wo['site_name']}")
    print(f"   Total dispensers: {len(test_wo['dispensers'])}")
    
    # Analyze each dispenser
    print("\n📊 Dispenser Data Analysis:")
    print("-" * 70)
    
    for i, disp in enumerate(test_wo['dispensers']):
        print(f"\nDispenser {i+1} - Number: {disp['dispenser_number']}")
        print(f"  Fields present: {list(disp.keys())}")
        
        # Check fuel grades fields
        print(f"\n  Fuel Grades Fields:")
        print(f"    fuel_grades: {type(disp.get('fuel_grades'))}")
        if disp.get('fuel_grades'):
            print(f"      Keys: {list(disp['fuel_grades'].keys()) if isinstance(disp['fuel_grades'], dict) else 'Not a dict'}")
            print(f"      Sample: {json.dumps(disp['fuel_grades'], indent=8)[:200]}...")
        
        print(f"    fuel_grades_list: {disp.get('fuel_grades_list')}")
        print(f"    grades_list: {disp.get('grades_list')}")
        
        # Check if grades contain numeric codes
        all_grades = (disp.get('fuel_grades_list') or []) + (disp.get('grades_list') or [])
        has_codes = any(g for g in all_grades if g.isdigit() and len(g) == 4)
        print(f"    Contains numeric codes: {'Yes ❌' if has_codes else 'No ✅'}")
        
        # Check form_data if exposed
        if 'form_data' in disp:
            print(f"\n  form_data: {disp['form_data']}")
        
        # Check other important fields
        print(f"\n  Other Fields:")
        print(f"    make: {disp.get('make')}")
        print(f"    model: {disp.get('model')}")
        print(f"    dispenser_type: {disp.get('dispenser_type')}")
        print(f"    title: {disp.get('title', 'Not present')}")
    
    # Now get a single work order to compare
    print("\n\n📋 Fetching single work order...")
    async with aiohttp.ClientSession() as session:
        url = f"{BASE_URL}/api/work-orders/{test_wo['id']}?user_id={USER_ID}"
        async with session.get(url, headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to get single work order")
                return
            
            single_wo = await resp.json()
    
    print(f"\n📊 Single Work Order API Response:")
    print("-" * 70)
    
    if single_wo.get('dispensers'):
        disp = single_wo['dispensers'][0]  # Check first dispenser
        print(f"\nFirst Dispenser - Number: {disp['dispenser_number']}")
        print(f"  fuel_grades_list: {disp.get('fuel_grades_list')}")
        print(f"  grades_list: {disp.get('grades_list')}")
        
        # Compare with list endpoint
        list_disp = test_wo['dispensers'][0]
        if disp.get('fuel_grades_list') != list_disp.get('fuel_grades_list'):
            print(f"\n⚠️  Difference in fuel_grades_list:")
            print(f"    List endpoint: {list_disp.get('fuel_grades_list')}")
            print(f"    Single endpoint: {disp.get('fuel_grades_list')}")

if __name__ == "__main__":
    asyncio.run(debug_api_response())