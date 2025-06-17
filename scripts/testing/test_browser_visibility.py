#!/usr/bin/env python3
"""
Test script to verify browser visibility toggle is working properly
"""

import asyncio
import json
from pathlib import Path
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'backend')))

from app.services.workfossa_automation import WorkFossaAutomationService

async def test_browser_visibility():
    """Test browser visibility with different settings"""
    
    # Test user ID
    user_id = "test_user"
    
    # Test 1: Default (headless = True)
    print("\n" + "="*50)
    print("TEST 1: Default settings (headless = True)")
    print("="*50)
    
    service1 = WorkFossaAutomationService(headless=True)
    await service1.initialize_browser()
    print(f"Browser headless mode: {service1.headless}")
    print("You should NOT see a browser window")
    await asyncio.sleep(3)
    await service1.cleanup()
    
    # Test 2: With user settings (headless = False)
    print("\n" + "="*50)
    print("TEST 2: User settings (headless = False)")
    print("="*50)
    
    user_settings = {
        'browser_settings': {
            'headless': False,
            'browser_type': 'chromium',
            'viewport_width': 1280,
            'viewport_height': 720
        }
    }
    
    service2 = WorkFossaAutomationService(headless=True, user_settings=user_settings)
    await service2.initialize_browser()
    print(f"Browser headless mode: {service2.headless}")
    print("You SHOULD see a browser window")
    await asyncio.sleep(5)
    await service2.cleanup()
    
    # Test 3: Environment variable override
    print("\n" + "="*50)
    print("TEST 3: Environment variable override (BROWSER_VISIBLE=true)")
    print("="*50)
    
    os.environ['BROWSER_VISIBLE'] = 'true'
    service3 = WorkFossaAutomationService(headless=True)
    await service3.initialize_browser()
    print(f"Browser headless mode: {service3.headless}")
    print("You SHOULD see a browser window (env var override)")
    await asyncio.sleep(5)
    await service3.cleanup()
    
    # Clean up environment variable
    del os.environ['BROWSER_VISIBLE']
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    asyncio.run(test_browser_visibility())