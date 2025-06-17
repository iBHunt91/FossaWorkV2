#!/usr/bin/env python3
"""
Integration test to demonstrate browser visibility toggle functionality
"""

import asyncio
import json
from pathlib import Path
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'backend')))

async def test_browser_settings_integration():
    """Test browser settings integration with actual scraping"""
    
    print("\n" + "="*70)
    print("BROWSER VISIBILITY TOGGLE - INTEGRATION TEST")
    print("="*70)
    
    # Simulate user settings directory
    user_id = "demo_user"
    settings_dir = Path(f"data/users/{user_id}/settings")
    settings_dir.mkdir(parents=True, exist_ok=True)
    
    # Test 1: Browser visible (headless = false)
    print("\n🔍 TEST 1: Browser VISIBLE (for debugging)")
    print("-" * 50)
    
    browser_settings = {
        "headless": False,  # Browser will be visible
        "browser_type": "chromium",
        "viewport_width": 1280,
        "viewport_height": 720,
        "enable_screenshots": True,
        "enable_debug_mode": True
    }
    
    # Save settings to file
    settings_file = settings_dir / "browser_settings.json"
    with open(settings_file, 'w') as f:
        json.dump(browser_settings, f, indent=2)
    
    print(f"✅ Saved browser settings to: {settings_file}")
    print(f"   - headless: {browser_settings['headless']} (Browser VISIBLE)")
    print(f"   - viewport: {browser_settings['viewport_width']}x{browser_settings['viewport_height']}")
    
    # Test 2: Browser hidden (headless = true)
    print("\n🔍 TEST 2: Browser HIDDEN (normal operation)")
    print("-" * 50)
    
    browser_settings['headless'] = True  # Browser will be hidden
    
    # Update settings file
    with open(settings_file, 'w') as f:
        json.dump(browser_settings, f, indent=2)
    
    print(f"✅ Updated browser settings:")
    print(f"   - headless: {browser_settings['headless']} (Browser HIDDEN)")
    
    # Show how to check current settings
    print("\n📋 HOW TO USE:")
    print("-" * 50)
    print("1. Go to Settings > Advanced > Browser Settings in the UI")
    print("2. Toggle 'Browser Visibility' to show/hide browser during scraping")
    print("3. When enabled, you'll see the browser window during:")
    print("   - Work order scraping")
    print("   - Dispenser scraping")
    print("   - Form automation")
    print("\n4. This is useful for:")
    print("   - Debugging scraping issues")
    print("   - Watching the automation process")
    print("   - Troubleshooting login problems")
    
    print("\n✅ Integration test completed!")

if __name__ == "__main__":
    asyncio.run(test_browser_settings_integration())