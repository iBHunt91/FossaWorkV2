#!/usr/bin/env python3
"""
Auto-clicking test to verify Equipment tab functionality
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService

async def auto_equipment_test():
    """Auto-clicking test to verify Equipment tab works"""
    
    print("🔍 AUTO EQUIPMENT TAB TEST")
    print("=" * 50)
    
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    automation_service = None
    
    try:
        # Initialize visible browser
        automation_service = WorkFossaAutomationService(headless=False)
        session_id = str(uuid.uuid4())
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        # Login
        await automation_service.create_session(session_id, user_id, credentials)
        await automation_service.login_to_workfossa(session_id)
        
        # Get page
        session_data = automation_service.sessions.get(session_id)
        page = session_data.get('page')
        
        # Navigate to customer page
        customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
        await page.goto(customer_url)
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(2)
        
        print("📸 Taking before screenshot...")
        await page.screenshot(path="auto_test_before.png")
        
        # Try to click Equipment tab
        print("🔍 Looking for Equipment tab...")
        
        try:
            # Find Equipment tab
            equipment_tab = await page.wait_for_selector("a:has-text('Equipment')", timeout=5000)
            
            if equipment_tab:
                print("✅ Found Equipment tab")
                
                # Highlight it
                await page.evaluate("""
                    (element) => {
                        element.style.border = '5px solid red';
                        element.style.backgroundColor = 'yellow';
                        element.scrollIntoView();
                    }
                """, equipment_tab)
                
                print("🔴 Equipment tab highlighted")
                await asyncio.sleep(2)
                
                # Click it
                await equipment_tab.click()
                print("✅ Clicked Equipment tab")
                
                # Wait for content to load
                await asyncio.sleep(3)
                
                print("📸 Taking after screenshot...")
                await page.screenshot(path="auto_test_after.png")
                
                # Check if Equipment content loaded
                page_text = await page.text_content('body')
                if 'Dispenser' in page_text:
                    print("✅ Equipment content loaded - 'Dispenser' found!")
                else:
                    print("❌ Equipment content may not have loaded - 'Dispenser' not found")
                
                # Look for dispenser section
                try:
                    dispenser_section = await page.wait_for_selector("*:has-text('Dispenser')", timeout=3000)
                    if dispenser_section:
                        print("✅ Dispenser section found")
                        
                        # Highlight dispenser section
                        await page.evaluate("""
                            (element) => {
                                element.style.border = '5px solid blue';
                                element.style.backgroundColor = 'lightblue';
                            }
                        """, dispenser_section)
                        print("🔵 Dispenser section highlighted in blue")
                        
                except Exception as e:
                    print(f"❌ Could not find dispenser section: {e}")
                
            else:
                print("❌ Equipment tab not found")
                
        except Exception as e:
            print(f"❌ Error finding Equipment tab: {e}")
        
        # Keep browser open for 30 seconds for inspection
        print("\n⏰ Browser will stay open for 30 seconds for inspection...")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        if automation_service and hasattr(automation_service, 'browser') and automation_service.browser:
            print("🧹 Closing browser...")
            await automation_service.browser.close()
        
        print("\n🏁 AUTO TEST COMPLETED")

if __name__ == "__main__":
    asyncio.run(auto_equipment_test())