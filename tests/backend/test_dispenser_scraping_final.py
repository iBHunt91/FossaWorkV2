#!/usr/bin/env python3
"""Test dispenser scraping with the updated selectors"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import asyncio
import json
from app.database import SessionLocal, engine
from app.core_models import WorkOrder
from app.services.dispenser_scraper import dispenser_scraper
from playwright.async_api import async_playwright
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text

async def test_single_work_order():
    """Test dispenser scraping on a single work order"""
    
    db = SessionLocal()
    
    try:
        # Get work order 110296 (Wawa location 32951)
        work_order = db.execute(sql_text("""
            SELECT * FROM work_orders
            WHERE external_id = '110296'
            AND user_id = '7bea3bdb7e8e303eacaba442bd824004'
        """)).fetchone()
        
        if not work_order:
            print("❌ Work order 110296 not found")
            return
            
        print("=" * 60)
        print("TESTING DISPENSER SCRAPING")
        print("=" * 60)
        print(f"Work Order: {work_order.external_id} - {work_order.site_name}")
        
        scraped_data = json.loads(work_order.scraped_data) if work_order.scraped_data else {}
        customer_url = scraped_data.get('customer_url')
        
        if not customer_url:
            print("❌ No customer URL found")
            return
            
        print(f"Customer URL: {customer_url}")
        
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
            
        print("\n🚀 Starting browser...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--disable-blink-features=AutomationControlled']
            )
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            )
            
            page = await context.new_page()
            
            # Login
            print("🔐 Logging in...")
            await page.goto('https://app.workfossa.com')
            await page.wait_for_timeout(2000)
            
            await page.fill('input[name="email"]', cred.username)
            await page.fill('input[name="password"]', cred.password)
            
            # Try to click login button
            login_selectors = [
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign In")',
                '.btn-primary'
            ]
            
            for selector in login_selectors:
                try:
                    if await page.locator(selector).is_visible():
                        await page.click(selector, timeout=5000)
                        break
                except:
                    pass
            
            # Wait for login
            await page.wait_for_timeout(5000)
            
            # Scrape dispensers
            print("\n🔧 Starting dispenser scraping...")
            dispensers, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
                page,
                work_order.external_id,
                customer_url
            )
            
            print(f"\n✅ Scraping complete. Found {len(dispensers)} dispensers")
            
            if dispensers:
                print("\n📋 Dispenser Details:")
                for i, dispenser in enumerate(dispensers):
                    print(f"\nDispenser {i+1}:")
                    print(f"  Title: {dispenser.title}")
                    print(f"  S/N: {dispenser.serial_number}")
                    print(f"  Make: {dispenser.make}")
                    print(f"  Model: {dispenser.model}")
                    print(f"  Number: {dispenser.dispenser_number}")
                    if dispenser.custom_fields:
                        print("  Custom Fields:")
                        for key, value in dispenser.custom_fields.items():
                            print(f"    {key}: {value}")
            else:
                print("\n❌ No dispensers found")
                
                # Save debug HTML for analysis
                if raw_html:
                    with open('debug_dispenser_html.html', 'w') as f:
                        f.write(raw_html)
                    print("\n💾 Saved debug HTML to debug_dispenser_html.html")
            
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("Testing dispenser scraping...")
    asyncio.run(test_single_work_order())