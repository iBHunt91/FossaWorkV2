#!/usr/bin/env python3
"""
Simple test of dispenser scraping fixes - direct page usage
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.dispenser_scraper import DispenserScraper
from playwright.async_api import async_playwright

async def main():
    """Test dispenser scraping with direct page control"""
    print("🚀 Testing dispenser scraping fixes...")
    
    # Test credentials
    email = "bruce.hunt@owlservices.com"
    password = "Ih031815"
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(
            headless=False,  # Show browser for debugging
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        page = await browser.new_page()
        
        try:
            # Manual login to WorkFossa
            print("🔐 Navigating to WorkFossa login...")
            await page.goto("https://app.workfossa.com", wait_until="networkidle")
            
            # Check if already logged in
            if "/app/" in page.url:
                print("✅ Already logged in!")
            else:
                print("📝 Logging in...")
                # Fill login form using correct selectors
                await page.fill('input[type="email"][name="email"]', email)
                await page.fill('input[type="password"][name="password"]', password)
                
                # Click login button
                await page.click('button[type="submit"], input[type="submit"]')
                
                # Wait for redirect
                await page.wait_for_url("**/app/**", timeout=30000)
                print("✅ Logged in successfully")
            
            # Test URLs
            test_cases = [
                {
                    'work_order_id': '110497',
                    'customer_url': 'https://app.workfossa.com/app/customers/locations/32943/',
                    'expected_dispensers': 4
                }
            ]
            
            # Create scraper
            scraper = DispenserScraper()
            
            # Test each case
            for test in test_cases:
                print(f"\n📋 Testing work order {test['work_order_id']}...")
                print(f"🔗 Customer URL: {test['customer_url']}")
                
                try:
                    # Scrape dispensers
                    dispensers, html = await scraper.scrape_dispensers_for_work_order(
                        page,
                        test['work_order_id'],
                        test['customer_url'],
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
                    
                    # Check result
                    if len(dispensers) == test['expected_dispensers']:
                        print(f"\n✅ SUCCESS: Got expected {test['expected_dispensers']} dispensers!")
                    else:
                        print(f"\n⚠️ Expected {test['expected_dispensers']} dispensers, got {len(dispensers)}")
                    
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