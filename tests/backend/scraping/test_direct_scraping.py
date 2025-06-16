#!/usr/bin/env python3
"""Test direct scraping without API"""

import asyncio
import sys
import os

# Add the backend directory to the path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.browser_automation import browser_automation
from app.services.workfossa_scraper import workfossa_scraper
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_scraping():
    """Test scraping directly"""
    credentials = {
        "username": "bruce.hunt@owlservices.com",
        "password": "Crompco0511"
    }
    session_id = "test_scrape_123"
    
    try:
        # Initialize browser
        logger.info("1. Initializing browser...")
        success = await browser_automation.initialize()
        if not success:
            logger.error("Failed to initialize browser")
            return
        
        # Create session
        logger.info("2. Creating browser session...")
        session_created = await browser_automation.create_session(session_id)
        if not session_created:
            logger.error("Failed to create browser session")
            return
        
        # Login to WorkFossa
        logger.info("3. Logging in to WorkFossa...")
        login_success = await browser_automation.navigate_to_workfossa(session_id, credentials)
        if not login_success:
            logger.error("Failed to login to WorkFossa")
            await browser_automation.close_session(session_id)
            return
        
        # Scrape work orders
        logger.info("4. Scraping work orders...")
        work_orders = await workfossa_scraper.scrape_work_orders(session_id)
        
        logger.info(f"\nFound {len(work_orders)} work orders:")
        for wo in work_orders[:5]:  # Show first 5
            logger.info(f"  - {wo.site_name} ({wo.external_id})")
        
        # Close session
        await browser_automation.close_session(session_id)
        
    except Exception as e:
        logger.error(f"Error during scraping: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        await browser_automation.cleanup()

if __name__ == "__main__":
    asyncio.run(test_scraping())