#!/usr/bin/env python3
"""Check which customer locations have been deleted in WorkFossa"""

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from playwright.async_api import async_playwright
import json
from app.database import SessionLocal
from app.core_models import WorkOrder
from sqlalchemy import text

async def check_deleted_locations():
    """Check which customer locations return 'deleted' message"""
    
    # Get failed work orders
    db = SessionLocal()
    try:
        # Get work orders that failed dispenser scraping
        failed_orders = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE scraped_data IS NOT NULL
            AND scraped_data NOT LIKE '%dispensers_scraped_at%'
            AND scraped_data LIKE '%customer_url%'
        """)).fetchall()
        
        print(f"Found {len(failed_orders)} work orders that failed dispenser scraping")
        
        # Extract customer URLs
        test_cases = []
        for order in failed_orders:
            data = json.loads(order.scraped_data) if order.scraped_data else {}
            customer_url = data.get('customer_url')
            if customer_url:
                test_cases.append((order.id, customer_url))
        
        print(f"\nWill check {len(test_cases)} customer URLs")
        
    finally:
        db.close()
    
    if not test_cases:
        print("No failed orders with customer URLs found")
        return
    
    # Load credentials
    creds_path = Path(__file__).parent.parent.parent / "data" / "credentials" / "workfossa_creds.json"
    with open(creds_path, 'r') as f:
        creds = json.load(f)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # Login
            print("\n🔐 Logging in to WorkFossa...")
            await page.goto("https://app.workfossa.com/login/")
            await page.fill('input[id="user_email"]', creds['username'])
            await page.fill('input[id="user_password"]', creds['password'])
            await page.click('button[type="submit"]')
            await page.wait_for_navigation()
            print("✅ Logged in successfully")
            
            # Check each customer URL
            deleted_locations = []
            accessible_locations = []
            
            for work_order_id, customer_url in test_cases:
                print(f"\n📍 Checking Work Order {work_order_id}")
                print(f"   URL: {customer_url}")
                
                await page.goto(customer_url)
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(1000)
                
                # Check for deletion message
                content = await page.content()
                if "could not find this location" in content.lower() or "may have been deleted" in content.lower():
                    print(f"   ❌ Location deleted/not found")
                    deleted_locations.append((work_order_id, customer_url))
                else:
                    # Check if Equipment tab exists
                    equipment_found = await page.evaluate("""
                        () => {
                            const elements = document.querySelectorAll('button, a, div[role="tab"]');
                            for (const el of elements) {
                                if (el.textContent && el.textContent.includes('Equipment')) {
                                    return true;
                                }
                            }
                            return false;
                        }
                    """)
                    
                    if equipment_found:
                        print(f"   ✅ Location accessible with Equipment tab")
                        accessible_locations.append((work_order_id, customer_url))
                    else:
                        print(f"   ⚠️  Location accessible but no Equipment tab found")
                        deleted_locations.append((work_order_id, customer_url))
            
            # Summary
            print("\n" + "="*80)
            print(f"\n📊 SUMMARY:")
            print(f"   Total checked: {len(test_cases)}")
            print(f"   Deleted/inaccessible: {len(deleted_locations)}")
            print(f"   Accessible with Equipment: {len(accessible_locations)}")
            
            if deleted_locations:
                print(f"\n❌ Deleted/Inaccessible Locations:")
                for wo_id, url in deleted_locations:
                    print(f"   - Work Order {wo_id}: {url}")
                    
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(check_deleted_locations())