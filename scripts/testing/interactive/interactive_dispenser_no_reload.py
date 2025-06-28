#!/usr/bin/env python3
"""Interactive test to diagnose and prevent dispenser toggle page reload"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import re
from playwright.async_api import async_playwright, Page
from app.database import SessionLocal
from sqlalchemy import text as sql_text
import json

async def wait_for_user():
    """Wait for user to press Enter"""
    print("\n⏸️  Press Enter to continue...")
    await asyncio.get_event_loop().run_in_executor(None, input)

async def prevent_reload_test():
    """Test different strategies to prevent page reload when clicking dispenser toggle"""
    
    db = SessionLocal()
    playwright = None
    browser = None
    
    try:
        # Get work order and credentials (same as before)
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
        
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        print("=" * 60)
        print("DISPENSER TOGGLE - NO RELOAD TEST")
        print("=" * 60)
        
        print("\n🚀 Launching browser...")
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Quick login
        print("🔐 Logging in...")
        await page.goto('https://app.workfossa.com')
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        await page.click('button[type="submit"]')
        await page.wait_for_url('**/app/**')
        
        print(f"🌐 Navigating to: {customer_url}")
        await page.goto(customer_url, wait_until="domcontentloaded")
        
        # STRATEGY 1: Wait for all dynamic content to load
        print("\n📋 STRATEGY 1: Waiting for full page initialization...")
        await wait_for_user()
        
        # Wait for various states
        print("   ⏳ Waiting for network idle...")
        await page.wait_for_load_state("networkidle")
        
        print("   ⏳ Waiting for any lazy-loaded content...")
        await page.wait_for_timeout(2000)
        
        # Check if page has any pending JavaScript
        js_ready = await page.evaluate("""
            () => {
                // Check document ready state
                const docReady = document.readyState === 'complete';
                
                // Check jQuery if available
                const jqueryReady = typeof jQuery !== 'undefined' ? jQuery.isReady : true;
                
                // Check for common loading indicators
                const noSpinners = document.querySelectorAll('.spinner, .loading, [class*="load"]').length === 0;
                
                return {
                    documentReady: docReady,
                    jqueryReady: jqueryReady,
                    noLoadingIndicators: noSpinners,
                    allReady: docReady && jqueryReady && noSpinners
                };
            }
        """)
        
        print(f"   📊 Page readiness: {js_ready}")
        
        # Click Equipment tab
        print("\n🔧 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        await page.wait_for_timeout(1000)
        
        # STRATEGY 2: Intercept and prevent default behavior
        print("\n📋 STRATEGY 2: Intercepting click events...")
        await wait_for_user()
        
        # Inject event interceptor
        await page.evaluate("""
            () => {
                console.log('Installing click interceptor...');
                
                // Store original addEventListener
                const originalAddEventListener = EventTarget.prototype.addEventListener;
                
                // Track all click handlers
                window.__clickHandlers = [];
                
                EventTarget.prototype.addEventListener = function(type, listener, options) {
                    if (type === 'click') {
                        window.__clickHandlers.push({
                            element: this,
                            listener: listener,
                            options: options
                        });
                    }
                    return originalAddEventListener.call(this, type, listener, options);
                };
                
                // Also intercept inline onclick
                Object.defineProperty(HTMLElement.prototype, 'onclick', {
                    set: function(handler) {
                        console.log('Inline onclick detected:', this);
                        this._onclick = handler;
                    },
                    get: function() {
                        return this._onclick;
                    }
                });
            }
        """)
        
        # Find dispenser toggle
        dispenser_toggle = await page.locator('button:has-text("Dispenser"), a:has-text("Dispenser")').first
        
        if dispenser_toggle:
            # Check what happens on hover (might reveal JavaScript behavior)
            print("\n🔍 Analyzing dispenser toggle element...")
            
            toggle_info = await dispenser_toggle.evaluate("""
                (element) => {
                    const info = {
                        tagName: element.tagName,
                        href: element.href || null,
                        onclick: element.onclick ? element.onclick.toString() : null,
                        dataAttributes: {},
                        eventListeners: []
                    };
                    
                    // Get all data attributes
                    Object.keys(element.dataset).forEach(key => {
                        info.dataAttributes[key] = element.dataset[key];
                    });
                    
                    // Try to get event listeners (Chrome DevTools API)
                    if (window.getEventListeners) {
                        const listeners = getEventListeners(element);
                        Object.keys(listeners).forEach(event => {
                            info.eventListeners.push(event);
                        });
                    }
                    
                    return info;
                }
            """)
            
            print(f"   📊 Toggle element info: {toggle_info}")
            
            # STRATEGY 3: Use alternative click methods
            print("\n📋 STRATEGY 3: Testing different click methods...")
            await wait_for_user()
            
            # Method 1: Regular click with immediate prevention
            print("\n   🧪 Method 1: Click with event.preventDefault()...")
            
            await page.evaluate("""
                () => {
                    const dispenser = document.querySelector('button:has-text("Dispenser"), a:has-text("Dispenser")');
                    if (dispenser) {
                        // Add our own handler that prevents default
                        dispenser.addEventListener('click', (e) => {
                            console.log('Preventing default behavior');
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Try to manually trigger the expand without reload
                            const target = e.target;
                            const expanded = target.getAttribute('aria-expanded') === 'true';
                            target.setAttribute('aria-expanded', !expanded);
                            
                            // Look for associated content to show/hide
                            const targetId = target.getAttribute('data-target') || target.getAttribute('href');
                            if (targetId) {
                                const content = document.querySelector(targetId);
                                if (content) {
                                    content.style.display = expanded ? 'none' : 'block';
                                    content.classList.toggle('show');
                                    content.classList.toggle('collapse');
                                }
                            }
                        }, true); // Use capture phase
                    }
                }
            """)
            
            await dispenser_toggle.click()
            await page.wait_for_timeout(1000)
            
            # Check if page reloaded
            reload_check = await page.evaluate("() => window.performance.navigation.type")
            print(f"   📊 Navigation type: {reload_check} (0=normal, 1=reload)")
            
            # Method 2: JavaScript click without event propagation
            print("\n   🧪 Method 2: Direct JavaScript manipulation...")
            await wait_for_user()
            
            result = await page.evaluate("""
                () => {
                    const dispenser = document.querySelector('button:has-text("Dispenser"), a:has-text("Dispenser")');
                    if (!dispenser) return { error: 'No dispenser toggle found' };
                    
                    // Find the target content
                    const targetSelector = dispenser.getAttribute('data-target') || 
                                         dispenser.getAttribute('href') || 
                                         '#dispenser-content';
                    
                    let content = null;
                    if (targetSelector && targetSelector !== '#') {
                        content = document.querySelector(targetSelector);
                    }
                    
                    // If no specific target, look for next sibling or nearby content
                    if (!content) {
                        content = dispenser.nextElementSibling;
                        if (!content || !content.classList.contains('collapse')) {
                            // Look for collapse element nearby
                            const parent = dispenser.closest('.card, .accordion-item, .panel');
                            if (parent) {
                                content = parent.querySelector('.collapse, .panel-collapse');
                            }
                        }
                    }
                    
                    if (content) {
                        // Toggle visibility without triggering page reload
                        const isHidden = content.style.display === 'none' || 
                                       content.classList.contains('collapse') && 
                                       !content.classList.contains('show');
                        
                        if (isHidden) {
                            content.style.display = 'block';
                            content.classList.add('show');
                            content.classList.remove('collapse');
                            dispenser.setAttribute('aria-expanded', 'true');
                        } else {
                            content.style.display = 'none';
                            content.classList.remove('show');
                            content.classList.add('collapse');
                            dispenser.setAttribute('aria-expanded', 'false');
                        }
                        
                        return { success: true, contentFound: true, isNowVisible: isHidden };
                    }
                    
                    return { success: false, contentFound: false };
                }
            """)
            
            print(f"   📊 JavaScript manipulation result: {result}")
            
            # STRATEGY 4: Wait and observe
            print("\n📋 STRATEGY 4: Observing natural page behavior...")
            await wait_for_user()
            
            # Set up mutation observer
            await page.evaluate("""
                () => {
                    window.__mutations = [];
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach(mutation => {
                            window.__mutations.push({
                                type: mutation.type,
                                target: mutation.target.tagName + (mutation.target.id ? '#' + mutation.target.id : ''),
                                addedNodes: mutation.addedNodes.length,
                                removedNodes: mutation.removedNodes.length
                            });
                        });
                    });
                    
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    });
                }
            """)
            
            print("   👁️  Mutation observer installed. Click the dispenser toggle manually...")
            await wait_for_user()
            
            # Check mutations
            mutations = await page.evaluate("() => window.__mutations")
            print(f"   📊 Detected {len(mutations)} DOM mutations")
            for i, mutation in enumerate(mutations[:5]):  # Show first 5
                print(f"      {i+1}. {mutation}")
        
        # Final check for dispensers
        print("\n🔍 Checking for visible dispensers...")
        dispenser_count = await page.locator('div.py-1\\.5').count()
        print(f"   📊 Found {dispenser_count} dispenser containers")
        
        if dispenser_count > 0:
            print("   ✅ Dispensers are visible!")
            
            # Extract one for verification
            first_dispenser = await page.locator('div.py-1\\.5').first.inner_text()
            print(f"   📄 First dispenser preview: {first_dispenser[:100]}...")
        
        print("\n✅ Test complete!")
        print("\n💡 Best strategy to implement:")
        print("   1. Wait for full page load before interacting")
        print("   2. Use JavaScript to manually toggle content visibility")
        print("   3. Or find direct API/data source if available")
        
        print("\n⏸️  Browser remains open. Press Enter to close...")
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

if __name__ == "__main__":
    asyncio.run(prevent_reload_test())