#!/usr/bin/env python3
"""
Dispenser scraping test with detailed screenshots at each critical step
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService

async def detailed_screenshot_test():
    """Test with screenshots at each critical step"""
    
    print("📸 DETAILED SCREENSHOT TEST")
    print("=" * 50)
    print("Taking screenshots at each critical step:")
    print("1. Initial customer page (Visits tab)")
    print("2. After clicking Equipment tab")  
    print("3. After clicking Dispenser section")
    print("4. Final state with dispensers visible")
    print()
    
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    automation_service = None
    
    try:
        # Initialize visible browser
        print("🔧 Initializing visible browser...")
        automation_service = WorkFossaAutomationService(headless=False)
        session_id = str(uuid.uuid4())
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        # Login
        await automation_service.create_session(session_id, user_id, credentials)
        await automation_service.login_to_workfossa(session_id)
        print("✅ Logged in successfully")
        
        # Get page
        session_data = automation_service.sessions.get(session_id)
        page = session_data.get('page')
        
        # Navigate to customer page
        customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
        await page.goto(customer_url)
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(2)
        
        # SCREENSHOT 1: Initial state (should show Visits tab active)
        print("📸 SCREENSHOT 1: Initial customer page (Visits tab active)")
        await page.screenshot(path="step1_initial_visits_tab.png")
        print("   Saved: step1_initial_visits_tab.png")
        
        # Find and click Equipment tab
        print("\n🔧 Looking for Equipment tab...")
        equipment_tab = await page.wait_for_selector("a:has-text('Equipment')", timeout=10000)
        
        if equipment_tab:
            print("✅ Found Equipment tab")
            
            # Highlight Equipment tab
            await page.evaluate("""
                (element) => {
                    element.style.border = '3px solid red';
                    element.style.backgroundColor = 'yellow';
                    element.scrollIntoView();
                }
            """, equipment_tab)
            
            # Screenshot with highlighted Equipment tab
            print("📸 SCREENSHOT 1.5: Equipment tab highlighted (before click)")
            await page.screenshot(path="step1_5_equipment_highlighted.png")
            print("   Saved: step1_5_equipment_highlighted.png")
            
            # Click Equipment tab
            print("🔧 Clicking Equipment tab...")
            await equipment_tab.click()
            print("✅ Equipment tab clicked")
            
            # Wait for Equipment content to load
            await asyncio.sleep(3)
            
            # SCREENSHOT 2: After clicking Equipment tab
            print("📸 SCREENSHOT 2: After clicking Equipment tab (Equipment content visible)")
            await page.screenshot(path="step2_equipment_tab_active.png")
            print("   Saved: step2_equipment_tab_active.png")
            
            # Look for Dispenser section
            print("\n🔧 Looking for Dispenser section...")
            
            # Try different selectors for dispenser section
            dispenser_selectors = [
                "h6:has-text('Dispenser')",
                ".group-header:has-text('Dispenser')",
                "*:has-text('Dispenser')"
            ]
            
            dispenser_section = None
            for selector in dispenser_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        is_visible = await element.is_visible()
                        if is_visible:
                            text = await element.text_content()
                            if 'Dispenser' in text and len(text.strip()) < 50:  # Likely a header
                                dispenser_section = element
                                print(f"✅ Found Dispenser section with selector: {selector}")
                                break
                    if dispenser_section:
                        break
                except:
                    continue
            
            if dispenser_section:
                # Highlight Dispenser section
                await page.evaluate("""
                    (element) => {
                        element.style.border = '3px solid blue';
                        element.style.backgroundColor = 'lightblue';
                        element.scrollIntoView();
                    }
                """, dispenser_section)
                
                # Screenshot with highlighted Dispenser section
                print("📸 SCREENSHOT 2.5: Dispenser section highlighted (before click)")
                await page.screenshot(path="step2_5_dispenser_highlighted.png")
                print("   Saved: step2_5_dispenser_highlighted.png")
                
                # Click Dispenser section
                print("🔧 Clicking Dispenser section...")
                await dispenser_section.click()
                print("✅ Dispenser section clicked")
                
                # Wait for dispenser content to expand
                await asyncio.sleep(3)
                
                # SCREENSHOT 3: After clicking Dispenser section
                print("📸 SCREENSHOT 3: After clicking Dispenser section (dispensers should be visible)")
                await page.screenshot(path="step3_dispensers_expanded.png")
                print("   Saved: step3_dispensers_expanded.png")
                
                # Look for actual dispenser data
                print("\n🔧 Looking for dispenser data...")
                
                # Check for dispenser numbers/details
                dispenser_data = await page.evaluate("""
                    () => {
                        const dispenserInfo = [];
                        
                        // Look for dispenser numbers and details
                        const allText = document.body.innerText;
                        const lines = allText.split('\\n');
                        
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (line.includes('S/N:') || line.includes('Make:') || line.includes('Model:')) {
                                dispenserInfo.push(line);
                            }
                        }
                        
                        return {
                            dispenserLines: dispenserInfo.slice(0, 10), // First 10 lines
                            hasSerialNumbers: allText.includes('S/N:'),
                            hasMakeModel: allText.includes('Make:') && allText.includes('Model:'),
                            hasGilbarco: allText.includes('Gilbarco')
                        };
                    }
                """)
                
                print(f"📋 Dispenser data analysis:")
                print(f"   • Has serial numbers: {dispenser_data['hasSerialNumbers']}")
                print(f"   • Has make/model info: {dispenser_data['hasMakeModel']}")
                print(f"   • Contains 'Gilbarco': {dispenser_data['hasGilbarco']}")
                
                if dispenser_data['dispenserLines']:
                    print(f"   • Found {len(dispenser_data['dispenserLines'])} dispenser detail lines:")
                    for i, line in enumerate(dispenser_data['dispenserLines'][:5]):
                        print(f"     {i+1}. {line}")
                
            else:
                print("❌ Could not find Dispenser section to click")
            
            # SCREENSHOT 4: Final state
            print("\n📸 SCREENSHOT 4: Final state")
            await page.screenshot(path="step4_final_state.png")
            print("   Saved: step4_final_state.png")
            
        else:
            print("❌ Equipment tab not found")
        
        print("\n📸 SCREENSHOT SUMMARY:")
        print("=" * 50)
        print("✅ step1_initial_visits_tab.png - Initial page (Visits tab)")
        print("✅ step1_5_equipment_highlighted.png - Equipment tab highlighted")
        print("✅ step2_equipment_tab_active.png - After Equipment tab click")
        print("✅ step2_5_dispenser_highlighted.png - Dispenser section highlighted")
        print("✅ step3_dispensers_expanded.png - After Dispenser section click")
        print("✅ step4_final_state.png - Final state")
        
        print("\n🌐 Browser staying open for 30 seconds for inspection...")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        if automation_service and hasattr(automation_service, 'browser') and automation_service.browser:
            print("🧹 Closing browser...")
            await automation_service.browser.close()
        
        print("\n🏁 DETAILED SCREENSHOT TEST COMPLETED")

if __name__ == "__main__":
    asyncio.run(detailed_screenshot_test())