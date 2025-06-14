#!/usr/bin/env python3
"""Debug dispenser scraping with screenshots"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import asyncio
import json
from app.database import SessionLocal
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def debug_with_screenshots():
    """Debug dispenser scraping with screenshots at each step"""
    
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
        print("DEBUG DISPENSER SCRAPING WITH SCREENSHOTS")
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
            print("\n🔐 Step 1: Navigating to login page...")
            await page.goto('https://app.workfossa.com')
            await page.wait_for_timeout(2000)
            await page.screenshot(path="debug_1_login_page.png")
            print("   📸 Screenshot saved: debug_1_login_page.png")
            
            print("\n📝 Step 2: Filling credentials...")
            await page.fill('input[name="email"]', cred.username)
            await page.fill('input[name="password"]', cred.password)
            await page.screenshot(path="debug_2_credentials_filled.png")
            print("   📸 Screenshot saved: debug_2_credentials_filled.png")
            
            print("\n🔑 Step 3: Clicking login button...")
            login_clicked = False
            login_selectors = [
                'button:has-text("Log In")',  # Exact text from screenshot
                'text=Log In',
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign In")',
                '.btn-primary'
            ]
            
            for selector in login_selectors:
                try:
                    await page.click(selector, timeout=5000)
                    login_clicked = True
                    print(f"   ✅ Clicked login button with selector: {selector}")
                    break
                except Exception as e:
                    pass
            
            if not login_clicked:
                print("   ❌ Could not find login button")
                
            # Wait for login
            print("\n⏳ Step 4: Waiting for login to complete...")
            await page.wait_for_timeout(7000)
            await page.screenshot(path="debug_3_after_login.png")
            print("   📸 Screenshot saved: debug_3_after_login.png")
            print(f"   Current URL: {page.url}")
            
            print("\n🌐 Step 5: Navigating to customer location...")
            await page.goto(customer_url, wait_until="networkidle")
            await page.wait_for_timeout(3000)
            await page.screenshot(path="debug_4_customer_page.png")
            print("   📸 Screenshot saved: debug_4_customer_page.png")
            
            # Check if we got an error
            page_content = await page.content()
            if "Could not find this location" in page_content:
                print("   ❌ ERROR: Location not found - page says it may have been deleted")
                await page.screenshot(path="debug_error_location_not_found.png")
                print("   📸 Error screenshot saved: debug_error_location_not_found.png")
                return
            
            print("\n🔍 Step 6: Looking for Equipment tab...")
            
            # Check what's on the page
            tabs_found = await page.evaluate("""
                () => {
                    const allText = document.body.textContent;
                    const hasEquipment = allText.includes('Equipment');
                    const hasVisits = allText.includes('Visits');
                    const hasFormHistory = allText.includes('Form History');
                    
                    // Find all tab-like elements
                    const tabs = [];
                    const tabElements = document.querySelectorAll('a, button, li, .tab, .nav-link, [role="tab"]');
                    tabElements.forEach(el => {
                        const text = el.textContent?.trim();
                        if (text && text.length < 50) {  // Reasonable length for a tab
                            tabs.push(text);
                        }
                    });
                    
                    return {
                        hasEquipment,
                        hasVisits,
                        hasFormHistory,
                        tabs: [...new Set(tabs)],  // Remove duplicates
                        url: window.location.href
                    };
                }
            """)
            
            print(f"   Page analysis:")
            print(f"   - Has 'Equipment' text: {tabs_found['hasEquipment']}")
            print(f"   - Has 'Visits' text: {tabs_found['hasVisits']}")
            print(f"   - Has 'Form History' text: {tabs_found['hasFormHistory']}")
            print(f"   - Current URL: {tabs_found['url']}")
            print(f"   - Found tabs: {tabs_found['tabs'][:10]}")  # First 10
            
            # Try to click Equipment tab
            equipment_clicked = False
            if tabs_found['hasEquipment']:
                # The tabs appear to be divs with text, not links or buttons
                # Try clicking by exact text match
                try:
                    # First try direct text selector
                    await page.click('text=Equipment', timeout=5000)
                    equipment_clicked = True
                    print(f"   ✅ Clicked Equipment tab with text selector")
                except:
                    # Try clicking the div containing Equipment text
                    try:
                        clicked = await page.evaluate("""
                            () => {
                                const elements = document.querySelectorAll('*');
                                for (const el of elements) {
                                    if (el.textContent && el.textContent.trim() === 'Equipment' && 
                                        !el.querySelector('*')) {  // No child elements
                                        el.click();
                                        return true;
                                    }
                                }
                                return false;
                            }
                        """)
                        if clicked:
                            equipment_clicked = True
                            print(f"   ✅ Clicked Equipment tab using JavaScript")
                    except:
                        pass
                
                if equipment_clicked:
                    await page.wait_for_timeout(3000)
                    await page.screenshot(path="debug_5_equipment_tab_clicked.png")
                    print("   📸 Screenshot saved: debug_5_equipment_tab_clicked.png")
                else:
                    print("   ❌ Could not click Equipment tab")
                    
            else:
                print("   ❌ No Equipment tab found on page")
            
            # Final screenshot
            await page.screenshot(path="debug_6_final_state.png", full_page=True)
            print("\n📸 Final full-page screenshot saved: debug_6_final_state.png")
            
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print("\n✅ Debug complete. Check the screenshot files.")

if __name__ == "__main__":
    asyncio.run(debug_with_screenshots())