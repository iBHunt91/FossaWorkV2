#!/usr/bin/env python3
"""
Test that browser is now visible for testing
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from app.services.workfossa_automation import workfossa_automation

async def test_visible_browser():
    """Test that browser launches visibly"""
    
    print("🧪 Testing Visible Browser Mode")
    print("=" * 80)
    
    print(f"🔍 Current Configuration:")
    print(f"   Headless Mode: {workfossa_automation.headless}")
    print(f"   BROWSER_VISIBLE env: {os.environ.get('BROWSER_VISIBLE', 'not set')}")
    
    if workfossa_automation.headless:
        print("❌ Browser is still in headless mode!")
    else:
        print("✅ Browser is configured for VISIBLE mode")
    
    print("\n📝 To switch modes:")
    print("   - For headless: export BROWSER_VISIBLE=false")
    print("   - For visible: export BROWSER_VISIBLE=true (or unset)")

if __name__ == "__main__":
    asyncio.run(test_visible_browser())