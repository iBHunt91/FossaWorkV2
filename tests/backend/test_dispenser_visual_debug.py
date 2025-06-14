#!/usr/bin/env python3
"""
Visual debugging test for dispenser scraping - shows browser and pauses for inspection
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.database import SessionLocal
from app.models import WorkOrder
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def visual_debug_test():
    """Visual debugging test with browser pause for inspection"""
    
    print("🔍 VISUAL DEBUGGING TEST - DISPENSER SCRAPING")
    print("=" * 60)
    print("This test will:")
    print("1. Open a VISIBLE browser")
    print("2. Navigate through the dispenser scraping process")
    print("3. PAUSE at the end so you can inspect the page")
    print("4. Wait for you to press ENTER to close the browser")
    print()
    
    # Initialize variables for cleanup
    automation_service = None
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    
    # Get a work order with customer URL
    db = SessionLocal()
    try:
        # Try broader search first
        wo = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).first()
        
        if not wo:
            print("❌ No work orders found for this user!")
            return
        
        # Get dispenser-specific work order
        dispenser_wo = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"]),
            WorkOrder.user_id == user_id
        ).first()
        
        if dispenser_wo:
            wo = dispenser_wo
            print(f"✅ Found dispenser work order: {wo.external_id}")
        else:
            print(f"⚠️ Using non-dispenser work order for testing: {wo.external_id}")
        
        customer_url = wo.scraped_data.get('customer_url') if wo.scraped_data else None
        
        print(f"🎯 Testing with work order: {wo.external_id}")
        print(f"📍 Site: {wo.site_name}")
        print(f"🔗 Customer URL: {customer_url}")
        print()
        
        if not customer_url:
            print("❌ No customer URL found!")
            return
        
        # Initialize services in VISIBLE mode
        print("🔧 STEP 1: Initialize Services (VISIBLE BROWSER)")
        print("-" * 50)
        automation_service = WorkFossaAutomationService(headless=False)  # VISIBLE!
        scraper = WorkFossaScraper(automation_service)
        print("✅ Services initialized - browser will be VISIBLE")
        print()
        
        # Create session and login
        print("🔧 STEP 2: Create Session and Login")
        print("-" * 50)
        session_id = str(uuid.uuid4())
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        await automation_service.create_session(session_id, user_id, credentials)
        print("✅ Browser session created - you should see the browser window")
        
        await automation_service.login_to_workfossa(session_id)
        print("✅ Successfully logged into WorkFossa")
        print()
        
        # Navigate to customer page first
        print("🔧 STEP 3: Navigate to Customer Page")
        print("-" * 50)
        print(f"🔗 Navigating to: {customer_url}")
        
        # Get the page from the session
        session_data = automation_service.sessions.get(session_id)
        if not session_data:
            print("❌ No session data found!")
            return
            
        page = session_data.get('page')
        if not page:
            print("❌ No page found in session!")
            return
        
        # Navigate to customer page
        await page.goto(customer_url)
        await page.wait_for_load_state('networkidle')
        print("✅ Navigated to customer page")
        
        # Take a screenshot before clicking anything
        screenshot_path = f"debug_before_equipment_tab_{wo.external_id}_{session_id[:8]}.png"
        await page.screenshot(path=screenshot_path)
        print(f"📸 Screenshot saved: {screenshot_path}")
        print()
        
        # Now try to find and click the Equipment tab
        print("🔧 STEP 4: Find and Click Equipment Tab")
        print("-" * 50)
        
        # Wait a bit for page to stabilize
        await asyncio.sleep(2)
        
        # Look for Equipment tab with multiple selectors
        equipment_selectors = [
            "a:has-text('Equipment')",
            "[role='tab']:has-text('Equipment')",
            ".tab:has-text('Equipment')",
            "button:has-text('Equipment')",
            "*:has-text('Equipment')"
        ]
        
        equipment_found = False
        for i, selector in enumerate(equipment_selectors, 1):
            try:
                print(f"🔍 Trying Equipment tab selector {i}/5: {selector}")
                element = await page.wait_for_selector(selector, timeout=3000)
                if element:
                    print(f"✅ Found Equipment tab with selector: {selector}")
                    
                    # Scroll element into view
                    await element.scroll_into_view_if_needed()
                    await asyncio.sleep(1)
                    
                    # Highlight the element
                    await page.evaluate("""
                        (element) => {
                            element.style.border = '3px solid red';
                            element.style.backgroundColor = 'yellow';
                        }
                    """, element)
                    
                    print("🔴 Equipment tab is now HIGHLIGHTED in red/yellow")
                    print("👀 You should see the highlighted Equipment tab in the browser")
                    
                    # Wait for user confirmation
                    input("\n⏸️  PAUSE: Press ENTER when you can see the highlighted Equipment tab...")
                    
                    # Click the Equipment tab
                    await element.click()
                    print("✅ Clicked Equipment tab")
                    equipment_found = True
                    break
                    
            except Exception as e:
                print(f"❌ Selector {i} failed: {str(e)[:100]}")
                continue
        
        if not equipment_found:
            print("❌ Could not find Equipment tab with any selector")
            print("📋 Available text content on page:")
            page_text = await page.text_content('body')
            if 'Equipment' in page_text:
                print("✅ 'Equipment' text IS present on the page")
            else:
                print("❌ 'Equipment' text is NOT present on the page")
        else:
            # Wait for Equipment tab content to load
            await asyncio.sleep(3)
            
            # Take screenshot after clicking Equipment tab
            screenshot_path_after = f"debug_after_equipment_tab_{wo.external_id}_{session_id[:8]}.png"
            await page.screenshot(path=screenshot_path_after)
            print(f"📸 Screenshot after Equipment tab: {screenshot_path_after}")
        
        print()
        print("🔧 STEP 5: Continue with Dispenser Scraping")
        print("-" * 50)
        
        # Now run the full dispenser scraping
        dispensers = await scraper.scrape_dispenser_details(session_id, wo.external_id, customer_url)
        
        print(f"📊 SCRAPING RESULTS: Found {len(dispensers)} dispensers")
        for i, dispenser in enumerate(dispensers, 1):
            print(f"  {i}. Dispenser #{dispenser.get('dispenser_number', 'N/A')}")
            print(f"     Serial: {dispenser.get('serial_number', 'N/A')}")
            print(f"     Details: {dispenser.get('title', 'N/A')[:50]}...")
        
        print()
        print("🔧 FINAL STEP: Browser Inspection")
        print("-" * 50)
        print("👀 The browser is still open for your inspection")
        print("🔍 You can now examine the page state")
        print("📸 Screenshots have been saved for comparison")
        print()
        
        # PAUSE for user inspection
        input("⏸️  FINAL PAUSE: Press ENTER when you're done inspecting the browser...")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()
        
        # Clean up browser
        if hasattr(automation_service, 'browser') and automation_service.browser:
            print("🧹 Closing browser...")
            await automation_service.browser.close()
        
        print("\n" + "=" * 60)
        print("🏁 VISUAL DEBUG TEST COMPLETED")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(visual_debug_test())