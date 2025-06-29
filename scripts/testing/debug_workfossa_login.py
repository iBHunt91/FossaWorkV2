#!/usr/bin/env python3
"""
Debug WorkFossa login to understand why verification is failing
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime

# Add backend to path
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.services.workfossa_automation import WorkFossaAutomationService

async def debug_login_process():
    """Debug the login process with detailed logging"""
    
    print("=== WorkFossa Login Debugging ===\n")
    
    # Test credentials (will be removed after debugging)
    test_username = "bruce.hunt@owlservices.com"
    test_password = "Crompco0511"
    
    # Create service with visible browser
    service = WorkFossaAutomationService(headless=False)
    
    print(f"Testing with username: {test_username}")
    print(f"Login URL: {service.LOGIN_URL}")
    print(f"Success indicators: {service.SUCCESS_INDICATORS}")
    print("\nStarting verification process...\n")
    
    # Custom status callback to see progress
    def status_callback(status, message, progress):
        print(f"[{progress}%] {status}: {message}")
    
    try:
        # Run verification with status callbacks
        result = await service.verify_credentials(
            session_id=f"debug_{datetime.now().timestamp()}",
            username=test_username,
            password=test_password,
            status_callback=status_callback
        )
        
        print(f"\nResult: {result}")
        print(f"Success: {result.get('success')}")
        print(f"Message: {result.get('message')}")
        
        # Let's also try a manual browser check
        print("\n--- Manual Browser Check ---")
        from playwright.async_api import async_playwright
        
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        print("1. Navigating to WorkFossa...")
        await page.goto("https://app.workfossa.com")
        print(f"   Current URL: {page.url}")
        
        # Take a screenshot of the login page
        await page.screenshot(path="/tmp/workfossa_login_page.png")
        print("   Screenshot saved: /tmp/workfossa_login_page.png")
        
        # Check what elements are on the page
        print("\n2. Checking for login form elements...")
        
        # Try different selectors
        selectors_to_check = [
            'input[type="email"]',
            'input[type="email"][name="email"]',
            'input[name="email"]',
            'input#email',
            'input[type="text"][name="email"]',
            'input[type="text"][name="username"]',
            'input[placeholder*="email" i]',
            'input[type="password"]',
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Sign in")',
            'button:has-text("Log in")',
            'button:has-text("Login")'
        ]
        
        for selector in selectors_to_check:
            try:
                element = await page.query_selector(selector)
                if element:
                    print(f"   ✓ Found: {selector}")
                    # Get more info about the element
                    attrs = await element.evaluate('''(el) => {
                        return {
                            tag: el.tagName,
                            type: el.type,
                            name: el.name,
                            id: el.id,
                            placeholder: el.placeholder,
                            text: el.textContent
                        }
                    }''')
                    print(f"     Details: {attrs}")
                else:
                    print(f"   ✗ Not found: {selector}")
            except Exception as e:
                print(f"   ✗ Error checking {selector}: {e}")
        
        print("\n3. Filling login form...")
        # Try to fill the form with what we found
        email_filled = False
        password_filled = False
        
        # Try email field
        for email_selector in ['input[type="email"]', 'input[name="email"]', 'input#email', 'input[type="text"][name="username"]']:
            try:
                await page.fill(email_selector, test_username)
                print(f"   ✓ Filled email using: {email_selector}")
                email_filled = True
                break
            except:
                continue
        
        if not email_filled:
            print("   ✗ Could not fill email field")
        
        # Try password field
        for password_selector in ['input[type="password"]', 'input[name="password"]', 'input#password']:
            try:
                await page.fill(password_selector, test_password)
                print(f"   ✓ Filled password using: {password_selector}")
                password_filled = True
                break
            except:
                continue
                
        if not password_filled:
            print("   ✗ Could not fill password field")
        
        if email_filled and password_filled:
            print("\n4. Submitting form...")
            
            # Try to click submit
            submit_clicked = False
            for submit_selector in ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Log in")']:
                try:
                    await page.click(submit_selector)
                    print(f"   ✓ Clicked submit using: {submit_selector}")
                    submit_clicked = True
                    break
                except:
                    continue
            
            if submit_clicked:
                print("\n5. Waiting for navigation...")
                await page.wait_for_load_state('networkidle', timeout=10000)
                
                print(f"   Current URL after login: {page.url}")
                await page.screenshot(path="/tmp/workfossa_after_login.png")
                print("   Screenshot saved: /tmp/workfossa_after_login.png")
                
                # Check for success indicators
                print("\n6. Checking for success indicators...")
                for indicator in service.SUCCESS_INDICATORS:
                    if indicator.startswith('**'):
                        url_part = indicator[2:]
                        if url_part in page.url:
                            print(f"   ✓ URL contains: {url_part}")
                        else:
                            print(f"   ✗ URL missing: {url_part}")
                    else:
                        element = await page.query_selector(indicator)
                        if element:
                            print(f"   ✓ Found element: {indicator}")
                        else:
                            print(f"   ✗ Missing element: {indicator}")
                
                # Also check page content
                print("\n7. Page content preview:")
                page_text = await page.inner_text('body')
                preview = page_text[:500].replace('\n', ' ')
                print(f"   {preview}...")
        
        print("\n8. Cleaning up...")
        await browser.close()
        await playwright.stop()
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure we're not in dev mode
    os.environ["WORKFOSSA_DEV_MODE"] = "false"
    os.environ["BROWSER_VISIBLE"] = "true"
    
    print("This will launch a visible browser for debugging")
    print("Watch the browser to see what happens during login\n")
    
    asyncio.run(debug_login_process())