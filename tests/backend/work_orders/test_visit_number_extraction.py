#!/usr/bin/env python3
"""
Test script to verify visit number extraction from work orders.
This will run the interactive work order test and check for visit_number field.
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
from app.core.logging import logger

async def test_visit_number_extraction():
    """Test that visit_number is properly extracted from work orders"""
    
    print("🧪 Testing Visit Number Extraction")
    print("=" * 60)
    
    # Initialize services
    browser_automation = BrowserAutomationService()
    scraper = WorkFossaScraper(browser_automation)
    
    try:
        # Get credentials
        credentials = await scraper.load_credentials()
        if not credentials:
            print("❌ No credentials found. Please configure WorkFossa credentials first.")
            return False
        
        print("✅ Credentials loaded")
        
        # Launch browser and login
        page = await scraper.browser_automation.launch_browser(
            headless=False,  # Visible for debugging
            timeout=30000
        )
        
        print("✅ Browser launched")
        
        # Login to WorkFossa
        success = await scraper.login(page, credentials['username'], credentials['password'])
        if not success:
            print("❌ Login failed")
            return False
        
        print("✅ Login successful")
        
        # Navigate to work orders page
        await page.goto("https://app.workfossa.com/app/work/list")
        await page.wait_for_timeout(3000)
        
        print("✅ On work orders page")
        
        # Change page size to 100
        try:
            # Try to click the custom dropdown to show 100 items
            dropdown_selector = "div.ks-select-selection:has-text('Show')"
            await page.wait_for_selector(dropdown_selector, timeout=5000)
            await page.click(dropdown_selector)
            await page.wait_for_timeout(1000)
            
            # Click "Show 100" option
            option_selector = "li:has-text('Show 100')"
            await page.click(option_selector)
            await page.wait_for_timeout(3000)
            print("✅ Changed page size to 100")
        except Exception as e:
            print(f"⚠️  Could not change page size: {e}")
        
        # Extract work orders
        work_orders = await scraper.extract_work_orders_from_page(page)
        
        if not work_orders:
            print("❌ No work orders found")
            return False
        
        print(f"✅ Found {len(work_orders)} work orders")
        
        # Test the first work order for visit_number field
        first_work_order = work_orders[0]
        
        print(f"\n📋 Testing First Work Order (ID: {first_work_order.id})")
        print("-" * 40)
        print(f"Visit URL: {first_work_order.visit_url}")
        print(f"Visit ID: {first_work_order.visit_id}")
        print(f"Visit Number: {first_work_order.visit_number}")
        print(f"Scheduled Date: {first_work_order.scheduled_date}")
        
        # Verify visit_number is extracted
        if first_work_order.visit_number:
            print(f"✅ Visit Number extracted successfully: {first_work_order.visit_number}")
            
            # Verify it matches the visit_id
            if first_work_order.visit_number == first_work_order.visit_id:
                print("✅ Visit Number matches Visit ID (as expected)")
            else:
                print(f"⚠️  Visit Number ({first_work_order.visit_number}) does not match Visit ID ({first_work_order.visit_id})")
            
            return True
        else:
            print("❌ Visit Number not extracted")
            return False
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        print(f"❌ Test failed: {e}")
        return False
    
    finally:
        # Close browser
        try:
            await scraper.browser_automation.close_browser()
            print("✅ Browser closed")
        except:
            pass

if __name__ == "__main__":
    result = asyncio.run(test_visit_number_extraction())
    if result:
        print("\n🎉 Test passed! Visit Number extraction is working correctly.")
        sys.exit(0)
    else:
        print("\n❌ Test failed! Visit Number extraction needs attention.")
        sys.exit(1)