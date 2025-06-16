#!/usr/bin/env python3
"""
Clear and re-scrape all work orders to update visit URLs and visit numbers.
"""

import asyncio
import sys
import os
import sqlite3

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
from app.database import SessionLocal
from app.core_models import WorkOrder
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to the database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'fossawork_v2.db')

def clear_work_orders():
    """Clear existing work orders from the database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Count existing work orders
        cursor.execute("SELECT COUNT(*) FROM work_orders")
        count = cursor.fetchone()[0]
        print(f"📊 Found {count} existing work orders")
        
        if count > 0:
            response = input("⚠️  Delete all work orders? (y/N): ")
            if response.lower() == 'y':
                cursor.execute("DELETE FROM work_orders")
                conn.commit()
                print(f"✅ Deleted {count} work orders")
                return True
            else:
                print("❌ Cancelled")
                return False
        return True
    finally:
        conn.close()

async def rescrape_work_orders():
    """Re-scrape all work orders with fixed extraction logic"""
    
    print("🔄 Re-scraping Work Orders with Fixed Visit URL Extraction")
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
        
        # Launch browser and login
        page = await scraper.browser_automation.launch_browser(
            headless=False,  # Show browser so you can see it working
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
        
        # Extract work orders
        print("\n🔍 Extracting work orders...")
        work_orders = await scraper.extract_work_orders_from_page(page)
        
        if not work_orders:
            print("❌ No work orders found")
            return False
        
        print(f"✅ Found {len(work_orders)} work orders")
        
        # Save to database
        print("\n💾 Saving to database...")
        db = SessionLocal()
        try:
            saved_count = 0
            for wo in work_orders:
                # Convert to dict for database
                wo_dict = {
                    'external_id': wo.external_id,
                    'site_name': wo.site_name,
                    'address': wo.address,
                    'scheduled_date': wo.scheduled_date,
                    'status': wo.status,
                    'customer_name': wo.customer_name,
                    'store_number': wo.store_number,
                    'service_code': wo.service_code,
                    'service_name': wo.service_name,
                    'service_items': wo.service_items,
                    'visit_url': wo.visit_url,
                    'visit_id': wo.visit_id,
                    'visit_number': wo.visit_number,
                    'customer_url': wo.customer_url,
                    'street': wo.street,
                    'city_state': wo.city_state,
                    'county': wo.county,
                    'created_date': wo.created_date,
                    'created_by': wo.created_by,
                    'instructions': wo.instructions,
                    'user_id': credentials.get('user_id', '7bea3bdb7e8e303eacaba442bd824004')
                }
                
                # Create work order
                db_wo = WorkOrder(**wo_dict)
                db.add(db_wo)
                saved_count += 1
                
                # Log key fields
                if saved_count <= 5:  # Show first 5
                    print(f"\n  Work Order {wo.external_id}:")
                    print(f"    Site: {wo.site_name}")
                    print(f"    Visit URL: {wo.visit_url}")
                    print(f"    Visit Number: {wo.visit_number}")
                    print(f"    Service: {wo.service_name} ({wo.service_code})")
            
            db.commit()
            print(f"\n✅ Saved {saved_count} work orders to database")
            
            # Verify the data
            print("\n🔍 Verifying saved data...")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Check visit URLs
            cursor.execute("""
                SELECT COUNT(*) FROM work_orders 
                WHERE visit_url LIKE '%/visits/%'
            """)
            visit_count = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM work_orders 
                WHERE visit_number IS NOT NULL
            """)
            visit_number_count = cursor.fetchone()[0]
            
            print(f"✅ Work orders with proper visit URLs: {visit_count}/{saved_count}")
            print(f"✅ Work orders with visit numbers: {visit_number_count}/{saved_count}")
            
            # Show sample
            cursor.execute("""
                SELECT external_id, visit_url, visit_number 
                FROM work_orders 
                WHERE visit_url IS NOT NULL 
                LIMIT 3
            """)
            samples = cursor.fetchall()
            if samples:
                print("\n📋 Sample work orders:")
                for ext_id, url, num in samples:
                    print(f"  WO {ext_id}: visit_number={num}, url={url}")
            
            conn.close()
            
        finally:
            db.close()
        
        return True
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        await scraper.browser_automation.close_browser()
        print("\n✅ Browser closed")

async def main():
    """Main function"""
    
    # First, clear existing work orders
    if not clear_work_orders():
        return
    
    # Then re-scrape with fixed logic
    success = await rescrape_work_orders()
    
    if success:
        print("\n🎉 Successfully re-scraped work orders with correct visit URLs!")
    else:
        print("\n❌ Re-scraping failed")

if __name__ == "__main__":
    asyncio.run(main())