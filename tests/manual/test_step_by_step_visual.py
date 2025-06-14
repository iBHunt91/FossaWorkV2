#!/usr/bin/env python3
"""
Step-by-step visual test with user confirmation at each step
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService

def wait_for_user(message):
    """Wait for user input to continue"""
    print(f"\n⏸️  {message}")
    print("   Type 'continue' or 'c' and press ENTER to proceed:")
    print("   Type 'quit' or 'q' to stop the test:")
    
    while True:
        user_input = input("   > ").strip().lower()
        if user_input in ['continue', 'c']:
            return True
        elif user_input in ['quit', 'q']:
            return False
        else:
            print("   Please type 'continue' (or 'c') to proceed, or 'quit' (or 'q') to stop.")

async def step_by_step_test():
    """Step-by-step visual test with user confirmation"""
    
    print("🔍 STEP-BY-STEP VISUAL TEST")
    print("=" * 60)
    print("This test will:")
    print("• Open a VISIBLE browser")
    print("• Pause at each step for your inspection")
    print("• Wait for your confirmation to continue")
    print("• Show you exactly what the automation is doing")
    print()
    
    if not wait_for_user("Ready to start? Browser will open in visible mode."):
        print("❌ Test cancelled by user")
        return
    
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    automation_service = None
    
    try:
        # STEP 1: Initialize Browser
        print("\n🔧 STEP 1: Initializing visible browser...")
        automation_service = WorkFossaAutomationService(headless=False)
        print("✅ Browser service initialized")
        print("👀 You should see a browser window open")
        
        if not wait_for_user("Can you see the browser window? Ready for login?"):
            return
        
        # STEP 2: Login
        print("\n🔧 STEP 2: Logging into WorkFossa...")
        session_id = str(uuid.uuid4())
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        await automation_service.create_session(session_id, user_id, credentials)
        print("✅ Session created")
        
        await automation_service.login_to_workfossa(session_id)
        print("✅ Login completed")
        print("👀 You should see the WorkFossa dashboard")
        
        if not wait_for_user("Can you see the WorkFossa dashboard? Ready to navigate to customer page?"):
            return
        
        # STEP 3: Navigate to Customer Page
        print("\n🔧 STEP 3: Navigating to customer page...")
        session_data = automation_service.sessions.get(session_id)
        page = session_data.get('page')
        
        customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
        print(f"🔗 Navigating to: {customer_url}")
        
        await page.goto(customer_url)
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(2)
        
        print("✅ Navigation completed")
        print("👀 You should see the customer location page")
        
        # Take screenshot
        await page.screenshot(path="step_3_customer_page.png")
        print("📸 Screenshot saved: step_3_customer_page.png")
        
        if not wait_for_user("Can you see the customer page with tabs? Ready to find Equipment tab?"):
            return
        
        # STEP 4: Find Equipment Tab
        print("\n🔧 STEP 4: Finding Equipment tab...")
        
        try:
            equipment_tab = await page.wait_for_selector("a:has-text('Equipment')", timeout=5000)
            
            if equipment_tab:
                print("✅ Equipment tab found!")
                
                # Highlight it for visibility
                await page.evaluate("""
                    (element) => {
                        element.style.border = '5px solid red';
                        element.style.backgroundColor = 'yellow';
                        element.style.color = 'black';
                        element.style.fontWeight = 'bold';
                        element.scrollIntoView({behavior: 'smooth', block: 'center'});
                    }
                """, equipment_tab)
                
                print("🔴 Equipment tab is now HIGHLIGHTED in red/yellow")
                print("👀 Look for the highlighted Equipment tab on the page")
                
                # Take screenshot with highlighted tab
                await page.screenshot(path="step_4_equipment_highlighted.png")
                print("📸 Screenshot saved: step_4_equipment_highlighted.png")
                
                if not wait_for_user("Can you see the highlighted Equipment tab? Ready to click it?"):
                    return
                
                # STEP 5: Click Equipment Tab
                print("\n🔧 STEP 5: Clicking Equipment tab...")
                await equipment_tab.click()
                print("✅ Equipment tab clicked!")
                
                # Wait for content to load
                print("⏱️ Waiting for Equipment content to load...")
                await asyncio.sleep(3)
                
                print("👀 Equipment tab content should now be visible")
                
                # Take screenshot after click
                await page.screenshot(path="step_5_equipment_clicked.png")
                print("📸 Screenshot saved: step_5_equipment_clicked.png")
                
                if not wait_for_user("Can you see the Equipment tab content? Ready to look for Dispenser section?"):
                    return
                
                # STEP 6: Find Dispenser Section
                print("\n🔧 STEP 6: Looking for Dispenser section...")
                
                # Check if Dispenser text is on the page
                page_text = await page.text_content('body')
                if 'Dispenser' in page_text:
                    print("✅ 'Dispenser' text found on page!")
                    
                    try:
                        # Look for dispenser section
                        dispenser_elements = await page.query_selector_all("*:has-text('Dispenser')")
                        
                        if dispenser_elements:
                            print(f"✅ Found {len(dispenser_elements)} elements containing 'Dispenser'")
                            
                            # Highlight the first visible dispenser element
                            for i, element in enumerate(dispenser_elements):
                                is_visible = await element.is_visible()
                                if is_visible:
                                    await page.evaluate("""
                                        (element) => {
                                            element.style.border = '5px solid blue';
                                            element.style.backgroundColor = 'lightblue';
                                            element.style.padding = '5px';
                                            element.scrollIntoView({behavior: 'smooth', block: 'center'});
                                        }
                                    """, element)
                                    
                                    print(f"🔵 Dispenser element {i+1} highlighted in blue")
                                    break
                            
                            # Take screenshot with dispenser highlighted
                            await page.screenshot(path="step_6_dispenser_highlighted.png")
                            print("📸 Screenshot saved: step_6_dispenser_highlighted.png")
                            
                            print("👀 Look for the blue-highlighted Dispenser section")
                            
                            if not wait_for_user("Can you see the highlighted Dispenser section? Ready to try clicking it?"):
                                return
                            
                            # STEP 7: Try to Click Dispenser Section
                            print("\n🔧 STEP 7: Attempting to click Dispenser section...")
                            
                            # Find a clickable dispenser section
                            dispenser_selectors = [
                                "h6:has-text('Dispenser')",
                                ".group-header:has-text('Dispenser')", 
                                "[data-target]:has-text('Dispenser')",
                                "button:has-text('Dispenser')",
                                "*[class*='dispenser']:has-text('Dispenser')"
                            ]
                            
                            clicked = False
                            for selector in dispenser_selectors:
                                try:
                                    dispenser_section = await page.wait_for_selector(selector, timeout=2000)
                                    if dispenser_section:
                                        await dispenser_section.click()
                                        print(f"✅ Clicked dispenser section with selector: {selector}")
                                        clicked = True
                                        break
                                except:
                                    continue
                            
                            if not clicked:
                                print("⚠️ Could not find a clickable dispenser section")
                                print("💡 This might be normal if dispensers are already visible")
                            
                            # Wait for any expansion
                            await asyncio.sleep(2)
                            
                            # Take final screenshot
                            await page.screenshot(path="step_7_final_state.png")
                            print("📸 Final screenshot saved: step_7_final_state.png")
                            
                        else:
                            print("❌ No dispenser elements found")
                    
                    except Exception as e:
                        print(f"❌ Error finding dispenser section: {e}")
                        
                else:
                    print("❌ 'Dispenser' text not found on page")
                    print("💡 Equipment content may not have loaded properly")
                
                print("\n🏁 STEP-BY-STEP TEST COMPLETED")
                print("🌐 Browser will stay OPEN for your inspection")
                print("📸 Screenshots saved for comparison")
                print("⚠️  IMPORTANT: Close the browser manually when you're done inspecting")
                
                # Keep the browser open - don't close it
                print("\n💡 Test finished - browser remains open for inspection")
                print("   You can now examine the page state")
                print("   Close the browser window when you're done")
                return  # Exit without closing browser
                
            else:
                print("❌ Equipment tab not found")
                
        except Exception as e:
            print(f"❌ Error finding Equipment tab: {e}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Only close browser on error
        if automation_service and hasattr(automation_service, 'browser') and automation_service.browser:
            print("\n🧹 Closing browser due to error...")
            await automation_service.browser.close()
    
    # Normal completion - browser stays open
    print("\n🏁 STEP-BY-STEP TEST COMPLETED")
    print("📸 Screenshots saved:")
    print("   • step_3_customer_page.png")
    print("   • step_4_equipment_highlighted.png") 
    print("   • step_5_equipment_clicked.png")
    print("   • step_6_dispenser_highlighted.png")
    print("   • step_7_final_state.png")

if __name__ == "__main__":
    asyncio.run(step_by_step_test())