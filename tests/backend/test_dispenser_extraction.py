#!/usr/bin/env python3
"""Test dispenser extraction without interactive pauses"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import asyncio
import json
from app.database import SessionLocal
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def test_extraction():
    """Test dispenser extraction"""
    
    db = SessionLocal()
    
    try:
        # Get work order 110296
        work_order = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id = '110296'
        """)).fetchone()
        
        if not work_order:
            print("❌ Work order 110296 not found")
            return
            
        data = json.loads(work_order.scraped_data) if work_order.scraped_data else {}
        customer_url = data.get('customer_url', 'https://app.workfossa.com/app/customers/locations/32951/')
        
        print("=" * 60)
        print("DISPENSER EXTRACTION TEST")
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
            
        print("\n🚀 Starting browser (headless)...")
        
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
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
        
        # Navigate to customer location
        print(f"🌐 Navigating to customer location...")
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Check if location exists
        if "Could not find this location" in await page.content():
            print("❌ Location not found")
            await browser.close()
            await playwright.stop()
            return
            
        # Click Equipment tab
        print("👆 Clicking Equipment tab...")
        await page.click('text=Equipment')
        await page.wait_for_timeout(2000)
        
        # Close any modal
        try:
            cancel_button = page.locator('button:has-text("Cancel")')
            if await cancel_button.count() > 0:
                await cancel_button.first.click()
                print("✅ Closed modal")
                await page.wait_for_timeout(1000)
        except:
            pass
        
        # Click Dispenser section
        print("👆 Looking for Dispenser section...")
        
        # Debug: Find all text that contains "Dispenser"
        debug_elements = await page.locator('*:has-text("Dispenser")').all()
        print(f"   Found {len(debug_elements)} elements containing 'Dispenser'")
        
        # Try to find and click Dispenser section
        dispenser_clicked = False
        
        # Method 1: Click the Dispenser link/text
        try:
            # Look for the Dispenser (8) text specifically
            await page.click('text=Dispenser (8)', timeout=3000)
            dispenser_clicked = True
            print("✅ Clicked Dispenser section")
        except:
            # Try with regex for any number
            try:
                await page.click('text=/Dispenser \\(\\d+\\)/', timeout=3000)
                dispenser_clicked = True
                print("✅ Clicked Dispenser section (regex)")
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
                            console.log('Found Dispenser section:', text);
                            el.click();
                            return text;
                        }
                    }
                    return null;
                }
            """)
            if clicked:
                dispenser_clicked = True
                print(f"✅ Clicked Dispenser section: {clicked} (JS method)")
        
        if not dispenser_clicked:
            print("❌ Could not click Dispenser section")
            # Save debug screenshot
            await page.screenshot(path="debug_no_dispenser_section.png")
            print("📸 Debug screenshot saved: debug_no_dispenser_section.png")
            await browser.close()
            await playwright.stop()
            return
            
        await page.wait_for_timeout(2000)
        
        # Extract dispensers
        print("\n📋 Extracting dispenser information...")
        
        # Get all dispenser containers
        containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        print(f"Found {len(containers)} potential containers")
        
        dispensers = []
        for i, container in enumerate(containers):
            try:
                # Check if this has dispenser info
                if await container.locator('.px-2').count() > 0:
                    dispenser_data = {}
                    
                    # Extract title
                    title_elem = container.locator('.px-2 .flex.align-start > div').first
                    if await title_elem.count() > 0:
                        title_text = await title_elem.inner_text()
                        lines = title_text.strip().split('\n')
                        if lines:
                            dispenser_data['title'] = lines[0].strip()
                    
                    # Extract S/N
                    sn_elem = container.locator('.muted.text-tiny').first
                    if await sn_elem.count() > 0:
                        sn_text = await sn_elem.inner_text()
                        if 'S/N:' in sn_text:
                            dispenser_data['serial'] = sn_text.replace('S/N:', '').strip()
                    
                    # Extract Make
                    make_spans = await container.locator('span').all()
                    for span in make_spans:
                        text = await span.inner_text()
                        if 'Make:' in text:
                            parent = span.locator('..')
                            make_text = await parent.inner_text()
                            dispenser_data['make'] = make_text.replace('Make:', '').strip()
                            break
                    
                    # Extract Model
                    for span in make_spans:
                        text = await span.inner_text()
                        if 'Model:' in text:
                            parent = span.locator('..')
                            model_text = await parent.inner_text()
                            dispenser_data['model'] = model_text.replace('Model:', '').strip()
                            break
                    
                    # Extract Grade
                    grade_labels = await container.locator('.muted.uppercase.text-xs').all()
                    for label in grade_labels:
                        text = await label.inner_text()
                        if 'GRADE' in text:
                            # Find the next sibling
                            parent = label.locator('..')
                            value_elem = parent.locator('.text-xs.mt-1').first
                            if await value_elem.count() > 0:
                                dispenser_data['grade'] = await value_elem.inner_text()
                            break
                    
                    if 'title' in dispenser_data:
                        dispensers.append(dispenser_data)
                        print(f"\n✅ Dispenser {len(dispensers)}:")
                        print(f"   Title: {dispenser_data.get('title', 'N/A')}")
                        print(f"   S/N: {dispenser_data.get('serial', 'N/A')}")
                        print(f"   Make: {dispenser_data.get('make', 'N/A')}")
                        print(f"   Model: {dispenser_data.get('model', 'N/A')}")
                        print(f"   Grade: {dispenser_data.get('grade', 'N/A')}")
                        
            except Exception as e:
                print(f"Error processing container {i+1}: {e}")
                continue
        
        print(f"\n✅ Extraction complete. Found {len(dispensers)} dispensers with data")
        
        # Save screenshot for verification
        await page.screenshot(path="dispenser_extraction_result.png")
        print("\n📸 Screenshot saved: dispenser_extraction_result.png")
        
        await browser.close()
        await playwright.stop()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_extraction())