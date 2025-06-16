#!/usr/bin/env python3
"""Test the fixed dispenser scraper"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from playwright.async_api import async_playwright
from app.database import SessionLocal
from sqlalchemy import text as sql_text
import json

# Import the fixed scraper
from app.services.dispenser_scraper_fixed import dispenser_scraper_fixed

async def test_fixed_scraper():
    """Test the fixed dispenser scraper"""
    
    db = SessionLocal()
    playwright = None
    browser = None
    
    try:
        # Get work order with known dispenser data
        work_order = db.execute(sql_text("""
            SELECT wo.external_id, wo.site_name, wo.scraped_data, wo.id
            FROM work_orders wo
            WHERE wo.user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND wo.external_id IN ('110296', '109815', '109813')
            ORDER BY wo.external_id
            LIMIT 1
        """)).fetchone()
        
        if not work_order:
            print("❌ No test work order found")
            return
            
        data = json.loads(work_order.scraped_data) if work_order.scraped_data else {}
        customer_url = data.get('customer_url')
        visit_url = data.get('visit_url')
        
        print("=" * 60)
        print("TESTING FIXED DISPENSER SCRAPER")
        print("=" * 60)
        print(f"Work Order: {work_order.external_id} - {work_order.site_name}")
        print(f"Customer URL: {customer_url}")
        print(f"Visit URL: {visit_url}")
        
        if not visit_url:
            print("❌ No visit URL found in work order data")
            return
        
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
        
        print("\n🚀 Launching browser...")
        
        # Launch browser in headless mode for testing
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,  # Use headless for automated testing
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        print("✅ Browser launched")
        
        print("\n🔐 Logging in to WorkFossa...")
        
        # Login
        await page.goto('https://app.workfossa.com')
        await page.wait_for_timeout(2000)
        
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        
        # Try to click login button
        login_selectors = [
            'button[type="submit"]',
            'button:has-text("Login")',
            'button:has-text("Sign In")',
            'input[type="submit"]'
        ]
        
        for selector in login_selectors:
            try:
                if await page.locator(selector).is_visible():
                    await page.click(selector, timeout=5000)
                    break
            except:
                pass
        
        # Wait for login
        try:
            await page.wait_for_url('**/app/**', timeout=10000)
            print("✅ Login successful")
        except:
            print("⚠️  Login might have failed or taken longer than expected")
        
        print("\n🔧 Testing fixed dispenser scraper...")
        
        # Test the fixed scraper
        dispensers, html = await dispenser_scraper_fixed.scrape_dispensers_for_work_order(
            page, 
            work_order.external_id,
            visit_url
        )
        
        print("\n" + "=" * 60)
        print("RESULTS")
        print("=" * 60)
        print(f"Found {len(dispensers)} dispensers")
        
        if dispensers:
            print("\n📋 Dispenser Details:")
            for i, dispenser in enumerate(dispensers):
                print(f"\nDispenser {i+1}:")
                print(f"  Title: {dispenser.title}")
                print(f"  S/N: {dispenser.serial_number}")
                print(f"  Make: {dispenser.make}")
                print(f"  Model: {dispenser.model}")
                print(f"  Number(s): {dispenser.dispenser_number}")
                print(f"  Grades: {', '.join(dispenser.grades_list) if dispenser.grades_list else 'N/A'}")
                print(f"  Stand Alone Code: {dispenser.stand_alone_code}")
                print(f"  Nozzles: {dispenser.number_of_nozzles}")
                print(f"  Meter Type: {dispenser.meter_type}")
            
            print("\n✅ SUCCESS! Fixed scraper found dispensers")
        else:
            print("\n❌ FAILED! No dispensers found")
            print(f"HTML Length: {len(html) if html else 0} characters")
            
            # Save HTML for debugging
            if html:
                with open(f"debug_fixed_scraper_{work_order.external_id}.html", "w") as f:
                    f.write(html)
                print(f"Debug HTML saved to: debug_fixed_scraper_{work_order.external_id}.html")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()
        db.close()
        print("\n👋 Test complete")

if __name__ == "__main__":
    print("Starting fixed scraper test...")
    asyncio.run(test_fixed_scraper())