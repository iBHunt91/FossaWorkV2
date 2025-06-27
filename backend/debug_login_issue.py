#!/usr/bin/env python3
"""
Debug script to diagnose WorkFossa login issues
"""

import asyncio
import os
import sys
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, '.')

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from app.services.credential_manager import CredentialManager
from app.services.browser_automation import BrowserAutomationService

async def debug_login_process():
    """Debug the complete login process step by step"""
    
    print("🔍 Starting WorkFossa Login Diagnosis")
    print("=" * 50)
    
    # Test user ID from the logs
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # 1. Check if credentials exist
    print("1️⃣ Checking credential storage...")
    credential_manager = CredentialManager()
    
    # Check if credential file exists
    cred_file = os.path.join(credential_manager.storage_path, f"{user_id}.cred")
    print(f"   📁 Credential file path: {cred_file}")
    print(f"   📄 File exists: {os.path.exists(cred_file)}")
    
    if os.path.exists(cred_file):
        try:
            with open(cred_file, 'r') as f:
                cred_data = json.load(f)
            print(f"   ✅ File readable: {len(cred_data)} keys")
            print(f"   📅 Created: {cred_data.get('created_at', 'Unknown')}")
            print(f"   🔒 Has encrypted data: {'encrypted_data' in cred_data}")
        except Exception as e:
            print(f"   ❌ Error reading file: {e}")
    
    # 2. Check environment variables
    print("\n2️⃣ Checking environment setup...")
    master_key = os.environ.get('FOSSAWORK_MASTER_KEY')
    print(f"   🔑 FOSSAWORK_MASTER_KEY set: {bool(master_key)}")
    if master_key:
        print(f"   🔑 Key length: {len(master_key)} characters")
    
    encryption_password = os.environ.get('ENCRYPTION_PASSWORD')
    print(f"   🔐 ENCRYPTION_PASSWORD set: {bool(encryption_password)}")
    
    secret_key = os.environ.get('SECRET_KEY')
    print(f"   🔐 SECRET_KEY set: {bool(secret_key)}")
    
    # 3. Try to load credentials
    print("\n3️⃣ Attempting to load credentials...")
    try:
        credentials = credential_manager.retrieve_credentials(user_id)
        if credentials:
            print(f"   ✅ Credentials loaded successfully")
            print(f"   👤 Username: {credentials.username}")
            print(f"   🔒 Password: {'*' * len(credentials.password)} ({len(credentials.password)} chars)")
            print(f"   ✅ Valid: {credentials.is_valid}")
            print(f"   🕒 Last used: {credentials.last_used}")
        else:
            print(f"   ❌ Failed to load credentials")
            return
    except Exception as e:
        print(f"   ❌ Error loading credentials: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 4. Test basic browser automation setup
    print("\n4️⃣ Testing browser automation setup...")
    try:
        browser_service = BrowserAutomationService()
        print(f"   ✅ Browser service created")
        
        # Check if we can create a session
        session_id = "debug_session"
        success = await browser_service.create_session(session_id)
        print(f"   🌐 Session creation: {'✅ Success' if success else '❌ Failed'}")
        
        if success:
            # 5. Test actual login process
            print("\n5️⃣ Testing WorkFossa login process...")
            
            # Get the page
            page = browser_service.pages.get(session_id)
            if page:
                print(f"   📄 Page object available: ✅")
                
                # Navigate to WorkFossa login page
                print(f"   🌐 Navigating to https://app.workfossa.com...")
                try:
                    await page.goto("https://app.workfossa.com", wait_until="networkidle", timeout=15000)
                    current_url = page.url
                    page_title = await page.title()
                    
                    print(f"   📍 Current URL: {current_url}")
                    print(f"   📝 Page title: {page_title}")
                    
                    # Take screenshot
                    await page.screenshot(path="debug_login_page.png")
                    print(f"   📸 Screenshot saved: debug_login_page.png")
                    
                    # Check for login form elements
                    print(f"\n   🔍 Checking for login form elements...")
                    
                    email_field = await page.query_selector("input[name='email'], input[type='email']")
                    password_field = await page.query_selector("input[name='password'], input[type='password']")
                    submit_button = await page.query_selector("input[type='submit'], button[type='submit']")
                    
                    print(f"   📧 Email field found: {'✅' if email_field else '❌'}")
                    print(f"   🔒 Password field found: {'✅' if password_field else '❌'}")
                    print(f"   🔘 Submit button found: {'✅' if submit_button else '❌'}")
                    
                    if email_field and password_field and submit_button:
                        print(f"\n   🔑 Attempting login with stored credentials...")
                        
                        # Fill in credentials
                        await page.fill("input[name='email'], input[type='email']", credentials.username)
                        await page.fill("input[name='password'], input[type='password']", credentials.password)
                        
                        # Take screenshot before clicking
                        await page.screenshot(path="debug_before_login.png")
                        print(f"   📸 Pre-login screenshot: debug_before_login.png")
                        
                        # Click login
                        await submit_button.click()
                        print(f"   🖱️ Login button clicked")
                        
                        # Wait for response
                        await page.wait_for_timeout(3000)
                        
                        # Check result
                        final_url = page.url
                        final_title = await page.title()
                        
                        print(f"   📍 Final URL: {final_url}")
                        print(f"   📝 Final title: {final_title}")
                        
                        # Take final screenshot
                        await page.screenshot(path="debug_after_login.png")
                        print(f"   📸 Post-login screenshot: debug_after_login.png")
                        
                        # Check if login was successful
                        if "login" in final_url.lower():
                            print(f"   ❌ Login failed - still on login page")
                            
                            # Check for error messages
                            error_elements = await page.query_selector_all(".error, .alert, .message")
                            if error_elements:
                                for i, elem in enumerate(error_elements):
                                    text = await elem.text_content()
                                    if text and text.strip():
                                        print(f"   ⚠️ Error message {i+1}: {text.strip()}")
                        else:
                            print(f"   ✅ Login appears successful!")
                    else:
                        print(f"   ❌ Login form elements not found - page structure may have changed")
                        
                        # Save page content for analysis
                        content = await page.content()
                        with open("debug_page_content.html", "w") as f:
                            f.write(content)
                        print(f"   📄 Page content saved: debug_page_content.html")
                    
                except Exception as e:
                    print(f"   ❌ Navigation/login failed: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"   ❌ No page object available")
            
            # Clean up
            await browser_service.close_session(session_id)
            print(f"   🧹 Session cleaned up")
        
    except Exception as e:
        print(f"   ❌ Browser automation error: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n🏁 Diagnosis complete!")

if __name__ == "__main__":
    asyncio.run(debug_login_process())