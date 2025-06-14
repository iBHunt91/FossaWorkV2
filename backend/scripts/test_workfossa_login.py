#!/usr/bin/env python3
"""
Test WorkFossa login independently
This script tests if we can successfully log into WorkFossa with given credentials
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from playwright.async_api import async_playwright

async def test_workfossa_login(username: str, password: str, headless: bool = False):
    """Test logging into WorkFossa website"""
    print(f"🔍 Testing WorkFossa login for: {username}")
    print(f"🌐 Headless mode: {headless}")
    print("-" * 50)
    
    browser = None
    try:
        # Start Playwright
        playwright = await async_playwright().start()
        
        # Launch browser (visible so you can see what's happening)
        print("🚀 Launching browser...")
        browser = await playwright.chromium.launch(
            headless=headless,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        # Create context
        context = await browser.new_context(
            viewport={'width': 1366, 'height': 768},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        # Create page
        page = await context.new_page()
        
        # Navigate to WorkFossa
        print("📍 Navigating to https://app.workfossa.com...")
        await page.goto("https://app.workfossa.com", wait_until="networkidle")
        
        # Take screenshot of login page
        await page.screenshot(path="workfossa_login_page.png")
        print("📸 Screenshot saved: workfossa_login_page.png")
        
        # Check current URL
        print(f"📍 Current URL: {page.url}")
        
        # Look for login form
        print("🔍 Looking for login form...")
        
        # Try different selectors for email field
        email_selectors = [
            'input[type="email"]',
            'input[name="email"]',
            'input[placeholder*="email" i]',
            '#email',
            'input[type="text"][name="email"]'
        ]
        
        email_field = None
        for selector in email_selectors:
            try:
                email_field = await page.wait_for_selector(selector, timeout=2000)
                if email_field:
                    print(f"✅ Found email field with selector: {selector}")
                    break
            except:
                continue
                
        if not email_field:
            print("❌ Could not find email input field")
            # List all input fields on the page
            inputs = await page.query_selector_all('input')
            print(f"📝 Found {len(inputs)} input fields on page:")
            for i, input_elem in enumerate(inputs):
                input_type = await input_elem.get_attribute('type')
                input_name = await input_elem.get_attribute('name')
                input_placeholder = await input_elem.get_attribute('placeholder')
                print(f"   [{i}] type={input_type}, name={input_name}, placeholder={input_placeholder}")
            return False
            
        # Fill email
        print(f"📝 Filling email field with: {username}")
        await email_field.fill(username)
        
        # Find password field
        password_selectors = [
            'input[type="password"]',
            'input[name="password"]',
            '#password'
        ]
        
        password_field = None
        for selector in password_selectors:
            try:
                password_field = await page.wait_for_selector(selector, timeout=2000)
                if password_field:
                    print(f"✅ Found password field with selector: {selector}")
                    break
            except:
                continue
                
        if not password_field:
            print("❌ Could not find password input field")
            return False
            
        # Fill password
        print("📝 Filling password field")
        await password_field.fill(password)
        
        # Take screenshot before submit
        await page.screenshot(path="workfossa_before_submit.png")
        print("📸 Screenshot saved: workfossa_before_submit.png")
        
        # Find and click submit button
        submit_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Sign In")',
            'button:has-text("Login")',
            'button:has-text("Log In")'
        ]
        
        submit_button = None
        for selector in submit_selectors:
            try:
                submit_button = await page.wait_for_selector(selector, timeout=2000)
                if submit_button:
                    print(f"✅ Found submit button with selector: {selector}")
                    break
            except:
                continue
                
        if not submit_button:
            print("❌ Could not find submit button")
            # List all buttons on the page
            buttons = await page.query_selector_all('button')
            print(f"📝 Found {len(buttons)} buttons on page:")
            for i, button in enumerate(buttons):
                button_text = await button.inner_text()
                button_type = await button.get_attribute('type')
                print(f"   [{i}] type={button_type}, text={button_text}")
            return False
            
        # Click submit
        print("🖱️ Clicking submit button...")
        await submit_button.click()
        
        # Wait for navigation
        print("⏳ Waiting for login to complete...")
        try:
            await page.wait_for_navigation(timeout=10000)
        except:
            print("⚠️ Navigation timeout - checking current state...")
            
        # Check result
        current_url = page.url
        print(f"📍 Current URL after login: {current_url}")
        
        # Take screenshot after login
        await page.screenshot(path="workfossa_after_login.png")
        print("📸 Screenshot saved: workfossa_after_login.png")
        
        # Check for success indicators
        if "dashboard" in current_url.lower() or "app/dashboard" in current_url:
            print("✅ Login successful! Reached dashboard")
            return True
        elif "login" in current_url.lower():
            print("❌ Still on login page - login may have failed")
            # Check for error messages
            error_selectors = [
                '.error-message',
                '.alert-danger',
                '.form-error',
                '[role="alert"]',
                '.text-danger'
            ]
            for selector in error_selectors:
                error_elem = await page.query_selector(selector)
                if error_elem:
                    error_text = await error_elem.inner_text()
                    print(f"⚠️ Error message found: {error_text}")
            return False
        else:
            print(f"🤔 Ended up on unexpected page: {current_url}")
            # Try to find navigation elements
            nav_elem = await page.query_selector('nav')
            if nav_elem:
                print("✅ Found navigation element - likely logged in")
                return True
            return False
            
    except Exception as e:
        print(f"❌ Error during login test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if browser:
            await browser.close()
        print("-" * 50)

async def main():
    # Test credentials
    username = "bruce.hunt@owlservices.com"
    password = "Crompco0511"
    
    print("WorkFossa Login Test")
    print("=" * 50)
    
    # Run test with browser visible
    success = await test_workfossa_login(username, password, headless=False)
    
    if success:
        print("\n✅ Login test PASSED - credentials are valid!")
    else:
        print("\n❌ Login test FAILED - please check credentials or website changes")

if __name__ == "__main__":
    asyncio.run(main())