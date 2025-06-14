#!/usr/bin/env python3
"""Test scraping synchronously to debug issues"""

import asyncio
import sys
import os
import logging
from datetime import datetime

# Setup path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from app.services.browser_automation import browser_automation
from app.services.workfossa_scraper import workfossa_scraper
from app.database import SessionLocal
from app.models.user_models import User, UserCredential
from app.core_models import WorkOrder

logger = logging.getLogger(__name__)

async def test_scraping_sync():
    """Test scraping synchronously"""
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Get database session
    db = SessionLocal()
    
    try:
        # Get user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User not found: {user_id}")
            return
        
        logger.info(f"Found user: {user.email}")
        
        # Get credentials
        credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa"
        ).first()
        
        if not credential:
            logger.error("No WorkFossa credentials found")
            return
        
        logger.info(f"Found credentials for: {credential.username}")
        
        credentials = {
            "username": credential.username,
            "password": credential.password
        }
        
        # Now run the scraping logic
        session_id = f"test_sync_{datetime.now().timestamp()}"
        
        logger.info("1. Initializing browser...")
        if not browser_automation.browser:
            success = await browser_automation.initialize()
            if not success:
                logger.error("Failed to initialize browser")
                return
            logger.info("Browser initialized")
        
        logger.info("2. Creating session...")
        session_created = await browser_automation.create_session(session_id)
        if not session_created:
            logger.error("Failed to create session")
            return
        logger.info("Session created")
        
        logger.info("3. Logging in to WorkFossa...")
        
        # Try to navigate manually first to see what's happening
        page = browser_automation.pages.get(session_id)
        if page:
            logger.info("Navigating to WorkFossa...")
            await page.goto("https://app.workfossa.com", wait_until="networkidle")
            
            # Take screenshot
            screenshot_path = f"data/screenshots/debug_login_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            await page.screenshot(path=screenshot_path)
            logger.info(f"Screenshot saved to: {screenshot_path}")
            
            # Check page content
            title = await page.title()
            logger.info(f"Page title: {title}")
            
            # Try different selectors
            selectors_to_try = [
                "input[name='email']",
                "input[type='email']",
                "input[name='username']",
                "#email",
                "#username",
                "input[placeholder*='email' i]",
                "input[placeholder*='username' i]"
            ]
            
            found_selector = None
            for selector in selectors_to_try:
                try:
                    if await page.locator(selector).count() > 0:
                        logger.info(f"Found input with selector: {selector}")
                        found_selector = selector
                        break
                except:
                    pass
            
            if not found_selector:
                logger.error("Could not find login input field")
                # Get page content for debugging
                content = await page.content()
                logger.info(f"Page HTML preview: {content[:500]}...")
            
            # Check for submit buttons
            button_selectors = [
                "button[type='submit']",
                "input[type='submit']", 
                "button",
                "input[type='button']",
                ".btn",
                ".button"
            ]
            
            logger.info("Looking for buttons...")
            for selector in button_selectors:
                try:
                    count = await page.locator(selector).count()
                    if count > 0:
                        logger.info(f"Found {count} elements with selector: {selector}")
                        # Get text/value of first element
                        element = page.locator(selector).first
                        try:
                            text = await element.text_content()
                            if text:
                                logger.info(f"  Text: {text.strip()}")
                        except:
                            pass
                        try:
                            value = await element.get_attribute("value")
                            if value:
                                logger.info(f"  Value: {value}")
                        except:
                            pass
                except Exception as e:
                    logger.debug(f"Error checking {selector}: {e}")
        
        login_success = await browser_automation.navigate_to_workfossa(session_id, credentials)
        if not login_success:
            logger.error("Failed to login")
            await browser_automation.close_session(session_id)
            return
        logger.info("Login successful")
        
        logger.info("4. Scraping work orders...")
        work_orders = await workfossa_scraper.scrape_work_orders(session_id)
        logger.info(f"Found {len(work_orders)} work orders")
        
        # Show some results
        for i, wo in enumerate(work_orders[:3]):
            logger.info(f"  Work Order {i+1}: {wo.site_name} ({wo.external_id})")
        
        # Close session
        await browser_automation.close_session(session_id)
        
        logger.info("Scraping test completed!")
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        await browser_automation.cleanup()

if __name__ == "__main__":
    asyncio.run(test_scraping_sync())