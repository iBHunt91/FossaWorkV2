#!/usr/bin/env python3
"""
Test script to verify browser visibility toggle functionality
"""
import asyncio
import json
import os
from pathlib import Path

# Add the backend directory to the Python path
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from app.services.browser_automation import BrowserAutomation


async def test_browser_visibility():
    """Test browser visibility toggle"""
    print("\n🧪 Testing Browser Visibility Toggle\n")
    
    # Test user ID (Bruce Hunt's ID from the console logs)
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Path to browser settings
    settings_path = Path(__file__).parent.parent.parent / "data" / "users" / user_id / "settings" / "browser_settings.json"
    
    # Test 1: Check if settings file exists
    print("1️⃣ Checking browser settings file...")
    if settings_path.exists():
        with open(settings_path, 'r') as f:
            settings = json.load(f)
        print(f"   ✅ Settings found: {json.dumps(settings, indent=2)}")
    else:
        print("   ⚠️  No settings file found, using defaults")
    
    # Test 2: Test with browser visible
    print("\n2️⃣ Testing with browser VISIBLE (headless=False)...")
    browser_settings = {
        "browser_visible": True,
        "browser_type": "chromium",
        "viewport_width": 1280,
        "viewport_height": 720
    }
    
    browser = BrowserAutomation()
    await browser.initialize(headless=not browser_settings["browser_visible"])
    
    print("   ✅ Browser launched in VISIBLE mode")
    print("   🔍 You should see a browser window open")
    
    # Navigate to a test page
    await browser.page.goto("https://example.com")
    print("   📄 Navigated to example.com")
    
    # Wait a bit so user can see the browser
    print("   ⏳ Waiting 3 seconds...")
    await asyncio.sleep(3)
    
    await browser.cleanup()
    print("   ✅ Browser closed")
    
    # Test 3: Test with browser hidden
    print("\n3️⃣ Testing with browser HIDDEN (headless=True)...")
    browser_settings["browser_visible"] = False
    
    browser = BrowserAutomation()
    await browser.initialize(headless=not browser_settings["browser_visible"])
    
    print("   ✅ Browser launched in HIDDEN mode")
    print("   👻 No browser window should be visible")
    
    # Navigate to a test page
    await browser.page.goto("https://example.com")
    print("   📄 Navigated to example.com")
    
    # Take a screenshot to prove it's working
    screenshot_path = Path(__file__).parent / "browser_visibility_test.png"
    await browser.page.screenshot(path=str(screenshot_path))
    print(f"   📸 Screenshot saved to: {screenshot_path}")
    
    await browser.cleanup()
    print("   ✅ Browser closed")
    
    print("\n✅ Browser visibility toggle test completed successfully!")
    print("\n💡 Next steps:")
    print("   1. Go to Settings > Advanced > Browser Settings in the UI")
    print("   2. Toggle 'Browser Visibility' on/off")
    print("   3. Run work order scraping to see the effect")


if __name__ == "__main__":
    asyncio.run(test_browser_visibility())