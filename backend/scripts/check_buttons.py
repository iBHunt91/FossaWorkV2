#!/usr/bin/env python3
"""Quick check for WorkFossa login buttons"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.browser_automation import browser_automation
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_buttons():
    """Check what buttons are on WorkFossa login page"""
    session_id = "button_check"
    
    try:
        # Initialize and create session
        await browser_automation.initialize()
        await browser_automation.create_session(session_id)
        
        page = browser_automation.pages.get(session_id)
        if not page:
            logger.error("No page created")
            return
            
        # Navigate to WorkFossa
        logger.info("Navigating to WorkFossa...")
        await page.goto("https://app.workfossa.com", wait_until="networkidle")
        
        # Wait a bit for page to load
        await page.wait_for_timeout(2000)
        
        # Take screenshot
        screenshot_path = "data/screenshots/button_check.png"
        await page.screenshot(path=screenshot_path)
        logger.info(f"Screenshot saved to: {screenshot_path}")
        
        # Check various button selectors
        selectors = [
            "button[type='submit']",
            "input[type='submit']",
            "button",
            "input[type='button']",
            ".btn-primary",
            ".btn",
            "form button",
            "form input[type='submit']",
            "[type='submit']"
        ]
        
        logger.info("\nChecking for buttons:")
        for selector in selectors:
            try:
                count = await page.locator(selector).count()
                if count > 0:
                    logger.info(f"\n✓ Found {count} elements with selector: '{selector}'")
                    
                    # Check first element
                    element = page.locator(selector).first
                    
                    # Get attributes
                    attrs = {}
                    for attr in ['type', 'value', 'class', 'id', 'name']:
                        val = await element.get_attribute(attr)
                        if val:
                            attrs[attr] = val
                    
                    if attrs:
                        logger.info(f"  Attributes: {attrs}")
                    
                    # Get text
                    try:
                        text = await element.text_content()
                        if text and text.strip():
                            logger.info(f"  Text: '{text.strip()}'")
                    except:
                        pass
                        
                    # Get inner HTML
                    try:
                        html = await element.inner_html()
                        if html and len(html) < 100:
                            logger.info(f"  HTML: {html}")
                    except:
                        pass
                        
            except Exception as e:
                logger.debug(f"Error with {selector}: {e}")
        
        # Also check the form structure
        logger.info("\nChecking form structure:")
        forms = await page.locator("form").count()
        logger.info(f"Found {forms} forms on the page")
        
        if forms > 0:
            form = page.locator("form").first
            # Check form action
            action = await form.get_attribute("action")
            method = await form.get_attribute("method")
            logger.info(f"Form action: {action}")
            logger.info(f"Form method: {method}")
        
        await browser_automation.close_session(session_id)
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await browser_automation.cleanup()

if __name__ == "__main__":
    asyncio.run(check_buttons())