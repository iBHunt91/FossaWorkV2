#!/usr/bin/env python3
"""
Test script to debug and fix work order scraping
"""

import asyncio
import logging
from pathlib import Path
import sys
import json

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.services.browser_automation import browser_automation
from app.services.workfossa_scraper import workfossa_scraper

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_work_order_scraping():
    """Test work order scraping with debugging"""
    print("\n=== Testing Work Order Scraping ===\n")
    
    # Test user ID
    user_id = "test_user"
    session_id = f"{user_id}_test"
    
    try:
        # Initialize browser
        print("1. Initializing browser...")
        await browser_automation.initialize(session_id)
        page = browser_automation.pages.get(session_id)
        
        if not page:
            print("❌ Failed to initialize browser")
            return
        
        print("✅ Browser initialized")
        
        # Login
        print("\n2. Logging in to WorkFossa...")
        login_result = await browser_automation.login_to_workfossa(
            session_id=session_id,
            email="fossatest123@gmail.com",
            password="FossaDemo123!"
        )
        
        if not login_result.get('success'):
            print(f"❌ Login failed: {login_result.get('error', 'Unknown error')}")
            return
        
        print("✅ Login successful")
        
        # Navigate directly to work list
        print("\n3. Navigating to work orders page...")
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Take screenshot for debugging
        await page.screenshot(path="work_orders_page.png")
        print("📸 Screenshot saved as work_orders_page.png")
        
        # Debug: Print page HTML structure
        print("\n4. Analyzing page structure...")
        
        # Check for table structure
        table_exists = await page.query_selector("table")
        if table_exists:
            print("✅ Found table structure")
            
            # Get all table rows
            rows = await page.query_selector_all("tbody tr")
            print(f"✅ Found {len(rows)} table rows")
            
            if rows:
                # Analyze first row structure
                print("\n5. Analyzing first work order row...")
                first_row = rows[0]
                cells = await first_row.query_selector_all("td")
                print(f"   - Row has {len(cells)} cells")
                
                # Print cell contents
                for i, cell in enumerate(cells):
                    text = await cell.text_content()
                    print(f"   - Cell {i}: {text[:50]}..." if text and len(text) > 50 else f"   - Cell {i}: {text}")
                
                # Look for links in the row
                links = await first_row.query_selector_all("a")
                print(f"\n   - Found {len(links)} links in first row")
                for i, link in enumerate(links):
                    href = await link.get_attribute("href")
                    text = await link.text_content()
                    print(f"   - Link {i}: {text} -> {href}")
        else:
            print("❌ No table found - page might use different structure")
            
            # Try to find any work order elements
            selectors_to_try = [
                ".work-list-item",
                ".work-order-item",
                "[data-testid*='work-order']",
                ".card",
                ".list-item"
            ]
            
            for selector in selectors_to_try:
                elements = await page.query_selector_all(selector)
                if elements:
                    print(f"✅ Found {len(elements)} elements with selector: {selector}")
                    break
        
        # Now test the actual scraper
        print("\n6. Testing work order scraper...")
        
        # Add progress callback
        def progress_callback(progress):
            print(f"   Progress: {progress.phase} - {progress.percentage}% - {progress.message}")
        
        workfossa_scraper.add_progress_callback(lambda p: asyncio.create_task(progress_callback(p)))
        
        # Run the scraper
        work_orders = await workfossa_scraper.scrape_work_orders(session_id)
        
        print(f"\n✅ Scraping completed: {len(work_orders)} work orders found")
        
        # Print first work order details
        if work_orders:
            print("\n7. First work order details:")
            first_order = work_orders[0]
            print(json.dumps({
                'id': first_order.id,
                'external_id': first_order.external_id,
                'site_name': first_order.site_name,
                'address': first_order.address,
                'customer_name': first_order.customer_name,
                'service_code': first_order.service_code,
                'scheduled_date': str(first_order.scheduled_date) if first_order.scheduled_date else None
            }, indent=2))
        else:
            print("\n❌ No work orders extracted")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        print("\n8. Cleaning up...")
        await browser_automation.cleanup_session(session_id)
        print("✅ Test completed")

if __name__ == "__main__":
    asyncio.run(test_work_order_scraping())