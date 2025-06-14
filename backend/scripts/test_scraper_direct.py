#!/usr/bin/env python3
"""
Direct test of page size dropdown detection using existing credentials
"""

import asyncio
import logging
import sys
import json
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger(__name__)

# Also set scraper logger to INFO  
scraper_logger = logging.getLogger('app.services.workfossa_scraper')
scraper_logger.setLevel(logging.INFO)

async def test_with_credentials():
    """Test page size dropdown detection with automatic login"""
    
    logger.info("🧪 Testing Page Size Dropdown with Auto Login")
    logger.info("="*60)
    
    try:
        from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials
        from app.services.workfossa_scraper import workfossa_scraper
        from app.services.credential_manager import CredentialManager
        
        # Get the actual user's credentials - the user ID from the screenshots
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        cred_manager = CredentialManager()
        user_cred_obj = cred_manager.retrieve_credentials(user_id)
        
        if not user_cred_obj:
            logger.error(f"❌ User credentials not found for user: {user_id}")
            logger.info("Please ensure credentials exist in data/credentials/")
            return
            
        logger.info(f"✅ Found credentials for user: {user_id}")
        
        # Convert to dict format expected by create_session
        user_creds = {
            'username': user_cred_obj.username,
            'password': user_cred_obj.password
        }
        
        # Create automation service
        automation = WorkFossaAutomationService(headless=False)
        await automation.initialize_browser()
        
        # Create session
        session_id = "test_page_size_dropdown"
        
        # Create credentials object
        credentials = WorkFossaCredentials(
            email=user_creds['username'],
            password=user_creds['password'],
            user_id=user_id
        )
        
        # Create session using the correct method
        await automation.create_automation_session(user_id, credentials)
        
        # The session is stored with user_id as key in this case
        session = automation.sessions.get(user_id)
        if not session:
            # Try with session_id
            await automation.create_session(session_id, user_id, user_creds)
            session = automation.sessions.get(session_id)
        
        if not session:
            logger.error("❌ Failed to create session")
            return
            
        page = session['page']
        
        # Login to WorkFossa
        logger.info("🔐 Logging in to WorkFossa...")
        login_success = await automation.login_to_workfossa(session_id if session_id in automation.sessions else user_id)
        
        if not login_success:
            logger.error("❌ Login failed!")
            return
            
        logger.info("✅ Login successful!")
        
        # Navigate to work orders page
        logger.info("📄 Navigating to work orders page...")
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Take initial screenshot
        await page.screenshot(path="test_before_page_size.png")
        logger.info("📸 Screenshot saved: test_before_page_size.png")
        
        # Count initial work orders
        initial_count = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('tbody tr');
                return rows.length;
            }
        """)
        logger.info(f"📊 Initial work order count: {initial_count}")
        
        # Test the page size method directly
        logger.info("\n" + "="*60)
        logger.info("🔧 TESTING PAGE SIZE DETECTION")
        logger.info("="*60)
        
        # Call the scraper's page size method
        result = await workfossa_scraper._set_page_size_to_100(page)
        
        logger.info("="*60)
        logger.info(f"RESULT: {'✅ SUCCESS' if result else '❌ FAILED'}")
        logger.info("="*60)
        
        # Wait for page to reload if successful
        if result:
            await page.wait_for_timeout(3000)
        
        # Take screenshot after attempt
        await page.screenshot(path="test_after_page_size.png")
        logger.info("📸 Screenshot saved: test_after_page_size.png")
        
        # Count work orders after change
        final_count = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('tbody tr');
                return rows.length;
            }
        """)
        logger.info(f"📊 Final work order count: {final_count}")
        
        if final_count > initial_count:
            logger.info(f"✅ SUCCESS! Work orders increased from {initial_count} to {final_count}")
        else:
            logger.info(f"❌ No change in work order count: still {final_count}")
        
        # Do detailed analysis
        logger.info("\n📋 DETAILED ANALYSIS:")
        
        # Find all select elements
        selects = await page.query_selector_all("select")
        logger.info(f"Total select elements on page: {len(selects)}")
        
        # Look for page size indicators
        page_indicators = await page.evaluate("""
            () => {
                const results = [];
                document.querySelectorAll('*').forEach(el => {
                    const text = el.textContent || '';
                    if ((text.includes('25') || text.includes('50') || text.includes('100')) &&
                        (text.includes('per page') || text.includes('show') || text.includes('items'))) {
                        results.push({
                            tag: el.tagName.toLowerCase(),
                            text: text.trim().substring(0, 100),
                            className: el.className || '',
                            id: el.id || ''
                        });
                    }
                });
                return results.slice(0, 10);
            }
        """)
        
        if page_indicators:
            logger.info(f"\n🔍 Found {len(page_indicators)} page size indicators:")
            for indicator in page_indicators:
                logger.info(f"  - {indicator['tag']}: {indicator['text']}")
        
        # Keep browser open for inspection
        logger.info("\n🔍 Browser will stay open for 30 seconds for inspection...")
        logger.info("Check if the page shows more than 25 work orders now")
        await page.wait_for_timeout(30000)
        
        # Cleanup
        await automation.cleanup_session(session_id if session_id in automation.sessions else user_id)
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_with_credentials())