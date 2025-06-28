#!/usr/bin/env python3
"""
Find the work orders page in WorkFossa
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

async def find_work_orders():
    """Find work orders page by exploring the interface"""
    print("🔍 Finding WorkFossa Work Orders Page")
    print("=" * 50)
    
    credentials = {
        "username": "bruce.hunt@owlservices.com",
        "password": "Crompco0511"
    }
    
    playwright = None
    browser = None
    
    try:
        # Start Playwright
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
        
        # Navigate and login
        print("1. Logging into WorkFossa...")
        await page.goto("https://app.workfossa.com", wait_until="networkidle")
        await page.fill("input[type='email']", credentials["username"])
        await page.fill("input[type='password']", credentials["password"])
        await page.click("input[type='submit']")
        await page.wait_for_timeout(3000)
        print(f"   ✅ Logged in - URL: {page.url}")
        
        # Try clicking on Directory first
        print("\n2. Exploring Directory...")
        try:
            directory_link = await page.wait_for_selector("a:has-text('Directory')", timeout=2000)
            if directory_link:
                await directory_link.click()
                await page.wait_for_load_state("networkidle")
                print(f"   📍 In Directory - URL: {page.url}")
                
                # Look for work-related links in directory
                await page.wait_for_timeout(2000)
                work_links = await page.query_selector_all("a")
                print("   Looking for work-related links...")
                
                for link in work_links:
                    try:
                        text = await link.inner_text()
                        href = await link.get_attribute('href')
                        if text and any(word in text.lower() for word in ['work', 'job', 'visit', 'order', 'schedule']):
                            print(f"   Found: {text} -> {href}")
                    except:
                        continue
        except:
            print("   Could not access Directory")
        
        # Try direct URLs
        print("\n3. Trying direct URLs...")
        test_urls = [
            "/app/work-orders",
            "/app/workorders", 
            "/app/work/list",
            "/app/jobs",
            "/app/visits",
            "/app/schedule",
            "/app/calendar"
        ]
        
        for url_path in test_urls:
            try:
                full_url = f"https://app.workfossa.com{url_path}"
                print(f"   Trying: {full_url}")
                await page.goto(full_url, wait_until="networkidle", timeout=5000)
                
                # Check if we got redirected to login
                if "login" in page.url:
                    print(f"     ❌ Redirected to login")
                else:
                    print(f"     ✅ Accessible! Current URL: {page.url}")
                    
                    # Look for content that indicates work orders
                    content = await page.content()
                    if any(word in content.lower() for word in ['work order', 'job', 'visit', 'schedule']):
                        print(f"     🎯 Found work-related content!")
                        
                        # Take screenshot
                        filename = f"workfossa_{url_path.replace('/', '_')}.png"
                        await page.screenshot(path=filename)
                        print(f"     📸 Screenshot saved: {filename}")
            except Exception as e:
                print(f"     Error: {str(e)}")
        
        # Check page content for clues
        print("\n4. Analyzing current page content...")
        current_content = await page.content()
        
        # Look for JavaScript variables or data
        if "workOrder" in current_content or "work_order" in current_content:
            print("   ✅ Found work order references in page")
        
        if "visit" in current_content.lower():
            print("   ✅ Found visit references in page")
            
        # Look for API endpoints
        print("\n5. Looking for API endpoints in page...")
        if "/api/" in current_content:
            import re
            api_matches = re.findall(r'/api/[^"\']+', current_content)
            for api in set(api_matches[:10]):  # First 10 unique
                print(f"   API: {api}")
        
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
    success = await find_work_orders()
    
    if success:
        print("\n🎉 Exploration completed!")
    else:
        print("\n❌ Exploration failed!")

if __name__ == "__main__":
    asyncio.run(main())