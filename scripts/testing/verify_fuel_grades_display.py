#!/usr/bin/env python3
"""
Verify fuel grades are displayed correctly in the modal
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
    print("🔍 Verifying Fuel Grades Display")
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
    
    # Find work order with dispensers
    test_wo = None
    for wo in work_orders:
        if wo.get('dispensers') and len(wo['dispensers']) > 0:
            test_wo = wo
            break
    
    if not test_wo:
        print("❌ No work orders with dispensers found")
        print("\n💡 Run batch or single dispenser scraping first!")
        return
    
    print(f"\n✅ Found work order: {test_wo['external_id']} at {test_wo['site_name']}")
    print(f"   Total dispensers: {len(test_wo['dispensers'])}")
    
    # Check all dispensers
    print("\n📊 Fuel Grades Check:")
    print("-" * 50)
    
    all_good = True
    for i, disp in enumerate(test_wo['dispensers']):
        print(f"\nDispenser {disp['dispenser_number']}:")
        print(f"  Make/Model: {disp.get('make', 'Unknown')} {disp.get('model', 'Unknown')}")
        
        # Check what grades are available
        fuel_grades_list = disp.get('fuel_grades_list', [])
        grades_list = disp.get('grades_list', [])
        
        # What the modal would use (matching DispenserInfoModal.tsx logic)
        frontend_grades = fuel_grades_list or grades_list or []
        
        print(f"  fuel_grades_list: {fuel_grades_list}")
        print(f"  grades_list: {grades_list}")
        print(f"  Frontend will use: {frontend_grades}")
        
        # Check for numeric codes
        has_codes = False
        for grade in frontend_grades:
            if isinstance(grade, str) and grade.isdigit() and len(grade) == 4:
                has_codes = True
                print(f"    ❌ Found numeric code: {grade}")
        
        if not has_codes and frontend_grades:
            print(f"    ✅ All grades properly named!")
        elif not frontend_grades:
            print(f"    ⚠️  No fuel grades found")
            all_good = False
        else:
            all_good = False
    
    # Summary
    print("\n" + "=" * 70)
    if all_good:
        print("✅ SUCCESS: All fuel grades are properly displayed!")
        print("   The dispenser modal will show readable names like 'Regular', 'Plus', 'Premium'")
    else:
        print("❌ ISSUE: Some dispensers still have numeric codes or missing grades")
        print("   Try the following:")
        print("   1. Restart the backend server")
        print("   2. Clear browser cache and refresh")
        print("   3. Re-run single job dispenser scraping")
    
    # Also check if the data structure matches what the modal expects
    print("\n📋 Data Structure Check:")
    if test_wo['dispensers']:
        disp = test_wo['dispensers'][0]
        expected_fields = ['id', 'dispenser_number', 'make', 'model', 'fuel_grades_list', 'grades_list']
        missing = [f for f in expected_fields if f not in disp]
        
        if missing:
            print(f"   ⚠️  Missing fields: {missing}")
        else:
            print(f"   ✅ All expected fields present")

if __name__ == "__main__":
    asyncio.run(main())