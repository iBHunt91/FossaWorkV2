#!/usr/bin/env python3
"""
Quick test to verify fuel grade extraction is working correctly without hardcoded octane values
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import json
from app.services.browser_automation import browser_automation
from app.services.dispenser_scraper import dispenser_scraper
from app.services.workfossa_scraper import workfossa_scraper

async def test_fuel_grade_extraction():
    """Test that fuel grades are extracted correctly without hardcoded octane values"""
    
    print("🧪 Testing Fuel Grade Extraction Fix")
    print("=" * 80)
    
    # Test store 5127 which should have Super and Ethanol-Free Gasoline Plus
    work_order_id = "test_5127"
    customer_url = "https://app.workfossa.com/app/customers/locations/32820/"
    
    print(f"Testing Store #5127")
    print(f"Customer URL: {customer_url}")
    print()
    
    try:
        # Initialize browser service
        service = await browser_automation.get_or_create_service("test_user")
        if not service:
            print("❌ Failed to create browser service")
            return
        
        page = service.page
        
        # Login if needed
        if not page.url.startswith("https://app.workfossa.com"):
            print("🔐 Logging into WorkFossa...")
            success = await workfossa_scraper.login(page, "test_user")
            if not success:
                print("❌ Login failed")
                return
        
        # Navigate to customer page
        print(f"🔗 Navigating to customer page...")
        await page.goto(customer_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        
        # Scrape dispensers
        print("📋 Scraping dispensers...")
        dispensers, html = await dispenser_scraper.scrape_dispensers_for_work_order(
            page, 
            work_order_id=work_order_id,
            visit_url=None  # Already at customer page
        )
        
        print(f"\n✅ Found {len(dispensers)} dispensers")
        
        # Check fuel grades for each dispenser
        print("\n📊 Fuel Grade Analysis:")
        print("-" * 80)
        
        for disp in dispensers:
            print(f"\nDispenser {disp.dispenser_number}:")
            print(f"  Title: {disp.title}")
            print(f"  Grades List: {disp.grades_list}")
            print(f"  Fuel Grades Dict:")
            
            # Check that no octane values are present
            has_octane = False
            for grade_key, grade_info in disp.fuel_grades.items():
                if 'octane' in grade_info:
                    has_octane = True
                    print(f"    ❌ {grade_key}: {grade_info} (CONTAINS OCTANE!)")
                else:
                    print(f"    ✅ {grade_key}: {grade_info}")
            
            if has_octane:
                print("    ⚠️  WARNING: Hardcoded octane values found!")
            
            # Check for specific grades
            if 'super' in disp.fuel_grades:
                print("    ✅ Super grade found")
            else:
                print("    ❌ Super grade missing")
                
            if 'ethanol_free_gasoline_plus' in disp.fuel_grades:
                print("    ✅ Ethanol-Free Gasoline Plus found")
            else:
                print("    ❌ Ethanol-Free Gasoline Plus missing")
        
        print("\n" + "=" * 80)
        print("✅ Test complete")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await browser_automation.cleanup_service("test_user")

if __name__ == "__main__":
    asyncio.run(test_fuel_grade_extraction())