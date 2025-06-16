#!/usr/bin/env python3
"""
Debug why the dispenser toggle click isn't working
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager import credential_manager
from app.services.content_based_wait import ContentBasedWait


async def debug_dispenser_click():
    """Debug why dispenser click isn't working"""
    print("🔍 Debugging Dispenser Click Issue")
    print("=" * 50)
    
    # Get credentials
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds:
        print("❌ No credentials found")
        return
    
    credentials = {
        "username": creds.username,
        "password": creds.password
    }
    
    # Create service
    automation = WorkFossaAutomationService(headless=False)
    
    try:
        # Create session and login
        session_id = "debug_click"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Navigate and click Equipment tab
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        print(f"\n📍 Navigating to: {customer_url}")
        await page.goto(customer_url, wait_until="domcontentloaded")
        
        # Wait and click Equipment
        await ContentBasedWait.wait_for_equipment_tab(page)
        await page.click('text="Equipment"')
        await ContentBasedWait.wait_for_loader_to_disappear(page)
        
        # Close modal
        await ContentBasedWait.wait_for_modal_and_close(page)
        
        print("\n🔍 Analyzing Dispenser Toggle Structure...")
        
        # Get detailed info about all elements with "Dispenser" text
        toggle_analysis = await page.evaluate("""
            () => {
                const results = [];
                const allElements = document.querySelectorAll('*');
                
                for (const el of allElements) {
                    const text = el.textContent ? el.textContent.trim() : '';
                    
                    // Look for "Dispenser (8)" or similar
                    if (text.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                        // Get bounding box
                        const rect = el.getBoundingClientRect();
                        
                        // Check if element is actually clickable
                        const style = window.getComputedStyle(el);
                        const isClickable = rect.width > 0 && 
                                          rect.height > 0 && 
                                          style.visibility !== 'hidden' && 
                                          style.display !== 'none' &&
                                          style.pointerEvents !== 'none';
                        
                        // Get all event listeners (if possible)
                        const hasClickHandler = el.onclick !== null;
                        
                        // Check parent structure
                        let clickableParent = null;
                        let parent = el.parentElement;
                        while (parent && !clickableParent) {
                            if (parent.tagName === 'A' || parent.tagName === 'BUTTON' || 
                                parent.onclick || parent.getAttribute('data-toggle')) {
                                clickableParent = {
                                    tagName: parent.tagName,
                                    classes: parent.className,
                                    href: parent.getAttribute('href'),
                                    dataToggle: parent.getAttribute('data-toggle'),
                                    dataBsToggle: parent.getAttribute('data-bs-toggle'),
                                    role: parent.getAttribute('role')
                                };
                            }
                            parent = parent.parentElement;
                        }
                        
                        results.push({
                            text: text,
                            tagName: el.tagName,
                            classes: el.className,
                            id: el.id,
                            isClickable: isClickable,
                            hasClickHandler: hasClickHandler,
                            rect: {
                                top: rect.top,
                                left: rect.left,
                                width: rect.width,
                                height: rect.height
                            },
                            clickableParent: clickableParent,
                            // Get a unique selector for this element
                            selector: el.id ? `#${el.id}` : 
                                     el.className ? `${el.tagName.toLowerCase()}.${el.className.split(' ').join('.')}` :
                                     el.tagName.toLowerCase()
                        });
                    }
                }
                
                return results;
            }
        """)
        
        print(f"\n📊 Found {len(toggle_analysis)} elements with Dispenser text:")
        for i, elem in enumerate(toggle_analysis):
            print(f"\n🎯 Element {i+1}:")
            print(f"   Text: {elem['text']}")
            print(f"   Tag: {elem['tagName']}")
            print(f"   Classes: {elem['classes']}")
            print(f"   ID: {elem['id']}")
            print(f"   Clickable: {elem['isClickable']}")
            print(f"   Has onClick: {elem['hasClickHandler']}")
            print(f"   Position: top={elem['rect']['top']}, left={elem['rect']['left']}")
            print(f"   Size: {elem['rect']['width']}x{elem['rect']['height']}")
            
            if elem['clickableParent']:
                print(f"   Clickable Parent: {elem['clickableParent']['tagName']} "
                      f"(href={elem['clickableParent']['href']}, "
                      f"data-toggle={elem['clickableParent']['dataToggle']})")
        
        # Try different click methods
        print("\n🧪 Testing Different Click Methods...")
        
        # Method 1: Click the exact text
        print("\n1️⃣ Method 1: Click exact text match...")
        try:
            await page.click('text=/^Dispenser \\(\\d+\\)$/', timeout=2000)
            print("   ✅ Click successful")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
        
        await asyncio.sleep(1)
        
        # Check if anything changed
        container_count = await page.locator('div.py-1\\.5').count()
        print(f"   Container count: {container_count}")
        
        # Method 2: Find and click programmatically
        print("\n2️⃣ Method 2: JavaScript click on correct element...")
        click_result = await page.evaluate("""
            () => {
                // Find the actual clickable element
                const allElements = document.querySelectorAll('a, button, [role="button"], [data-toggle]');
                
                for (const el of allElements) {
                    // Check if this element or its children contain "Dispenser (X)"
                    const text = el.textContent ? el.textContent.trim() : '';
                    if (text.includes('Dispenser') && text.includes('(')) {
                        console.log('Found clickable element:', el);
                        
                        // Try multiple click methods
                        try {
                            // Method 1: Regular click
                            el.click();
                            
                            // Method 2: Dispatch click event
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            el.dispatchEvent(clickEvent);
                            
                            // Method 3: If it's a link with href="#something"
                            const href = el.getAttribute('href');
                            if (href && href.startsWith('#') && href.length > 1) {
                                const targetId = href.substring(1);
                                const target = document.getElementById(targetId);
                                if (target) {
                                    target.style.display = 'block';
                                    target.classList.remove('collapse');
                                    target.classList.add('show');
                                }
                            }
                            
                            return {
                                success: true,
                                element: {
                                    tag: el.tagName,
                                    text: text,
                                    href: href,
                                    classes: el.className
                                }
                            };
                        } catch (err) {
                            console.error('Click error:', err);
                        }
                    }
                }
                
                // Also check for nested structures
                const spans = document.querySelectorAll('span');
                for (const span of spans) {
                    const text = span.textContent ? span.textContent.trim() : '';
                    if (text.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                        // Find clickable ancestor
                        let ancestor = span.parentElement;
                        while (ancestor) {
                            if (ancestor.tagName === 'A' || ancestor.tagName === 'BUTTON' || 
                                ancestor.getAttribute('data-toggle') || ancestor.onclick) {
                                console.log('Found clickable ancestor:', ancestor);
                                ancestor.click();
                                return {
                                    success: true,
                                    element: {
                                        tag: ancestor.tagName,
                                        text: text,
                                        ancestorTag: ancestor.tagName,
                                        classes: ancestor.className
                                    }
                                };
                            }
                            ancestor = ancestor.parentElement;
                        }
                    }
                }
                
                return { success: false, error: 'No clickable element found' };
            }
        """)
        
        print(f"   Result: {click_result}")
        
        await asyncio.sleep(1)
        
        # Final check
        final_count = await page.locator('div.py-1\\.5').count()
        print(f"   Final container count: {final_count}")
        
        # Check for any error messages or console logs
        print("\n📋 Checking console logs...")
        logs = await page.evaluate("() => window.console.logs || []")
        if logs:
            for log in logs[-5:]:  # Last 5 logs
                print(f"   Console: {log}")
        
        # Take a screenshot for debugging
        print("\n📸 Taking screenshot...")
        await page.screenshot(path="debug_dispenser_click.png")
        print("   Screenshot saved as debug_dispenser_click.png")
        
        print("\n⏸️  Browser remains open for inspection...")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("\n✅ Done")


if __name__ == "__main__":
    asyncio.run(debug_dispenser_click())