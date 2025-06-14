#!/usr/bin/env python3
"""Detailed test of dispenser scraping"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import asyncio
import json
from app.database import SessionLocal
from app.services.dispenser_scraper import dispenser_scraper
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def test_detailed():
    """Test dispenser scraping with detailed logging"""
    
    db = SessionLocal()
    
    try:
        # Get work order 110296
        work_order = db.execute(sql_text("""
            SELECT * FROM work_orders
            WHERE external_id = '110296'
            AND user_id = '7bea3bdb7e8e303eacaba442bd824004'
        """)).fetchone()
        
        if not work_order:
            print("❌ Work order 110296 not found")
            return
            
        scraped_data = json.loads(work_order.scraped_data) if work_order.scraped_data else {}
        customer_url = scraped_data.get('customer_url', 'https://app.workfossa.com/app/customers/locations/32951/')
        
        print("=" * 60)
        print("DETAILED DISPENSER SCRAPING TEST")
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
            page.on("console", lambda msg: print(f"  [Browser Console] {msg.text}"))
            
            # Login
            print("\n🔐 Logging in...")
            await page.goto('https://app.workfossa.com')
            await page.wait_for_timeout(2000)
            
            await page.fill('input[name="email"]', cred.username)
            await page.fill('input[name="password"]', cred.password)
            await page.click('text=Log In')
            
            # Wait for login
            await page.wait_for_timeout(7000)
            print(f"✅ Logged in. Current URL: {page.url}")
            
            # Navigate to customer URL
            print(f"\n🌐 Navigating to: {customer_url}")
            await page.goto(customer_url, wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            # Check if location exists
            page_content = await page.content()
            if "Could not find this location" in page_content:
                print("❌ ERROR: Location not found")
                await browser.close()
                return
                
            print("✅ On customer page")
            
            # Click Equipment tab
            print("\n🔍 Looking for Equipment tab...")
            equipment_clicked = False
            try:
                await page.click('text=Equipment', timeout=5000)
                equipment_clicked = True
                print("✅ Clicked Equipment tab")
            except:
                print("❌ Could not click Equipment tab")
                
            if equipment_clicked:
                await page.wait_for_timeout(3000)
                
                # Look for Dispenser section
                print("\n🔍 Looking for Dispenser section...")
                
                # Check what's visible
                dispenser_info = await page.evaluate("""
                    () => {
                        const info = {
                            hasDispenserSection: false,
                            dispenserSectionText: null,
                            visibleSections: []
                        };
                        
                        // Find all sections in Equipment tab
                        const sections = document.querySelectorAll('*');
                        sections.forEach(el => {
                            const text = el.textContent?.trim() || '';
                            if (text.match(/^[A-Za-z\\s]+\\s*\\(\\d+\\)$/)) {
                                info.visibleSections.push(text);
                                if (text.includes('Dispenser')) {
                                    info.hasDispenserSection = true;
                                    info.dispenserSectionText = text;
                                }
                            }
                        });
                        
                        return info;
                    }
                """)
                
                print(f"  Equipment sections found: {dispenser_info['visibleSections']}")
                
                if dispenser_info['hasDispenserSection']:
                    print(f"  ✅ Found Dispenser section: {dispenser_info['dispenserSectionText']}")
                    
                    # Click Dispenser section
                    try:
                        await page.click(f"text={dispenser_info['dispenserSectionText']}", timeout=5000)
                        print("  ✅ Clicked Dispenser section")
                        await page.wait_for_timeout(2000)
                        
                        # Check if dispensers are now visible
                        dispenser_count = await page.evaluate("""
                            () => {
                                const containers = document.querySelectorAll('.py-1\\\\.5, .py-1\\\\.5.bg-gray-50');
                                let count = 0;
                                containers.forEach(container => {
                                    if (container.querySelector('.px-2') && container.textContent.includes('S/N:')) {
                                        count++;
                                    }
                                });
                                return count;
                            }
                        """)
                        
                        print(f"  ✅ Found {dispenser_count} dispenser containers")
                        
                    except Exception as e:
                        print(f"  ❌ Could not click Dispenser section: {e}")
                else:
                    print("  ❌ No Dispenser section found")
            
            # Now run the actual scraper
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
                    print(f"\nDispenser {i+1}:")
                    print(f"  Title: {dispenser.title}")
                    print(f"  S/N: {dispenser.serial_number}")
                    print(f"  Make: {dispenser.make}")
                    print(f"  Model: {dispenser.model}")
                    print(f"  Number: {dispenser.dispenser_number}")
            
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_detailed())