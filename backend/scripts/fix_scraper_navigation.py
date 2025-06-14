#!/usr/bin/env python3
"""
Fix the WorkFossa scraper navigation issues
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from playwright.async_api import async_playwright
import logging

# Enable logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_navigation():
    """Test different navigation approaches"""
    print("🔍 Testing WorkFossa Navigation Approaches")
    print("=" * 50)
    
    credentials = {
        "username": "bruce.hunt@owlservices.com",
        "password": "Crompco0511"
    }
    
    playwright = None
    browser = None
    
    try:
        # Start Playwright
        print("1. Starting Playwright...")
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,  # Show browser for debugging
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            ignore_https_errors=True
        )
        
        page = await context.new_page()
        
        # Method 1: Direct to base URL (like the working test)
        print("\n2. Method 1: Navigate to base URL...")
        await page.goto("https://app.workfossa.com", wait_until="networkidle")
        print(f"   Current URL: {page.url}")
        
        # Wait for redirect or login form
        await page.wait_for_timeout(2000)
        
        # Check if we're on login page
        if "login" in page.url or await page.query_selector("input[type='email']"):
            print("   ✅ On login page")
            
            # Login
            print("\n3. Logging in...")
            await page.fill("input[type='email']", credentials["username"])
            await page.fill("input[type='password']", credentials["password"])
            await page.click("input[type='submit']")
            
            # Wait for navigation
            try:
                await page.wait_for_navigation(timeout=10000)
            except:
                await page.wait_for_timeout(3000)
            
            print(f"   ✅ Logged in - URL: {page.url}")
        
        # Now look for navigation menu
        print("\n4. Looking for navigation menu...")
        nav_selectors = [
            "nav",
            ".nav-menu",
            ".sidebar-nav",
            ".main-navigation",
            "[role='navigation']"
        ]
        
        nav_found = False
        for selector in nav_selectors:
            nav = await page.query_selector(selector)
            if nav:
                print(f"   ✅ Found navigation with selector: {selector}")
                nav_found = True
                break
        
        if nav_found:
            # Look for work orders link
            print("\n5. Looking for work orders link...")
            link_selectors = [
                "a:has-text('Work Orders')",
                "a:has-text('Jobs')",
                "a:has-text('Visits')",
                "a[href*='work-order']",
                "a[href*='jobs']",
                "a[href*='visits']"
            ]
            
            for selector in link_selectors:
                try:
                    link = await page.wait_for_selector(selector, timeout=2000)
                    if link:
                        href = await link.get_attribute('href')
                        text = await link.inner_text()
                        print(f"   ✅ Found link: {text} -> {href}")
                        
                        # Click the link
                        await link.click()
                        await page.wait_for_load_state("networkidle")
                        
                        print(f"   📍 Navigated to: {page.url}")
                        break
                except:
                    continue
        
        # Take screenshot of current page
        await page.screenshot(path="workfossa_navigation_test.png")
        print("\n📸 Screenshot saved: workfossa_navigation_test.png")
        
        # List all links on the page for debugging
        print("\n6. All links on current page:")
        all_links = await page.query_selector_all("a")
        for i, link in enumerate(all_links[:10]):  # First 10 links
            try:
                href = await link.get_attribute('href')
                text = await link.inner_text()
                if text.strip():
                    print(f"   [{i}] {text.strip()} -> {href}")
            except:
                continue
        
        # Close browser
        await browser.close()
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {str(e)}", exc_info=True)
        print(f"\n❌ Test failed: {str(e)}")
        
        if browser:
            await browser.close()
        
        return False
    finally:
        if playwright:
            await playwright.stop()

async def main():
    success = await test_navigation()
    
    if success:
        print("\n🎉 Navigation test completed!")
    else:
        print("\n❌ Navigation test failed!")

if __name__ == "__main__":
    asyncio.run(main())