#!/usr/bin/env python3
"""Simple extraction test"""

import sys
from pathlib import Path
# Add backend directory to path
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import asyncio
import json
from app.database import SessionLocal
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def simple_test():
    """Simple extraction test"""
    
    db = SessionLocal()
    
    try:
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
            
        print("🚀 Starting browser...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--disable-blink-features=AutomationControlled']
            )
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            )
            
            page = await context.new_page()
            
            # Login
            print("🔐 Logging in...")
            await page.goto('https://app.workfossa.com')
            await page.wait_for_timeout(2000)
            
            await page.fill('input[name="email"]', cred.username)
            await page.fill('input[name="password"]', cred.password)
            await page.click('text=Log In')
            await page.wait_for_timeout(7000)
            
            # Navigate
            print("🌐 Navigating to location...")
            await page.goto('https://app.workfossa.com/app/customers/locations/32951/', wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            # Click Equipment tab
            print("👆 Clicking Equipment tab...")
            await page.click('text=Equipment')
            await page.wait_for_timeout(2000)
            
            # Close modal if present
            try:
                await page.click('button:has-text("Cancel")', timeout=1000)
                await page.wait_for_timeout(1000)
            except:
                pass
            
            # Click Dispenser section
            print("👆 Clicking Dispenser section...")
            await page.click('text=Dispenser (8)')
            await page.wait_for_timeout(2000)
            
            # Simple extraction using evaluate
            print("\n📋 Extracting dispensers...")
            
            dispensers = await page.evaluate("""
                () => {
                    const results = [];
                    
                    // Find the dispenser section
                    const sections = document.querySelectorAll('.mt-4');
                    let dispenserSection = null;
                    
                    for (const section of sections) {
                        const header = section.querySelector('.bold');
                        if (header && header.textContent.includes('Dispenser')) {
                            dispenserSection = section;
                            break;
                        }
                    }
                    
                    if (!dispenserSection) {
                        console.log('No dispenser section found');
                        return results;
                    }
                    
                    // Get all rows/containers in the dispenser section
                    const containers = dispenserSection.querySelectorAll('.py-1\\\\.5');
                    console.log(`Found ${containers.length} containers`);
                    
                    containers.forEach((container, index) => {
                        const text = container.textContent || '';
                        if (!text.includes('S/N:')) return; // Skip if no serial number
                        
                        const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
                        
                        const dispenser = {
                            index: index + 1,
                            title: lines[0] || 'Unknown',
                            serial: '',
                            make: '',
                            model: '',
                            grade: '',
                            raw_text: text.substring(0, 200) + '...'
                        };
                        
                        // Extract S/N
                        const snMatch = text.match(/S\\/N:\\s*([A-Z0-9]+)/);
                        if (snMatch) dispenser.serial = snMatch[1];
                        
                        // Extract MAKE
                        const makeMatch = text.match(/MAKE:\\s*([^\\n]+)/);
                        if (makeMatch) dispenser.make = makeMatch[1].trim();
                        
                        // Extract MODEL
                        const modelMatch = text.match(/MODEL:\\s*([^\\n]+)/);
                        if (modelMatch) dispenser.model = modelMatch[1].trim();
                        
                        // Extract GRADE
                        const gradeMatch = text.match(/GRADE\\s+([^\\n]+?)(?=\\s*STAND|\\s*METER|\\s*NUMBER|$)/);
                        if (gradeMatch) dispenser.grade = gradeMatch[1].trim();
                        
                        results.push(dispenser);
                    });
                    
                    return results;
                }
            """)
            
            print(f"\n✅ Found {len(dispensers)} dispensers")
            
            for d in dispensers:
                print(f"\nDispenser {d['index']}:")
                print(f"  Title: {d['title']}")
                print(f"  S/N: {d['serial']}")
                print(f"  Make: {d['make']}")
                print(f"  Model: {d['model']}")
                print(f"  Grade: {d['grade']}")
                
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(simple_test())