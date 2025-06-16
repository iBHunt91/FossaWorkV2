#!/usr/bin/env python3
"""
Test dispenser extraction to debug the issue
"""
import asyncio
from playwright.async_api import async_playwright
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

async def test_extraction():
    """Test dispenser extraction"""
    print("🔍 Testing Dispenser Extraction")
    print("=" * 70)
    
    # Sample HTML that might be on the page
    test_html = """
    <div class="dispenser-container">
        <div>Dispenser 1/2</div>
        <div>S/N: ABC123</div>
        <div>MAKE: Gilbarco</div>
        <div>MODEL: Encore</div>
        <div>GRADE 0126 0135 0136</div>
        <div>STAND ALONE CODE XYZ789</div>
        <div>NUMBER OF NOZZLES (PER SIDE) 6</div>
        <div>METER TYPE HD Meter</div>
    </div>
    """
    
    # JavaScript extraction logic similar to what's in dispenser_scraper
    js_code = """
    () => {
        const fullText = document.body.textContent || '';
        
        // Find dispenser number patterns
        let dispenserNumber = '';
        let title = '';
        
        // Pattern 1: "1/2 - Regular, Plus, Diesel..."
        let titleMatch = fullText.match(/(\\d+\\/\\d+\\s*-\\s*[^\\n]+)/);
        if (titleMatch) {
            title = titleMatch[1].trim();
            console.log('Found title pattern 1:', title);
        }
        
        // Pattern 2: Look for "Dispenser" followed by number
        if (!title) {
            titleMatch = fullText.match(/Dispenser\\s+(\\d+(?:\\/\\d+)?)/i);
            if (titleMatch) {
                dispenserNumber = titleMatch[1];
                title = `Dispenser ${dispenserNumber}`;
                console.log('Found title pattern 2:', title, 'Number:', dispenserNumber);
            }
        }
        
        // Pattern 3: Just find any number at start
        if (!title) {
            const numberAtStart = fullText.match(/^(\\d+(?:\\/\\d+)?)/m);
            if (numberAtStart) {
                dispenserNumber = numberAtStart[1];
                title = `Dispenser ${dispenserNumber}`;
                console.log('Found title pattern 3:', title, 'Number:', dispenserNumber);
            }
        }
        
        console.log('Final title:', title);
        console.log('Final dispenserNumber:', dispenserNumber);
        
        // Extract custom fields
        const fields = {};
        
        const gradeMatch = fullText.match(/GRADE\\s*([^\\n]+?)(?=\\s*STAND|\\s*METER|\\s*$)/);
        if (gradeMatch) {
            fields['GRADE'] = gradeMatch[1].trim();
            console.log('Found GRADE:', fields['GRADE']);
        }
        
        return {
            title,
            dispenserNumber,
            fields,
            fullText: fullText.substring(0, 200) // First 200 chars
        };
    }
    """
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Set content
        await page.set_content(f"<html><body>{test_html}</body></html>")
        
        # Run extraction
        result = await page.evaluate(js_code)
        
        print("\nExtraction Result:")
        print(f"  Title: {result['title']}")
        print(f"  Dispenser Number: {result['dispenserNumber']}")
        print(f"  Fields: {result['fields']}")
        print(f"  Full Text Preview: {result['fullText']}")
        
        # Check what went wrong
        if not result['dispenserNumber'] or result['dispenserNumber'] == '':
            print("\n❌ Failed to extract dispenser number!")
            print("The JavaScript patterns are not matching the actual HTML structure")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_extraction())