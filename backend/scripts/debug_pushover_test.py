#!/usr/bin/env python3
"""
Debug Pushover notification test

Simple script to test Pushover notifications end-to-end.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.pushover_notification import PushoverNotificationService, PushoverSettings, PushoverPriority


async def test_pushover_directly():
    """Test Pushover notification directly with hardcoded credentials"""
    print("🧪 Testing Pushover notifications directly...")
    
    # You'll need to replace these with real credentials for testing
    user_key = input("Enter your Pushover User Key: ").strip()
    api_token = input("Enter your Pushover Application Token: ").strip()
    
    if not user_key or not api_token:
        print("❌ Both user key and application token are required")
        return
    
    try:
        # Create Pushover settings
        settings = PushoverSettings(
            user_key=user_key,
            api_token=api_token,
            sound="pushover"
        )
        
        print("✅ Pushover settings created successfully")
        
        # Create service
        service = PushoverNotificationService(settings)
        print("✅ Pushover service created successfully")
        
        # Test validation first
        print("\n🔍 Validating credentials...")
        validation_result = await service.validate_credentials()
        print(f"Validation result: {validation_result}")
        
        if not validation_result.get("valid", False):
            print(f"❌ Credential validation failed: {validation_result.get('message')}")
            return
        
        print("✅ Credentials validated successfully!")
        
        # Send test notification
        print("\n📤 Sending test notification...")
        success = await service.send_notification(
            title="🧪 FossaWork Test",
            message="This is a test notification from FossaWork to verify your Pushover setup is working correctly.",
            priority=PushoverPriority.NORMAL
        )
        
        if success:
            print("✅ Test notification sent successfully!")
            print("📱 Check your Pushover app for the notification")
        else:
            print("❌ Failed to send test notification")
            
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_pushover_directly())