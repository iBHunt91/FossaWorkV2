#!/usr/bin/env python3
"""
Test user credentials to diagnose login failures
"""

import asyncio
import sys
import os
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

# Set environment
os.environ['SECRET_KEY'] = "Am7t7lXtMeZQJ48uYGgh2L0Uy7OzBnvEfGaqoXKPzcw"

from app.services.credential_manager_deprecated import CredentialManager
from app.services.workfossa_scraper import WorkFossaScraper
import httpx

async def test_workfossa_api_login(username: str, password: str):
    """Test login directly against WorkFossa API"""
    print(f"\n{'='*60}")
    print(f"Testing WorkFossa API Login")
    print(f"{'='*60}")
    print(f"Username: {username}")
    print(f"Password: {'*' * len(password)}")
    
    async with httpx.AsyncClient() as client:
        try:
            # Try the WorkFossa login endpoint
            response = await client.post(
                "https://app.workfossa.com/api/auth/login",
                json={"username": username, "password": password},
                headers={"Content-Type": "application/json"},
                timeout=30.0
            )
            
            print(f"\nResponse Status: {response.status_code}")
            
            if response.status_code == 200:
                print("✅ Login successful!")
                return True
            else:
                print("❌ Login failed!")
                print(f"Response: {response.text[:200]}...")
                return False
                
        except Exception as e:
            print(f"❌ Error during API login: {type(e).__name__}: {str(e)}")
            return False

async def test_browser_login(username: str, password: str, user_id: str):
    """Test login using browser automation"""
    print(f"\n{'='*60}")
    print(f"Testing Browser Login")
    print(f"{'='*60}")
    
    scraper = None
    try:
        scraper = WorkFossaScraper(
            username=username,
            password=password,
            headless=True,
            user_id=user_id
        )
        
        await scraper.initialize()
        print("✅ Browser initialized")
        
        success = await scraper.login()
        
        if success:
            print("✅ Browser login successful!")
            
            # Try to navigate to a protected page
            await scraper.page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
            await asyncio.sleep(2)
            
            # Check if we're still logged in
            current_url = scraper.page.url
            if "/login" in current_url:
                print("⚠️  Redirected to login page - session may be invalid")
            else:
                print("✅ Successfully accessed work orders page")
        else:
            print("❌ Browser login failed!")
            
        return success
        
    except Exception as e:
        print(f"❌ Error during browser login: {type(e).__name__}: {str(e)}")
        return False
    finally:
        if scraper and scraper.page:
            await scraper.close()

async def test_user_credentials(user_id: str):
    """Test credentials for a specific user"""
    print(f"\n{'='*80}")
    print(f"TESTING CREDENTIALS FOR USER: {user_id}")
    print(f"{'='*80}")
    
    # Get credentials
    cred_manager = CredentialManager()
    
    has_creds = await cred_manager.has_credentials(user_id)
    if not has_creds:
        print("❌ No credentials found for this user!")
        return
    
    try:
        creds = await cred_manager.get_credentials(user_id)
        username = creds.get('username', '')
        password = creds.get('password', '')
        
        print(f"\nFound credentials:")
        print(f"Username: {username}")
        print(f"Password length: {len(password)}")
        
        # Test API login
        api_success = await test_workfossa_api_login(username, password)
        
        # Test browser login
        browser_success = await test_browser_login(username, password, user_id)
        
        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"API Login: {'✅ Success' if api_success else '❌ Failed'}")
        print(f"Browser Login: {'✅ Success' if browser_success else '❌ Failed'}")
        
        if not api_success and not browser_success:
            print("\n⚠️  RECOMMENDATION: Credentials appear to be invalid")
            print("The user needs to update their WorkFossa credentials in the settings")
        
    except Exception as e:
        print(f"❌ Error getting credentials: {type(e).__name__}: {str(e)}")

async def main():
    """Test both problematic users"""
    
    # Test the user with login failures (from 3:30 PM)
    print("\n" + "="*80)
    print("Testing user with login failures")
    print("="*80)
    await test_user_credentials("80bb76f1de123a479e6391a8ee70a7bb")
    
    # Also test the main user to ensure credentials are working
    print("\n\n" + "="*80)
    print("Testing main user for comparison")
    print("="*80)
    await test_user_credentials("7bea3bdb7e8e303eacaba442bd824004")

if __name__ == "__main__":
    asyncio.run(main())