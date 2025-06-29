#!/usr/bin/env python3
"""
Test script for Pushover notifications debugging
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.pushover_notification import PushoverNotificationService, PushoverSettings, PushoverPriority
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_pushover():
    """Test Pushover notification directly"""
    
    # Test credentials (you'll need to replace these with actual values)
    user_key = input("Enter your Pushover user key (30 chars): ").strip()
    api_token = input("Enter your Pushover application token (30 chars): ").strip()
    
    try:
        # Create settings
        settings = PushoverSettings(
            user_key=user_key,
            api_token=api_token,
            sound="pushover"
        )
        print("✅ Credentials validated (format check passed)")
        
        # Create service
        service = PushoverNotificationService(settings)
        
        # Test validation
        print("\nTesting credential validation...")
        result = await service.validate_credentials()
        print(f"Validation result: {result}")
        
        if result['valid']:
            print("✅ Credentials are valid!")
            print(f"Devices: {result.get('devices', [])}")
            
            # Send test notification
            print("\nSending test notification...")
            success = await service.send_notification(
                title="🧪 FossaWork Test",
                message="This is a test notification from FossaWork. If you see this, Pushover is working correctly!",
                priority=PushoverPriority.NORMAL
            )
            
            if success:
                print("✅ Test notification sent successfully!")
            else:
                print("❌ Failed to send test notification")
        else:
            print(f"❌ Validation failed: {result.get('message', 'Unknown error')}")
            
    except ValueError as e:
        print(f"❌ Credential format error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
        logger.exception("Detailed error:")

if __name__ == "__main__":
    asyncio.run(test_pushover())