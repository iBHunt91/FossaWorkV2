#!/usr/bin/env python3
"""Test the improved dispenser scraper on a single work order"""

import asyncio
import sys
import logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.core_models import WorkOrder
from app.services.browser_automation import BrowserAutomationService
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.dispenser_scraper import dispenser_scraper
from sqlalchemy import text
import json

# Set up logging to see detailed output
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

async def test_improved_scraper():
    """Test the improved dispenser scraper"""
    
    db = SessionLocal()
    browser_service = None
    automation = None
    
    try:
        # Get a work order with customer URL
        order = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND scraped_data LIKE '%customer_url%'
            LIMIT 1
        """)).fetchone()
        
        if not order:
            print("❌ No work orders found for testing")
            return
            
        data = json.loads(order.scraped_data)
        customer_url = data.get('customer_url')
        
        print(f"🧪 Testing work order: {order.id[:8]}...")
        print(f"   Customer URL: {customer_url}")
        print(f"   Site: {data.get('site_name', 'Unknown')}")
        
        # Get credentials
        creds_file = Path(__file__).parent.parent / "data" / "users" / "7bea3bdb7e8e303eacaba442bd824004" / "workfossa_creds.json"
        if not creds_file.exists():
            print("❌ No credentials found")
            return
            
        with open(creds_file) as f:
            creds = json.load(f)
        
        # Initialize services
        print("\n🔧 Initializing browser automation...")
        browser_service = BrowserAutomationService()
        automation = WorkFossaAutomationService(browser_service)
        
        # Login
        print("\n🔐 Logging in to WorkFossa...")
        login_result = await automation.login(creds['username'], creds['password'])
        if not login_result['success']:
            print(f"❌ Login failed: {login_result.get('error')}")
            return
        print("✅ Login successful")
        
        # Get the main page
        page = automation.pages.get('main')
        if not page:
            print("❌ No page available")
            return
        
        # Navigate to customer URL
        print(f"\n🌐 Navigating to customer URL...")
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        # Test the improved scraper
        print(f"\n🔍 Testing improved dispenser scraper...")
        dispensers, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
            page=page,
            work_order_id=order.id,
            visit_url=customer_url
        )
        
        print(f"\n📊 RESULTS:")
        if dispensers:
            print(f"✅ Successfully found {len(dispensers)} dispensers:")
            for i, d in enumerate(dispensers):
                print(f"   {i+1}. {d.title}")
                print(f"      Make/Model: {d.make} {d.model}")
                print(f"      Serial: {d.serial_number}")
                print(f"      Fuel Grades: {list(d.fuel_grades.keys()) if d.fuel_grades else 'None'}")
        else:
            print("❌ No dispensers found")
            
            # Check for error conditions
            current_url = await page.url()
            content = await page.content()
            
            if "could not find this location" in content.lower():
                print("   ⚠️  Location appears to be deleted")
            elif "access denied" in content.lower():
                print("   ⚠️  Access denied to location")
            elif "error" in content.lower():
                print("   ⚠️  General error on page")
            else:
                print("   ⚠️  Unknown issue - check debug logs and screenshots")
                
        print(f"\n🎯 Test completed for work order {order.id[:8]}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if automation:
            await automation.close()
        db.close()

if __name__ == "__main__":
    asyncio.run(test_improved_scraper())