#!/usr/bin/env python3
"""Complete test with proper navigation and waits"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import asyncio
import json
from app.database import SessionLocal
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def test_complete_fix():
    """Test dispenser scraping with proper waits and navigation"""
    
    db = SessionLocal()
    
    try:
        # Get work order 110296
        work_order = db.execute(sql_text("""
            SELECT * FROM work_orders
            WHERE external_id = '110296'
            AND user_id = '7bea3bdb7e8e303eacaba442bd824004'
        """)).fetchone()
        
        if not work_order:
            print("❌ Work order 110296 not found")
            return
            
        scraped_data = json.loads(work_order.scraped_data) if work_order.scraped_data else {}
        customer_url = scraped_data.get('customer_url', 'https://app.workfossa.com/app/customers/locations/32951/')
        
        print("=" * 60)
        print("COMPLETE DISPENSER SCRAPING TEST")
        print("=" * 60)
        print(f"Work Order: {work_order.external_id} - {work_order.site_name}")
        print(f"Customer URL: {customer_url}")
        
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
            
        print("\n🚀 Starting browser...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,  # Visible for debugging
                args=['--disable-blink-features=AutomationControlled']
            )
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            )
            
            page = await context.new_page()
            
            # Login
            print("\n🔐 Logging in...")
            await page.goto('https://app.workfossa.com')
            await page.wait_for_timeout(2000)
            
            await page.fill('input[name="email"]', cred.username)
            await page.fill('input[name="password"]', cred.password)
            await page.click('text=Log In')
            
            # Wait for login
            await page.wait_for_timeout(7000)
            print(f"✅ Logged in. Current URL: {page.url}")
            
            # Navigate to customer URL
            print(f"\n🌐 Navigating to: {customer_url}")
            await page.goto(customer_url, wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            # Check if location exists
            page_content = await page.content()
            if "Could not find this location" in page_content:
                print("❌ ERROR: Location not found")
                await browser.close()
                return
                
            print("✅ On customer page")
            
            # Click Equipment tab
            print("\n🔍 Step 1: Clicking Equipment tab...")
            await page.click('text=Equipment')
            await page.wait_for_timeout(2000)
            print("✅ Equipment tab clicked")
            
            # Close any modals that might have opened
            print("\n🔍 Step 2: Checking for and closing any modals...")
            try:
                cancel_button = await page.locator('button:has-text("Cancel")').first
                if await cancel_button.is_visible():
                    await cancel_button.click()
                    print("✅ Closed modal")
                    await page.wait_for_timeout(1000)
            except:
                print("✅ No modal to close")
            
            # Now look for and click Dispenser section
            print("\n🔍 Step 3: Looking for Dispenser section...")
            
            # Find and click the Dispenser section
            dispenser_clicked = False
            
            # Method 1: Click by exact text pattern
            try:
                # Look for "Dispenser (8)" or similar
                dispenser_elements = await page.locator('text=/^Dispenser\\s*\\(\\d+\\)$/').all()
                if dispenser_elements:
                    await dispenser_elements[0].click()
                    dispenser_clicked = True
                    print(f"✅ Clicked Dispenser section")
            except:
                pass
            
            # Method 2: JavaScript click
            if not dispenser_clicked:
                clicked = await page.evaluate("""
                    () => {
                        const elements = document.querySelectorAll('*');
                        for (const el of elements) {
                            const text = el.textContent?.trim() || '';
                            if (text.match(/^Dispenser\\s*\\(\\d+\\)$/) && !el.querySelector('*')) {
                                el.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                if clicked:
                    dispenser_clicked = True
                    print("✅ Clicked Dispenser section using JavaScript")
            
            if not dispenser_clicked:
                print("❌ Could not click Dispenser section")
                await browser.close()
                return
                
            # Wait for dispensers to appear
            print("\n🔍 Step 4: Waiting for dispensers to appear...")
            await page.wait_for_timeout(3000)
            
            # Extract dispensers manually
            print("\n📋 Step 5: Extracting dispenser information...")
            
            dispensers = await page.evaluate("""
                () => {
                    const dispensers = [];
                    
                    // Find all dispenser containers
                    const containers = document.querySelectorAll('.py-1\\\\.5, .py-1\\\\.5.bg-gray-50');
                    
                    containers.forEach((container, index) => {
                        // Check if this is a dispenser container
                        const px2Div = container.querySelector('.px-2');
                        if (!px2Div) return;
                        
                        // Get the main content
                        const flexDiv = px2Div.querySelector('.flex.align-start');
                        if (!flexDiv) return;
                        
                        const contentDiv = flexDiv.querySelector('div');
                        if (!contentDiv) return;
                        
                        // Extract title
                        const fullText = contentDiv.textContent;
                        const titleMatch = fullText.match(/^([^\\n]+)/);
                        const title = titleMatch ? titleMatch[1].trim() : '';
                        
                        if (!title || title.length < 5) return;
                        
                        // Get serial number
                        const serialEl = container.querySelector('.muted.text-tiny');
                        const serial = serialEl ? serialEl.textContent.replace('S/N:', '').trim() : '';
                        
                        // Get make and model
                        let make = '';
                        let model = '';
                        
                        const makeSpan = Array.from(container.querySelectorAll('span')).find(span => 
                            span.textContent.includes('Make:')
                        );
                        const modelSpan = Array.from(container.querySelectorAll('span')).find(span => 
                            span.textContent.includes('Model:')
                        );
                        
                        if (makeSpan && makeSpan.parentElement) {
                            make = makeSpan.parentElement.textContent.replace('Make:', '').trim();
                        }
                        if (modelSpan && modelSpan.parentElement) {
                            model = modelSpan.parentElement.textContent.replace('Model:', '').trim();
                        }
                        
                        // Get custom fields
                        const fields = {};
                        const customFieldsView = container.querySelector('.custom-fields-view');
                        if (customFieldsView) {
                            const fieldDivs = customFieldsView.querySelectorAll('.row > div');
                            fieldDivs.forEach(fieldDiv => {
                                const label = fieldDiv.querySelector('.muted.uppercase.text-xs');
                                const value = fieldDiv.querySelector('.text-xs.mt-1');
                                if (label && value) {
                                    fields[label.textContent.trim()] = value.textContent.trim();
                                }
                            });
                        }
                        
                        dispensers.push({
                            index: index + 1,
                            title,
                            serial,
                            make,
                            model,
                            fields
                        });
                    });
                    
                    return dispensers;
                }
            """)
            
            print(f"\n✅ Found {len(dispensers)} dispensers")
            
            if dispensers:
                print("\n📋 Dispenser Details:")
                for dispenser in dispensers:
                    print(f"\nDispenser {dispenser['index']}:")
                    print(f"  Title: {dispenser['title']}")
                    print(f"  S/N: {dispenser['serial']}")
                    print(f"  Make: {dispenser['make']}")
                    print(f"  Model: {dispenser['model']}")
                    if dispenser['fields']:
                        print("  Custom Fields:")
                        for key, value in dispenser['fields'].items():
                            print(f"    {key}: {value}")
            
            print("\n⏸️  Browser will remain open. Press Enter to close...")
            input()
            
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_complete_fix())