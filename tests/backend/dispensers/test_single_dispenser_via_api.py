#!/usr/bin/env python3
"""Test single work order dispenser scraping via API"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
import time
import json
from app.database import SessionLocal
from sqlalchemy import text as sql_text

def test_single_dispenser():
    """Test scraping dispensers for a single work order"""
    print("🚀 Testing Single Work Order Dispenser Scraping")
    print("=" * 60)
    
    # Configuration
    API_BASE = "http://localhost:8000"
    
    # Load credentials for authentication
    creds_path = Path(__file__).parent.parent / "data" / "users" / "bruce" / "workfossa_credentials.json"
    if creds_path.exists():
        with open(creds_path, 'r') as f:
            creds = json.load(f)
            email = creds.get("email", "")
            password = creds.get("password", "")
    else:
        print("❌ Credentials file not found")
        return
    
    # Step 1: Login to get auth token
    print("\n🔐 Logging in...")
    login_response = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": email, "password": password}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    auth_data = login_response.json()
    token = auth_data.get("token")
    user_id = auth_data.get("user", {}).get("id", "bruce")
    print(f"✅ Logged in successfully. User ID: {user_id}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Get a work order with customer URL for this user
    print("\n📋 Finding a work order with customer URL...")
    db = SessionLocal()
    try:
        result = db.execute(sql_text("""
            SELECT wo.id, wo.external_id, wo.site_name, wo.customer_url, wo.user_id
            FROM work_orders wo
            WHERE wo.customer_url IS NOT NULL 
            AND wo.customer_url != ''
            AND wo.customer_url LIKE '%/customers/locations/%'
            AND wo.user_id = :user_id
            ORDER BY wo.created_at DESC
            LIMIT 1
        """), {"user_id": user_id})
        work_order = result.fetchone()
        
        if not work_order:
            print(f"❌ No work orders with customer URLs found for user {user_id}")
            print("Run work order scraping first to get work orders")
            return
            
        print(f"✅ Found work order: {work_order.external_id} - {work_order.site_name}")
        print(f"   ID: {work_order.id}")
        print(f"   Customer URL: {work_order.customer_url}")
        print(f"   User ID: {work_order.user_id}")
        
    finally:
        db.close()
    
    # Step 3: Trigger dispenser scraping
    print(f"\n🔄 Triggering dispenser scraping...")
    
    scrape_url = f"{API_BASE}/api/v1/work-orders/{work_order.id}/scrape-dispensers?user_id={user_id}"
    
    print(f"   URL: {scrape_url}")
    
    scrape_response = requests.post(scrape_url, headers=headers)
    
    if scrape_response.status_code == 200:
        result = scrape_response.json()
        print(f"✅ Scraping started: {result['message']}")
    else:
        print(f"❌ Failed to start scraping: {scrape_response.status_code}")
        print(f"   Response: {scrape_response.text}")
        return
    
    # Step 4: Wait for completion
    print("\n⏳ Waiting for scraping to complete (15 seconds)...")
    time.sleep(15)
    
    # Step 5: Check results
    print("\n🔍 Checking results...")
    db = SessionLocal()
    try:
        # Check dispensers
        dispensers = db.execute(sql_text("""
            SELECT 
                dispenser_number,
                dispenser_type,
                form_data
            FROM dispensers 
            WHERE work_order_id = :wo_id
            ORDER BY dispenser_number
        """), {"wo_id": work_order.id}).fetchall()
        
        print(f"\n📊 Found {len(dispensers)} dispensers in database")
        
        if dispensers:
            print("\n📋 Dispenser Details:")
            for d in dispensers:
                form_data = d.form_data or {}
                print(f"\n   Dispenser {d.dispenser_number}:")
                print(f"   - Type: {d.dispenser_type}")
                print(f"   - Serial: {form_data.get('serial_number', 'N/A')}")
                print(f"   - Make: {form_data.get('make', 'N/A')}")
                print(f"   - Model: {form_data.get('model', 'N/A')}")
                print(f"   - Stand Alone Code: {form_data.get('stand_alone_code', 'N/A')}")
                print(f"   - Nozzles: {form_data.get('number_of_nozzles', 'N/A')}")
                print(f"   - Fuel Grades: {', '.join(form_data.get('grades_list', []))}")
        else:
            print("\n⚠️ No dispensers found")
            print("This could mean:")
            print("1. The scraping failed")
            print("2. The work order has no dispensers")
            print("3. The customer page couldn't be accessed")
            
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("✅ Test Complete!")

if __name__ == "__main__":
    print("\n⚠️  IMPORTANT: The API server should be running via 'fossa start'")
    print("\nThis test will:")
    print("1. Find a work order with a customer URL")
    print("2. Trigger dispenser scraping for that work order")
    print("3. Wait for completion")
    print("4. Show the results")
    print("\nPress Enter to continue or Ctrl+C to cancel...")
    input()
    
    test_single_dispenser()