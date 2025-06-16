#!/usr/bin/env python3
"""
Test the enhanced fuel grade extraction
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import json
from app.services.browser_automation import browser_automation
from app.services.dispenser_scraper import dispenser_scraper

async def test_fuel_extraction():
    """Test fuel grade extraction with Store #5127"""
    
    print("🧪 Testing Enhanced Fuel Grade Extraction")
    print("=" * 80)
    
    # Test data that mimics the actual format from WorkFossa
    test_text = """1/2 - Regular, Plus, Premium, Super, Ethanol-Free Gasoline Plus - Gilbarco
S/N: 1CB223020893
MAKE: Gilbarco
MODEL: NL2
Grade
Regular
Plus
Premium
Super
Ethanol-Free Gasoline Plus
STAND ALONE CODE
0128
METER TYPE
Electronic
NUMBER OF NOZZLES PER SIDE
2"""

    # Extract using the regex pattern from dispenser_scraper
    import re
    
    # Test the Grade field extraction
    grade_match = re.search(r'Grade\s*\n((?:[^\n]+\n?)+?)(?=(?:STAND|METER|Electronic|NUMBER|$))', test_text, re.IGNORECASE | re.MULTILINE)
    if grade_match:
        grade_text = grade_match.group(1).strip()
        fuel_list = [f.strip() for f in grade_text.split('\n') if f.strip()]
        print(f"✅ Extracted fuel grades: {fuel_list}")
    else:
        print("❌ Failed to extract fuel grades")
    
    # Create fuel grades dict
    fuel_grades = {}
    for fuel in fuel_list:
        fuel_lower = fuel.lower()
        fuel_key = fuel_lower.replace(' ', '_').replace('-', '_')
        
        if 'regular' in fuel_lower:
            fuel_grades['regular'] = {'octane': 87, 'name': fuel}
        elif 'plus' in fuel_lower and 'ethanol' not in fuel_lower:
            fuel_grades['plus'] = {'octane': 89, 'name': fuel}
        elif 'premium' in fuel_lower:
            fuel_grades['premium'] = {'octane': 91, 'name': fuel}
        elif 'super' in fuel_lower:
            fuel_grades['super'] = {'octane': 93, 'name': fuel}
        elif 'diesel' in fuel_lower:
            fuel_grades['diesel'] = {'octane': None, 'name': fuel}
        elif 'ethanol' in fuel_lower:
            fuel_grades[fuel_key] = {'octane': None, 'name': fuel}
        else:
            fuel_grades[fuel_key] = {'octane': None, 'name': fuel}
    
    print(f"\n📊 Fuel grades dict:")
    print(json.dumps(fuel_grades, indent=2))
    
    # Test with actual scraping
    print("\n\n🌐 Testing with actual WorkFossa scraping...")
    print("1. This will log into WorkFossa")
    print("2. Navigate to Store #5127 (Visit 136664)")
    print("3. Scrape dispenser information")
    print("\nPress Enter to continue or Ctrl+C to skip...")
    
    try:
        input()
        
        # Initialize browser service
        service = await browser_automation.get_or_create_service("test_user")
        if not service:
            print("❌ Failed to create browser service")
            return
        
        try:
            page = service.page
            
            # Navigate to the customer URL for Store #5127
            customer_url = "https://app.workfossa.com/app/customers/locations/32820/"
            print(f"\n🔗 Navigating to: {customer_url}")
            
            await page.goto(customer_url, wait_until="domcontentloaded", timeout=30000)
            
            # Run the dispenser scraper
            dispensers, html = await dispenser_scraper.scrape_dispensers_for_work_order(
                page, 
                work_order_id="test_5127",
                visit_url=None  # Already at the customer page
            )
            
            print(f"\n✅ Found {len(dispensers)} dispensers")
            
            # Show fuel grades for each dispenser
            for disp in dispensers:
                print(f"\n📋 Dispenser {disp.dispenser_number}:")
                print(f"   Title: {disp.title}")
                print(f"   Fuel Grades List: {disp.grades_list}")
                print(f"   Fuel Grades Dict:")
                for grade_key, grade_info in disp.fuel_grades.items():
                    print(f"      - {grade_key}: {grade_info}")
                
        finally:
            await browser_automation.cleanup_service("test_user")
            
    except KeyboardInterrupt:
        print("\n⏹️  Skipping actual scraping test")

if __name__ == "__main__":
    asyncio.run(test_fuel_extraction())