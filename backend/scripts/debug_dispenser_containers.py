#!/usr/bin/env python3
"""
Debug script to see what's in the dispenser containers
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
from playwright.async_api import async_playwright


async def debug_containers():
    """Debug what's in the dispenser containers"""
    print("🔍 Debugging Dispenser Containers")
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
    
    print(f"✅ Using credentials for: {credentials['username']}")
    
    # Create service
    automation = WorkFossaAutomationService(headless=False)
    
    try:
        # Create session and login
        session_id = "debug_containers"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Navigate to customer page
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        print(f"\n📍 Navigating to: {customer_url}")
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        # Click Equipment tab
        print("🔧 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        await page.wait_for_load_state('networkidle')
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
        
        # Click Dispenser section
        print("🔧 Clicking Dispenser section...")
        await page.click('a:has-text("Dispenser")')
        await page.wait_for_load_state('networkidle')
        await page.wait_for_timeout(1000)
        
        # Find all potential containers
        print("\n🔍 Looking for containers with selector: div.py-1\\.5, div.py-1\\.5.bg-gray-50")
        containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        print(f"Found {len(containers)} containers")
        
        # Debug each container
        print("\n📋 Container Contents:")
        print("-" * 50)
        
        for i, container in enumerate(containers):
            try:
                text = await container.text_content()
                html = await container.inner_html()
                
                print(f"\n🔷 Container {i+1}:")
                print(f"Text length: {len(text) if text else 0} characters")
                
                if text:
                    # Show first 200 chars
                    preview = text.strip()[:200]
                    print(f"Text preview: {preview}")
                    
                    # Check for key indicators
                    has_dispenser = 'Dispenser' in text
                    has_serial = 'S/N' in text or 'Serial' in text
                    has_make = any(mfr in text for mfr in ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett'])
                    
                    print(f"Contains 'Dispenser': {has_dispenser}")
                    print(f"Contains serial: {has_serial}")
                    print(f"Contains manufacturer: {has_make}")
                    
                    # Check structure
                    has_px2 = '<div class="px-2">' in html
                    print(f"Has px-2 div: {has_px2}")
                    
                    # If it looks like a dispenser, show more detail
                    if has_serial or has_make:
                        print("\n✅ This looks like a dispenser container!")
                        print("Full text:")
                        print("-" * 30)
                        print(text.strip())
                        print("-" * 30)
                else:
                    print("Empty container")
                    
            except Exception as e:
                print(f"Error processing container {i+1}: {e}")
        
        # Also check for alternative selectors
        print("\n🔍 Checking alternative selectors...")
        
        alt_selectors = [
            '.dispenser-item',
            '.equipment-item',
            '[data-equipment-type="dispenser"]',
            '.px-2:has(.text-tiny)'
        ]
        
        for selector in alt_selectors:
            count = await page.locator(selector).count()
            if count > 0:
                print(f"✅ Found {count} elements with selector: {selector}")
                # Show first element
                first = await page.locator(selector).first.text_content()
                if first:
                    print(f"   First element preview: {first[:100]}...")
        
        print("\n⏸️ Browser remains open. Press Enter to close...")
        input()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("✅ Done")


if __name__ == "__main__":
    asyncio.run(debug_containers())