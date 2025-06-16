#!/usr/bin/env python3
"""
Test the single scrape fix by running a scrape and checking the results
"""
import asyncio
import aiohttp
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

# Configuration
BASE_URL = "http://localhost:8000"
USER_ID = "1"
USERNAME = os.getenv("WORKFOSSA_USERNAME", "")
PASSWORD = os.getenv("WORKFOSSA_PASSWORD", "")

async def main():
    print("🔍 Testing Single Scrape Fix")
    print("=" * 70)
    
    if not USERNAME or not PASSWORD:
        print("❌ Please set WORKFOSSA_USERNAME and WORKFOSSA_PASSWORD environment variables")
        return
    
    # Login
    async with aiohttp.ClientSession() as session:
        login_data = {"username": USERNAME, "password": PASSWORD}
        
        print(f"\n🔐 Logging in as {USERNAME}...")
        async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as resp:
            if resp.status != 200:
                text = await resp.text()
                print(f"❌ Login failed: {text}")
                return
            
            data = await resp.json()
            token = data["access_token"]
            print("✅ Login successful")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get work orders
    async with aiohttp.ClientSession() as session:
        print("\n📋 Fetching work orders...")
        async with session.get(f"{BASE_URL}/api/work-orders/?user_id={USER_ID}", headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to get work orders")
                return
            
            work_orders = await resp.json()
    
    # Find a dispenser work order without dispensers
    test_wo = None
    for wo in work_orders:
        if wo.get('service_code') in ['2861', '2862', '3146', '3002']:
            if not wo.get('dispensers') or len(wo['dispensers']) == 0:
                test_wo = wo
                break
    
    if not test_wo:
        # Try to find one with dispensers to re-scrape
        for wo in work_orders:
            if wo.get('service_code') in ['2861', '2862', '3146', '3002']:
                test_wo = wo
                break
    
    if not test_wo:
        print("❌ No dispenser work orders found")
        return
    
    print(f"\n✅ Found work order: {test_wo['external_id']} at {test_wo['site_name']}")
    print(f"   Service: {test_wo.get('service_code')} - {test_wo.get('service_name', 'Unknown')}")
    print(f"   Current dispensers: {len(test_wo.get('dispensers', []))}")
    
    # Clear existing dispensers if any
    if test_wo.get('dispensers'):
        print("\n🗑️ Clearing existing dispensers...")
        async with session.delete(
            f"{BASE_URL}/api/work-orders/{test_wo['id']}/dispensers?user_id={USER_ID}",
            headers=headers
        ) as resp:
            if resp.status == 200:
                print("✅ Existing dispensers cleared")
            else:
                print(f"⚠️ Failed to clear dispensers: {resp.status}")
    
    # Trigger single job scrape
    print(f"\n🔧 Triggering single job dispenser scrape...")
    async with session.post(
        f"{BASE_URL}/api/work-orders/{test_wo['id']}/scrape-dispensers?user_id={USER_ID}",
        headers=headers
    ) as resp:
        if resp.status != 200:
            text = await resp.text()
            print(f"❌ Failed to trigger scrape: {text}")
            return
        
        result = await resp.json()
        print(f"✅ Scrape triggered: {result['message']}")
    
    # Wait for scraping to complete
    print("\n⏳ Waiting for scraping to complete...")
    await asyncio.sleep(15)  # Give it time to scrape
    
    # Fetch updated work order
    print("\n📋 Fetching updated work order...")
    async with session.get(f"{BASE_URL}/api/work-orders/?user_id={USER_ID}", headers=headers) as resp:
        if resp.status != 200:
            print(f"❌ Failed to get work orders")
            return
        
        work_orders = await resp.json()
    
    # Find our work order
    updated_wo = None
    for wo in work_orders:
        if wo['id'] == test_wo['id']:
            updated_wo = wo
            break
    
    if not updated_wo:
        print("❌ Could not find updated work order")
        return
    
    print(f"\n✅ Found updated work order: {updated_wo['external_id']}")
    print(f"   Dispensers found: {len(updated_wo.get('dispensers', []))}")
    
    if not updated_wo.get('dispensers'):
        print("❌ No dispensers found after scraping")
        return
    
    # Check dispenser data
    print("\n📊 Checking Dispenser Data:")
    print("-" * 50)
    
    issues_found = []
    
    for i, disp in enumerate(updated_wo['dispensers'][:3]):  # Check first 3
        print(f"\nDispenser {i+1}:")
        print(f"  Number: {disp['dispenser_number']}")
        print(f"  Title: {disp.get('title', 'N/A')}")
        print(f"  Type: {disp['dispenser_type']}")
        print(f"  Make/Model: {disp.get('make', 'Unknown')} {disp.get('model', 'Unknown')}")
        
        # Check fuel grades
        fuel_grades_list = disp.get('fuel_grades_list', [])
        grades_list = disp.get('grades_list', [])
        
        print(f"\n  Fuel Grades:")
        print(f"    fuel_grades_list: {fuel_grades_list}")
        print(f"    grades_list: {grades_list}")
        
        # What the frontend will use
        frontend_grades = fuel_grades_list or grades_list or []
        print(f"    Frontend will display: {frontend_grades}")
        
        # Check for issues
        # 1. Check if dispenser number is generic (1, 2, 3...)
        if disp['dispenser_number'] in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']:
            issues_found.append(f"Dispenser {i+1} has generic number: {disp['dispenser_number']}")
        
        # 2. Check for non-fuel items in grades
        non_fuel_items = []
        for grade in frontend_grades:
            if isinstance(grade, str):
                grade_lower = grade.lower()
                if any(keyword in grade_lower for keyword in ['stand alone', 'nozzle', 'meter', 'number of', 'code']):
                    non_fuel_items.append(grade)
        
        if non_fuel_items:
            issues_found.append(f"Dispenser {i+1} has non-fuel items in grades: {non_fuel_items}")
        
        # 3. Check for numeric codes instead of names
        numeric_codes = [g for g in frontend_grades if isinstance(g, str) and g.isdigit() and len(g) == 4]
        if numeric_codes:
            issues_found.append(f"Dispenser {i+1} has numeric codes: {numeric_codes}")
    
    # Summary
    print("\n" + "=" * 70)
    if issues_found:
        print("❌ ISSUES FOUND:")
        for issue in issues_found:
            print(f"   - {issue}")
        print("\n💡 Fixes still needed:")
        print("   1. Dispenser numbers need better extraction (not just 1, 2, 3...)")
        print("   2. Fuel grades should only show actual fuel types")
        print("   3. Numeric codes should be decoded to readable names")
    else:
        print("✅ SUCCESS: Single scrape is working correctly!")
        print("   - Dispenser numbers are properly extracted")
        print("   - Only fuel grades are shown (no Stand Alone Code, etc.)")
        print("   - Fuel grades show readable names (not codes)")

if __name__ == "__main__":
    asyncio.run(main())