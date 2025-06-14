#!/usr/bin/env python3
"""Test a specific customer URL that failed dispenser scraping"""

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.browser_automation import BrowserAutomation
from app.services.dispenser_scraper import DispenserScraper
import json

async def test_customer_url():
    """Test a specific customer URL"""
    # Test with one of the failed URLs
    test_url = "https://app.workfossa.com/app/customers/locations/32921/"
    work_order_id = "110433"
    
    print(f"Testing customer URL: {test_url}")
    print(f"Work Order: {work_order_id}")
    print("-" * 80)
    
    browser = BrowserAutomation()
    scraper = DispenserScraper(browser)
    
    try:
        # Load credentials
        creds_path = Path(__file__).parent.parent / "data" / "credentials" / "workfossa_creds.json"
        with open(creds_path, 'r') as f:
            creds = json.load(f)
        
        print("🔐 Logging in...")
        await browser.initialize()
        await browser.login_to_workfossa(creds['username'], creds['password'])
        
        print(f"📍 Navigating to customer page...")
        page = browser.page
        await page.goto(test_url, wait_until='networkidle')
        await page.wait_for_timeout(2000)
        
        # Take screenshot of the page
        await page.screenshot(path="customer_page.png")
        print("📸 Screenshot saved as customer_page.png")
        
        # Check what's on the page
        print("\n🔍 Checking page content...")
        
        # Look for Equipment tab
        equipment_tab = await page.query_selector('text="Equipment"')
        if equipment_tab:
            print("✅ Found Equipment tab")
            
            # Click it
            await equipment_tab.click()
            await page.wait_for_timeout(2000)
            
            # Take screenshot after clicking
            await page.screenshot(path="equipment_tab.png")
            print("📸 Screenshot after clicking Equipment tab saved")
            
            # Check for dispensers
            page_text = await page.content()
            if "dispenser" in page_text.lower():
                print("✅ Found dispenser-related content")
            else:
                print("❌ No dispenser content found")
                
            # Try the scraper
            print("\n🔧 Running dispenser scraper...")
            dispensers = await scraper.scrape_dispensers_from_customer_url(test_url, work_order_id)
            
            if dispensers:
                print(f"✅ Found {len(dispensers)} dispensers:")
                for d in dispensers:
                    print(f"  - {d.title}: {d.make} {d.model}")
            else:
                print("❌ No dispensers found by scraper")
                
        else:
            print("❌ No Equipment tab found on page")
            
            # Check what tabs are available
            tabs = await page.query_selector_all('[role="tab"], .tab, .nav-tab, button')
            print(f"\n📑 Found {len(tabs)} potential tabs:")
            for i, tab in enumerate(tabs[:10]):
                text = await tab.text_content()
                if text and text.strip():
                    print(f"  {i+1}. {text.strip()}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_customer_url())