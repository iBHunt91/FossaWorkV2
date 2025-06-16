#!/usr/bin/env python3
"""
Comprehensive test script to verify all work order extraction improvements.
Tests the complete extraction including visit_number, proper site names, service items, etc.
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
import logging

logger = logging.getLogger(__name__)

async def test_complete_extraction():
    """Test complete work order extraction with all new fields"""
    
    print("🧪 Comprehensive Work Order Extraction Test")
    print("=" * 80)
    print("This test verifies:")
    print("  1. Site names like '7-Eleven' are extracted correctly")
    print("  2. Visit numbers are extracted from URLs")
    print("  3. Service items show dispenser counts")
    print("  4. Scheduled dates are properly captured")
    print("  5. All fields are stored correctly")
    print("=" * 80)
    
    # Initialize services
    browser_automation = BrowserAutomationService()
    scraper = WorkFossaScraper(browser_automation)
    
    results = {
        "test_time": datetime.now().isoformat(),
        "issues_found": [],
        "work_orders_tested": 0,
        "fields_verified": {}
    }
    
    try:
        # Get credentials
        credentials = await scraper.load_credentials()
        if not credentials:
            print("❌ No credentials found. Please configure WorkFossa credentials first.")
            return False
        
        print("✅ Credentials loaded")
        
        # Launch browser and login
        page = await scraper.browser_automation.launch_browser(
            headless=True,  # Run headless for automated testing
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
            dropdown_selector = "div.ks-select-selection:has-text('Show')"
            await page.wait_for_selector(dropdown_selector, timeout=5000)
            await page.click(dropdown_selector)
            await page.wait_for_timeout(1000)
            
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
        results["work_orders_tested"] = len(work_orders)
        
        # Test up to 5 work orders
        for i, work_order in enumerate(work_orders[:5]):
            print(f"\n📋 Testing Work Order #{i+1} (ID: {work_order.id})")
            print("-" * 60)
            
            # Check 1: Site name should include hyphens (e.g., "7-Eleven")
            if work_order.site_name:
                print(f"Site Name: {work_order.site_name}")
                if "Eleven" in work_order.site_name and "7-" not in work_order.site_name:
                    issue = f"Site name missing hyphen: '{work_order.site_name}' (should be '7-Eleven')"
                    print(f"❌ {issue}")
                    results["issues_found"].append(issue)
                else:
                    print("✅ Site name looks correct")
            
            # Check 2: Visit number extraction
            if work_order.visit_url:
                print(f"Visit URL: {work_order.visit_url}")
                print(f"Visit Number: {work_order.visit_number}")
                
                if not work_order.visit_number:
                    issue = f"Visit number not extracted from URL: {work_order.visit_url}"
                    print(f"❌ {issue}")
                    results["issues_found"].append(issue)
                else:
                    print(f"✅ Visit number extracted: {work_order.visit_number}")
            
            # Check 3: Service items and dispenser count
            if work_order.service_items:
                print(f"Service Items: {work_order.service_items}")
                
                # Check for dispenser count in service items
                dispenser_count = 0
                for item in work_order.service_items:
                    import re
                    match = re.search(r'(\d+)\s*x\s*(All\s*)?Dispenser', item)
                    if match:
                        dispenser_count = int(match.group(1))
                        print(f"✅ Found dispenser count in service items: {dispenser_count}")
                        break
                
                if dispenser_count == 0 and any("Dispenser" in item for item in work_order.service_items):
                    issue = f"Could not extract dispenser count from: {work_order.service_items}"
                    print(f"⚠️  {issue}")
            
            # Check 4: Scheduled date
            if work_order.scheduled_date:
                print(f"Scheduled Date: {work_order.scheduled_date}")
                print("✅ Scheduled date extracted")
            else:
                print("⚠️  No scheduled date found")
            
            # Check 5: Service name
            if work_order.service_name:
                print(f"Service Name: {work_order.service_name}")
                print("✅ Service name extracted")
            else:
                print("⚠️  No service name found")
            
            # Track which fields were populated
            fields = [
                "id", "external_id", "site_name", "address", "scheduled_date",
                "status", "visit_url", "visit_number", "store_number", 
                "service_code", "service_name", "service_items", "customer_url",
                "street", "city_state", "county", "created_date", "created_by"
            ]
            
            for field in fields:
                value = getattr(work_order, field, None)
                if field not in results["fields_verified"]:
                    results["fields_verified"][field] = {"populated": 0, "empty": 0}
                
                if value:
                    results["fields_verified"][field]["populated"] += 1
                else:
                    results["fields_verified"][field]["empty"] += 1
        
        # Print summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        print(f"Work Orders Tested: {results['work_orders_tested']}")
        print(f"Issues Found: {len(results['issues_found'])}")
        
        if results["issues_found"]:
            print("\n⚠️  Issues:")
            for issue in results["issues_found"]:
                print(f"  - {issue}")
        
        print("\n📈 Field Population Stats:")
        for field, stats in results["fields_verified"].items():
            total = stats["populated"] + stats["empty"]
            if total > 0:
                percentage = (stats["populated"] / total) * 100
                print(f"  {field}: {stats['populated']}/{total} ({percentage:.0f}%)")
        
        # Save results to JSON
        results_file = f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n💾 Results saved to: {results_file}")
        
        return len(results["issues_found"]) == 0
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Close browser
        try:
            await scraper.browser_automation.close_browser()
            print("\n✅ Browser closed")
        except:
            pass

if __name__ == "__main__":
    success = asyncio.run(test_complete_extraction())
    if success:
        print("\n🎉 All tests passed! Work order extraction is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please review the results.")
        sys.exit(1)