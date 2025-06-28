#!/usr/bin/env python3
"""
Analyze page ready signals to create intelligent wait conditions
"""

import asyncio
import sys
import os
from pathlib import Path
import time
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager import credential_manager


async def inject_page_monitoring(page):
    """Inject JavaScript to monitor page readiness signals"""
    await page.evaluate("""
        () => {
            window.__pageReadySignals = {
                domReady: false,
                imagesLoaded: false,
                ajaxComplete: true,  // Start as true, set false when AJAX starts
                animationsComplete: true,
                customDataLoaded: false,
                vueReady: false,
                reactReady: false,
                angularReady: false,
                readyTime: null,
                events: []
            };
            
            // Monitor DOM ready
            if (document.readyState === 'complete') {
                window.__pageReadySignals.domReady = true;
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    window.__pageReadySignals.domReady = true;
                    window.__pageReadySignals.events.push({time: Date.now(), event: 'DOMContentLoaded'});
                });
            }
            
            // Monitor images
            const checkImages = () => {
                const images = document.querySelectorAll('img');
                const allLoaded = Array.from(images).every(img => img.complete);
                window.__pageReadySignals.imagesLoaded = allLoaded;
                if (allLoaded) {
                    window.__pageReadySignals.events.push({time: Date.now(), event: 'AllImagesLoaded'});
                }
            };
            window.addEventListener('load', checkImages);
            
            // Monitor AJAX requests
            const originalXHR = window.XMLHttpRequest;
            let activeRequests = 0;
            
            window.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                const originalOpen = xhr.open;
                const originalSend = xhr.send;
                
                xhr.open = function() {
                    originalOpen.apply(this, arguments);
                };
                
                xhr.send = function() {
                    activeRequests++;
                    window.__pageReadySignals.ajaxComplete = false;
                    window.__pageReadySignals.events.push({time: Date.now(), event: 'AJAX_start', count: activeRequests});
                    
                    xhr.addEventListener('loadend', () => {
                        activeRequests--;
                        if (activeRequests === 0) {
                            window.__pageReadySignals.ajaxComplete = true;
                            window.__pageReadySignals.events.push({time: Date.now(), event: 'AJAX_complete'});
                        }
                    });
                    
                    originalSend.apply(this, arguments);
                };
                
                return xhr;
            };
            
            // Monitor fetch requests
            const originalFetch = window.fetch;
            window.fetch = function() {
                activeRequests++;
                window.__pageReadySignals.ajaxComplete = false;
                window.__pageReadySignals.events.push({time: Date.now(), event: 'Fetch_start', count: activeRequests});
                
                return originalFetch.apply(this, arguments).finally(() => {
                    activeRequests--;
                    if (activeRequests === 0) {
                        window.__pageReadySignals.ajaxComplete = true;
                        window.__pageReadySignals.events.push({time: Date.now(), event: 'Fetch_complete'});
                    }
                });
            };
            
            // Monitor animations
            const checkAnimations = () => {
                const animations = document.getAnimations ? document.getAnimations() : [];
                const allFinished = animations.every(anim => anim.playState === 'finished');
                window.__pageReadySignals.animationsComplete = allFinished;
            };
            
            // Check for framework-specific ready states
            const checkFrameworks = () => {
                // Vue.js
                if (window.Vue || window.app || document.querySelector('[data-v-]')) {
                    window.__pageReadySignals.vueReady = true;
                }
                
                // React
                if (window.React || window.ReactDOM || document.querySelector('[data-reactroot]')) {
                    window.__pageReadySignals.reactReady = true;
                }
                
                // Angular
                if (window.angular || document.querySelector('[ng-app]')) {
                    window.__pageReadySignals.angularReady = true;
                }
            };
            
            // Monitor mutations for dynamic content
            let mutationTimeout;
            const observer = new MutationObserver((mutations) => {
                clearTimeout(mutationTimeout);
                window.__pageReadySignals.customDataLoaded = false;
                
                mutationTimeout = setTimeout(() => {
                    window.__pageReadySignals.customDataLoaded = true;
                    window.__pageReadySignals.events.push({time: Date.now(), event: 'MutationsSettled'});
                    checkAnimations();
                    checkFrameworks();
                }, 300);  // Consider stable after 300ms of no mutations
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });
            
            // Initial checks
            checkImages();
            checkAnimations();
            checkFrameworks();
            
            console.log('Page monitoring injected');
        }
    """)


