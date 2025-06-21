#!/usr/bin/env python3
"""
Test various approaches to detect when dispenser content is fully loaded
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


async def test_loading_detection_methods():
    """Test different methods to detect when content is loaded"""
    print("🧪 Testing Loading Detection Methods")
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
        session_id = "test_loading"
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
        
        # Test different loading detection methods
        print("\n📊 Testing Loading Detection Methods:\n")
        
        # Method 1: Network Idle
        print("1️⃣ Network Idle Method:")
        start = time.time()
        await page.wait_for_load_state('networkidle')
        elapsed = time.time() - start
        print(f"   ⏱️  Time: {elapsed:.2f}s")
        print(f"   ℹ️  Good for: Initial page loads, API-heavy pages")
        print(f"   ⚠️  Issues: Can be slow, doesn't detect JavaScript rendering")
        
        # Method 2: DOM Content Loaded
        print("\n2️⃣ DOM Content Loaded:")
        start = time.time()
        await page.wait_for_load_state('domcontentloaded')
        elapsed = time.time() - start
        print(f"   ⏱️  Time: {elapsed:.2f}s")
        print(f"   ℹ️  Good for: Basic HTML structure")
        print(f"   ⚠️  Issues: Too early for dynamic content")
        
        # Click Equipment tab
        print("\n🔧 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        
        # Method 3: Wait for Specific Element
        print("\n3️⃣ Wait for Specific Element:")
        start = time.time()
        try:
            await page.wait_for_selector('a:has-text("Dispenser")', timeout=5000)
            elapsed = time.time() - start
            print(f"   ⏱️  Time: {elapsed:.2f}s")
            print(f"   ✅ Found Dispenser toggle")
            print(f"   ℹ️  Good for: Known UI elements")
            print(f"   ⚠️  Issues: Element might exist but not be ready")
        except:
            print("   ❌ Timeout waiting for element")
        
        # Close modal if present
        try:
            cancel = await page.query_selector('button:has-text("Cancel")')
            if cancel:
                await cancel.click()
                await page.wait_for_timeout(500)
        except:
            pass
        
        # Method 4: Custom JavaScript Readiness Check
        print("\n4️⃣ Custom JavaScript Readiness Check:")
        start = time.time()
        
        await page.evaluate("""
            () => {
                window.__readinessCheck = {
                    mutationCount: 0,
                    lastMutation: Date.now(),
                    startTime: Date.now()
                };
                
                const observer = new MutationObserver(() => {
                    window.__readinessCheck.mutationCount++;
                    window.__readinessCheck.lastMutation = Date.now();
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });
            }
        """)
        
        # Wait for mutations to settle
        await page.wait_for_function("""
            () => {
                const check = window.__readinessCheck;
                if (!check) return true;
                
                // Consider stable if no mutations for 500ms
                const timeSinceLastMutation = Date.now() - check.lastMutation;
                const totalTime = Date.now() - check.startTime;
                
                // Stable if no mutations for 500ms OR timeout after 3s
                return timeSinceLastMutation > 500 || totalTime > 3000;
            }
        """)
        
        elapsed = time.time() - start
        mutations = await page.evaluate("() => window.__readinessCheck.mutationCount")
        print(f"   ⏱️  Time: {elapsed:.2f}s")
        print(f"   📊 Mutations observed: {mutations}")
        print(f"   ℹ️  Good for: Dynamic content, JavaScript-heavy pages")
        print(f"   ✅ Most reliable for modern SPAs")
        
        # Method 5: Wait for Container Count Change (for Dispenser toggle)
        print("\n5️⃣ Container Count Change Method:")
        print("   Getting initial container count...")
        initial_count = await page.locator('div.py-1\\.5').count()
        print(f"   Initial count: {initial_count}")
        
        # Click Dispenser toggle
        print("   Clicking Dispenser toggle...")
        await page.click('a:has-text("Dispenser")')
        
        start = time.time()
        try:
            # Wait for container count to increase
            await page.wait_for_function(f"""
                () => {{
                    const containers = document.querySelectorAll('div.py-1\\\\.5');
                    return containers.length > {initial_count};
                }}
            """, timeout=5000)
            
            elapsed = time.time() - start
            final_count = await page.locator('div.py-1\\.5').count()
            print(f"   ⏱️  Time: {elapsed:.2f}s")
            print(f"   📊 Final count: {final_count} (+{final_count - initial_count})")
            print(f"   ✅ Best for: Expandable sections like dispensers")
        except:
            print("   ❌ Timeout waiting for containers")
        
        # Method 6: Combined Smart Wait
        print("\n6️⃣ Combined Smart Wait (Recommended):")
        print("   This combines multiple signals:")
        
        await page.evaluate("""
            () => {
                window.__smartWait = {
                    networkRequests: 0,
                    domStable: false,
                    specificElementFound: false,
                    startTime: Date.now()
                };
                
                // Monitor network
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name.includes('api') || entry.name.includes('ajax')) {
                            window.__smartWait.networkRequests++;
                        }
                    }
                });
                observer.observe({ entryTypes: ['resource'] });
                
                // Monitor DOM stability
                let stabilityTimer;
                const mutationObserver = new MutationObserver(() => {
                    clearTimeout(stabilityTimer);
                    window.__smartWait.domStable = false;
                    
                    stabilityTimer = setTimeout(() => {
                        window.__smartWait.domStable = true;
                    }, 300);
                });
                mutationObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                // Check for specific content
                setInterval(() => {
                    const hasDispenserInfo = document.body.textContent.includes('S/N:') ||
                                           document.body.textContent.includes('Gilbarco');
                    window.__smartWait.specificElementFound = hasDispenserInfo;
                }, 100);
            }
        """)
        
        start = time.time()
        await page.wait_for_function("""
            () => {
                const wait = window.__smartWait;
                if (!wait) return true;
                
                const elapsed = Date.now() - wait.startTime;
                
                // Ready when:
                // 1. DOM is stable AND
                // 2. Specific content found OR timeout
                return wait.domStable && (wait.specificElementFound || elapsed > 5000);
            }
        """, timeout=10000)
        
        elapsed = time.time() - start
        status = await page.evaluate("() => window.__smartWait")
        print(f"   ⏱️  Time: {elapsed:.2f}s")
        print(f"   📊 Status: {status}")
        print(f"   ✅ Most comprehensive approach")
        
        # Summary of best practices
        print("\n📋 BEST PRACTICES SUMMARY:")
        print("=" * 50)
        print("1. For initial page load: Network idle + specific element")
        print("2. For expandable content: Container count change")
        print("3. For dynamic content: DOM stability monitoring")
        print("4. For maximum reliability: Combined approach")
        print("\n🎯 RECOMMENDED APPROACH FOR DISPENSERS:")
        print("   1. Wait for Equipment tab to be clickable")
        print("   2. Click and wait for DOM stability (300ms no changes)")
        print("   3. Click Dispenser toggle")
        print("   4. Wait for container count to increase")
        print("   5. Wait for DOM stability again")
        print("   6. Extract dispenser data")
        
        # Demonstrate the recommended approach
        print("\n🚀 DEMONSTRATING RECOMMENDED APPROACH:")
        
        # Navigate fresh
        await page.goto(customer_url, wait_until="domcontentloaded")
        
        # Step 1: Smart wait for page ready
        print("1. Waiting for page ready...")
        await page.wait_for_load_state('networkidle')
        await page.wait_for_selector('text="Equipment"', state='visible')
        
        # Step 2: Click Equipment with stability check
        print("2. Clicking Equipment tab...")
        await page.click('text="Equipment"')
        
        # Inject stability monitor
        await page.evaluate("""
            () => {
                window.__isStable = false;
                let timer;
                const observer = new MutationObserver(() => {
                    window.__isStable = false;
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        window.__isStable = true;
                    }, 300);
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
        """)
        
        await page.wait_for_function("() => window.__isStable", timeout=5000)
        print("   ✅ Equipment tab stable")
        
        # Close modal
        try:
            cancel = await page.query_selector('button:has-text("Cancel")')
            if cancel:
                await cancel.click()
                await page.wait_for_timeout(300)
        except:
            pass
        
        # Step 3: Click Dispenser with count monitoring
        print("3. Expanding Dispenser section...")
        initial = await page.locator('div.py-1\\.5').count()
        print(f"   Initial containers: {initial}")
        
        await page.click('a:has-text("Dispenser")')
        
        # Wait for expansion
        await page.wait_for_function(f"""
            () => document.querySelectorAll('div.py-1\\\\.5').length > {initial}
        """, timeout=5000)
        
        final = await page.locator('div.py-1\\.5').count()
        print(f"   Final containers: {final}")
        print(f"   ✅ Dispenser section expanded successfully!")
        
        print("\n✅ Test complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("✅ Done")


if __name__ == "__main__":
    asyncio.run(test_loading_detection_methods())