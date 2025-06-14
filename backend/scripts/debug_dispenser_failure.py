#!/usr/bin/env python3
"""Debug why dispenser scraping failed for specific locations"""

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from playwright.async_api import async_playwright
import json

async def debug_customer_page():
    """Debug a specific customer page"""
    # Test with one of the failed URLs
    test_cases = [
        ("110433", "https://app.workfossa.com/app/customers/locations/32921/"),
        ("131156", "https://app.workfossa.com/app/customers/locations/127209/"),
        ("110296", "https://app.workfossa.com/app/customers/locations/32951/")
    ]
    
    # Load credentials
    creds_path = Path(__file__).parent.parent / "data" / "credentials" / "workfossa_creds.json"
    with open(creds_path, 'r') as f:
        creds = json.load(f)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Show browser
        page = await browser.new_page()
        
        try:
            # Login
            print("🔐 Logging in to WorkFossa...")
            await page.goto("https://app.workfossa.com/login/")
            await page.fill('input[id="user_email"]', creds['username'])
            await page.fill('input[id="user_password"]', creds['password'])
            await page.click('button[type="submit"]')
            await page.wait_for_navigation()
            print("✅ Logged in successfully")
            
            # Test first customer URL
            work_order_id, customer_url = test_cases[0]
            print(f"\n📍 Testing Work Order {work_order_id}")
            print(f"   URL: {customer_url}")
            
            await page.goto(customer_url)
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)
            
            # Check page title
            title = await page.title()
            print(f"   Page title: {title}")
            
            # Look for tabs
            print("\n🔍 Looking for tabs on the page...")
            tabs = await page.query_selector_all('a[role="tab"], button[role="tab"], .tab, .nav-tab, [data-tab]')
            print(f"   Found {len(tabs)} potential tabs")
            
            for i, tab in enumerate(tabs[:10]):
                text = await tab.text_content()
                if text and text.strip():
                    print(f"   Tab {i+1}: {text.strip()}")
                    if "equipment" in text.lower():
                        print(f"   ✅ Found Equipment tab!")
            
            # Look for Equipment link/button anywhere
            equipment_elements = await page.query_selector_all('*:has-text("Equipment")')
            print(f"\n🔍 Found {len(equipment_elements)} elements containing 'Equipment'")
            
            # Try clicking Equipment if found
            equipment_clicked = False
            for elem in equipment_elements:
                tag = await elem.evaluate('el => el.tagName')
                if tag in ['A', 'BUTTON', 'DIV']:
                    text = await elem.text_content()
                    if text and text.strip() == "Equipment":
                        print(f"   Clicking {tag} element with text 'Equipment'...")
                        await elem.click()
                        equipment_clicked = True
                        await page.wait_for_timeout(2000)
                        break
            
            if equipment_clicked:
                print("✅ Clicked Equipment tab/button")
                
                # Look for Dispenser section
                print("\n🔍 Looking for Dispenser section...")
                dispenser_elements = await page.query_selector_all('*:has-text("Dispenser")')
                print(f"   Found {len(dispenser_elements)} elements containing 'Dispenser'")
                
                for elem in dispenser_elements[:5]:
                    text = await elem.text_content()
                    if text:
                        print(f"   - {text.strip()[:100]}...")
            else:
                print("❌ Could not find Equipment tab/button to click")
            
            # Take screenshot
            await page.screenshot(path=f"debug_{work_order_id}.png")
            print(f"\n📸 Screenshot saved as debug_{work_order_id}.png")
            
            # Check page content
            content = await page.content()
            if "no equipment" in content.lower():
                print("\n⚠️  Page contains 'no equipment' text")
            if "no dispensers" in content.lower():
                print("⚠️  Page contains 'no dispensers' text")
            
            print("\n" + "="*80)
            input("Press Enter to close browser and exit...")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_customer_page())