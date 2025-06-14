#!/usr/bin/env python3
"""
Simple test script to verify work order scraping works
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
    """Test work order scraping"""
    print("\n=== Testing Work Order Scraping ===\n")
    
    # Test user ID
    user_id = "test_user"
    session_id = f"{user_id}_test"
    
    try:
        # Initialize browser service
        print("1. Initializing browser service...")
        success = await browser_automation.initialize()
        if not success:
            print("❌ Failed to initialize browser service")
            return
        print("✅ Browser service initialized")
        
        # Create session
        print("\n2. Creating browser session...")
        success = await browser_automation.create_session(session_id)
        if not success:
            print("❌ Failed to create browser session")
            return
        print("✅ Browser session created")
        
        # Login
        print("\n3. Logging in to WorkFossa...")
        login_result = await browser_automation.login_to_workfossa(
            session_id=session_id,
            email="fossatest123@gmail.com",
            password="FossaDemo123!"
        )
        
        if not login_result.get('success'):
            print(f"❌ Login failed: {login_result.get('error', 'Unknown error')}")
            return
        
        print("✅ Login successful")
        
        # Test work order scraping
        print("\n4. Scraping work orders...")
        work_orders = await workfossa_scraper.scrape_work_orders(session_id)
        
        print(f"\n✅ Found {len(work_orders)} work orders")
        
        # Display results
        if work_orders:
            print("\n5. Work Order Details:")
            print("-" * 80)
            
            for i, wo in enumerate(work_orders[:5]):  # Show first 5
                print(f"\nWork Order #{i+1}:")
                print(f"  ID: {wo.id}")
                print(f"  Site: {wo.site_name}")
                print(f"  Customer: {wo.customer_name}")
                print(f"  Store #: {wo.store_number}")
                print(f"  Address: {wo.address}")
                print(f"  Service: {wo.service_code} - {wo.service_description}")
                print(f"  Quantity: {wo.service_quantity} dispensers")
                print(f"  Visit URL: {wo.visit_url}")
                print(f"  Scheduled: {wo.scheduled_date}")
            
            if len(work_orders) > 5:
                print(f"\n... and {len(work_orders) - 5} more work orders")
        else:
            print("\n❌ No work orders found - scraping may have failed")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        print("\n6. Cleaning up...")
        if browser_automation.pages.get(session_id):
            await browser_automation.close_session(session_id)
        await browser_automation.shutdown()
        print("✅ Cleanup completed")

if __name__ == "__main__":
    asyncio.run(test_work_order_scraping())