#!/usr/bin/env python3
"""
Test the visit URL extraction fix
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
import logging

# Set up basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_visit_url_extraction():
    """Test that visit URLs are extracted correctly"""
    print("🧪 Testing Visit URL Extraction Fix")
    print("=" * 80)
    
    # Create browser automation service
    browser_service = BrowserAutomationService()
    
    # Create scraper instance
    scraper = WorkFossaScraper(browser_service)
    
    try:
        # Login
        print("\n1. Logging in to WorkFossa...")
        login_result = await scraper.login("ibhunt@fossaautomation.com", "7c!BJ8M2HQebAA$B")
        if not login_result['success']:
            print(f"❌ Login failed: {login_result.get('error', 'Unknown error')}")
            return
        print("✅ Login successful")
        
        # Scrape work orders
        print("\n2. Scraping work orders...")
        work_orders = await scraper.scrape_work_orders(limit=5)
        
        if not work_orders:
            print("❌ No work orders found")
            return
            
        print(f"✅ Found {len(work_orders)} work orders")
        
        # Analyze results
        print("\n3. Analyzing visit URLs:")
        print("-" * 80)
        
        correct_urls = 0
        incorrect_urls = 0
        null_urls = 0
        
        for wo in work_orders:
            visit_url = wo.visit_url
            visit_number = wo.visit_number
            
            print(f"\nWork Order: {wo.id}")
            print(f"  Site: {wo.site_name}")
            print(f"  Visit URL: {visit_url}")
            print(f"  Visit Number: {visit_number}")
            
            if visit_url:
                if '/visits/' in visit_url:
                    print("  ✅ Correct format (contains /visits/)")
                    correct_urls += 1
                else:
                    print("  ⚠️  Incorrect format (missing /visits/)")
                    incorrect_urls += 1
            else:
                print("  ❌ No visit URL")
                null_urls += 1
        
        print("\n" + "=" * 80)
        print("RESULTS:")
        print("=" * 80)
        print(f"✅ Correct URLs: {correct_urls}")
        print(f"⚠️  Incorrect URLs: {incorrect_urls}")
        print(f"❌ Null URLs: {null_urls}")
        
        if correct_urls > 0 and incorrect_urls == 0:
            print("\n🎉 SUCCESS! Visit URLs are now being extracted correctly!")
        elif correct_urls > 0:
            print("\n⚠️  PARTIAL SUCCESS: Some visit URLs are correct, but some are still wrong")
        else:
            print("\n❌ FAILED: No correct visit URLs found")
            
    except Exception as e:
        print(f"\n❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await browser_service.close()

if __name__ == "__main__":
    asyncio.run(test_visit_url_extraction())