async def wait_for_page_ready(page, timeout=10000):
    """Smart wait that checks multiple signals"""
    start_time = time.time()
    
    await inject_page_monitoring(page)
    
    # Wait for all signals to be ready
    ready = await page.wait_for_function("""
        () => {
            const signals = window.__pageReadySignals;
            
            // Check all signals
            const isReady = signals.domReady && 
                           signals.ajaxComplete && 
                           signals.animationsComplete &&
                           signals.customDataLoaded;
            
            if (isReady && !signals.readyTime) {
                signals.readyTime = Date.now();
                signals.events.push({time: Date.now(), event: 'PAGE_READY'});
            }
            
            return isReady;
        }
    """, timeout=timeout)
    
    elapsed = time.time() - start_time
    
    # Get the signals for analysis
    signals = await page.evaluate("() => window.__pageReadySignals")
    
    return elapsed, signals


async def analyze_ready_patterns():
    """Analyze page ready patterns"""
    print("🔍 Analyzing Page Ready Patterns")
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
        session_id = "analyze_ready"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Test different scenarios
        print("\n📊 Testing Page Ready Detection...")
        
        # Scenario 1: Navigate to customer page
        print("\n1️⃣ Customer Page Navigation:")
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        
        nav_start = time.time()
        await page.goto(customer_url, wait_until="domcontentloaded")
        dom_time = time.time() - nav_start
        print(f"   DOM ready in: {dom_time:.2f}s")
        
        # Smart wait
        elapsed, signals = await wait_for_page_ready(page)
        print(f"   Page fully ready in: {elapsed:.2f}s")
        print(f"   Ready signals: {json.dumps(signals, indent=2)}")
        
        # Traditional wait comparison
        trad_start = time.time()
        await page.wait_for_load_state('networkidle')
        await page.wait_for_timeout(2000)
        trad_time = time.time() - trad_start
        print(f"   Traditional wait took: {trad_time:.2f}s")
        print(f"   ⚡ Smart wait saved: {trad_time - elapsed:.2f}s")
        
        # Scenario 2: Click Equipment tab
        print("\n2️⃣ Equipment Tab Click:")
        click_start = time.time()
        await page.click('text="Equipment"')
        
        # Smart wait for tab content
        elapsed, signals = await wait_for_page_ready(page)
        print(f"   Tab content ready in: {elapsed:.2f}s")
        
        # Close modal if present
        try:
            cancel = await page.query_selector('button:has-text("Cancel")')
            if cancel:
                await cancel.click()
                await asyncio.sleep(0.5)
        except:
            pass
        
        # Scenario 3: Click Dispenser toggle
        print("\n3️⃣ Dispenser Toggle Click:")
        
        # Find initial container count
        initial_count = await page.locator('div.py-1\\.5').count()
        print(f"   Initial containers: {initial_count}")
        
        toggle_start = time.time()
        await page.click('a:has-text("Dispenser")')
        
        # Wait for containers to appear
        await page.wait_for_function(f"""
            () => {{
                const containers = document.querySelectorAll('div.py-1\\\\.5');
                return containers.length > {initial_count};
            }}
        """, timeout=5000)
        
        container_time = time.time() - toggle_start
        final_count = await page.locator('div.py-1\\.5').count()
        print(f"   Containers appeared in: {container_time:.2f}s")
        print(f"   Final containers: {final_count}")
        
        # Get final ready signals
        elapsed, signals = await wait_for_page_ready(page)
        print(f"   Content fully ready in: {elapsed:.2f}s")
        
        print("\n📈 Summary:")
        print("   - DOM ready is fast but not sufficient")
        print("   - Network idle waits too long")
        print("   - Smart waits can detect actual readiness")
        print("   - Container count change is good indicator for dispenser expansion")
        
        # Additional analysis - check for specific patterns
        print("\n🔍 Analyzing page patterns...")
        patterns = await page.evaluate("""
            () => {
                const analysis = {
                    hasJQuery: typeof jQuery !== 'undefined',
                    hasLoadingIndicators: document.querySelectorAll('.loading, .spinner, [class*="load"]').length > 0,
                    hasTransitions: false,
                    dataAttributes: []
                };
                
                // Check for CSS transitions
                const styles = window.getComputedStyle(document.body);
                if (styles.transition !== 'none' && styles.transition !== '') {
                    analysis.hasTransitions = true;
                }
                
                // Find useful data attributes
                const elements = document.querySelectorAll('[data-loaded], [data-ready], [data-initialized]');
                elements.forEach(el => {
                    Object.keys(el.dataset).forEach(key => {
                        analysis.dataAttributes.push(`data-${key}="${el.dataset[key]}"`);
                    });
                });
                
                return analysis;
            }
        """)
        print(f"   Page patterns: {json.dumps(patterns, indent=2)}")
        
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
    asyncio.run(analyze_ready_patterns())