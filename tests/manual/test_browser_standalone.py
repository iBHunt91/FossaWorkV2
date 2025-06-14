#!/usr/bin/env python3
"""
Test browser functionality independently
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.services.workfossa_automation import WorkFossaAutomationService
from test_credentials_access import get_workfossa_credentials
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_browser_standalone():
    """Test browser functionality independently"""
    
    logger.info("🧪 TESTING BROWSER STANDALONE")
    logger.info("="*60)
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        logger.error("No credentials found!")
        return
    
    user_id = creds['user_id']
    
    try:
        # Test 1: Create automation service
        logger.info("1️⃣ Creating WorkFossaAutomationService...")
        automation_service = WorkFossaAutomationService(headless=False)  # Use visible browser for debugging
        logger.info("✅ WorkFossaAutomationService created successfully")
        
        # Test 2: Initialize browser
        logger.info("\n2️⃣ Initializing browser...")
        browser_init = await automation_service.initialize_browser()
        if browser_init:
            logger.info("✅ Browser initialized successfully")
        else:
            logger.error("❌ Browser initialization failed")
            return
        
        # Test 3: Create session
        logger.info("\n3️⃣ Creating session...")
        session_id = "test_session_123"
        credentials_dict = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        created_session_id = await automation_service.create_session(session_id, user_id, credentials_dict)
        if created_session_id:
            logger.info(f"✅ Session created: {created_session_id}")
        else:
            logger.error("❌ Session creation failed")
            return
        
        # Test 4: Login
        logger.info("\n4️⃣ Testing login...")
        login_success = await automation_service.login_to_workfossa(session_id)
        if login_success:
            logger.info("✅ Login successful")
        else:
            logger.error("❌ Login failed")
            return
        
        # Test 5: Check session status
        logger.info("\n5️⃣ Checking session status...")
        session = automation_service.sessions.get(session_id)
        if session:
            logger.info(f"✅ Session active:")
            logger.info(f"   User ID: {session['user_id']}")
            logger.info(f"   Logged in: {session['logged_in']}")
            logger.info(f"   Page URL: {session['page'].url}")
        else:
            logger.error("❌ Session not found")
        
        logger.info("\n✅ All browser tests passed!")
        
    except Exception as e:
        logger.error(f"❌ Browser test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        if hasattr(automation_service, 'browser') and automation_service.browser:
            logger.info("\n🧹 Closing browser...")
            await automation_service.browser.close()

if __name__ == "__main__":
    asyncio.run(test_browser_standalone())