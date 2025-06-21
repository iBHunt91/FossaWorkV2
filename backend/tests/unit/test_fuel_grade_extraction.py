#!/usr/bin/env python3
"""
Test fuel grade extraction to see the actual format
"""

import asyncio
import re
from playwright.async_api import async_playwright

async def test_fuel_grade_extraction():
    """Test how fuel grades appear in the HTML"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        print("🔍 Testing Fuel Grade Extraction")
        print("=" * 80)
        
        # Navigate to WorkFossa
        print("\n1️⃣ Please navigate to a dispenser page manually")
        print("2️⃣ Expand the Dispenser section")
        print("3️⃣ Press Enter when ready...")
        input()
        
        # Get the raw HTML of dispenser containers
        containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        print(f"\n✅ Found {len(containers)} dispenser containers")
        
        for i, container in enumerate(containers[:3]):  # First 3 dispensers
            text = await container.text_content()
            if not text or 'S/N' not in text:
                continue
                
            print(f"\n📋 Dispenser {i+1}")
            print("-" * 60)
            
            # Show the raw text around Grade field
            lines = text.split('\n')
            in_grade_section = False
            grade_lines = []
            
            for j, line in enumerate(lines):
                if 'Grade' in line and not 'GRADE' in line:
                    print(f"Found Grade label at line {j}: '{line.strip()}'")
                    in_grade_section = True
                    # Get next few lines after Grade
                    for k in range(j+1, min(j+10, len(lines))):
                        next_line = lines[k].strip()
                        if next_line and not any(label in next_line for label in ['STAND', 'METER', 'MODEL', 'MAKE', 'Electronic']):
                            grade_lines.append(next_line)
                        elif any(label in next_line for label in ['STAND', 'METER', 'MODEL', 'MAKE']):
                            break
                    break
            
            print(f"Grade lines found: {grade_lines}")
            
            # Try different extraction patterns
            print("\n🔍 Extraction attempts:")
            
            # Pattern 1: Look for Grade field with newline-separated values
            grade_match = re.search(r'Grade\s*\n((?:[^\n]+\n?)+?)(?=(?:STAND|METER|Electronic|$))', text, re.IGNORECASE | re.MULTILINE)
            if grade_match:
                grade_text = grade_match.group(1).strip()
                print(f"Pattern 1 (multiline): '{grade_text}'")
                # Split by newlines and filter empty
                grades = [g.strip() for g in grade_text.split('\n') if g.strip()]
                print(f"Extracted grades: {grades}")
            
            # Pattern 2: Extract individual grade lines
            all_grades = []
            grade_patterns = [
                r'Regular',
                r'Plus',
                r'Premium',
                r'Super',
                r'Diesel',
                r'Ethanol-Free.*',
                r'E\d+',  # E85, E15, etc.
                r'Unleaded.*'
            ]
            
            for pattern in grade_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                all_grades.extend(matches)
            
            print(f"\nPattern 2 (individual): {list(set(all_grades))}")
            
            # Show the actual HTML structure
            inner_html = await container.inner_html()
            if 'Grade' in inner_html:
                grade_section = re.search(r'Grade.*?</div>.*?<div[^>]*>([^<]+(?:<[^>]+>[^<]+)*)', inner_html, re.IGNORECASE | re.DOTALL)
                if grade_section:
                    print(f"\nHTML structure: {grade_section.group(0)[:200]}...")
        
        print("\n✅ Test complete. Close browser when done.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_fuel_grade_extraction())