#!/usr/bin/env python3
"""
Test script specifically for customer URL extraction from work orders
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
    level=logging.DEBUG,  # Set to DEBUG for more details
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_customer_url_extraction():
    """Test customer URL extraction from work orders"""
    
    # Test credentials - replace with your actual credentials
    credentials = {
        'username': 'test@example.com',  # Replace with actual email
        'password': 'test_password'       # Replace with actual password
    }
    
    session_id = None
    
    try:
        logger.info("=== Testing Customer URL Extraction ===")
        
        # Initialize browser
        logger.info("1. Initializing browser...")
        await workfossa_automation.initialize_browser()
        
        # Create session
        logger.info("2. Creating session...")
        session_id = await workfossa_automation.create_session(
            session_id="test_url_extraction",
            user_id="test_user",
            credentials=credentials
        )
        
        # Login
        logger.info("3. Logging in...")
        login_result = await workfossa_automation.login_to_workfossa(session_id)
        if not login_result['success']:
            raise Exception(f"Login failed: {login_result.get('error')}")
        
        # Navigate to work orders
        logger.info("4. Navigating to work orders...")
        nav_result = await workfossa_automation.navigate_to_work_orders(session_id)
        if not nav_result['success']:
            raise Exception(f"Navigation failed: {nav_result.get('error')}")
        
        # Get page
        session_data = workfossa_automation.sessions.get(session_id)
        page = session_data.get('page')
        
        # Wait for work orders to load
        logger.info("5. Waiting for work orders to load...")
        await page.wait_for_selector('.work-order-item, tr[data-order-id], .job-row', timeout=10000)
        
        # Extract URLs manually to debug
        logger.info("6. Extracting customer URLs...")
        
        # Try multiple selectors for work order links
        selectors = [
            'a[href*="/customers/"][href*="/locations/"]',
            'a[href*="/app/customers/"]',
            '.customer-link',
            'td a[href*="/customers/"]'
        ]
        
        customer_urls = []
        for selector in selectors:
            logger.debug(f"   Trying selector: {selector}")
            try:
                links = await page.query_selector_all(selector)
                logger.debug(f"   Found {len(links)} links with selector: {selector}")
                
                for link in links:
                    href = await link.get_attribute('href')
                    if href:
                        full_url = f"https://app.workfossa.com{href}" if href.startswith('/') else href
                        customer_urls.append(full_url)
                        logger.info(f"   ✓ Found customer URL: {full_url}")
            except Exception as e:
                logger.debug(f"   Error with selector {selector}: {e}")
        
        # Also check for customer links in table cells
        logger.info("7. Checking table structure...")
        try:
            # Get all table rows
            rows = await page.query_selector_all('tr[data-order-id], .work-order-row, tbody tr')
            logger.info(f"   Found {len(rows)} table rows")
            
            for i, row in enumerate(rows[:5]):  # Check first 5 rows
                logger.debug(f"\n   Row {i+1}:")
                
                # Get all links in the row
                links = await row.query_selector_all('a')
                for link in links:
                    href = await link.get_attribute('href')
                    text = await link.text_content()
                    if href and '/customers/' in href:
                        full_url = f"https://app.workfossa.com{href}" if href.startswith('/') else href
                        logger.info(f"     ✓ Customer link: {text.strip()} -> {full_url}")
                        customer_urls.append(full_url)
        except Exception as e:
            logger.error(f"   Error checking table structure: {e}")
        
        # Summary
        logger.info(f"\n=== Summary ===")
        logger.info(f"Total unique customer URLs found: {len(set(customer_urls))}")
        
        if customer_urls:
            logger.info("\nUnique URLs:")
            for url in set(customer_urls):
                logger.info(f"  - {url}")
        else:
            logger.warning("No customer URLs found!")
            
            # Take screenshot for debugging
            logger.info("Taking screenshot for debugging...")
            await page.screenshot(path="debug_work_orders_page.png")
            logger.info("Screenshot saved as debug_work_orders_page.png")
        
    except Exception as e:
        logger.error(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup
        if session_id and workfossa_automation.sessions.get(session_id):
            await workfossa_automation.close_session(session_id)
        
        if workfossa_automation.browser:
            await workfossa_automation.browser.close()
        
        if workfossa_automation.playwright:
            await workfossa_automation.playwright.stop()

if __name__ == "__main__":
    asyncio.run(test_customer_url_extraction())