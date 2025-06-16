#!/usr/bin/env python3
"""
Verify that single job and batch dispenser scraping produce identical results
"""
import asyncio
import aiohttp
import json
import os
import sys
from datetime import datetime

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

def compare_dispenser_data(disp1, disp2, label1="Dispenser1", label2="Dispenser2"):
    """Compare two dispenser objects and report differences"""
    differences = []
    
    # Fields to compare
    fields = [
        'dispenser_number', 'dispenser_type', 'fuel_grades', 
        'fuel_grades_list', 'grades_list', 'make', 'model',
        'serial_number', 'stand_alone_code', 'meter_type',
        'number_of_nozzles', 'title'
    ]
    
    for field in fields:
        val1 = disp1.get(field)
        val2 = disp2.get(field)
        
        # Special handling for fuel grades lists
        if field in ['fuel_grades_list', 'grades_list']:
            # Both should have the same fuel grades
            list1 = disp1.get('fuel_grades_list') or disp1.get('grades_list', [])
            list2 = disp2.get('fuel_grades_list') or disp2.get('grades_list', [])
            
            if set(list1) != set(list2):
                differences.append({
                    'field': 'fuel_grades (combined)',
                    label1: list1,
                    label2: list2
                })
        elif val1 != val2:
            differences.append({
                'field': field,
                label1: val1,
                label2: val2
            })
    
    return differences

async def test_consistency():
    """Test that single and batch scraping produce identical results"""
    print("🔬 Dispenser Scraping Consistency Test")
    print("=" * 70)
    print("This test verifies that single job and batch scraping produce identical results")
    print()
    
    if not USERNAME or not PASSWORD:
        print("❌ Please set WORKFOSSA_USERNAME and WORKFOSSA_PASSWORD environment variables")
        return
    
    # Login
    token = await login()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get a work order with customer URL
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
    
    # Store original dispensers (if any from batch scraping)
    original_dispensers = test_wo.get('dispensers', [])
    print(f"   Original dispensers: {len(original_dispensers)}")
    
    # Test 1: Single job scraping
    print(f"\n🧪 Test 1: Single Job Dispenser Scraping")
    print("-" * 50)
    
    async with aiohttp.ClientSession() as session:
        url = f"{BASE_URL}/api/work-orders/{test_wo['id']}/scrape-dispensers?user_id={USER_ID}"
        async with session.post(url, headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to start single job scraping")
                return
            
            result = await resp.json()
            print(f"✅ {result['message']}")
    
    # Wait for completion
    print("⏳ Waiting for scraping to complete...")
    await asyncio.sleep(15)
    
    # Get updated work order
    async with aiohttp.ClientSession() as session:
        url = f"{BASE_URL}/api/work-orders/{test_wo['id']}?user_id={USER_ID}"
        async with session.get(url, headers=headers) as resp:
            if resp.status != 200:
                print(f"❌ Failed to get updated work order")
                return
            
            single_job_wo = await resp.json()
    
    single_job_dispensers = single_job_wo.get('dispensers', [])
    print(f"✅ Single job scraping found {len(single_job_dispensers)} dispensers")
    
    # Display single job results
    print("\n📊 Single Job Scraping Results:")
    for disp in single_job_dispensers:
        grades = disp.get('fuel_grades_list') or disp.get('grades_list', [])
        print(f"  - Dispenser {disp['dispenser_number']}: {disp.get('make', 'Unknown')} {disp.get('model', 'Unknown')}")
        print(f"    Fuel Grades: {', '.join(grades) if grades else 'None'}")
        print(f"    Has Codes: {'Yes' if any(g.isdigit() for g in grades) else 'No'}")
    
    # Compare with original dispensers if available
    if original_dispensers:
        print(f"\n📊 Comparison with Original Dispensers:")
        all_match = True
        
        for i, single_disp in enumerate(single_job_dispensers):
            # Find matching dispenser by number
            orig_disp = None
            for od in original_dispensers:
                if od['dispenser_number'] == single_disp['dispenser_number']:
                    orig_disp = od
                    break
            
            if not orig_disp:
                print(f"\n❌ Dispenser {single_disp['dispenser_number']} not found in original!")
                all_match = False
                continue
            
            differences = compare_dispenser_data(orig_disp, single_disp, "Original", "Single Job")
            
            if differences:
                all_match = False
                print(f"\n⚠️  Dispenser {single_disp['dispenser_number']} has differences:")
                for diff in differences:
                    print(f"   - {diff['field']}:")
                    print(f"     Original:   {diff['Original']}")
                    print(f"     Single Job: {diff['Single Job']}")
            else:
                print(f"\n✅ Dispenser {single_disp['dispenser_number']} - Perfect match!")
        
        # Summary
        print("\n" + "=" * 70)
        if all_match and len(single_job_dispensers) == len(original_dispensers):
            print("✅ SUCCESS: Single job scraping produces identical results!")
        else:
            print("❌ FAILURE: Single job scraping produces different results!")
    else:
        print("\n⚠️  No original dispensers to compare with (run batch scraping first)")
    
    # Check fuel grade decoding
    print("\n🔍 Fuel Grade Decoding Check:")
    has_codes = False
    for disp in single_job_dispensers:
        grades = disp.get('fuel_grades_list') or disp.get('grades_list', [])
        for grade in grades:
            if grade.isdigit() and len(grade) == 4:
                has_codes = True
                print(f"   ❌ Dispenser {disp['dispenser_number']} still has code: {grade}")
    
    if not has_codes:
        print("   ✅ All fuel grades properly decoded (no numeric codes)")
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    asyncio.run(test_consistency())