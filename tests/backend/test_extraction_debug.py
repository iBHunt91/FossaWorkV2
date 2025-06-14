#!/usr/bin/env python3
"""Debug the extraction logic"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import asyncio
from playwright.async_api import async_playwright

async def debug_extraction():
    """Debug extraction with manual navigation"""
    
    print("Starting extraction debug...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Visible browser
        page = await browser.new_page()
        
        # Load the debug screenshot HTML if saved, or navigate manually
        print("\n⏸️  Please navigate to the dispenser page manually")
        print("   1. Login to WorkFossa")
        print("   2. Go to location 32951")
        print("   3. Click Equipment tab")
        print("   4. Click Dispenser (8)")
        print("\n   Press Enter when dispensers are visible...")
        input()
        
        # Now test extraction
        print("\n🔍 Testing extraction methods...")
        
        # Method 1: Check container structure
        containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        print(f"\nFound {len(containers)} containers")
        
        # Debug first container
        if containers:
            print("\n📋 Debugging first container...")
            container = containers[0]
            
            # Get all text
            all_text = await container.inner_text()
            print(f"\nAll text:\n{all_text}")
            print("-" * 40)
            
            # Check structure
            has_px2 = await container.locator('.px-2').count()
            print(f"Has .px-2: {has_px2}")
            
            if has_px2:
                # Get the title area
                title_candidates = await container.locator('.flex.align-start > div, .flex.align-start div').all()
                print(f"Title candidates: {len(title_candidates)}")
                
                for i, candidate in enumerate(title_candidates[:3]):
                    text = await candidate.inner_text()
                    print(f"Candidate {i}: {text[:100]}...")
                    
            # Look for S/N
            sn_elements = await container.locator('*:has-text("S/N:")').all()
            print(f"\nS/N elements: {len(sn_elements)}")
            if sn_elements:
                sn_text = await sn_elements[0].inner_text()
                print(f"S/N text: {sn_text}")
                
            # Look for Make/Model
            make_elements = await container.locator('*:has-text("MAKE:")').all()
            print(f"\nMAKE elements: {len(make_elements)}")
            if make_elements:
                make_text = await make_elements[0].inner_text()
                print(f"MAKE text: {make_text}")
                
        print("\n⏸️  Press Enter to close browser...")
        input()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_extraction())