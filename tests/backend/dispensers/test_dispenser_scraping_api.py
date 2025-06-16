#!/usr/bin/env python3
"""Test dispenser scraping through the API to ensure full integration"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
import time
import json
from app.database import SessionLocal
from sqlalchemy import text as sql_text

def test_api_integration():
    """Test the complete dispenser scraping flow through the API"""
    print("🚀 Testing Dispenser Scraping API Integration")
    print("=" * 60)
    
    # Configuration
    API_BASE = "http://localhost:8000"
    
    # Load credentials
    creds_path = Path(__file__).parent.parent / "data" / "users" / "bruce" / "workfossa_credentials.json"
    if creds_path.exists():
        with open(creds_path, 'r') as f:
            creds = json.load(f)
            email = creds.get("email", "")
            password = creds.get("password", "")
    else:
        print("❌ Credentials file not found")
        return
    
    # Step 1: Login
    print("\n🔐 Step 1: Logging in...")
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
    
    # Step 2: Get a work order with customer URL
    print("\n📋 Step 2: Finding work order with customer URL...")
    db = SessionLocal()
    try:
        result = db.execute(sql_text("""
            SELECT id, external_id, site_name, customer_url
            FROM work_orders
            WHERE customer_url IS NOT NULL 
            AND customer_url != ''
            ORDER BY created_at DESC
            LIMIT 1
        """))
        work_order = result.fetchone()
        
        if not work_order:
            print("❌ No work orders with customer URLs found")
            return
            
        print(f"✅ Found work order: {work_order.external_id} - {work_order.site_name}")
        print(f"   Customer URL: {work_order.customer_url}")
        
    finally:
        db.close()
    
    # Step 3: Trigger dispenser scraping
    print(f"\n🔄 Step 3: Triggering dispenser scraping...")
    scrape_url = f"{API_BASE}/api/v1/work-orders/{work_order.id}/scrape-dispensers?user_id={user_id}"
    
    scrape_response = requests.post(scrape_url, headers=headers)
    
    if scrape_response.status_code != 200:
        print(f"❌ Failed to start scraping: {scrape_response.text}")
        return
    
    result = scrape_response.json()
    print(f"✅ Scraping started: {result['message']}")
    
    # Step 4: Wait for scraping to complete
    print("\n⏳ Step 4: Waiting for scraping to complete...")
    time.sleep(10)  # Give it time to complete
    
    # Step 5: Check results in database
    print("\n🔍 Step 5: Checking results...")
    db = SessionLocal()
    try:
        # Check dispensers table
        dispenser_count = db.execute(sql_text("""
            SELECT COUNT(*) FROM dispensers WHERE work_order_id = :wo_id
        """), {"wo_id": work_order.id}).scalar()
        
        print(f"\n📊 Dispensers in database: {dispenser_count}")
        
        if dispenser_count > 0:
            # Get dispenser details
            dispensers = db.execute(sql_text("""
                SELECT dispenser_number, dispenser_type, form_data
                FROM dispensers 
                WHERE work_order_id = :wo_id
                ORDER BY dispenser_number
            """), {"wo_id": work_order.id}).fetchall()
            
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
                print(f"   - Meter Type: {form_data.get('meter_type', 'N/A')}")
                print(f"   - Grades: {', '.join(form_data.get('grades_list', []))}")
        
        # Check work order scraped_data
        wo_data = db.execute(sql_text("""
            SELECT scraped_data FROM work_orders WHERE id = :wo_id
        """), {"wo_id": work_order.id}).scalar()
        
        if wo_data and 'dispensers' in wo_data:
            print(f"\n✅ Work order scraped_data contains {len(wo_data['dispensers'])} dispensers")
        else:
            print("\n⚠️ No dispensers in work order scraped_data")
            
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("✅ API Integration Test Complete!")

if __name__ == "__main__":
    print("\n⚠️  IMPORTANT: Make sure the API server is running!")
    print("Run in another terminal: cd backend && uvicorn app.main:app --reload")
    print("\nPress Enter to continue or Ctrl+C to cancel...")
    input()
    
    test_api_integration()