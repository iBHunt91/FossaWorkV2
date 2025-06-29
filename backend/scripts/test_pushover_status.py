#!/usr/bin/env python3
"""
Test script to check Pushover status in testing dashboard

This will help verify that the testing dashboard correctly shows
both "enabled" and "configured" status for Pushover notifications.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.notification_manager import get_notification_manager


async def test_pushover_status():
    """Test Pushover status checking"""
    print("🧪 Testing Pushover status detection...")
    
    # Test with demo user
    user_id = "demo"
    
    try:
        # Get notification manager
        notification_manager = get_notification_manager(user_id=user_id)
        
        # Get current preferences
        preferences = notification_manager.get_user_preferences(user_id)
        
        print(f"\n📋 Current Pushover preferences for user '{user_id}':")
        print(f"  ✅ Enabled: {preferences.get('pushover_enabled', False)}")
        print(f"  🔑 User Key: {'***' + preferences.get('pushover_user_key', '')[-4:] if preferences.get('pushover_user_key') else 'Not set'}")
        print(f"  🔐 API Token: {'***' + preferences.get('pushover_api_token', '')[-4:] if preferences.get('pushover_api_token') else 'Not set'}")
        
        # Check configuration status
        has_user_key = bool(preferences.get('pushover_user_key', '').strip())
        has_api_token = bool(preferences.get('pushover_api_token', '').strip())
        configured = has_user_key and has_api_token
        enabled = preferences.get('pushover_enabled', False)
        
        print(f"\n🔍 Status Analysis:")
        print(f"  📝 Configured: {configured} (has both credentials)")
        print(f"  🟢 Enabled: {enabled}")
        print(f"  ✅ Ready: {configured and enabled}")
        
        # Test what the testing dashboard would see
        if not configured:
            status = "❌ Not configured - missing credentials"
        elif not enabled:
            status = "⚠️ Configured but disabled"
        else:
            status = "✅ Configured and enabled"
            
        print(f"\n🎯 Testing Dashboard should show: {status}")
        
        return configured, enabled
        
    except Exception as e:
        print(f"❌ Error testing Pushover status: {e}")
        import traceback
        traceback.print_exc()
        return False, False


if __name__ == "__main__":
    asyncio.run(test_pushover_status())