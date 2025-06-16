#!/usr/bin/env python3
"""Debug dispenser extraction to see raw text"""

import sys
from pathlib import Path
# Add backend directory to path
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import asyncio
from app.database import SessionLocal
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def debug_extraction():
    """Debug what text is actually extracted"""
    
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
            
            # Debug extraction - get first dispenser's raw text
            print("\n📋 Extracting first dispenser's raw text...")
            
            first_dispenser_text = await page.evaluate("""
                () => {
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
                        return 'No dispenser section found';
                    }
                    
                    // Get first dispenser container
                    const firstContainer = dispenserSection.querySelector('.py-1\\\\.5');
                    if (!firstContainer) {
                        return 'No dispenser container found';
                    }
                    
                    // Get raw text and HTML
                    return {
                        text: firstContainer.textContent,
                        html: firstContainer.innerHTML,
                        innerText: firstContainer.innerText
                    };
                }
            """)
            
            print("\n=== RAW TEXT (textContent) ===")
            if isinstance(first_dispenser_text, dict):
                print(repr(first_dispenser_text.get('text', '')))
                
                print("\n=== INNER TEXT ===")
                print(repr(first_dispenser_text.get('innerText', '')))
                
                print("\n=== HTML ===")
                print(first_dispenser_text.get('html', '')[:500] + "...")
            else:
                print(first_dispenser_text)
                
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(debug_extraction())