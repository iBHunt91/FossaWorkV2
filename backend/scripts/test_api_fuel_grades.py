#!/usr/bin/env python3
"""
Test what the API is actually returning for fuel grades
"""
import requests
import json
import os

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = os.getenv("WORKFOSSA_USERNAME", "")
PASSWORD = os.getenv("WORKFOSSA_PASSWORD", "")
USER_ID = "1"

def test_api():
    print("🧪 Testing API Fuel Grades Response")
    print("=" * 70)
    
    # Login
    print(f"\n🔐 Logging in as {USERNAME}...")
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": USERNAME,
        "password": PASSWORD
    })
    
    if login_resp.status_code != 200:
        print(f"❌ Login failed: {login_resp.text}")
        return
    
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful")
    
    # Get work orders
    print("\n📋 Fetching work orders...")
    wo_resp = requests.get(f"{BASE_URL}/api/work-orders/?user_id={USER_ID}", headers=headers)
    
    if wo_resp.status_code != 200:
        print(f"❌ Failed to get work orders: {wo_resp.text}")
        return
    
    work_orders = wo_resp.json()
    
    # Find work order with dispensers
    test_wo = None
    for wo in work_orders:
        if wo.get('dispensers') and len(wo['dispensers']) > 0:
            test_wo = wo
            break
    
    if not test_wo:
        print("❌ No work orders with dispensers found")
        return
    
    print(f"\n✅ Found work order: {test_wo['external_id']}")
    print(f"   Dispensers: {len(test_wo['dispensers'])}")
    
    # Check first dispenser
    disp = test_wo['dispensers'][0]
    print(f"\n📊 First Dispenser Analysis:")
    print(f"  Number: {disp['dispenser_number']}")
    print(f"  Type: {disp['dispenser_type']}")
    
    # Check fuel grades fields
    print(f"\n  Fuel Grades Fields:")
    print(f"    fuel_grades: {json.dumps(disp.get('fuel_grades', {}), indent=6)}")
    print(f"    fuel_grades_list: {disp.get('fuel_grades_list')}")
    print(f"    grades_list: {disp.get('grades_list')}")
    
    # Check what the frontend would use
    frontend_grades = disp.get('fuel_grades_list') or disp.get('grades_list') or []
    print(f"\n  Frontend would use: {frontend_grades}")
    
    # Check if numeric codes
    has_codes = any(g for g in frontend_grades if g.isdigit() and len(g) == 4)
    print(f"  Contains numeric codes: {'Yes ❌' if has_codes else 'No ✅'}")
    
    # Also check single work order endpoint
    print(f"\n\n📋 Checking single work order endpoint...")
    single_resp = requests.get(
        f"{BASE_URL}/api/work-orders/{test_wo['id']}?user_id={USER_ID}", 
        headers=headers
    )
    
    if single_resp.status_code == 200:
        single_wo = single_resp.json()
        single_disp = single_wo['dispensers'][0]
        
        print(f"\n📊 Single endpoint - First Dispenser:")
        print(f"    fuel_grades_list: {single_disp.get('fuel_grades_list')}")
        print(f"    grades_list: {single_disp.get('grades_list')}")
        
        # Compare
        if single_disp.get('fuel_grades_list') != disp.get('fuel_grades_list'):
            print(f"\n⚠️  Difference detected!")

if __name__ == "__main__":
    test_api()