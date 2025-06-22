#!/usr/bin/env python3
"""
Test WorkFossa login to diagnose authentication issues
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set required environment variables if not already set
if not os.environ.get('FOSSAWORK_MASTER_KEY'):
    os.environ['FOSSAWORK_MASTER_KEY'] = 'qghPNqYce-4lJMCIUoZnqunMAyusw4WSh85Dfm56nlI'

from app.services.workfossa_automation import WorkFossaAutomationService
from app.database import SessionLocal
from app.models import UserCredential
import base64
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def simple_decrypt(encrypted_password: str) -> str:
    """Simple decryption - check if it's base64 or plain text"""
    try:
        # Try base64 decode first
        return base64.b64decode(encrypted_password.encode()).decode()
    except:
        # If that fails, it might be plain text
        return encrypted_password

async def test_login():
    """Test WorkFossa login with stored credentials"""
    
    # User ID from the screenshot
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    logger.info(f"Testing WorkFossa login for user: {user_id}")
    
    # Get credentials using CredentialManager
    from app.services.credential_manager import CredentialManager
    
    credential_manager = CredentialManager()
    workfossa_creds = credential_manager.retrieve_credentials(user_id)
    
    if not workfossa_creds:
        logger.error("No WorkFossa credentials found")
        return
    
    username = workfossa_creds.username
    password = workfossa_creds.password
    
    logger.info(f"Found credentials for username: {username}")
    logger.info(f"Password length: {len(password)}")
    
    # Create automation service with visible browser
    logger.info("Creating WorkFossa automation service...")
    automation = WorkFossaAutomationService(headless=False)
    
    session_id = f"test_{user_id}"
    
    try:
        # Test credential verification
        logger.info("Testing credential verification...")
        result = await automation.verify_credentials(
            session_id,
            username,
            password
        )
        
        logger.info(f"Verification result: {result}")
        
        if result['success']:
            logger.info("✅ Credentials verified successfully!")
        else:
            logger.error(f"❌ Credential verification failed: {result['message']}")
            
            # Try creating a session and logging in to get more details
            logger.info("\nTrying full login process...")
            
            await automation.create_session(
                session_id=session_id,
                user_id=user_id,
                credentials={
                    'email': username,
                    'password': password
                }
            )
            
            login_success = await automation.login_to_workfossa(session_id)
            logger.info(f"Login result: {login_success}")
            
    except Exception as e:
        logger.error(f"Error during testing: {e}", exc_info=True)
    finally:
        # Clean up
        if hasattr(automation, 'browser') and automation.browser:
            await automation.browser.close()
            logger.info("Browser closed")

if __name__ == "__main__":
    asyncio.run(test_login())