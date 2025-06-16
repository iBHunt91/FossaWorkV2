#!/usr/bin/env python3
"""
Check the actual API response for work orders
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
    print("🔍 Checking API Response")
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
            print(f"\nWork Order: {wo['external_id']}")
            print(f"Dispensers: {len(wo['dispensers'])}")
            
            # Check first dispenser
            d = wo['dispensers'][0]
            print(f"\nFirst Dispenser Raw Data:")
            print(json.dumps(d, indent=2))
            
            # Check what's in grades_list vs fuel_grades_list
            print(f"\n⚠️  Key Fields:")
            print(f"  grades_list: {d.get('grades_list', 'NOT FOUND')}")
            print(f"  fuel_grades_list: {d.get('fuel_grades_list', 'NOT FOUND')}")
            print(f"  custom_fields: {d.get('custom_fields', 'NOT FOUND')}")
            
            # Check if grades_list has non-fuel items
            grades_list = d.get('grades_list', [])
            if grades_list:
                non_fuel = [g for g in grades_list if any(
                    keyword in str(g).lower() 
                    for keyword in ['stand alone', 'nozzle', 'meter', 'code']
                )]
                if non_fuel:
                    print(f"\n❌ ERROR: grades_list contains non-fuel items: {non_fuel}")
                else:
                    print(f"\n✅ grades_list contains only fuel items")
            
            break

if __name__ == "__main__":
    asyncio.run(main())