#!/usr/bin/env python3
"""
Test the improved dispenser click mechanism that handles the specific HTML structure
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
from app.services.credential_manager_deprecated import credential_manager
from app.services.content_based_wait import ContentBasedWait


async def test_improved_dispenser_click():
    """Test the improved dispenser click mechanism"""
    print("🧪 Testing Improved Dispenser Click")
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
        session_id = "test_improved_click"
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
        
        # Click Equipment tab
        print("\n👆 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        
        # Wait for loader to disappear
        print("\n⏳ Waiting for loader to disappear...")
        if await ContentBasedWait.wait_for_loader_to_disappear(page):
            print("✅ Loader has disappeared")
        
        # Wait for and extract dispenser count
        print("\n🔍 Looking for Dispenser toggle...")
        toggle_text = await ContentBasedWait.wait_for_dispenser_toggle(page)
        if toggle_text:
            print(f"✅ Found: {toggle_text}")
            expected_count = await ContentBasedWait.extract_dispenser_count_from_toggle(page)
            print(f"📊 Expected dispenser count: {expected_count}")
        
        # Close modal if present
        print("\n📋 Checking for modal...")
        if await ContentBasedWait.wait_for_modal_and_close(page):
            print("✅ Modal closed")
        else:
            print("ℹ️  No modal found")
        
        # Check initial container count
        initial_count = await page.locator('div.py-1\\.5').count()
        print(f"\n📊 Initial container count: {initial_count}")
        
        # Try the improved click method
        print("\n🎯 Testing improved Dispenser click...")
        click_success = await ContentBasedWait.click_dispenser_toggle_safely(page)
        
        if click_success:
            print("✅ Click method returned success")
            
            # Wait a bit for expansion
            await asyncio.sleep(1)
            
            # Check final container count
            final_count = await page.locator('div.py-1\\.5').count()
            print(f"\n📊 Final container count: {final_count}")
            
            # Check for actual dispenser content
            success, dispenser_count = await ContentBasedWait.wait_for_dispenser_content(
                page, timeout=3000, min_containers=1
            )
            
            if success:
                print(f"✅ Found {dispenser_count} dispensers with content")
                
                # Extract some sample data
                sample_data = await page.evaluate("""
                    () => {
                        const containers = document.querySelectorAll('div.py-1\\\\.5');
                        const samples = [];
                        
                        for (let i = 0; i < Math.min(3, containers.length); i++) {
                            const text = containers[i].textContent || '';
                            if (text.includes('S/N:') || text.includes('MAKE:')) {
                                samples.push(text.trim().substring(0, 100));
                            }
                        }
                        
                        return samples;
                    }
                """)
                
                if sample_data:
                    print("\n📄 Sample dispenser data:")
                    for i, data in enumerate(sample_data):
                        print(f"   {i+1}. {data}...")
            else:
                print("❌ No dispenser content found after click")
                
                # Debug: check what's visible
                visible_elements = await page.evaluate("""
                    () => {
                        const result = {
                            links: [],
                            containers: [],
                            hiddenElements: []
                        };
                        
                        // Check all links
                        document.querySelectorAll('a').forEach(a => {
                            if (a.textContent && a.textContent.includes('Dispenser')) {
                                result.links.push({
                                    text: a.textContent.trim(),
                                    href: a.href,
                                    visible: a.offsetHeight > 0
                                });
                            }
                        });
                        
                        // Check containers
                        document.querySelectorAll('[class*="equipment"], .py-1\\\\.5').forEach(el => {
                            const text = el.textContent || '';
                            if (text.length > 10) {
                                result.containers.push({
                                    class: el.className,
                                    visible: el.offsetHeight > 0,
                                    display: window.getComputedStyle(el).display,
                                    sample: text.substring(0, 50)
                                });
                            }
                        });
                        
                        // Check for hidden elements
                        document.querySelectorAll('[style*="display: none"], .collapse:not(.show)').forEach(el => {
                            if (el.className || el.id) {
                                result.hiddenElements.push({
                                    tag: el.tagName,
                                    class: el.className,
                                    id: el.id
                                });
                            }
                        });
                        
                        return result;
                    }
                """)
                
                print("\n🔍 Debug info:")
                print(f"Links: {visible_elements['links']}")
                print(f"Containers: {len(visible_elements['containers'])} found")
                print(f"Hidden elements: {len(visible_elements['hiddenElements'])} found")
        else:
            print("❌ Click method failed")
        
        # Take screenshot
        print("\n📸 Taking screenshot...")
        await page.screenshot(path="test_improved_click_result.png")
        print("   Screenshot saved as test_improved_click_result.png")
        
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
    asyncio.run(test_improved_dispenser_click())