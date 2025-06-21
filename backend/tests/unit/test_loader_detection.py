#!/usr/bin/env python3
"""
Test loader detection when switching to Equipment tab
"""

import asyncio
import sys
import os
from pathlib import Path
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager import credential_manager
from app.services.content_based_wait import ContentBasedWait


async def test_loader_detection():
    """Test loader detection when clicking Equipment tab"""
    print("🧪 Testing Loader Detection")
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
        session_id = "test_loader"
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
        await page.goto(customer_url, wait_until="domcontentloaded")
        
        # Wait for Equipment tab
        print("\n⏳ Waiting for Equipment tab...")
        if await ContentBasedWait.wait_for_equipment_tab(page):
            print("✅ Equipment tab is ready")
        
        # Monitor loader state
        print("\n🔍 Setting up loader monitoring...")
        await page.evaluate("""
            () => {
                window.__loaderStates = [];
                
                // Monitor loader changes
                const checkLoader = () => {
                    const loader = document.querySelector('.loader-line');
                    if (loader) {
                        const display = window.getComputedStyle(loader).display;
                        const timestamp = new Date().toISOString();
                        window.__loaderStates.push({
                            time: timestamp,
                            display: display,
                            visible: display !== 'none'
                        });
                    }
                };
                
                // Check every 100ms
                window.__loaderInterval = setInterval(checkLoader, 100);
                
                // Initial check
                checkLoader();
            }
        """)
        
        # Click Equipment tab
        print("\n👆 Clicking Equipment tab...")
        click_time = time.time()
        await page.click('text="Equipment"')
        
        # Wait for loader to disappear
        print("\n⏳ Waiting for loader to disappear...")
        loader_start = time.time()
        
        loader_disappeared = await ContentBasedWait.wait_for_loader_to_disappear(page)
        
        loader_time = time.time() - loader_start
        total_time = time.time() - click_time
        
        if loader_disappeared:
            print(f"✅ Loader disappeared after {loader_time:.2f}s")
            print(f"   Total time from click: {total_time:.2f}s")
        else:
            print("❌ Loader did not disappear in time")
        
        # Stop monitoring and get results
        loader_states = await page.evaluate("""
            () => {
                if (window.__loaderInterval) {
                    clearInterval(window.__loaderInterval);
                }
                return window.__loaderStates;
            }
        """)
        
        print(f"\n📊 Loader state changes: {len(loader_states)}")
        if loader_states:
            # Show first few and last few states
            print("\n   First states:")
            for state in loader_states[:3]:
                print(f"   - {state['time']}: display={state['display']} (visible={state['visible']})")
            
            if len(loader_states) > 6:
                print("   ...")
                
            print("\n   Last states:")
            for state in loader_states[-3:]:
                print(f"   - {state['time']}: display={state['display']} (visible={state['visible']})")
        
        # Now check if Dispenser toggle is ready
        print("\n🔍 Checking for Dispenser toggle...")
        toggle_text = await ContentBasedWait.wait_for_dispenser_toggle(page, timeout=3000)
        
        if toggle_text:
            print(f"✅ Found: {toggle_text}")
            
            # Close modal if present
            await ContentBasedWait.wait_for_modal_and_close(page)
            
            # Try clicking the toggle
            print("\n👆 Attempting to click Dispenser toggle...")
            
            # Check loader state before clicking
            loader_visible_before = await page.evaluate("""
                () => {
                    const loader = document.querySelector('.loader-line');
                    if (loader) {
                        const display = window.getComputedStyle(loader).display;
                        return display !== 'none';
                    }
                    return false;
                }
            """)
            
            print(f"   Loader visible before click: {loader_visible_before}")
            
            if not loader_visible_before:
                # Safe to click
                clicked = await ContentBasedWait.click_dispenser_toggle_safely(page)
                
                if clicked:
                    print("✅ Clicked Dispenser toggle")
                    
                    # Wait for content
                    success, count = await ContentBasedWait.wait_for_dispenser_content(
                        page, timeout=5000, min_containers=1
                    )
                    
                    if success:
                        print(f"✅ Dispenser content loaded ({count} containers)")
                    else:
                        print("❌ Dispenser content did not appear")
                else:
                    print("❌ Failed to click Dispenser toggle")
            else:
                print("⚠️  Loader still visible, not safe to click")
        else:
            print("❌ Dispenser toggle not found")
        
        print("\n✅ Test complete!")
        
        # Keep browser open briefly
        print("\n⏸️  Browser will remain open for 5 seconds...")
        await asyncio.sleep(5)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("\n✅ Done")


if __name__ == "__main__":
    asyncio.run(test_loader_detection())