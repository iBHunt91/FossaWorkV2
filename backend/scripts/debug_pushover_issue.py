#!/usr/bin/env python3
"""
Debug script to understand why Pushover test is returning False
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.pushover_notification import PushoverNotificationService, PushoverSettings
from app.services.notification_manager import NotificationManager
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def test_direct_pushover():
    """Test Pushover service directly"""
    try:
        # Test with your credentials
        settings = PushoverSettings(
            user_key="u3h8ajytntb1pu3p6qtmpjy6pgaou2",
            api_token="ayxnbk5eim41c11ybhivjf4ximp61v"
        )
        
        service = PushoverNotificationService(settings)
        
        logger.info("Testing Pushover service directly...")
        
        # Test send_notification
        result = await service.send_notification(
            title="🧪 Debug Test",
            message="Direct test from debug script"
        )
        
        logger.info(f"send_notification returned: {result} (type: {type(result)})")
        
        # Also test the validation
        validation_result = await service.validate_credentials()
        logger.info(f"validate_credentials returned: {validation_result}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error in test: {e}", exc_info=True)
        return False

async def test_notification_manager():
    """Test through notification manager"""
    try:
        from app.services.logging_service import LoggingService
        
        # Create notification manager
        logging_service = LoggingService("test")
        notification_manager = NotificationManager(logging_service=logging_service)
        
        # Set up user preferences
        user_id = "test_user"
        preferences = {
            "pushover_enabled": True,
            "pushover_user_key": "u3h8ajytntb1pu3p6qtmpjy6pgaou2",
            "pushover_api_token": "ayxnbk5eim41c11ybhivjf4ximp61v"
        }
        
        await notification_manager.update_user_preferences(user_id, preferences)
        
        # Get the pushover service
        pushover_service = await notification_manager._get_pushover_service(user_id, preferences)
        
        if pushover_service:
            logger.info("Got Pushover service from notification manager")
            
            # Test sending
            result = await pushover_service.send_notification(
                title="🧪 Manager Test",
                message="Test through notification manager"
            )
            
            logger.info(f"Notification manager test returned: {result}")
            return result
        else:
            logger.error("Could not get Pushover service from notification manager")
            return False
            
    except Exception as e:
        logger.error(f"Error in notification manager test: {e}", exc_info=True)
        return False

async def main():
    logger.info("=== Starting Pushover Debug Tests ===")
    
    # Test 1: Direct service
    logger.info("\n1. Testing direct Pushover service...")
    direct_result = await test_direct_pushover()
    logger.info(f"Direct test result: {direct_result}\n")
    
    # Test 2: Through notification manager
    logger.info("2. Testing through notification manager...")
    manager_result = await test_notification_manager()
    logger.info(f"Manager test result: {manager_result}\n")
    
    logger.info("=== Tests Complete ===")
    logger.info(f"Direct: {direct_result}, Manager: {manager_result}")

if __name__ == "__main__":
    asyncio.run(main())