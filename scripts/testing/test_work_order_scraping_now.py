#!/usr/bin/env python3
"""
Test work order scraping after credential fix
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.logging_service import get_logger

logger = get_logger("test_scraping")

async def test_scraping():
    """Test work order scraping with the fixed credentials"""
    print("🧪 Testing Work Order Scraping")
    print("=" * 50)
    
    # Initialize browser automation service with visible browser
    from app.services.browser_automation import BrowserAutomationService
    browser_service = BrowserAutomationService(headless=False)
    
    # Initialize scraper
    scraper = WorkFossaScraper(browser_service)
    
    try:
        # Test with the user that had the credential issue
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        print(f"\n📋 Testing authentication for user: {user_id}")
        auth_result = await scraper.authenticate(user_id)
        
        if auth_result['status'] == 'success':
            print(f"✅ Authentication successful!")
            
            print(f"\n📋 Scraping work orders...")
            work_orders = await scraper.scrape_work_orders(limit=5)
            
            if work_orders:
                print(f"✅ Successfully scraped {len(work_orders)} work orders!")
                
                for i, wo in enumerate(work_orders[:3], 1):
                    print(f"\nWork Order {i}:")
                    print(f"  Job ID: {wo.get('job_id', 'N/A')}")
                    print(f"  Store: {wo.get('store_number', 'N/A')}")
                    print(f"  Customer: {wo.get('customer_name', 'N/A')}")
            else:
                print("❌ No work orders found")
        else:
            print(f"❌ Authentication failed: {auth_result.get('message', 'Unknown error')}")
            
        # Keep browser open for a moment to observe
        print("\n⏸️  Browser will close in 5 seconds...")
        await asyncio.sleep(5)
        
    except Exception as e:
        print(f"💥 Error: {str(e)}")
        logger.exception("Scraping test failed")
    finally:
        await browser_service.close()
        print("✅ Test complete")

if __name__ == "__main__":
    asyncio.run(test_scraping())