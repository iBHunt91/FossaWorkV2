#!/usr/bin/env python3
"""
Test better wait conditions for Equipment tab and Dispenser toggle
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


async def wait_for_equipment_tab_ready(page):
    """Wait for Equipment tab to be fully loaded and ready"""
    print("\n⏳ Waiting for Equipment tab to be fully ready...")
    
    # Method 1: Wait for specific elements that indicate tab is loaded
    try:
        # Wait for the Equipment tab content to be visible
        await page.wait_for_selector('.tab-pane.active', state='visible', timeout=5000)
        print("   ✅ Tab pane is active")
    except:
        print("   ⚠️  Tab pane not found")
    
    # Method 2: Wait for the Dispenser section link to be present
    try:
        await page.wait_for_selector('a:has-text("Dispenser"), button:has-text("Dispenser")', state='visible', timeout=5000)
        print("   ✅ Dispenser toggle is visible")
    except:
        print("   ⚠️  Dispenser toggle not found")
    
    # Method 3: Check if content is still loading
    is_loading = await page.evaluate("""
        () => {
            // Check for loading indicators
            const spinners = document.querySelectorAll('.spinner, .loading, [class*="load"]');
            const hasSpinners = spinners.length > 0;
            
            // Check for skeleton loaders
            const skeletons = document.querySelectorAll('.skeleton, [class*="skeleton"]');
            const hasSkeletons = skeletons.length > 0;
            
            // Check if any AJAX requests are pending (jQuery)
            const jqueryActive = typeof jQuery !== 'undefined' ? jQuery.active > 0 : false;
            
            return {
                hasSpinners: hasSpinners,
                hasSkeletons: hasSkeletons,
                jqueryActive: jqueryActive,
                isLoading: hasSpinners || hasSkeletons || jqueryActive
            };
        }
    """)
    
    if is_loading['isLoading']:
        print(f"   ⏳ Content still loading: {is_loading}")
        await page.wait_for_timeout(2000)
    else:
        print("   ✅ No loading indicators found")
    
    # Method 4: Wait for network to be idle
    await page.wait_for_load_state('networkidle')
    print("   ✅ Network is idle")
    
    # Method 5: Check DOM stability
    initial_html = await page.content()
    await page.wait_for_timeout(500)
    final_html = await page.content()
    
    if len(initial_html) != len(final_html):
        print(f"   ⏳ DOM still changing: {len(initial_html)} -> {len(final_html)}")
        await page.wait_for_timeout(1000)
    else:
        print("   ✅ DOM is stable")
    
    # Final safety wait
    await page.wait_for_timeout(1000)
    print("   ✅ Equipment tab should be ready now")


async def wait_for_dispenser_content_ready(page):
    """Wait for Dispenser content to be fully expanded and ready"""
    print("\n⏳ Waiting for Dispenser content to be ready...")
    
    # Method 1: Wait for dispenser containers to appear
    try:
        await page.wait_for_selector('div.py-1\\.5', state='visible', timeout=5000)
        count = await page.locator('div.py-1\\.5').count()
        print(f"   ✅ Found {count} dispenser containers")
    except:
        print("   ⚠️  No dispenser containers found")
    
    # Method 2: Wait for specific dispenser content
    try:
        await page.wait_for_function("""
            () => {
                // Look for dispenser-specific content
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    const text = el.textContent || '';
                    if (text.includes('S/N:') || text.includes('Serial Number') || 
                        text.includes('Wayne') || text.includes('Gilbarco')) {
                        return true;
                    }
                }
                return false;
            }
        """, timeout=5000)
        print("   ✅ Dispenser content detected")
    except:
        print("   ⚠️  No dispenser content found")
    
    # Method 3: Check animation/transition completion
    await page.evaluate("""
        () => {
            // Force any CSS transitions to complete
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                el.style.transition = 'none';
            });
        }
    """)
    print("   ✅ Forced transition completion")
    
    # Final wait for content to settle
    await page.wait_for_load_state('networkidle')
    await page.wait_for_timeout(500)
    print("   ✅ Dispenser content should be ready")


async def test_wait_conditions():
    """Test improved wait conditions"""
    print("🧪 Testing Improved Wait Conditions")
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
        session_id = "test_wait_conditions"
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
        await page.wait_for_load_state('networkidle')
        print("✅ Page loaded")
        
        # Click Equipment tab with improved wait
        print("\n🔧 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        
        # Wait for Equipment tab to be ready
        await wait_for_equipment_tab_ready(page)
        
        # Close modal if present
        try:
            cancel_button = await page.query_selector('button:has-text("Cancel")')
            if cancel_button:
                print("\n📋 Closing modal...")
                await cancel_button.click()
                await page.wait_for_timeout(1000)
        except:
            pass
        
        # Find and click Dispenser toggle
        print("\n🔧 Looking for Dispenser toggle...")
        
        # Check current state
        dispenser_toggle = await page.query_selector('a:has-text("Dispenser"), button:has-text("Dispenser")')
        if dispenser_toggle:
            # Check if already expanded
            expanded = await dispenser_toggle.get_attribute('aria-expanded')
            print(f"   Current expanded state: {expanded}")
            
            # Get initial container count
            initial_count = await page.locator('div.py-1\\.5').count()
            print(f"   Initial container count: {initial_count}")
            
            # Click the toggle
            print("\n🔧 Clicking Dispenser toggle...")
            await dispenser_toggle.click()
            
            # Wait for content to be ready
            await wait_for_dispenser_content_ready(page)
            
            # Get final container count
            final_count = await page.locator('div.py-1\\.5').count()
            print(f"\n📊 Final container count: {final_count}")
            
            if final_count > initial_count:
                print("✅ Dispenser section expanded successfully!")
                
                # Extract one dispenser to verify
                first_container = await page.locator('div.py-1\\.5').first
                text = await first_container.text_content()
                print(f"\n📄 First container preview: {text[:200] if text else 'Empty'}...")
            else:
                print("⚠️  Container count didn't increase")
        else:
            print("❌ Could not find Dispenser toggle")
        
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
    asyncio.run(test_wait_conditions())