#!/usr/bin/env python3
"""Test dispenser scraping for a single work order"""

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.core_models import WorkOrder
from app.services.browser_automation import BrowserAutomationService
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.dispenser_scraper import dispenser_scraper
import json

async def test_single_scrape():
    """Test scraping dispensers for one work order"""
    
    db = SessionLocal()
    try:
        # Get first work order with customer URL
        order = db.execute("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND scraped_data LIKE '%customer_url%'
            AND scraped_data NOT LIKE '%dispensers_scraped_at%'
            LIMIT 1
        """).fetchone()
        
        if not order:
            print("No work orders to test")
            return
            
        data = json.loads(order.scraped_data)
        print(f"Testing work order: {order.id[:8]}...")
        print(f"Customer URL: {data.get('customer_url')}")
        
        # Get credentials
        creds_file = Path(__file__).parent.parent / "data" / "users" / "7bea3bdb7e8e303eacaba442bd824004" / "workfossa_creds.json"
        if creds_file.exists():
            with open(creds_file) as f:
                creds = json.load(f)
        else:
            print("No credentials found")
            return
        
        # Initialize services
        browser_service = BrowserAutomationService()
        automation = WorkFossaAutomationService(browser_service)
        
        # Login
        print("\n🔐 Logging in...")
        login_result = await automation.login(creds['username'], creds['password'])
        if not login_result['success']:
            print(f"Login failed: {login_result.get('error')}")
            return
        print("✅ Logged in")
        
        # Get page from automation
        page = automation.pages.get('main')
        if not page:
            print("No page available")
            return
            
        # Scrape dispensers
        print("\n🔧 Scraping dispensers...")
        result = await dispenser_scraper.scrape_dispensers_for_work_order(
            page=page,
            work_order_id=order.id,
            visit_url=data.get('customer_url')
        )
        
        dispensers, raw_html = result
        
        if dispensers:
            print(f"✅ Found {len(dispensers)} dispensers:")
            for d in dispensers:
                print(f"   - {d.title} ({d.make} {d.model})")
                print(f"     Serial: {d.serial_number}")
        else:
            print("❌ No dispensers found")
            
            # Check raw HTML
            if raw_html and "deleted" in raw_html.lower():
                print("   ⚠️  Location appears to be deleted")
            elif raw_html and "no equipment" in raw_html.lower():
                print("   ⚠️  No equipment found at location")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        if 'automation' in locals():
            await automation.close()

if __name__ == "__main__":
    asyncio.run(test_single_scrape())