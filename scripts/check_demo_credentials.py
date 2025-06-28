#!/usr/bin/env python3
"""
Check if demo user has valid WorkFossa credentials
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set required environment variables if not already set
if not os.environ.get('FOSSAWORK_MASTER_KEY'):
    os.environ['FOSSAWORK_MASTER_KEY'] = 'qghPNqYce-4lJMCIUoZnqunMAyusw4WSh85Dfm56nlI'

from app.services.credential_manager import CredentialManager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_demo_credentials():
    """Check demo user credentials"""
    
    user_id = "demo"
    logger.info(f"Checking credentials for user: {user_id}")
    
    credential_manager = CredentialManager()
    
    try:
        workfossa_creds = credential_manager.retrieve_credentials(user_id)
        
        if workfossa_creds:
            logger.info(f"✅ Found credentials for username: {workfossa_creds.username}")
            logger.info(f"Password length: {len(workfossa_creds.password)}")
            logger.info(f"Created at: {workfossa_creds.created_at}")
            logger.info(f"Last used: {workfossa_creds.last_used}")
            logger.info(f"Is valid: {workfossa_creds.is_valid}")
        else:
            logger.error("❌ No credentials found for demo user")
            
            # Try to copy credentials from Bruce's account
            logger.info("\nAttempting to copy credentials from Bruce's account...")
            bruce_creds = credential_manager.retrieve_credentials("7bea3bdb7e8e303eacaba442bd824004")
            
            if bruce_creds:
                from app.services.credential_manager import WorkFossaCredentials
                demo_creds = WorkFossaCredentials(
                    username=bruce_creds.username,
                    password=bruce_creds.password,
                    user_id="demo"
                )
                
                if credential_manager.store_credentials(demo_creds):
                    logger.info("✅ Successfully copied credentials to demo user")
                else:
                    logger.error("❌ Failed to store credentials for demo user")
            else:
                logger.error("❌ Could not retrieve Bruce's credentials either")
                
    except Exception as e:
        logger.error(f"Error checking credentials: {e}", exc_info=True)

if __name__ == "__main__":
    check_demo_credentials()