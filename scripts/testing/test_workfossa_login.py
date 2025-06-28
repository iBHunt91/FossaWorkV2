#\!/usr/bin/env python3
"""
Simple test to verify WorkFossa login is working
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.services.browser_automation import BrowserAutomationService
from app.services.logging_service import get_logger
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL
from app.models.user_models import UserCredential

logger = get_logger("test.login")

async def test_login():
    """Test WorkFossa login"""
    # Create database session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Get user credentials (use the test user)
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not user_credential:
            logger.error("No WorkFossa credentials found")
            return
            
        credentials = {
            'username': user_credential.username,
            'password': user_credential.password
        }
        
        logger.info(f"Found credentials for user: {credentials['username']}")
        
        # Create browser automation instance with visible browser
        browser_automation = BrowserAutomationService(headless=False)
        
        # Create session
        session_id = "test_login"
        
        # Create browser session
        logger.info("Creating browser session...")
        await browser_automation.create_session(session_id)
        
        # Login to WorkFossa
        logger.info("Attempting to login to WorkFossa...")
        result = await browser_automation.navigate_to_workfossa(session_id, credentials)
        
        if result:
            logger.info("✅ Login successful\!")
            
            # Get the page
            page = browser_automation.sessions[session_id]["page"]
            
            # Check current URL
            current_url = page.url
            logger.info(f"Current URL: {current_url}")
            
            # Check page title
            title = await page.title()
            logger.info(f"Page title: {title}")
            
            # Take screenshot
            await page.screenshot(path="/tmp/workfossa_login_success.png")
            logger.info("Screenshot saved to /tmp/workfossa_login_success.png")
            
            # Wait a moment to see the page
            await asyncio.sleep(5)
            
            # Try navigating to work orders
            logger.info("Navigating to work orders list...")
            await page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
            
            # Check if we made it to work orders
            work_orders_url = page.url
            logger.info(f"Work orders URL: {work_orders_url}")
            
            # Take another screenshot
            await page.screenshot(path="/tmp/workfossa_work_orders.png")
            logger.info("Screenshot saved to /tmp/workfossa_work_orders.png")
            
            # Check for work order elements
            logger.info("Checking for work order elements...")
            
            # Wait for the page to load
            await page.wait_for_timeout(3000)
            
            # Try basic selectors
            selectors_to_try = [
                "table",
                "tbody",
                "tr",
                "[class*='table']",
                "[class*='row']",
                "[class*='work']",
                "[class*='order']"
            ]
            
            for selector in selectors_to_try:
                elements = await page.query_selector_all(selector)
                if elements:
                    logger.info(f"Found {len(elements)} elements with selector: {selector}")
            
            # Get page content for debugging
            page_content = await page.content()
            logger.info(f"Page content length: {len(page_content)}")
            
            # Save page content
            with open("/tmp/workfossa_work_orders.html", "w") as f:
                f.write(page_content)
            logger.info("Page content saved to /tmp/workfossa_work_orders.html")
            
        else:
            logger.error("❌ Login failed\!")
            
        # Wait for user input
        input("\nPress Enter to close browser and exit...")
        
    except Exception as e:
        logger.error(f"Error during test: {e}", exc_info=True)
    finally:
        # Cleanup
        try:
            await browser_automation.close_session(session_id)
        except:
            pass
        db.close()

if __name__ == "__main__":
    asyncio.run(test_login())
EOF < /dev/null