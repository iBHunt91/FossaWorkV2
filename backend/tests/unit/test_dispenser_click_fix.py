#!/usr/bin/env python3
"""
Test fixing dispenser click with reload prevention and proper extraction
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


async def wait_for_user():
    """Wait for user to press Enter"""
    print("\n⏸️  Press Enter to continue...")
    await asyncio.get_event_loop().run_in_executor(None, input)


async def test_dispenser_click_fix():
    """Test fixing dispenser click with proper wait and extraction"""
    print("🧪 Testing Dispenser Click Fix")
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
        session_id = "test_click_fix"
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
        
        # Click Equipment tab
        print("\n🔧 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        await page.wait_for_load_state('networkidle')
        
        # Close modal if present
        try:
            cancel_button = await page.query_selector('button:has-text("Cancel")')
            if cancel_button:
                print("📋 Closing modal...")
                await cancel_button.click()
                await page.wait_for_timeout(1000)
        except:
            pass
        
        # Check if dispenser section is already visible
        print("\n🔍 Checking dispenser section state...")
        
        # Look for dispenser containers first
        initial_containers = await page.locator('div.py-1\\.5').all()
        print(f"Initial containers found: {len(initial_containers)}")
        
        # Check if any contain dispenser info
        has_dispenser_content = False
        for container in initial_containers:
            text = await container.text_content()
            if text and ('S/N' in text or 'Serial' in text or 'MAKE:' in text or 'MODEL:' in text):
                has_dispenser_content = True
                break
        
        if has_dispenser_content:
            print("✅ Dispenser content already visible!")
        else:
            print("⚠️  No dispenser content visible, need to expand")
            
            # Method 1: Try different dispenser toggle selectors
            print("\n🔍 Looking for Dispenser toggle...")
            toggle_selectors = [
                'a:has-text("Dispenser")',
                'button:has-text("Dispenser")',
                'h3:has-text("Dispenser")',
                '.accordion:has-text("Dispenser")',
                '[data-toggle]:has-text("Dispenser")',
                '.group-heading:has-text("Dispenser")'
            ]
            
            toggle_found = False
            for selector in toggle_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        print(f"   Found toggle with selector: {selector}")
                        
                        # Get element info
                        tag_name = await element.evaluate('el => el.tagName')
                        href = await element.get_attribute('href')
                        data_target = await element.get_attribute('data-target')
                        expanded = await element.get_attribute('aria-expanded')
                        
                        print(f"   Tag: {tag_name}")
                        print(f"   Href: {href}")
                        print(f"   Data-target: {data_target}")
                        print(f"   Expanded: {expanded}")
                        
                        # Inject click handler to prevent reload
                        await page.evaluate("""
                            (element) => {
                                console.log('Injecting click handler...');
                                element.addEventListener('click', (e) => {
                                    console.log('Click intercepted!');
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    // Get target element
                                    const href = element.getAttribute('href');
                                    const dataTarget = element.getAttribute('data-target');
                                    const targetSelector = href || dataTarget;
                                    
                                    if (targetSelector && targetSelector.startsWith('#')) {
                                        const target = document.querySelector(targetSelector);
                                        if (target) {
                                            // Toggle visibility
                                            if (target.style.display === 'none' || target.classList.contains('collapse')) {
                                                target.style.display = 'block';
                                                target.classList.remove('collapse');
                                                target.classList.add('show');
                                                element.setAttribute('aria-expanded', 'true');
                                            } else {
                                                target.style.display = 'none';
                                                target.classList.add('collapse');
                                                target.classList.remove('show');
                                                element.setAttribute('aria-expanded', 'false');
                                            }
                                        }
                                    }
                                    
                                    // Alternative: Check next sibling
                                    const nextSibling = element.nextElementSibling;
                                    if (nextSibling && nextSibling.classList.contains('collapse')) {
                                        nextSibling.classList.toggle('show');
                                        nextSibling.classList.toggle('collapse');
                                    }
                                    
                                }, true);
                            }
                        """, element)
                        
                        # Click the element
                        print("\n👆 Clicking Dispenser toggle...")
                        await element.click()
                        toggle_found = True
                        break
                except Exception as e:
                    continue
            
            if not toggle_found:
                print("❌ Could not find Dispenser toggle")
                await wait_for_user()
            
            # Wait for content to appear
            print("\n⏳ Waiting for dispenser content...")
            await page.wait_for_timeout(2000)
        
        # Extract dispenser information
        print("\n📋 Extracting dispenser information...")
        
        # Get all containers again
        dispenser_containers = await page.locator('div.py-1\\.5').all()
        print(f"Total containers found: {len(dispenser_containers)}")
        
        dispensers_found = 0
        for i, container in enumerate(dispenser_containers):
            try:
                text = await container.text_content()
                if not text:
                    continue
                
                # Check if this container has dispenser info
                has_serial = 'S/N' in text or 'Serial' in text
                has_make = any(mfr in text for mfr in ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett', 'MAKE:', 'Make:'])
                has_model = 'MODEL:' in text or 'Model:' in text
                has_grade = 'GRADE' in text or 'Grade' in text
                
                if has_serial or has_make or has_model or has_grade:
                    dispensers_found += 1
                    print(f"\n✅ Dispenser {dispensers_found}:")
                    print(f"   Preview: {text[:200]}...")
                    
                    # Extract specific fields
                    import re
                    
                    # Serial number
                    sn_match = re.search(r'S/N:\s*([A-Z0-9-]+)', text)
                    if sn_match:
                        print(f"   S/N: {sn_match.group(1)}")
                    
                    # Make
                    make_match = re.search(r'(?:MAKE|Make):\s*([A-Za-z0-9\s]+?)(?=\n|MODEL|Model|$)', text)
                    if make_match:
                        print(f"   Make: {make_match.group(1).strip()}")
                    
                    # Model
                    model_match = re.search(r'(?:MODEL|Model):\s*([A-Za-z0-9\s]+?)(?=\n|GRADE|Grade|$)', text)
                    if model_match:
                        print(f"   Model: {model_match.group(1).strip()}")
                    
                    # Grades
                    grade_match = re.search(r'GRADE\s*([^\n]+?)(?=\s*STAND|$)', text)
                    if grade_match:
                        grades = grade_match.group(1).strip()
                        print(f"   Grades: {grades}")
            except Exception as e:
                print(f"Error processing container {i}: {e}")
                continue
        
        print(f"\n📊 Summary: Found {dispensers_found} dispensers")
        
        print("\n⏸️ Browser remains open. Press Enter to close...")
        await wait_for_user()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("✅ Done")


if __name__ == "__main__":
    asyncio.run(test_dispenser_click_fix())