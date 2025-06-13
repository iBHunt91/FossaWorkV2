#!/usr/bin/env python3
"""Test the updated dispenser scraper"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import asyncio
import json
from app.database import SessionLocal
from app.services.dispenser_scraper import dispenser_scraper
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def test_updated_scraper():
    """Test the updated dispenser scraper"""
    
    db = SessionLocal()
    
    try:
        # Get work order 110296
        work_order = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id = '110296'
        """)).fetchone()
        
        if not work_order:
            print("❌ Work order 110296 not found")
            return
            
        data = json.loads(work_order.scraped_data) if work_order.scraped_data else {}
        customer_url = data.get('customer_url', 'https://app.workfossa.com/app/customers/locations/32951/')
        
        print("=" * 60)
        print("UPDATED DISPENSER SCRAPER TEST")
        print("=" * 60)
        print(f"Work Order: {work_order.external_id} - {work_order.site_name}")
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
            
            # Enable console logging
            page.on("console", lambda msg: print(f"  [Browser] {msg.text}"))
            
            # Login
            print("🔐 Logging in...")
            await page.goto('https://app.workfossa.com')
            await page.wait_for_timeout(2000)
            
            await page.fill('input[name="email"]', cred.username)
            await page.fill('input[name="password"]', cred.password)
            await page.click('text=Log In')
            await page.wait_for_timeout(7000)
            
            # Run the scraper
            print("\n🔧 Running dispenser scraper...")
            dispensers, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
                page,
                work_order.external_id,
                customer_url
            )
            
            print(f"\n✅ Scraping complete. Found {len(dispensers)} dispensers")
            
            if dispensers:
                print("\n📋 Dispenser Details:")
                for i, dispenser in enumerate(dispensers):
                    print(f"\n✅ Dispenser found:")
                    print(f"      Title: {dispenser.title}")
                    print(f"      S/N: {dispenser.serial_number}")
                    print(f"      Make: {dispenser.make}")
                    print(f"      Model: {dispenser.model}")
                    print(f"      Grades: {', '.join(dispenser.grades_list) if dispenser.grades_list else 'N/A'}")
                    print(f"      Dispenser Number(s): {dispenser.dispenser_number}")
                    print(f"      Stand Alone Code: {dispenser.stand_alone_code or 'N/A'}")
                    print(f"      Number of Nozzles: {dispenser.number_of_nozzles or 'N/A'}")
                    print(f"      Meter Type: {dispenser.meter_type or 'N/A'}")
                            
                # Convert to dict for database storage
                dispensers_data = []
                for d in dispensers:
                    disp_dict = {
                        'dispenser_id': d.dispenser_id,
                        'title': d.title,
                        'serial_number': d.serial_number,
                        'make': d.make,
                        'model': d.model,
                        'dispenser_number': d.dispenser_number,
                        'dispenser_numbers': d.dispenser_numbers,
                        'stand_alone_code': d.stand_alone_code,
                        'number_of_nozzles': d.number_of_nozzles,
                        'meter_type': d.meter_type,
                        'fuel_grades': d.fuel_grades,
                        'grades_list': d.grades_list,
                        'custom_fields': d.custom_fields
                    }
                    dispensers_data.append(disp_dict)
                    
                print(f"\n💾 Dispenser data ready for database storage")
                print(f"   Format: {len(dispensers_data)} dispenser objects")
                
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_updated_scraper())