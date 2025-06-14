#!/usr/bin/env python3
"""
Simple visual test with hardcoded customer URL to debug Equipment tab clicking
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService

async def simple_visual_test():
    """Simple visual test to debug Equipment tab interaction"""
    
    print("🔍 SIMPLE VISUAL TEST - EQUIPMENT TAB DEBUGGING")
    print("=" * 60)
    print("This test will:")
    print("1. Open a VISIBLE browser")
    print("2. Login to WorkFossa")
    print("3. Navigate to a customer page")
    print("4. Try to find and click the Equipment tab")
    print("5. PAUSE for your inspection")
    print()
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    automation_service = None
    
    try:
        # Initialize service in VISIBLE mode
        print("🔧 STEP 1: Initialize Visible Browser")
        print("-" * 50)
        automation_service = WorkFossaAutomationService(headless=False)
        print("✅ Browser service initialized - window should be visible")
        print()
        
        # Create session and login
        print("🔧 STEP 2: Login to WorkFossa")
        print("-" * 50)
        session_id = str(uuid.uuid4())
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        await automation_service.create_session(session_id, user_id, credentials)
        print("✅ Session created")
        
        await automation_service.login_to_workfossa(session_id)
        print("✅ Logged into WorkFossa")
        print()
        
        # Get the page
        session_data = automation_service.sessions.get(session_id)
        if not session_data:
            print("❌ No session data!")
            return
            
        page = session_data.get('page')
        if not page:
            print("❌ No page in session!")
            return
        
        # Navigate to a known customer URL (from our successful test)
        customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
        
        print("🔧 STEP 3: Navigate to Customer Page")
        print("-" * 50)
        print(f"🔗 Navigating to: {customer_url}")
        
        await page.goto(customer_url)
        await page.wait_for_load_state('networkidle')
        print("✅ Navigated to customer page")
        
        # Wait for page to fully load
        await asyncio.sleep(3)
        
        # Take initial screenshot
        await page.screenshot(path="debug_initial_page.png")
        print("📸 Initial screenshot: debug_initial_page.png")
        print()
        
        # Check page content
        print("🔧 STEP 4: Analyze Page Content")
        print("-" * 50)
        
        page_title = await page.title()
        current_url = page.url
        print(f"📄 Page title: {page_title}")
        print(f"🔗 Current URL: {current_url}")
        
        # Check if Equipment text exists
        page_text = await page.text_content('body')
        if 'Equipment' in page_text:
            print("✅ 'Equipment' text found on page")
        else:
            print("❌ 'Equipment' text NOT found on page")
        
        # Look for all possible tab elements
        print("\n🔍 Looking for tab elements...")
        
        # Get all clickable elements that might be tabs
        tab_elements = await page.evaluate("""
            () => {
                const elements = [];
                
                // Look for elements containing 'Equipment'
                const allElements = document.querySelectorAll('*');
                for (let el of allElements) {
                    if (el.textContent && el.textContent.includes('Equipment')) {
                        elements.push({
                            tag: el.tagName,
                            text: el.textContent.trim(),
                            classes: el.className,
                            role: el.getAttribute('role'),
                            type: el.type || null
                        });
                    }
                }
                
                return elements;
            }
        """)
        
        if tab_elements:
            print(f"✅ Found {len(tab_elements)} elements containing 'Equipment':")
            for i, elem in enumerate(tab_elements):
                print(f"  {i+1}. <{elem['tag']}> '{elem['text'][:50]}...' (class: {elem['classes']}) (role: {elem['role']})")
        else:
            print("❌ No elements found containing 'Equipment'")
        
        print()
        print("🔧 STEP 5: Try to Find and Click Equipment Tab")
        print("-" * 50)
        
        # Try multiple selectors
        selectors_to_try = [
            "a:has-text('Equipment')",
            "[role='tab']:has-text('Equipment')",
            ".tab:has-text('Equipment')",
            "button:has-text('Equipment')",
            "li:has-text('Equipment')",
            "*:has-text('Equipment')"
        ]
        
        equipment_found = False
        for i, selector in enumerate(selectors_to_try):
            try:
                print(f"🔍 Trying selector {i+1}: {selector}")
                elements = await page.query_selector_all(selector)
                
                if elements:
                    print(f"  ✅ Found {len(elements)} element(s)")
                    
                    # Try the first one that looks like a tab
                    for j, element in enumerate(elements):
                        try:
                            text = await element.text_content()
                            is_visible = await element.is_visible()
                            
                            print(f"    Element {j+1}: '{text}' (visible: {is_visible})")
                            
                            if is_visible and 'Equipment' in text:
                                # Highlight this element
                                await page.evaluate("""
                                    (element) => {
                                        element.style.border = '5px solid red';
                                        element.style.backgroundColor = 'yellow';
                                        element.style.color = 'black';
                                        element.scrollIntoView();
                                    }
                                """, element)
                                
                                print(f"    🔴 HIGHLIGHTED element {j+1} - check browser!")
                                
                                # Pause for inspection
                                input(f"\n⏸️  PAUSE: Can you see the highlighted Equipment element? Press ENTER to click it...")
                                
                                # Try to click
                                await element.click()
                                print(f"    ✅ Clicked element {j+1}")
                                
                                equipment_found = True
                                break
                                
                        except Exception as e:
                            print(f"    ❌ Error with element {j+1}: {e}")
                            continue
                    
                    if equipment_found:
                        break
                else:
                    print(f"  ❌ No elements found")
                    
            except Exception as e:
                print(f"  ❌ Selector failed: {e}")
                continue
        
        if equipment_found:
            print("\n✅ Successfully found and clicked Equipment tab!")
            await asyncio.sleep(2)
            await page.screenshot(path="debug_after_equipment_click.png")
            print("📸 After click screenshot: debug_after_equipment_click.png")
        else:
            print("\n❌ Could not find Equipment tab")
        
        print()
        print("🔧 FINAL STEP: Browser Inspection")
        print("-" * 50)
        print("👀 Browser is open for your inspection")
        print("🔍 Check the current state of the page")
        
        # Final pause
        input("\n⏸️  FINAL PAUSE: Press ENTER when done inspecting...")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        if automation_service and hasattr(automation_service, 'browser') and automation_service.browser:
            print("🧹 Closing browser...")
            await automation_service.browser.close()
        
        print("\n" + "=" * 60)
        print("🏁 SIMPLE VISUAL TEST COMPLETED")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(simple_visual_test())