#!/usr/bin/env python3
"""
Test script to verify the React refresh loop fix.
Monitors the application for continuous mount/unmount cycles.
"""

import asyncio
import sys
import time
from playwright.async_api import async_playwright
from datetime import datetime

async def test_refresh_loop():
    """Test that the application doesn't continuously refresh"""
    async with async_playwright() as p:
        print("\n🔍 Testing React Refresh Loop Fix...")
        
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Track console messages
        mount_count = 0
        unmount_count = 0
        refresh_count = 0
        api_calls = []
        
        def handle_console(msg):
            nonlocal mount_count, unmount_count
            text = msg.text
            
            if "App.mount" in text:
                mount_count += 1
                print(f"  ⚛️  App mounted (count: {mount_count})")
            elif "App.unmount" in text:
                unmount_count += 1
                print(f"  ⚛️  App unmounted (count: {unmount_count})")
            elif "Rate limit exceeded" in text:
                print(f"  ⚠️  Rate limit warning: {text}")
                
        page.on("console", handle_console)
        
        # Track network requests
        def handle_request(request):
            if "/api/setup/status" in request.url:
                api_calls.append(datetime.now())
                print(f"  📡 API call to /api/setup/status (total: {len(api_calls)})")
                
        page.on("request", handle_request)
        
        # Track page navigations
        def handle_navigation(frame):
            nonlocal refresh_count
            refresh_count += 1
            print(f"  🔄 Page navigation detected (count: {refresh_count})")
            
        page.on("framenavigated", handle_navigation)
        
        try:
            # Navigate to the app
            print("\n📍 Navigating to http://localhost:5173...")
            await page.goto("http://localhost:5173", wait_until="networkidle")
            
            print("\n⏱️  Monitoring for 10 seconds...")
            
            # Monitor for 10 seconds
            start_time = time.time()
            while time.time() - start_time < 10:
                await page.wait_for_timeout(1000)
                
                # Check if page is still responsive
                try:
                    await page.evaluate("() => document.title")
                except:
                    print("  ❌ Page became unresponsive!")
                    break
            
            # Analyze results
            print("\n📊 Test Results:")
            print(f"  - Mount count: {mount_count}")
            print(f"  - Unmount count: {unmount_count}")
            print(f"  - Page navigations: {refresh_count}")
            print(f"  - API calls to /api/setup/status: {len(api_calls)}")
            
            # Check for continuous refresh loop
            if mount_count > 3 or unmount_count > 2:
                print("\n❌ FAIL: Detected continuous mount/unmount cycle!")
                print("  The refresh loop issue is NOT fixed.")
                return False
            elif len(api_calls) > 5:
                print("\n❌ FAIL: Too many API calls detected!")
                print("  The application is making excessive requests.")
                return False
            elif refresh_count > 2:
                print("\n❌ FAIL: Multiple page refreshes detected!")
                print("  The application is reloading the page.")
                return False
            else:
                print("\n✅ PASS: No refresh loop detected!")
                print("  The application appears to be stable.")
                
                # Additional check - try logging in
                print("\n🔐 Testing login flow...")
                
                # Check if we're on the login page
                try:
                    await page.wait_for_selector('input[id="username"]', timeout=2000)
                    print("  ✓ Login page loaded correctly")
                    return True
                except:
                    # Check if we're already logged in
                    try:
                        await page.wait_for_selector('nav', timeout=2000)
                        print("  ✓ Already logged in - dashboard loaded")
                        return True
                    except:
                        print("  ⚠️  Unexpected page state")
                        return False
                        
        except Exception as e:
            print(f"\n❌ Error during test: {str(e)}")
            return False
        finally:
            await browser.close()

async def main():
    """Main test runner"""
    print("=" * 60)
    print("React Refresh Loop Fix Test")
    print("=" * 60)
    
    # Check if frontend is running
    print("\n⚠️  Make sure the frontend dev server is running on port 5173")
    print("  Run: npm run dev")
    input("\nPress Enter when ready to test...")
    
    # Run the test
    success = await test_refresh_loop()
    
    if success:
        print("\n🎉 All tests passed! The refresh loop has been fixed.")
    else:
        print("\n🔧 The refresh loop issue persists. Please check the fixes.")
        
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))