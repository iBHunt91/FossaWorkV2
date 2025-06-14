#!/usr/bin/env python3
"""
Test script for WorkFossa dispenser scraping
Tests the complete flow: login -> navigate -> scrape work orders -> scrape dispensers
"""

import asyncio
import sys
import logging
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.workfossa_automation import workfossa_automation
from app.services.workfossa_scraper import WorkFossaScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_dispenser_scraping():
    """Test complete dispenser scraping workflow"""
    
    # Test credentials - replace with your actual credentials
    credentials = {
        'username': 'test@example.com',  # Replace with actual email
        'password': 'test_password'       # Replace with actual password
    }
    
    session_id = None
    
    try:
        logger.info("=== Starting WorkFossa Dispenser Scraping Test ===")
        
        # Initialize browser
        logger.info("1. Initializing browser...")
        await workfossa_automation.initialize_browser()
        
        # Create session
        logger.info("2. Creating automation session...")
        session_id = await workfossa_automation.create_session(
            session_id="test_session_001",
            user_id="test_user",
            credentials=credentials
        )
        logger.info(f"   Created session: {session_id}")
        
        # Login to WorkFossa
        logger.info("3. Logging into WorkFossa...")
        login_result = await workfossa_automation.login_to_workfossa(session_id)
        if not login_result['success']:
            raise Exception(f"Login failed: {login_result.get('error', 'Unknown error')}")
        logger.info("   ✓ Login successful")
        
        # Navigate to work orders
        logger.info("4. Navigating to work orders page...")
        nav_result = await workfossa_automation.navigate_to_work_orders(session_id)
        if not nav_result['success']:
            raise Exception(f"Navigation failed: {nav_result.get('error', 'Unknown error')}")
        logger.info("   ✓ Navigation successful")
        
        # Create scraper
        logger.info("5. Initializing scraper...")
        scraper = WorkFossaScraper(workfossa_automation)
        
        # Get the page from the session
        session_data = workfossa_automation.sessions.get(session_id)
        if not session_data:
            raise Exception("Session data not found")
        
        page = session_data.get('page')
        if not page:
            raise Exception("Page not found in session")
        
        # Scrape work orders
        logger.info("6. Scraping work orders...")
        work_orders = await scraper.scrape_work_orders(
            session_id=session_id,
            page=page  # Pass the page directly
        )
        logger.info(f"   Found {len(work_orders)} work orders")
        
        # Display work orders
        if work_orders:
            logger.info("\n=== Work Orders Found ===")
            for i, wo in enumerate(work_orders[:5], 1):  # Show first 5
                logger.info(f"\n{i}. Work Order #{wo.external_id}")
                logger.info(f"   Site: {wo.site_name}")
                logger.info(f"   Address: {wo.address}")
                logger.info(f"   Status: {wo.status}")
                logger.info(f"   Scheduled: {wo.scheduled_date}")
                logger.info(f"   Customer URL: {wo.customer_url}")
                logger.info(f"   Dispensers: {len(wo.dispensers)}")
        
        # Test dispenser scraping for first work order with customer URL
        work_order_with_url = next((wo for wo in work_orders if wo.customer_url), None)
        
        if work_order_with_url:
            logger.info(f"\n7. Testing dispenser scraping for work order #{work_order_with_url.external_id}...")
            logger.info(f"   Customer URL: {work_order_with_url.customer_url}")
            
            # Scrape dispensers
            dispensers = await scraper.scrape_dispensers_for_location(
                session_id=session_id,
                customer_url=work_order_with_url.customer_url
            )
            
            logger.info(f"   Found {len(dispensers)} dispensers")
            
            # Display dispensers
            if dispensers:
                logger.info("\n=== Dispensers Found ===")
                for i, disp in enumerate(dispensers, 1):
                    logger.info(f"\n{i}. Dispenser #{disp.get('number', 'Unknown')}")
                    logger.info(f"   Type: {disp.get('type', 'Unknown')}")
                    logger.info(f"   Fuel Grades: {', '.join(disp.get('fuel_grades', []))}")
                    logger.info(f"   Status: {disp.get('status', 'Unknown')}")
        else:
            logger.warning("No work orders found with customer URLs for dispenser testing")
        
        logger.info("\n=== Test completed successfully! ===")
        
    except Exception as e:
        logger.error(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup
        if session_id and workfossa_automation.sessions.get(session_id):
            logger.info("\nCleaning up session...")
            await workfossa_automation.close_session(session_id)
        
        # Close browser
        if workfossa_automation.browser:
            logger.info("Closing browser...")
            await workfossa_automation.browser.close()
        
        if workfossa_automation.playwright:
            logger.info("Stopping Playwright...")
            await workfossa_automation.playwright.stop()

if __name__ == "__main__":
    asyncio.run(test_dispenser_scraping())