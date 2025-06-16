#!/usr/bin/env python3
"""Test dispenser scraping with the fixes applied"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from playwright.async_api import async_playwright
import json
from app.services.dispenser_scraper import dispenser_scraper
from app.database import SessionLocal
from sqlalchemy import text as sql_text

async def test_dispenser_scraping():
    """Test dispenser scraping with a real work order"""
    print("🚀 Starting dispenser scraping test...")
    
    # Test data - from the database check
    test_work_order = {
        "id": "110296",
        "customer_url": "https://app.workfossa.com/app/customers/locations/32951/",
        "store_name": "Wawa 2025 AccuMeasure"
    }
    
    async with async_playwright() as p:
        # Launch browser in headless mode for testing
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("🔐 Logging into WorkFossa...")
            # Navigate to login page
            await page.goto("https://app.workfossa.com", wait_until="networkidle")
            
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
            
            # Fill login form
            await page.fill('input[type="email"]', email)
            await page.fill('input[type="password"]', password)
            await page.click('button[type="submit"]')
            
            # Wait for login to complete
            await page.wait_for_url("**/app/**", timeout=30000)
            print("✅ Logged in successfully")
            
            # Test dispenser scraping
            print(f"\n🔍 Testing dispenser scraping for work order {test_work_order['id']}...")
            print(f"📍 Customer URL: {test_work_order['customer_url']}")
            
            dispensers = await dispenser_scraper.scrape_dispensers_for_work_order(
                page,
                test_work_order['id'],
                test_work_order['customer_url']
            )
            
            if dispensers:
                print(f"\n✅ Successfully scraped {len(dispensers)} dispensers!")
                for i, dispenser in enumerate(dispensers):
                    print(f"\n📋 Dispenser {i+1}:")
                    print(f"   Title: {dispenser.title}")
                    print(f"   S/N: {dispenser.serial_number}")
                    print(f"   Make: {dispenser.make}")
                    print(f"   Model: {dispenser.model}")
                    print(f"   Fuel Grades: {', '.join(dispenser.grades_list)}")
                    print(f"   Stand Alone Code: {dispenser.stand_alone_code}")
                    print(f"   Number of Nozzles: {dispenser.number_of_nozzles}")
                    print(f"   Meter Type: {dispenser.meter_type}")
            else:
                print("❌ No dispensers found")
                
                # Save debug info
                await page.screenshot(path="debug_test_failed.png")
                print("📸 Debug screenshot saved: debug_test_failed.png")
                
                # Get page content for debugging
                content = await page.content()
                with open("debug_page_content.html", "w") as f:
                    f.write(content)
                print("📄 Page content saved: debug_page_content.html")
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            import traceback
            traceback.print_exc()
            
            # Save error screenshot
            try:
                await page.screenshot(path="debug_test_error.png")
                print("📸 Error screenshot saved: debug_test_error.png")
            except:
                pass
                
        finally:
            await browser.close()
            print("\n🏁 Test completed")

if __name__ == "__main__":
    asyncio.run(test_dispenser_scraping())