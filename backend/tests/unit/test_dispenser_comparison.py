#!/usr/bin/env python3
"""
Non-interactive test comparing working vs non-working dispenser extraction
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
from app.services.dispenser_scraper import DispenserScraper


async def test_manual_approach():
    """Test the approach from the working interactive script"""
    print("\n" + "=" * 60)
    print("TESTING MANUAL APPROACH (from interactive script)")
    print("=" * 60)
    
    # Get credentials
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds:
        print("❌ No credentials found")
        return None
    
    credentials = {
        "username": creds.username,
        "password": creds.password
    }
    
    # Create service
    automation = WorkFossaAutomationService(headless=False)
    
    try:
        # Create session and login
        session_id = "test_manual"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return None
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Navigate to customer page
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        print(f"\n📍 Navigating to: {customer_url}")
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        print("✅ Page loaded")
        
        # Click Equipment tab
        print("\n🔧 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        await page.wait_for_timeout(2000)
        
        # Close modal if present
        try:
            cancel_button = await page.query_selector('button:has-text("Cancel")')
            if cancel_button:
                print("📋 Closing modal...")
                await cancel_button.click()
                await page.wait_for_timeout(1000)
        except:
            pass
        
        # Look for and click Dispenser section
        print("\n🔍 Looking for Dispenser section...")
        
        # Look specifically for "Dispenser (8)" or similar
        dispenser_toggle = None
        toggle_text = None
        
        # Check all links and buttons for Dispenser text
        elements = await page.query_selector_all('a, button, h3')
        for element in elements:
            text = await element.text_content()
            if text and 'Dispenser' in text:
                print(f"   Found element with text: {text.strip()}")
                if '(' in text and ')' in text:  # Found "Dispenser (8)"
                    dispenser_toggle = element
                    toggle_text = text.strip()
                    break
        
        if dispenser_toggle:
            print(f"   ✅ Found Dispenser toggle: {toggle_text}")
            
            # Check if already expanded by looking for dispenser content
            initial_containers = await page.locator('div.py-1\\.5').count()
            print(f"   Initial container count: {initial_containers}")
            
            if initial_containers == 0:
                print("\n👆 Clicking to expand Dispenser section...")
                await dispenser_toggle.click()
                await page.wait_for_timeout(2000)
                print("✅ Clicked to expand")
                
                # Check container count after click
                final_containers = await page.locator('div.py-1\\.5').count()
                print(f"   Container count after click: {final_containers}")
            else:
                print("   ✅ Dispenser section already expanded")
        
        # Extract using the working selector
        print("\n📋 Extracting dispenser information...")
        dispenser_containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        print(f"   Found {len(dispenser_containers)} dispenser containers")
        
        dispensers_found = 0
        for container in dispenser_containers:
            try:
                if await container.locator('.px-2').count() > 0:
                    text = await container.inner_text()
                    # Check if it has dispenser info
                    if 'S/N' in text or 'MAKE' in text or 'MODEL' in text:
                        dispensers_found += 1
                        print(f"\n   ✅ Dispenser {dispensers_found}:")
                        print(f"      Preview: {text[:150]}...")
            except:
                continue
        
        print(f"\n📊 Manual approach found: {dispensers_found} dispensers")
        return dispensers_found
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        await automation.cleanup_session(session_id)


async def test_app_approach():
    """Test the approach from the app implementation"""
    print("\n" + "=" * 60)
    print("TESTING APP APPROACH (DispenserScraper)")
    print("=" * 60)
    
    # Get credentials
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds:
        print("❌ No credentials found")
        return None
    
    credentials = {
        "username": creds.username,
        "password": creds.password
    }
    
    # Create service
    automation = WorkFossaAutomationService(headless=False)
    scraper = DispenserScraper()
    
    try:
        # Create session and login
        session_id = "test_app"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return None
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Navigate to customer page
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        print(f"\n📍 Using scraper to fetch dispensers from: {customer_url}")
        
        # Use the scraper's method
        dispensers, html = await scraper.scrape_dispensers_for_work_order(
            page, 
            work_order_id="110296",
            visit_url=customer_url
        )
        
        print(f"\n📊 App approach found: {len(dispensers)} dispensers")
        
        for i, dispenser in enumerate(dispensers):
            print(f"\n   Dispenser {i+1}:")
            print(f"      Title: {dispenser.title}")
            print(f"      S/N: {dispenser.serial_number}")
            print(f"      Make: {dispenser.make}")
            print(f"      Model: {dispenser.model}")
        
        return len(dispensers)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        await automation.cleanup_session(session_id)


async def main():
    """Run both tests and compare results"""
    print("🧪 Comparing Dispenser Extraction Approaches")
    
    # Test manual approach first
    manual_count = await test_manual_approach()
    
    # Small delay between tests
    await asyncio.sleep(2)
    
    # Test app approach
    app_count = await test_app_approach()
    
    # Compare results
    print("\n" + "=" * 60)
    print("COMPARISON RESULTS")
    print("=" * 60)
    print(f"Manual approach: {manual_count} dispensers")
    print(f"App approach: {app_count} dispensers")
    
    if manual_count == app_count and manual_count > 0:
        print("\n✅ Both approaches work correctly!")
    elif manual_count > 0 and app_count == 0:
        print("\n❌ App approach is failing - needs fix")
    elif manual_count == 0 and app_count == 0:
        print("\n⚠️  Both approaches failed - possible page structure change")
    else:
        print("\n🤔 Unexpected result - further investigation needed")


if __name__ == "__main__":
    asyncio.run(main())