#!/usr/bin/env python3
"""
Verify that browser automation is working correctly
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

async def test_playwright_installation():
    """Test if Playwright is properly installed"""
    print("🧪 Testing Playwright Installation...")
    
    try:
        from playwright.async_api import async_playwright
        print("✅ Playwright imported successfully")
        
        async with async_playwright() as p:
            print("✅ Playwright context created")
            
            # Test browser launch
            browser = await p.chromium.launch(headless=True)
            print("✅ Chromium browser launched")
            
            # Test page creation
            page = await browser.new_page()
            print("✅ Browser page created")
            
            # Test navigation
            await page.goto("https://example.com")
            title = await page.title()
            print(f"✅ Navigation successful - Page title: {title}")
            
            await browser.close()
            print("✅ Browser closed cleanly")
            
        return True
        
    except ImportError as e:
        print(f"❌ Playwright import failed: {e}")
        print("Run: pip install playwright && playwright install")
        return False
        
    except Exception as e:
        print(f"❌ Playwright test failed: {e}")
        return False

async def test_automation_service():
    """Test the automation service"""
    print("\n🔧 Testing Automation Service...")
    
    try:
        from app.services.browser_automation import automation_service
        print("✅ Automation service imported")
        
        # Test initialization
        init_result = await automation_service.initialize()
        print(f"✅ Service initialized: {init_result}")
        
        # Test session creation (mock credentials for testing)
        test_credentials = {"username": "test", "password": "test"}
        session = await automation_service.create_session("test_user", test_credentials)
        print(f"✅ Session created: {session.session_id}")
        
        # Test cleanup
        await automation_service.close_session(session.session_id)
        print("✅ Session cleaned up")
        
        await automation_service.cleanup()
        print("✅ Service cleanup complete")
        
        return True
        
    except Exception as e:
        print(f"❌ Automation service test failed: {e}")
        return False

async def main():
    """Run all verification tests"""
    print("🎯 FossaWork V2 - Browser Automation Verification")
    print("=" * 60)
    
    # Test Playwright installation
    playwright_ok = await test_playwright_installation()
    
    # Test automation service
    service_ok = await test_automation_service()
    
    print("\n" + "=" * 60)
    print("🎯 VERIFICATION SUMMARY:")
    print("=" * 60)
    
    if playwright_ok and service_ok:
        print("✅ ALL TESTS PASSED - Browser automation ready!")
        print("\n🚀 Ready for real WorkFossa integration:")
        print("1. Configure real credentials in backend")
        print("2. Test with actual WorkFossa site")
        print("3. Begin live data scraping")
        return True
    else:
        print("❌ Some tests failed - check errors above")
        if not playwright_ok:
            print("🔧 Fix: Run install-playwright.bat")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    input("\nPress Enter to exit...")
    sys.exit(0 if success else 1)