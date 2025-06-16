#!/usr/bin/env python3
"""
Compare batch dispenser scraping vs single job scraping to ensure consistency
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

def compare_dispensers(batch_dispenser, single_dispenser):
    """Compare two dispenser objects and return differences"""
    differences = []
    
    # Key fields to compare
    fields_to_compare = [
        'dispenser_number', 'make', 'model', 'serial_number',
        'fuel_grades', 'fuel_grades_list', 'grades_list',
        'stand_alone_code', 'meter_type', 'number_of_nozzles'
    ]
    
    for field in fields_to_compare:
        batch_val = batch_dispenser.get(field)
        single_val = single_dispenser.get(field)
        
        # Special handling for fuel grades list
        if field in ['fuel_grades_list', 'grades_list']:
            # Check if either has the data
            batch_grades = batch_dispenser.get('fuel_grades_list') or batch_dispenser.get('grades_list', [])
            single_grades = single_dispenser.get('fuel_grades_list') or single_dispenser.get('grades_list', [])
            
            if batch_grades != single_grades:
                differences.append({
                    'field': 'fuel_grades_list/grades_list',
                    'batch': batch_grades,
                    'single': single_grades
                })
        elif batch_val != single_val:
            differences.append({
                'field': field,
                'batch': batch_val,
                'single': single_val
            })
    
    return differences

def display_comparison_results(work_order_id, batch_dispensers, single_dispensers):
    """Display comparison results between batch and single scraping"""
    print(f"\n📊 Comparison Results for Work Order {work_order_id}")
    print("=" * 70)
    
    print(f"Batch Scrape: {len(batch_dispensers)} dispensers")
    print(f"Single Scrape: {len(single_dispensers)} dispensers")
    
    if len(batch_dispensers) != len(single_dispensers):
        print("❌ Different number of dispensers found!")
        return False
    
    all_match = True
    
    # Compare each dispenser
    for i, batch_disp in enumerate(batch_dispensers):
        # Find matching dispenser in single scrape by dispenser_number
        single_disp = None
        for sd in single_dispensers:
            if sd['dispenser_number'] == batch_disp['dispenser_number']:
                single_disp = sd
                break
        
        if not single_disp:
            print(f"\n❌ Dispenser {batch_disp['dispenser_number']} not found in single scrape!")
            all_match = False
            continue
        
        differences = compare_dispensers(batch_disp, single_disp)
        
        if differences:
            all_match = False
            print(f"\n⚠️  Dispenser {batch_disp['dispenser_number']} has differences:")
            for diff in differences:
                print(f"   - {diff['field']}:")
                print(f"     Batch:  {diff['batch']}")
                print(f"     Single: {diff['single']}")
        else:
            print(f"\n✅ Dispenser {batch_disp['dispenser_number']} - Perfect match!")
    
    return all_match

async def main():
    """Main comparison test"""
    print("🔬 Batch vs Single Dispenser Scrape Comparison Test")
    print("=" * 70)
    
    if not USERNAME or not PASSWORD:
        print("❌ Please set WORKFOSSA_USERNAME and WORKFOSSA_PASSWORD environment variables")
        return
    
    # Login
    token = await login()
    if not token:
        return
    
    # Get work orders from batch scraping results
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n📋 Fetching work orders...")
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BASE_URL}/api/work-orders/?user_id={USER_ID}", headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to get work orders")
                return
            
            work_orders = await resp.json()
    
    # Find work orders that have dispensers (from batch scraping)
    work_orders_with_dispensers = [
        wo for wo in work_orders 
        if wo.get('dispensers') and len(wo['dispensers']) > 0 and wo.get('customer_url')
    ]
    
    if not work_orders_with_dispensers:
        print("❌ No work orders with dispensers found. Run batch scraping first!")
        return
    
    print(f"✅ Found {len(work_orders_with_dispensers)} work orders with dispensers")
    
    # Test the first 3 work orders
    test_count = min(3, len(work_orders_with_dispensers))
    all_passed = True
    
    for i in range(test_count):
        wo = work_orders_with_dispensers[i]
        print(f"\n\n🧪 Test {i+1}/{test_count}: {wo['external_id']} at {wo['site_name']}")
        print("-" * 70)
        
        # Store batch dispensers
        batch_dispensers = wo['dispensers']
        print(f"📦 Batch scrape has {len(batch_dispensers)} dispensers")
        
        # Clear dispensers and trigger single scrape
        print(f"🔧 Triggering single job dispenser scrape...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{BASE_URL}/api/work-orders/{wo['id']}/scrape-dispensers?user_id={USER_ID}"
            async with session.post(url, headers=headers) as resp:
                if resp.status != 200:
                    print(f"❌ Failed to start single scraping")
                    continue
        
        # Wait for scraping to complete
        print("⏳ Waiting for scraping to complete...", end="", flush=True)
        await asyncio.sleep(10)  # Initial wait
        
        # Get updated work order
        async with aiohttp.ClientSession() as session:
            url = f"{BASE_URL}/api/work-orders/{wo['id']}?user_id={USER_ID}"
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    updated_wo = await resp.json()
                    single_dispensers = updated_wo.get('dispensers', [])
                    
                    # Compare results
                    match = display_comparison_results(wo['external_id'], batch_dispensers, single_dispensers)
                    if not match:
                        all_passed = False
                else:
                    print(f"\n❌ Failed to get updated work order")
                    all_passed = False
    
    # Final summary
    print("\n\n" + "=" * 70)
    if all_passed:
        print("✅ ALL TESTS PASSED! Batch and single scraping produce identical results.")
    else:
        print("❌ SOME TESTS FAILED! There are differences between batch and single scraping.")

if __name__ == "__main__":
    asyncio.run(main())