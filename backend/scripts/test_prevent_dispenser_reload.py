#!/usr/bin/env python3
"""
Test preventing page reload when clicking dispenser toggle
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


async def test_prevent_reload():
    """Test preventing reload when clicking dispenser toggle"""
    print("🧪 Testing Dispenser Toggle Without Reload")
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
        session_id = "test_no_reload"
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
        
        # Inject reload prevention
        print("\n🛡️ Injecting reload prevention...")
        await page.evaluate("""
            () => {
                console.log('Installing reload prevention...');
                
                // Mark the page to detect reloads
                window.__noReloadMarker = 'active';
                
                // Intercept all clicks
                document.addEventListener('click', (e) => {
                    const target = e.target;
                    
                    // Check if it's the dispenser toggle
                    if (target && (
                        target.textContent?.includes('Dispenser') ||
                        target.closest('a')?.textContent?.includes('Dispenser') ||
                        target.closest('button')?.textContent?.includes('Dispenser')
                    )) {
                        console.log('Dispenser click intercepted!');
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        // Find the actual toggle element
                        const toggle = target.closest('a, button') || target;
                        
                        // Check if it's an anchor with href
                        if (toggle.tagName === 'A' && toggle.href) {
                            console.log('Preventing anchor navigation:', toggle.href);
                            
                            // If it's a hash link, handle the toggle manually
                            if (toggle.href.includes('#')) {
                                const targetId = toggle.href.split('#')[1];
                                const targetElement = document.getElementById(targetId);
                                
                                if (targetElement) {
                                    // Toggle visibility manually
                                    if (targetElement.style.display === 'none' || 
                                        targetElement.classList.contains('collapse')) {
                                        targetElement.style.display = 'block';
                                        targetElement.classList.remove('collapse');
                                        targetElement.classList.add('show');
                                        toggle.setAttribute('aria-expanded', 'true');
                                    } else {
                                        targetElement.style.display = 'none';
                                        targetElement.classList.add('collapse');
                                        targetElement.classList.remove('show');
                                        toggle.setAttribute('aria-expanded', 'false');
                                    }
                                }
                            }
                        }
                        
                        // Trigger any data-toggle behavior manually
                        const dataTarget = toggle.getAttribute('data-target');
                        if (dataTarget) {
                            const target = document.querySelector(dataTarget);
                            if (target) {
                                // Bootstrap-style toggle
                                if (target.classList.contains('show')) {
                                    target.classList.remove('show');
                                    target.classList.add('collapse');
                                } else {
                                    target.classList.add('show');
                                    target.classList.remove('collapse');
                                }
                            }
                        }
                        
                        return false;
                    }
                }, true);  // Use capture phase
                
                // Also prevent form submissions
                document.addEventListener('submit', (e) => {
                    console.log('Form submission prevented');
                    e.preventDefault();
                    return false;
                }, true);
                
                // Prevent navigation
                window.addEventListener('beforeunload', (e) => {
                    console.log('Navigation attempt detected!');
                });
            }
        """)
        
        # Find dispenser toggle
        print("\n🔍 Looking for Dispenser toggle...")
        await page.wait_for_timeout(1000)
        
        # Get initial state
        initial_containers = await page.locator('div.py-1\\.5').count()
        print(f"Initial containers: {initial_containers}")
        
        # Method 1: Try regular click with monitoring
        print("\n📍 Method 1: Regular click with reload detection...")
        
        # Click dispenser toggle
        try:
            await page.click('a:has-text("Dispenser")')
            print("✅ Clicked Dispenser toggle")
        except Exception as e:
            print(f"❌ Click failed: {e}")
        
        # Check if page reloaded
        await page.wait_for_timeout(1000)
        marker = await page.evaluate("() => window.__noReloadMarker")
        if marker == 'active':
            print("✅ No reload detected!")
        else:
            print("❌ Page reloaded!")
        
        # Check container count
        final_containers = await page.locator('div.py-1\\.5').count()
        print(f"Final containers: {final_containers}")
        
        if final_containers != initial_containers:
            print("✅ Container count changed - toggle worked!")
        
        # Method 2: JavaScript click
        print("\n📍 Method 2: Direct JavaScript manipulation...")
        result = await page.evaluate("""
            () => {
                // Find dispenser toggle element
                const links = Array.from(document.querySelectorAll('a'));
                const buttons = Array.from(document.querySelectorAll('button'));
                const allElements = [...links, ...buttons];
                
                const dispenserToggle = allElements.find(el => 
                    el.textContent && el.textContent.includes('Dispenser')
                );
                
                if (!dispenserToggle) return { error: 'Toggle not found' };
                
                console.log('Found toggle:', dispenserToggle);
                
                // Get the href or data-target
                const href = dispenserToggle.getAttribute('href');
                const dataTarget = dispenserToggle.getAttribute('data-target');
                const targetSelector = href || dataTarget;
                
                console.log('Target:', targetSelector);
                
                if (targetSelector && targetSelector.startsWith('#')) {
                    const targetElement = document.querySelector(targetSelector);
                    if (targetElement) {
                        // Force expand
                        targetElement.style.display = 'block';
                        targetElement.classList.remove('collapse');
                        targetElement.classList.add('show');
                        dispenserToggle.setAttribute('aria-expanded', 'true');
                        
                        return { 
                            success: true, 
                            targetFound: true,
                            targetId: targetSelector
                        };
                    }
                }
                
                // Alternative: Look for next sibling
                const nextElement = dispenserToggle.nextElementSibling || 
                                  dispenserToggle.parentElement?.nextElementSibling;
                if (nextElement) {
                    nextElement.style.display = 'block';
                    nextElement.classList.add('show');
                    return { success: true, usedSibling: true };
                }
                
                return { error: 'No target found' };
            }
        """)
        
        print(f"JavaScript result: {result}")
        
        # Check final state
        await page.wait_for_timeout(1000)
        final_count = await page.locator('div.py-1\\.5').count()
        print(f"\nFinal container count: {final_count}")
        
        # Extract one dispenser to verify
        if final_count > 0:
            first_text = await page.locator('div.py-1\\.5').first.text_content()
            print(f"First container preview: {first_text[:100] if first_text else 'Empty'}...")
        
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
    asyncio.run(test_prevent_reload())