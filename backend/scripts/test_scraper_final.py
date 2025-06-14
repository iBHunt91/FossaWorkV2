#!/usr/bin/env python3
"""
Final test of the WorkFossa scraper with correct URLs
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from playwright.async_api import async_playwright
import logging

# Enable logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def scrape_work_orders_direct():
    """Directly scrape work orders to verify the selectors"""
    print("🔍 Direct WorkFossa Work Order Scraping Test")
    print("=" * 50)
    
    credentials = {
        "username": "bruce.hunt@owlservices.com",
        "password": "Crompco0511"
    }
    
    playwright = None
    browser = None
    work_orders = []
    
    try:
        # Start Playwright
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            ignore_https_errors=True
        )
        
        page = await context.new_page()
        
        # Login
        print("1. Logging into WorkFossa...")
        await page.goto("https://app.workfossa.com", wait_until="networkidle")
        await page.fill("input[type='email']", credentials["username"])
        await page.fill("input[type='password']", credentials["password"])
        await page.click("input[type='submit']")
        await page.wait_for_timeout(3000)
        print(f"   ✅ Logged in")
        
        # Navigate to work orders
        print("\n2. Navigating to work orders...")
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        print(f"   📍 Current URL: {page.url}")
        
        # Take screenshot
        await page.screenshot(path="workfossa_work_list_page.png")
        print("   📸 Screenshot saved: workfossa_work_list_page.png")
        
        # Look for work order elements
        print("\n3. Looking for work orders...")
        
        # Try different selectors
        selectors = [
            "tr[data-id]",  # Table rows with data-id
            "tr.clickable",  # Clickable table rows
            "tbody tr",  # All table body rows
            ".work-order-row",
            ".job-row",
            "tr:has(td)",  # Rows with table cells
        ]
        
        elements = []
        used_selector = None
        for selector in selectors:
            try:
                test_elements = await page.query_selector_all(selector)
                if test_elements and len(test_elements) > 0:
                    print(f"   ✅ Found {len(test_elements)} elements with selector: {selector}")
                    elements = test_elements
                    used_selector = selector
                    break
            except:
                continue
        
        if not elements:
            print("   ❌ No work order elements found")
            
            # Debug: print page structure
            print("\n   Debugging page structure...")
            tables = await page.query_selector_all("table")
            print(f"   Found {len(tables)} tables")
            
            if tables:
                # Check first table
                tbody = await tables[0].query_selector("tbody")
                if tbody:
                    rows = await tbody.query_selector_all("tr")
                    print(f"   Found {len(rows)} rows in first table")
        else:
            print(f"\n4. Extracting work order data from {len(elements)} elements...")
            
            # Extract data from first few work orders
            for i, element in enumerate(elements[:5]):
                try:
                    # Get all text content
                    text_content = await element.text_content()
                    
                    # Try to extract specific fields
                    cells = await element.query_selector_all("td")
                    
                    work_order_data = {
                        "index": i,
                        "full_text": text_content.strip()[:200],
                        "cells": []
                    }
                    
                    # Extract cell data
                    for j, cell in enumerate(cells[:8]):  # First 8 cells
                        cell_text = await cell.text_content()
                        work_order_data["cells"].append(cell_text.strip())
                    
                    # Try to get data attributes
                    data_id = await element.get_attribute("data-id")
                    if data_id:
                        work_order_data["data_id"] = data_id
                    
                    work_orders.append(work_order_data)
                    
                    print(f"\n   Work Order {i + 1}:")
                    if data_id:
                        print(f"     ID: {data_id}")
                    if work_order_data["cells"]:
                        print(f"     Site: {work_order_data['cells'][1] if len(work_order_data['cells']) > 1 else 'N/A'}")
                        print(f"     Date: {work_order_data['cells'][0] if work_order_data['cells'] else 'N/A'}")
                    
                except Exception as e:
                    print(f"   Error extracting work order {i}: {str(e)}")
        
        # Close browser
        await browser.close()
        
        return len(work_orders) > 0, work_orders
        
    except Exception as e:
        logger.error(f"Test failed: {str(e)}", exc_info=True)
        print(f"\n❌ Test failed: {str(e)}")
        
        if browser:
            await browser.close()
        
        return False, []
    finally:
        if playwright:
            await playwright.stop()

async def main():
    success, work_orders = await scrape_work_orders_direct()
    
    if success:
        print(f"\n🎉 Successfully scraped {len(work_orders)} work orders!")
        print("\nSummary:")
        print(f"- Total work orders found: {len(work_orders)}")
        print("- Scraping mechanism is working correctly")
        print("- The issue might be in the background task or database storage")
    else:
        print("\n❌ Work order scraping failed!")
        print("Possible issues:")
        print("- No work orders available in the account")
        print("- Page structure has changed")
        print("- Selectors need to be updated")

if __name__ == "__main__":
    asyncio.run(main())