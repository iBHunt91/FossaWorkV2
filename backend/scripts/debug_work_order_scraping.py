#!/usr/bin/env python3
"""
Debug script to diagnose work order scraping issues
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.services.browser_automation import BrowserAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.logging_service import get_logger
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL
from app.models.user_models import UserCredential

logger = get_logger("debug.work_orders")

async def debug_work_order_scraping():
    """Debug work order scraping issues"""
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
        
        # Create browser automation instance with visible browser for debugging
        browser_automation = BrowserAutomationService(headless=False)
        
        # Create session
        session_id = "debug_session"
        
        # Create browser session
        logger.info("Creating browser session...")
        await browser_automation.create_session(session_id)
        
        # Login to WorkFossa
        logger.info("Logging in to WorkFossa...")
        await browser_automation.navigate_to_workfossa(session_id, credentials)
        
        # Wait a bit to ensure login is complete
        await asyncio.sleep(3)
        
        # Get the page
        page = browser_automation.sessions[session_id]["page"]
        
        # Navigate to work orders list
        logger.info("Navigating to work orders list...")
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Check page title
        title = await page.title()
        logger.info(f"Page title: {title}")
        
        # Try to change page size
        logger.info("Attempting to change page size...")
        
        # First, let's see what's on the page
        # Check for the page size dropdown
        page_size_selectors = [
            'div.ks-select-selection:has-text("Show 25")',
            'div.ks-select-selection:has-text("Show")',
            'select[name="pageSize"]',
            '.page-size-selector',
            'div[class*="select"]',
            'button:has-text("Show")'
        ]
        
        dropdown_found = False
        for selector in page_size_selectors:
            try:
                element = await page.wait_for_selector(selector, timeout=5000)
                if element:
                    logger.info(f"Found dropdown with selector: {selector}")
                    dropdown_found = True
                    
                    # Try to click it
                    await element.click()
                    await asyncio.sleep(1)
                    
                    # Look for 100 option
                    option_selectors = [
                        'div.ks-select-dropdown-option:has-text("100")',
                        'li:has-text("100")',
                        'option[value="100"]',
                        '*:has-text("100")'
                    ]
                    
                    for opt_selector in option_selectors:
                        try:
                            option = await page.wait_for_selector(opt_selector, timeout=2000)
                            if option:
                                logger.info(f"Found 100 option with selector: {opt_selector}")
                                await option.click()
                                await asyncio.sleep(2)
                                break
                        except:
                            continue
                    break
            except Exception as e:
                logger.debug(f"Selector {selector} failed: {e}")
                
        if not dropdown_found:
            logger.warning("Could not find page size dropdown")
            
        # Check for work order elements
        logger.info("Looking for work order elements...")
        
        work_order_selectors = [
            'tbody tr',
            'tr.work-order-row',
            'div[data-work-order-id]',
            'table tbody tr',
            '.work-order-item',
            'div.ks-table-body tr'
        ]
        
        for selector in work_order_selectors:
            try:
                elements = await page.query_selector_all(selector)
                if elements:
                    logger.info(f"Found {len(elements)} work orders with selector: {selector}")
                    
                    # Get first element text
                    if len(elements) > 0:
                        first_text = await elements[0].text_content()
                        logger.info(f"First element text: {first_text[:200]}...")
                    break
                else:
                    logger.debug(f"No elements found with selector: {selector}")
            except Exception as e:
                logger.debug(f"Error with selector {selector}: {e}")
                
        # Get page HTML structure
        logger.info("Getting page structure...")
        page_content = await page.content()
        
        # Save page content for analysis
        with open("/tmp/workfossa_page.html", "w") as f:
            f.write(page_content)
        logger.info("Saved page content to /tmp/workfossa_page.html")
        
        # Check for specific WorkFossa elements
        has_table = "table" in page_content.lower()
        has_tbody = "tbody" in page_content.lower()
        has_work_order_text = "work order" in page_content.lower()
        
        logger.info(f"Page analysis - Has table: {has_table}, Has tbody: {has_tbody}, Has 'work order' text: {has_work_order_text}")
        
        # Take screenshot
        await page.screenshot(path="/tmp/workfossa_debug.png")
        logger.info("Screenshot saved to /tmp/workfossa_debug.png")
        
        # Wait for user to inspect
        input("\nPress Enter to close browser and exit...")
        
    except Exception as e:
        logger.error(f"Error during debugging: {e}", exc_info=True)
    finally:
        # Cleanup
        try:
            await browser_automation.close_session(session_id)
        except:
            pass
        db.close()

if __name__ == "__main__":
    asyncio.run(debug_work_order_scraping())