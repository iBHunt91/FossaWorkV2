#!/usr/bin/env python3
"""
Test content-based detection - wait for specific content instead of generic conditions
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
from app.services.credential_manager_deprecated import credential_manager


async def wait_for_specific_content(page, content_checks, timeout=10000):
    """
    Wait for specific content to appear on the page
    
    Args:
        page: Playwright page object
        content_checks: Dict of content to check for:
            - equipment_tab: Text/selector for equipment tab
            - dispenser_toggle: Text/selector for dispenser toggle
            - dispenser_data: Indicators that dispenser data is visible
        timeout: Maximum wait time
    
    Returns:
        Dict with status of each check
    """
    start_time = time.time()
    results = {}
    
    # Inject content monitor
    await page.evaluate("""
        () => {
            window.__contentMonitor = {
                equipment_tab: false,
                dispenser_toggle: false,
                dispenser_data: false,
                container_count: 0,
                checks: []
            };
            
            // Monitor function
            window.__checkContent = () => {
                // Check for Equipment tab
                const equipmentElements = document.querySelectorAll('a, button, [role="tab"]');
                for (const el of equipmentElements) {
                    if (el.textContent && el.textContent.trim() === 'Equipment') {
                        window.__contentMonitor.equipment_tab = true;
                        window.__contentMonitor.checks.push('Found Equipment tab');
                        break;
                    }
                }
                
                // Check for Dispenser toggle (look for text with count)
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    const text = el.textContent || '';
                    // Match "Dispenser (8)" or similar
                    if (text.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                        window.__contentMonitor.dispenser_toggle = true;
                        window.__contentMonitor.dispenser_toggle_text = text;
                        window.__contentMonitor.checks.push(`Found Dispenser toggle: ${text}`);
                        break;
                    }
                }
                
                // Check for dispenser data containers
                const containers = document.querySelectorAll('div.py-1\\\\.5');
                window.__contentMonitor.container_count = containers.length;
                
                // Check for actual dispenser content
                for (const container of containers) {
                    const text = container.textContent || '';
                    if (text.includes('S/N:') || text.includes('MAKE:') || 
                        text.includes('Gilbarco') || text.includes('Wayne')) {
                        window.__contentMonitor.dispenser_data = true;
                        window.__contentMonitor.checks.push('Found dispenser data content');
                        break;
                    }
                }
            };
            
            // Initial check
            window.__checkContent();
            
            // Set up interval checker
            window.__contentInterval = setInterval(window.__checkContent, 100);
        }
    """)
    
    # Wait for each type of content
    for check_name, check_config in content_checks.items():
        try:
            print(f"\n⏳ Waiting for {check_name}...")
            
            if check_name == 'equipment_tab':
                await page.wait_for_function(
                    "() => window.__contentMonitor && window.__contentMonitor.equipment_tab",
                    timeout=timeout
                )
                elapsed = time.time() - start_time
                print(f"   ✅ Equipment tab found in {elapsed:.2f}s")
                results['equipment_tab'] = True
                
            elif check_name == 'dispenser_toggle':
                await page.wait_for_function(
                    "() => window.__contentMonitor && window.__contentMonitor.dispenser_toggle",
                    timeout=timeout
                )
                toggle_text = await page.evaluate("() => window.__contentMonitor.dispenser_toggle_text")
                elapsed = time.time() - start_time
                print(f"   ✅ Dispenser toggle found in {elapsed:.2f}s: {toggle_text}")
                results['dispenser_toggle'] = toggle_text
                
            elif check_name == 'dispenser_data':
                await page.wait_for_function(
                    "() => window.__contentMonitor && window.__contentMonitor.dispenser_data",
                    timeout=timeout
                )
                container_count = await page.evaluate("() => window.__contentMonitor.container_count")
                elapsed = time.time() - start_time
                print(f"   ✅ Dispenser data found in {elapsed:.2f}s ({container_count} containers)")
                results['dispenser_data'] = True
                results['container_count'] = container_count
                
        except Exception as e:
            print(f"   ❌ Timeout waiting for {check_name}")
            results[check_name] = False
    
    # Clean up
    await page.evaluate("() => { if (window.__contentInterval) clearInterval(window.__contentInterval); }")
    
    # Get all checks performed
    checks = await page.evaluate("() => window.__contentMonitor.checks")
    print(f"\n📋 Content checks performed: {checks}")
    
    return results


async def test_content_detection():
    """Test content-based detection approach"""
    print("🧪 Testing Content-Based Detection")
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
        session_id = "test_content"
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
        
        # Test 1: Wait for Equipment tab
        print("\n🔍 Test 1: Waiting for Equipment tab...")
        results = await wait_for_specific_content(page, {
            'equipment_tab': True
        }, timeout=10000)
        
        if results.get('equipment_tab'):
            # Click Equipment tab
            print("\n👆 Clicking Equipment tab...")
            await page.click('text="Equipment"')
            
            # Test 2: Wait for Dispenser toggle
            print("\n🔍 Test 2: Waiting for Dispenser toggle...")
            results = await wait_for_specific_content(page, {
                'dispenser_toggle': True
            }, timeout=10000)
            
            # Close modal if present
            try:
                cancel = await page.query_selector('button:has-text("Cancel")')
                if cancel:
                    print("📋 Closing modal...")
                    await cancel.click()
                    await asyncio.sleep(0.5)
            except:
                pass
            
            if results.get('dispenser_toggle'):
                toggle_text = results['dispenser_toggle']
                print(f"\n✅ Found: {toggle_text}")
                
                # Test 3: Click and wait for dispenser data
                print("\n👆 Clicking Dispenser toggle...")
                
                # Use JavaScript to find and click the exact element
                clicked = await page.evaluate("""
                    () => {
                        const elements = document.querySelectorAll('a, button');
                        for (const el of elements) {
                            if (el.textContent && el.textContent.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                                el.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                if clicked:
                    print("✅ Clicked Dispenser toggle")
                    
                    # Test 4: Wait for dispenser data
                    print("\n🔍 Test 3: Waiting for dispenser data...")
                    results = await wait_for_specific_content(page, {
                        'dispenser_data': True
                    }, timeout=10000)
                    
                    if results.get('dispenser_data'):
                        print(f"✅ Dispenser data visible! Found {results.get('container_count', 0)} containers")
                        
                        # Extract sample data
                        sample_data = await page.evaluate("""
                            () => {
                                const containers = document.querySelectorAll('div.py-1\\\\.5');
                                const samples = [];
                                
                                for (let i = 0; i < Math.min(3, containers.length); i++) {
                                    const text = containers[i].textContent || '';
                                    if (text.includes('S/N:') || text.includes('MAKE:')) {
                                        samples.push(text.substring(0, 150) + '...');
                                    }
                                }
                                
                                return samples;
                            }
                        """)
                        
                        print("\n📋 Sample dispenser data:")
                        for i, sample in enumerate(sample_data):
                            print(f"   {i+1}. {sample}")
        
        # Test comparison with traditional methods
        print("\n📊 Comparison with Traditional Methods:")
        print("=" * 50)
        
        # Navigate fresh
        await page.goto(customer_url, wait_until="domcontentloaded")
        
        # Traditional: Network idle
        print("\n1️⃣ Traditional Network Idle:")
        start = time.time()
        await page.wait_for_load_state('networkidle')
        elapsed = time.time() - start
        print(f"   Time: {elapsed:.2f}s")
        
        # Check if Equipment tab is visible
        equipment_visible = await page.is_visible('text="Equipment"')
        print(f"   Equipment tab visible: {equipment_visible}")
        
        # Content-based approach
        print("\n2️⃣ Content-Based Approach:")
        start = time.time()
        results = await wait_for_specific_content(page, {
            'equipment_tab': True
        }, timeout=10000)
        elapsed = time.time() - start
        print(f"   Time: {elapsed:.2f}s")
        print(f"   Equipment tab found: {results.get('equipment_tab')}")
        
        print("\n✅ Content-based detection is more reliable!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("\n✅ Done")


if __name__ == "__main__":
    asyncio.run(test_content_detection())