#!/usr/bin/env python3
"""
Force test the page size dropdown detection by calling scraper directly
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set up very detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

# Get all loggers we care about
logger = logging.getLogger(__name__)
scraper_logger = logging.getLogger('app.services.workfossa_scraper')
scraper_logger.setLevel(logging.DEBUG)

# Also log Playwright
playwright_logger = logging.getLogger('playwright')
playwright_logger.setLevel(logging.INFO)

async def force_test():
    """Force test the page size functionality"""
    
    logger.info("🧪 FORCE TEST: Page Size Dropdown Detection")
    logger.info("="*60)
    
    try:
        from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials
        from app.services.workfossa_scraper import workfossa_scraper
        
        # Create automation service
        logger.info("Creating automation service...")
        automation_service = WorkFossaAutomationService(headless=False)
        
        # Initialize browser
        logger.info("Initializing browser...")
        await automation_service.initialize_browser()
        
        # Create session
        session_id = "force_test_page_size"
        user_id = "test_user"
        
        # You need to provide real credentials here
        logger.info("⚠️  IMPORTANT: Edit this script to add real WorkFossa credentials")
        logger.info("Replace the email and password below with valid credentials:")
        
        email = "test@example.com"  # REPLACE WITH REAL EMAIL
        password = "test_password"   # REPLACE WITH REAL PASSWORD
        
        if email == "test@example.com":
            logger.error("❌ You must edit this script to add real WorkFossa credentials!")
            logger.info("Edit the email and password variables above")
            return
        
        credentials = WorkFossaCredentials(email=email, password=password, user_id=user_id)
        
        logger.info(f"Creating session: {session_id}")
        await automation_service.create_session(session_id, user_id, credentials)
        
        # Login
        logger.info("Logging in to WorkFossa...")
        login_success = await automation_service.login_to_workfossa(session_id)
        
        if not login_success:
            logger.error("❌ Login failed!")
            return
        
        logger.info("✅ Login successful!")
        
        # Get the page
        session = automation_service.sessions[session_id]
        page = session['page']
        
        # Navigate to work orders
        work_orders_url = "https://app.workfossa.com/app/work/list"
        logger.info(f"Navigating to: {work_orders_url}")
        await page.goto(work_orders_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Now force call the page size method
        logger.info("="*60)
        logger.info("🔧 FORCING PAGE SIZE DETECTION TEST")
        logger.info("="*60)
        
        # Call the scraper's page size method directly
        result = await workfossa_scraper._set_page_size_to_100(page)
        
        logger.info("="*60)
        logger.info(f"RESULT: {result}")
        logger.info("="*60)
        
        if result:
            logger.info("✅ PAGE SIZE CHANGE SUCCESSFUL!")
        else:
            logger.error("❌ PAGE SIZE CHANGE FAILED!")
            
            # Do manual inspection
            logger.info("Performing manual inspection...")
            
            # Count selects
            selects = await page.query_selector_all("select")
            logger.info(f"Total <select> elements on page: {len(selects)}")
            
            # Get info about each select
            for i, select in enumerate(selects):
                info = await select.evaluate("""
                    el => ({
                        name: el.name || '',
                        id: el.id || '',
                        className: el.className || '',
                        value: el.value || '',
                        optionCount: el.options.length,
                        options: Array.from(el.options).map(opt => ({
                            value: opt.value,
                            text: opt.textContent
                        }))
                    })
                """)
                logger.info(f"Select {i+1}: {info}")
            
        # Take final screenshot
        await page.screenshot(path="force_test_final.png", full_page=True)
        logger.info("📸 Final screenshot: force_test_final.png")
        
        # Keep browser open for inspection
        logger.info("Browser will stay open for 30 seconds...")
        await page.wait_for_timeout(30000)
        
        # Cleanup
        await automation_service.cleanup_session(session_id)
        
    except Exception as e:
        logger.error(f"❌ Force test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(force_test())