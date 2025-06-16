#!/usr/bin/env python3
"""
Final test of the WorkFossa custom dropdown handling
Tests the updated scraper with the specific HTML structure provided
"""

import asyncio
import logging
import sys
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

async def test_custom_dropdown():
    """Test the WorkFossa custom dropdown handling"""
    
    logger.info("🧪 Testing WorkFossa Custom Dropdown Handling")
    logger.info("="*60)
    
    try:
        from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials
        from app.services.workfossa_scraper import workfossa_scraper
        from app.services.credential_manager import CredentialManager
        
        # Get the actual user's credentials
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        cred_manager = CredentialManager()
        user_cred_obj = cred_manager.retrieve_credentials(user_id)
        
        if not user_cred_obj:
            logger.error(f"❌ User credentials not found for user: {user_id}")
            return
            
        logger.info(f"✅ Found credentials for user: {user_id}")
        
        # Convert to dict format expected by create_session
        user_creds = {
            'username': user_cred_obj.username,
            'password': user_cred_obj.password
        }
        
        # Create automation service with visible browser
        automation = WorkFossaAutomationService(headless=False)
        await automation.initialize_browser()
        
        # Create session
        session_id = "test_custom_dropdown"
        
        # Create credentials object
        credentials = WorkFossaCredentials(
            email=user_creds['username'],
            password=user_creds['password'],
            user_id=user_id
        )
        
        # Create session
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
        await page.screenshot(path="test_before_custom_dropdown.png")
        logger.info("📸 Screenshot saved: test_before_custom_dropdown.png")
        
        # Count initial work orders
        initial_count = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('tbody tr');
                return rows.length;
            }
        """)
        logger.info(f"📊 Initial work order count: {initial_count}")
        
        # Verify the custom dropdown exists
        logger.info("\n🔍 VERIFYING CUSTOM DROPDOWN EXISTS...")
        dropdown_exists = await page.evaluate("""
            () => {
                const dropdown = document.querySelector("div.ks-select-selection:has-text('Show 25')");
                if (dropdown) {
                    return {
                        exists: true,
                        text: dropdown.textContent.trim(),
                        className: dropdown.className,
                        innerHTML: dropdown.innerHTML
                    };
                }
                
                // Alternative: look for any element with that structure
                const allDivs = document.querySelectorAll('div.ks-select-selection');
                const found = [];
                allDivs.forEach(div => {
                    found.push({
                        text: div.textContent.trim(),
                        className: div.className,
                        innerHTML: div.innerHTML
                    });
                });
                
                return {
                    exists: false,
                    alternativesFound: found
                };
            }
        """)
        
        if dropdown_exists.get('exists'):
            logger.info(f"✅ Custom dropdown found: {dropdown_exists.get('text')}")
        else:
            logger.warning(f"❌ Custom dropdown not found with exact selector")
            if dropdown_exists.get('alternativesFound'):
                logger.info(f"Found {len(dropdown_exists['alternativesFound'])} alternatives:")
                for alt in dropdown_exists['alternativesFound']:
                    logger.info(f"  - {alt}")
        
        # Test the page size method directly
        logger.info("\n" + "="*60)
        logger.info("🔧 TESTING CUSTOM DROPDOWN HANDLING")
        logger.info("="*60)
        
        # Call the scraper's page size method
        result = await workfossa_scraper._set_page_size_to_100(page)
        
        logger.info("="*60)
        logger.info(f"RESULT: {'✅ SUCCESS' if result else '❌ FAILED'}")
        logger.info("="*60)
        
        # Wait for page to reload if successful
        if result:
            logger.info("⏳ Waiting for page to reload after dropdown change...")
            await page.wait_for_timeout(5000)
        
        # Take screenshot after attempt
        await page.screenshot(path="test_after_custom_dropdown.png")
        logger.info("📸 Screenshot saved: test_after_custom_dropdown.png")
        
        # Count work orders after change
        final_count = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('tbody tr');
                return rows.length;
            }
        """)
        logger.info(f"📊 Final work order count: {final_count}")
        
        # Check if dropdown text changed
        dropdown_after = await page.evaluate("""
            () => {
                const dropdown = document.querySelector('div.ks-select-selection');
                return dropdown ? dropdown.textContent.trim() : 'not found';
            }
        """)
        logger.info(f"📋 Dropdown text after change: {dropdown_after}")
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("📊 SUMMARY:")
        logger.info(f"  - Initial work orders: {initial_count}")
        logger.info(f"  - Final work orders: {final_count}")
        logger.info(f"  - Dropdown text: {dropdown_after}")
        
        if final_count > initial_count:
            logger.info(f"  ✅ SUCCESS! Work orders increased from {initial_count} to {final_count}")
            logger.info(f"  ✅ Dropdown changed to: {dropdown_after}")
        elif dropdown_after == "Show 100":
            logger.info(f"  ✅ SUCCESS! Dropdown changed to 'Show 100'")
            logger.info(f"  ⚠️  Work order count didn't change - may need page refresh")
        else:
            logger.info(f"  ❌ FAILED! No change detected")
            logger.info(f"  ❌ Dropdown still shows: {dropdown_after}")
        logger.info("="*60)
        
        # Keep browser open for inspection
        logger.info("\n🔍 Browser will stay open for 30 seconds for manual inspection...")
        logger.info("Check if the dropdown shows 'Show 100' and if there are more work orders")
        await page.wait_for_timeout(30000)
        
        # Cleanup
        await automation.cleanup_session(session_id if session_id in automation.sessions else user_id)
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_custom_dropdown())