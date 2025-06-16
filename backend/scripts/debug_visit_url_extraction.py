#!/usr/bin/env python3
"""
Debug visit URL extraction issue - why are we getting /work/ URLs instead of /visits/ URLs?
"""
import asyncio
from playwright.async_api import async_playwright
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def debug_visit_extraction():
    """Debug the visit URL extraction process"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        print("🔍 DEBUG: Visit URL Extraction")
        print("=" * 80)
        
        # Navigate to WorkFossa login
        print("\n1. Navigating to WorkFossa login...")
        await page.goto("https://app.workfossa.com")
        
        # Login
        print("2. Logging in...")
        await page.fill("input[name='email']", "ibhunt@fossaautomation.com")
        await page.fill("input[name='password']", "7c!BJ8M2HQebAA$B")
        await page.click("button[type='submit']")
        
        # Wait for navigation
        print("3. Waiting for dashboard...")
        await page.wait_for_url("**/app/**", timeout=30000)
        
        # Navigate to work orders
        print("4. Navigating to work orders...")
        await page.goto("https://app.workfossa.com/app/work/list")
        await page.wait_for_selector("tbody tr", timeout=30000)
        
        # Find the first work order row
        print("\n5. Finding first work order row...")
        rows = await page.query_selector_all("tbody tr")
        if not rows:
            print("❌ No work orders found!")
            await browser.close()
            return
        
        first_row = rows[0]
        
        # Get all cells
        cells = await first_row.query_selector_all("td")
        print(f"   Found {len(cells)} cells in the row")
        
        # Check cell 4 (Visits cell)
        if len(cells) >= 5:
            visits_cell = cells[4]
            visits_text = await visits_cell.text_content()
            print(f"\n6. Visits cell (cell 4) content:")
            print(f"   Text: {visits_text}")
            
            # Find all links in the visits cell
            visit_links = await visits_cell.query_selector_all("a")
            print(f"\n7. Links found in visits cell: {len(visit_links)}")
            
            for i, link in enumerate(visit_links):
                href = await link.get_attribute("href")
                text = await link.text_content()
                print(f"\n   Link {i + 1}:")
                print(f"   - Text: {text}")
                print(f"   - Href: {href}")
                
                if href:
                    if '/visits/' in href:
                        print(f"   - ✅ Contains /visits/ pattern")
                        visit_id_match = re.search(r'/visits/(\d+)', href)
                        if visit_id_match:
                            print(f"   - Visit ID: {visit_id_match.group(1)}")
                    elif '/customers/locations/' in href:
                        print(f"   - ⚠️  Customer URL (should be ignored)")
                    else:
                        print(f"   - ❓ Other URL type")
        
        # Also check for visit links in the entire row
        print("\n8. Checking for visit links in entire row...")
        all_links = await first_row.query_selector_all("a")
        visit_links_found = []
        
        for link in all_links:
            href = await link.get_attribute("href")
            if href and '/visits/' in href and '/customers/locations/' not in href:
                visit_links_found.append(href)
        
        print(f"   Visit links found in entire row: {len(visit_links_found)}")
        for url in visit_links_found:
            print(f"   - {url}")
        
        # Extract work order ID to see what fallback would generate
        cells = await first_row.query_selector_all("td")
        if len(cells) >= 2:
            wo_cell = cells[1]
            wo_text = await wo_cell.text_content()
            wo_match = re.search(r'W-(\d+)', wo_text)
            if wo_match:
                work_order_id = wo_match.group(1)
                print(f"\n9. Work Order ID: {work_order_id}")
                print(f"   Fallback URL would be: https://app.workfossa.com/app/work/{work_order_id}/")
        
        print("\n" + "=" * 80)
        print("ANALYSIS:")
        print("=" * 80)
        
        if visit_links_found:
            print("✅ Visit URLs with /visits/ pattern ARE being found in the page")
            print("❌ But they're not making it to the database")
            print("\nPOSSIBLE ISSUES:")
            print("1. The visit_info dict is not returning the URL properly")
            print("2. The fallback in line 815 is always being triggered")
            print("3. The URL is being overwritten somewhere else")
        else:
            print("❌ No visit URLs found - the page structure may have changed")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_visit_extraction())