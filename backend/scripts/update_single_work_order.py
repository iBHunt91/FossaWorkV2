#!/usr/bin/env python3
"""
Update a single work order (129651) with the fixed extraction logic.
"""

import asyncio
import sys
import os
import sqlite3

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to the database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'fossawork_v2.db')

async def update_work_order_129651():
    """Update work order 129651 with correct visit URL"""
    
    print("🔄 Updating Work Order 129651")
    print("=" * 60)
    
    # Initialize services
    browser_automation = BrowserAutomationService()
    scraper = WorkFossaScraper(browser_automation)
    
    try:
        # Get credentials
        credentials = await scraper.load_credentials()
        if not credentials:
            print("❌ No credentials found")
            return False
        
        print("✅ Credentials loaded")
        
        # Launch browser
        page = await scraper.browser_automation.launch_browser(
            headless=True,  # Run headless for speed
            timeout=30000
        )
        
        print("✅ Browser launched")
        
        # Login
        success = await scraper.login(page, credentials['username'], credentials['password'])
        if not success:
            print("❌ Login failed")
            return False
        
        print("✅ Login successful")
        
        # Navigate to work orders
        await page.goto("https://app.workfossa.com/app/work/list")
        await page.wait_for_timeout(3000)
        
        # Change page size
        try:
            await page.click('div.ks-select-selection:has-text("Show")')
            await page.wait_for_timeout(1000)
            await page.click('li:has-text("Show 100")')
            await page.wait_for_timeout(3000)
            print("✅ Changed page size to 100")
        except:
            print("⚠️  Could not change page size")
        
        # Look for work order 129651
        print("\n🔍 Looking for work order W-129651...")
        
        # Extract all work orders
        work_orders = await scraper.extract_work_orders_from_page(page)
        
        # Find our specific work order
        target_wo = None
        for wo in work_orders:
            if wo.external_id == "129651" or wo.id == "129651":
                target_wo = wo
                break
        
        if not target_wo:
            print("❌ Work order 129651 not found")
            return False
        
        print(f"✅ Found work order 129651")
        print(f"   Site Name: {target_wo.site_name}")
        print(f"   Visit URL: {target_wo.visit_url}")
        print(f"   Visit Number: {target_wo.visit_number}")
        print(f"   Customer URL: {target_wo.customer_url}")
        print(f"   Service: {target_wo.service_name} ({target_wo.service_code})")
        print(f"   Service Items: {target_wo.service_items}")
        
        # Update in database
        print("\n💾 Updating database...")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            # Update the work order
            cursor.execute("""
                UPDATE work_orders 
                SET visit_url = ?,
                    visit_number = ?,
                    visit_id = ?,
                    service_name = ?,
                    service_items = ?,
                    site_name = ?
                WHERE external_id = ?
            """, (
                target_wo.visit_url,
                target_wo.visit_number,
                target_wo.visit_id,
                target_wo.service_name,
                str(target_wo.service_items) if target_wo.service_items else None,
                target_wo.site_name,
                "129651"
            ))
            
            conn.commit()
            print(f"✅ Updated work order 129651")
            
            # Verify the update
            cursor.execute("""
                SELECT external_id, site_name, visit_url, visit_number, service_name, service_items
                FROM work_orders 
                WHERE external_id = '129651'
            """)
            
            row = cursor.fetchone()
            if row:
                print("\n📋 Verified database update:")
                print(f"   External ID: {row[0]}")
                print(f"   Site Name: {row[1]}")
                print(f"   Visit URL: {row[2]}")
                print(f"   Visit Number: {row[3]}")
                print(f"   Service Name: {row[4]}")
                print(f"   Service Items: {row[5]}")
            
        finally:
            conn.close()
        
        return True
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        await scraper.browser_automation.close_browser()
        print("\n✅ Browser closed")

if __name__ == "__main__":
    success = asyncio.run(update_work_order_129651())
    if success:
        print("\n🎉 Successfully updated work order 129651!")
        print("   The Debug Modal should now show the correct visit number.")
    else:
        print("\n❌ Update failed")