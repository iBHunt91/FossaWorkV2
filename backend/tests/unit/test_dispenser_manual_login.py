#!/usr/bin/env python3
"""
Test dispenser scraping - requires manual login
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.dispenser_scraper import DispenserScraper
from playwright.async_api import async_playwright

async def main():
    """Test dispenser scraping with manual login"""
    print("🚀 Testing dispenser scraping fixes...")
    print("\n⚠️  This test requires you to manually login to WorkFossa\n")
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(
            headless=False,  # Show browser
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        page = await browser.new_page()
        
        try:
            # Navigate to WorkFossa
            print("🔐 Opening WorkFossa...")
            await page.goto("https://app.workfossa.com", wait_until="networkidle")
            
            # Wait for manual login
            print("\n📝 Please login manually in the browser window")
            print("⏸️  Press Enter after you've logged in...")
            input()
            
            # Verify we're logged in
            if "/app/" not in page.url:
                print("❌ Doesn't look like you're logged in. Current URL:", page.url)
                return
            
            print("✅ Login confirmed!")
            
            # Test customer URL
            test_case = {
                'work_order_id': '110497',
                'customer_url': 'https://app.workfossa.com/app/customers/locations/32943/',
                'expected_dispensers': 4
            }
            
            # Create scraper
            scraper = DispenserScraper()
            
            print(f"\n📋 Testing work order {test_case['work_order_id']}...")
            print(f"🔗 Customer URL: {test_case['customer_url']}")
            print("⏸️  Press Enter to start scraping...")
            input()
            
            try:
                # Scrape dispensers
                dispensers, html = await scraper.scrape_dispensers_for_work_order(
                    page,
                    test_case['work_order_id'],
                    test_case['customer_url'],
                    max_retries=2
                )
                
                print(f"\n✅ Found {len(dispensers)} dispensers")
                
                if dispensers:
                    for i, d in enumerate(dispensers):
                        print(f"\n  Dispenser {i+1}:")
                        print(f"    Title: {d.title}")
                        print(f"    Number: {d.dispenser_number}")
                        print(f"    Make: {d.make}")
                        print(f"    Model: {d.model}")
                        print(f"    Serial: {d.serial_number}")
                        print(f"    Fuel Grades: {list(d.fuel_grades.keys())}")
                else:
                    print("⚠️ No dispensers found")
                    print(f"HTML captured: {len(html) if html else 0} characters")
                    
                    # Save HTML for debugging
                    if html:
                        with open("debug_dispenser_page.html", "w") as f:
                            f.write(html)
                        print("📄 HTML saved to debug_dispenser_page.html")
                
                # Check result
                if len(dispensers) == test_case['expected_dispensers']:
                    print(f"\n✅ SUCCESS: Got expected {test_case['expected_dispensers']} dispensers!")
                else:
                    print(f"\n⚠️ Expected {test_case['expected_dispensers']} dispensers, got {len(dispensers)}")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
            
            print("\n✅ Testing completed!")
            print("\n⏸️ Press Enter to close browser...")
            input()
            
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())