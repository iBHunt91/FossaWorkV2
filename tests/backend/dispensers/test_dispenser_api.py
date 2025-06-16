#!/usr/bin/env python3
"""Test dispenser scraping through the API endpoint"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import httpx
import json
from app.database import SessionLocal
from sqlalchemy import text as sql_text

async def test_dispenser_api():
    """Test the dispenser scraping API endpoint"""
    print("🚀 Testing dispenser scraping through API...")
    
    # API configuration
    base_url = "http://localhost:8000"
    
    # Load credentials for auth
    creds_path = Path(__file__).parent.parent / "data" / "users" / "bruce" / "workfossa_credentials.json"
    if creds_path.exists():
        with open(creds_path, 'r') as f:
            creds = json.load(f)
            email = creds.get("email", "")
            password = creds.get("password", "")
    else:
        print("❌ Credentials file not found")
        return
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            # Step 1: Login
            print("\n🔐 Step 1: Logging in...")
            login_response = await client.post(
                f"{base_url}/api/auth/login",
                json={"email": email, "password": password}
            )
            
            if login_response.status_code != 200:
                print(f"❌ Login failed: {login_response.text}")
                return
                
            auth_data = login_response.json()
            token = auth_data.get("token")
            user_id = auth_data.get("user", {}).get("id")
            print(f"✅ Logged in successfully. User ID: {user_id}")
            
            headers = {"Authorization": f"Bearer {token}"}
            
            # Step 2: Get work orders with customer URLs
            print("\n📋 Step 2: Getting work orders...")
            db = SessionLocal()
            try:
                result = db.execute(sql_text("""
                    SELECT id, store_name, customer_url 
                    FROM work_orders 
                    WHERE customer_url IS NOT NULL 
                    AND customer_url != ''
                    LIMIT 5
                """))
                work_orders = result.fetchall()
                print(f"Found {len(work_orders)} work orders with customer URLs")
            finally:
                db.close()
            
            if not work_orders:
                print("❌ No work orders with customer URLs found")
                return
            
            # Step 3: Test dispenser scraping for first work order
            test_wo = work_orders[0]
            print(f"\n🔍 Step 3: Testing dispenser scraping for work order {test_wo.id}")
            print(f"   Store: {test_wo.store_name}")
            print(f"   Customer URL: {test_wo.customer_url}")
            
            # Call the scrape endpoint
            scrape_response = await client.post(
                f"{base_url}/api/dispensers/scrape/{test_wo.id}",
                headers=headers
            )
            
            if scrape_response.status_code == 200:
                result = scrape_response.json()
                dispensers = result.get("dispensers", [])
                print(f"\n✅ Successfully scraped {len(dispensers)} dispensers!")
                
                for i, disp in enumerate(dispensers):
                    print(f"\n📋 Dispenser {i+1}:")
                    print(f"   Number: {disp.get('dispenser_number')}")
                    print(f"   Type: {disp.get('dispenser_type')}")
                    print(f"   Serial: {disp.get('serial_number')}")
                    print(f"   Make: {disp.get('make')}")
                    print(f"   Model: {disp.get('model')}")
                    print(f"   Fuel Grades: {disp.get('fuel_grades')}")
            else:
                print(f"❌ Scraping failed: {scrape_response.status_code}")
                print(f"   Error: {scrape_response.text}")
            
            # Step 4: Check if dispensers were saved to database
            print("\n💾 Step 4: Checking database...")
            db = SessionLocal()
            try:
                result = db.execute(sql_text("""
                    SELECT COUNT(*) as count 
                    FROM dispensers 
                    WHERE work_order_id = :wo_id
                """), {"wo_id": test_wo.id})
                count = result.scalar()
                print(f"Found {count} dispensers in database for work order {test_wo.id}")
                
                if count > 0:
                    # Get dispenser details
                    result = db.execute(sql_text("""
                        SELECT dispenser_number, serial_number, make, model
                        FROM dispensers 
                        WHERE work_order_id = :wo_id
                    """), {"wo_id": test_wo.id})
                    db_dispensers = result.fetchall()
                    
                    print("\nDispensers in database:")
                    for disp in db_dispensers:
                        print(f"  - {disp.dispenser_number}: {disp.make} {disp.model} (S/N: {disp.serial_number})")
                        
            finally:
                db.close()
                
        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    # Check if API is running
    print("⚠️  Make sure the API is running on http://localhost:8000")
    print("Run: cd backend && uvicorn app.main:app --reload --port 8000")
    print("")
    asyncio.run(test_dispenser_api())