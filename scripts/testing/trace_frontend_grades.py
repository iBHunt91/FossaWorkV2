#!/usr/bin/env python3
"""
Trace what the frontend would receive and display
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
    print("🔍 Tracing Frontend Grades Display")
    print("=" * 70)
    
    if not USERNAME or not PASSWORD:
        print("❌ Please set WORKFOSSA_USERNAME and WORKFOSSA_PASSWORD environment variables")
        return
    
    # Login
    async with aiohttp.ClientSession() as session:
        login_data = {"username": USERNAME, "password": PASSWORD}
        
        async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as resp:
            if resp.status != 200:
                print(f"❌ Login failed")
                return
            
            data = await resp.json()
            token = data["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get work orders
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BASE_URL}/api/work-orders/?user_id={USER_ID}", headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to get work orders")
                return
            
            work_orders = await resp.json()
    
    # Find work order with dispensers
    for wo in work_orders:
        if wo.get('dispensers') and len(wo['dispensers']) > 0:
            print(f"\n📋 Work Order: {wo['external_id']}")
            
            # Get first dispenser
            d = wo['dispensers'][0]
            
            print(f"\n1️⃣ API Response - Dispenser {d['dispenser_number']}:")
            print(f"  grades_list: {d.get('grades_list', 'NOT FOUND')}")
            print(f"  fuel_grades_list: {d.get('fuel_grades_list', 'NOT FOUND')}")
            print(f"  custom_fields: {d.get('custom_fields', 'NOT FOUND')}")
            
            # Simulate what the frontend would compute
            fuel_grades_list = d.get('fuel_grades_list', [])
            grades_list = d.get('grades_list', [])
            
            # This is what DispenserInfoModal does
            fuelGrades = fuel_grades_list or grades_list or []
            
            print(f"\n2️⃣ Frontend would use: {fuelGrades}")
            
            # Check what's in the array
            if fuelGrades:
                print(f"\n3️⃣ Analysis of fuel grades array:")
                for i, grade in enumerate(fuelGrades):
                    print(f"  [{i}] '{grade}' (type: {type(grade).__name__})")
                    
                    # Check if it's a field name
                    if isinstance(grade, str):
                        # Check if it looks like a transformed field name
                        if any(x in grade.lower() for x in ['stand alone', 'nozzle', 'meter', 'number of']):
                            print(f"      ❌ This is a FIELD NAME, not a fuel grade!")
                        # Check if it's a 4-digit code
                        elif grade.isdigit() and len(grade) == 4:
                            print(f"      ⚠️  This is a fuel grade CODE that should be decoded")
                        # Check if it's a value from custom_fields
                        elif d.get('custom_fields'):
                            for key, value in d['custom_fields'].items():
                                if str(value) == grade:
                                    print(f"      ❌ This is the VALUE of custom_field['{key}']")
            
            # Check if the issue is in how grades_list was populated
            print(f"\n4️⃣ Checking where these values came from:")
            if d.get('custom_fields'):
                # Transform keys to human-readable
                for key in d['custom_fields'].keys():
                    transformed = key.replace('_', ' ').title()
                    if transformed in fuelGrades:
                        print(f"  ❌ '{transformed}' is a transformed version of key '{key}'")
            
            break
    else:
        print("\n❌ No work orders with dispensers found")

if __name__ == "__main__":
    asyncio.run(main())