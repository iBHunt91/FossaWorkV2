#!/usr/bin/env python3
"""Enhanced interactive dispenser scraping test with wait condition detection"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import re
from playwright.async_api import async_playwright, Page
from app.database import SessionLocal
from sqlalchemy import text as sql_text
import json
from datetime import datetime

async def wait_for_user():
    """Wait for user to press Enter"""
    print("\n⏸️  Press Enter to continue...")
    await asyncio.get_event_loop().run_in_executor(None, input)

async def log_network_activity(page: Page, phase: str):
    """Log network activity for debugging"""
    print(f"\n📡 Network activity during {phase}:")
    
    requests = []
    responses = []
    
    def on_request(request):
        requests.append({
            'url': request.url,
            'method': request.method,
            'time': datetime.now().isoformat()
        })
        
    def on_response(response):
        responses.append({
            'url': response.url,
            'status': response.status,
            'time': datetime.now().isoformat()
        })
    
    page.on("request", on_request)
    page.on("response", on_response)
    
    return requests, responses

async def detect_best_wait_condition(page: Page, action_description: str):
    """Help detect the best wait condition after an action"""
    print(f"\n🔍 Detecting wait conditions after: {action_description}")
    
    # Start monitoring
    start_time = datetime.now()
    
    # Check various conditions
    conditions = {
        'network_idle': False,
        'dom_content_loaded': False,
        'load_event': False,
        'specific_elements': [],
        'ajax_complete': False
    }
    
    # Monitor for network idle
    try:
        await page.wait_for_load_state('networkidle', timeout=5000)
        conditions['network_idle'] = True
        print("   ✅ Network idle detected")
    except:
        print("   ⏱️  Network still active after 5 seconds")
    
    # Check for DOM changes
    initial_dom_size = await page.evaluate("() => document.body.innerHTML.length")
    await asyncio.sleep(0.5)
    final_dom_size = await page.evaluate("() => document.body.innerHTML.length")
    
    if final_dom_size != initial_dom_size:
        print(f"   📝 DOM changed: {initial_dom_size} -> {final_dom_size} characters")
    else:
        print("   📝 DOM appears stable")
    
    # Check for specific elements that might appear
    element_checks = [
        ('div.py-1\\.5', 'Dispenser containers'),
        ('.equipment-content', 'Equipment content'),
        ('.dispenser-details', 'Dispenser details'),
        ('[data-loaded="true"]', 'Loaded indicators'),
        ('.spinner, .loading', 'Loading indicators (should disappear)')
    ]
    
    for selector, description in element_checks:
        try:
            count = await page.locator(selector).count()
            if count > 0:
                conditions['specific_elements'].append(f"{description}: {count}")
                print(f"   ✅ Found {description}: {count} elements")
        except:
            pass
    
    # Check if jQuery/AJAX is complete (if jQuery exists)
    try:
        ajax_complete = await page.evaluate("""
            () => {
                if (typeof jQuery !== 'undefined') {
                    return jQuery.active === 0;
                }
                return null;
            }
        """)
        if ajax_complete is not None:
            conditions['ajax_complete'] = ajax_complete
            print(f"   📊 jQuery AJAX complete: {ajax_complete}")
    except:
        pass
    
    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"\n⏱️  Detection took {elapsed:.2f} seconds")
    
    return conditions

async def check_for_page_reload(page: Page, action: callable):
    """Execute an action and check if it causes a page reload"""
    print("\n🔄 Checking for page reload...")
    
    # Get initial page state
    initial_url = page.url
    initial_navigation_id = await page.evaluate("() => performance.navigation.type")
    
    # Mark the page to detect reload
    await page.evaluate("() => window.__test_marker = 'before_action'")
    
    # Perform the action
    await action()
    
    # Wait a bit
    await asyncio.sleep(1)
    
    # Check if page reloaded
    try:
        marker = await page.evaluate("() => window.__test_marker")
        current_url = page.url
        
        if marker != 'before_action':
            print("   ⚠️  PAGE RELOADED! The marker was lost")
            return True
        elif current_url != initial_url:
            print(f"   ⚠️  URL CHANGED: {initial_url} -> {current_url}")
            return True
        else:
            print("   ✅ No page reload detected")
            return False
    except:
        print("   ⚠️  Could not verify page state (possible reload)")
        return True

async def interactive_test_enhanced():
    """Enhanced test to identify proper wait conditions"""
    
    db = SessionLocal()
    playwright = None
    browser = None
    
    try:
        # Get work order
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
        print("ENHANCED INTERACTIVE DISPENSER SCRAPING TEST")
        print("=" * 60)
        print(f"Work Order: {work_order.external_id} - {work_order.site_name}")
        print(f"Customer URL: {customer_url}")
        print("\n📌 This test will help identify proper wait conditions")
        
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
            
        print("\n🚀 Step 1: Launching browser with network monitoring...")
        await wait_for_user()
        
        # Launch browser
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"   🖥️  Console: {msg.text}"))
        
        print("✅ Browser launched with monitoring enabled")
        
        # Login process - using working approach from interactive test
        print("\n🔐 Step 2: Navigating to login page...")
        await page.goto('https://app.workfossa.com')
        await page.wait_for_timeout(2000)
        
        print("\n📝 Step 3: Filling credentials...")
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        
        print("\n🔑 Step 4: Finding login button...")
        # Try different selectors for the login button
        login_selectors = [
            'button[type="submit"]',
            'button:has-text("Login")',
            'button:has-text("Sign In")',
            'input[type="submit"]',
            '.btn-primary',
            'button.btn'
        ]
        
        login_clicked = False
        for selector in login_selectors:
            try:
                if await page.locator(selector).is_visible():
                    print(f"   Found login button with selector: {selector}")
                    await page.click(selector, timeout=5000)
                    login_clicked = True
                    break
            except:
                pass
        
        if not login_clicked:
            print("   ❌ Could not find login button automatically")
            print("   ⏸️  Please manually click the login button...")
            await wait_for_user()
        
        print("⏳ Waiting for login to complete...")
        try:
            await page.wait_for_url('**/app/**', timeout=10000)
            print("✅ Login successful")
        except:
            print("⚠️  Login might have failed or taken longer than expected")
        
        print("\n🌐 Step 5: Navigating to customer location...")
        print(f"   URL: {customer_url}")
        await wait_for_user()
        
        # Monitor navigation
        await page.goto(customer_url, wait_until="networkidle")
        conditions = await detect_best_wait_condition(page, "customer page navigation")
        
        print("\n🔍 Step 6: Finding and clicking Equipment tab...")
        print("   Let me analyze the Equipment tab behavior...")
        await wait_for_user()
        
        # Find Equipment tab
        equipment_selector = None
        equipment_selectors = [
            'text="Equipment"',
            'a:has-text("Equipment")',
            'button:has-text("Equipment")',
            '[href*="equipment"]'
        ]
        
        for selector in equipment_selectors:
            if await page.locator(selector).count() > 0:
                equipment_selector = selector
                print(f"   ✅ Found Equipment tab: {selector}")
                break
        
        if equipment_selector:
            # Check if clicking causes reload
            reload_detected = await check_for_page_reload(
                page, 
                lambda: page.click(equipment_selector)
            )
            
            if not reload_detected:
                conditions = await detect_best_wait_condition(page, "Equipment tab click")
        
        print("\n🔍 Step 7: Finding Dispenser section...")
        await wait_for_user()
        
        # Check current state of dispensers
        dispenser_visible = await page.locator('div.py-1\\.5').count() > 0
        print(f"   📊 Dispenser containers visible: {dispenser_visible}")
        
        # Find dispenser toggle
        dispenser_selector = None
        dispenser_selectors = [
            'button:has-text("Dispenser")',
            'a:has-text("Dispenser")',
            '[data-toggle]:has-text("Dispenser")',
            '.accordion-header:has-text("Dispenser")'
        ]
        
        for selector in dispenser_selectors:
            if await page.locator(selector).count() > 0:
                dispenser_selector = selector
                print(f"   ✅ Found Dispenser toggle: {selector}")
                
                # Check aria-expanded or similar attributes
                try:
                    element = page.locator(selector).first
                    expanded = await element.get_attribute('aria-expanded')
                    if expanded:
                        print(f"   📊 Current expanded state: {expanded}")
                except:
                    pass
                break
        
        print("\n🔍 Step 8: Testing Dispenser toggle behavior...")
        print("   ⚠️  This is where the page reload issue occurs")
        await wait_for_user()
        
        if dispenser_selector:
            # Test the click
            print("   🧪 Testing click behavior...")
            
            # Get initial dispenser count
            initial_count = await page.locator('div.py-1\\.5').count()
            print(f"   📊 Initial dispenser containers: {initial_count}")
            
            # Monitor what happens when we click
            reload_detected = await check_for_page_reload(
                page,
                lambda: page.click(dispenser_selector)
            )
            
            if reload_detected:
                print("\n   ❌ PROBLEM IDENTIFIED: Clicking dispenser toggle causes page reload!")
                print("   💡 Possible solutions:")
                print("      1. Wait for a different page state before clicking")
                print("      2. Use JavaScript click instead of Playwright click")
                print("      3. Find an alternative way to access dispenser data")
                
                # Let's try alternative approaches
                print("\n   🧪 Testing alternative click method...")
                await wait_for_user()
                
                # Try JavaScript click
                await page.evaluate(f"""
                    (selector) => {{
                        const element = document.querySelector(selector);
                        if (element) {{
                            console.log('Clicking via JavaScript:', element);
                            element.click();
                        }}
                    }}
                """, dispenser_selector)
                
                # Check if this also causes reload
                await asyncio.sleep(1)
                marker_check = await page.evaluate("() => window.__test_marker || 'not_set'")
                print(f"   📊 Page marker after JS click: {marker_check}")
                
            else:
                conditions = await detect_best_wait_condition(page, "Dispenser toggle click")
                
                # Check final dispenser count
                final_count = await page.locator('div.py-1\\.5').count()
                print(f"   📊 Final dispenser containers: {final_count}")
                
                if final_count > initial_count:
                    print("   ✅ Dispensers expanded successfully!")
                else:
                    print("   ⚠️  Dispenser count didn't increase")
        
        print("\n🔍 Step 9: Analyzing page structure for better selectors...")
        await wait_for_user()
        
        # Let's examine the page structure
        page_info = await page.evaluate("""
            () => {
                const info = {
                    frameworks: [],
                    dataAttributes: [],
                    customEvents: []
                };
                
                // Check for common frameworks
                if (window.jQuery) info.frameworks.push('jQuery ' + jQuery.fn.jquery);
                if (window.Vue) info.frameworks.push('Vue.js');
                if (window.React) info.frameworks.push('React');
                if (window.angular) info.frameworks.push('Angular');
                
                // Check for data attributes that might help
                const elements = document.querySelectorAll('[data-toggle], [data-target], [data-expanded]');
                elements.forEach(el => {
                    Object.keys(el.dataset).forEach(key => {
                        info.dataAttributes.push(`data-${key}="${el.dataset[key]}"`);
                    });
                });
                
                return info;
            }
        """)
        
        print("   📊 Page analysis:")
        print(f"      Frameworks: {', '.join(page_info['frameworks']) if page_info['frameworks'] else 'None detected'}")
        print(f"      Data attributes: {len(set(page_info['dataAttributes']))} unique")
        
        print("\n✅ Enhanced test complete!")
        print("\n💡 Recommendations based on this test:")
        print("   1. Check for and wait for specific data attributes after actions")
        print("   2. Use JavaScript evaluation to check readiness")
        print("   3. Implement custom wait conditions based on DOM changes")
        print("   4. Consider intercepting network requests to detect AJAX completion")
        
        print("\n⏸️  Browser will remain open. Press Enter to close...")
        await wait_for_user()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()
        db.close()
        print("\n👋 Test ended")

if __name__ == "__main__":
    print("Starting enhanced interactive test...")
    asyncio.run(interactive_test_enhanced())