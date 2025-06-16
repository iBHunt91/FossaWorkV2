#!/usr/bin/env python3
"""
Final comprehensive test for WorkFossa scraping with proper error handling
"""

import asyncio
import sys
import logging
import json
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.workfossa_automation import workfossa_automation
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import browser_automation as browser_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_scraping_with_credentials():
    """Test scraping with proper credential handling"""
    
    # Load credentials from file if it exists
    creds_file = Path(__file__).parent.parent.parent / "data" / "credentials" / "test_credentials.json"
    
    if creds_file.exists():
        logger.info(f"Loading credentials from {creds_file}")
        with open(creds_file, 'r') as f:
            credentials = json.load(f)
    else:
        logger.warning("No credentials file found. Using defaults.")
        credentials = {
            'username': 'test@example.com',
            'password': 'test_password'
        }
        logger.info(f"To use real credentials, create {creds_file} with format:")
        logger.info('{"username": "your_email", "password": "your_password"}')
        return
    
    session_id = f"test_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    try:
        logger.info("=== WorkFossa Scraping Test ===")
        logger.info(f"Session ID: {session_id}")
        
        # Initialize browser
        logger.info("\n1. Initializing browser...")
        initialized = await workfossa_automation.initialize_browser()
        if not initialized:
            raise Exception("Failed to initialize browser")
        
        # Create session
        logger.info("\n2. Creating session...")
        session_id = await workfossa_automation.create_session(
            session_id=session_id,
            user_id="test_user",
            credentials=credentials
        )
        
        # Login
        logger.info("\n3. Logging into WorkFossa...")
        login_result = await workfossa_automation.login_to_workfossa(session_id)
        if not login_result['success']:
            raise Exception(f"Login failed: {login_result.get('error', 'Check credentials')}")
        logger.info("   ✓ Login successful!")
        
        # Navigate to work orders
        logger.info("\n4. Navigating to work orders...")
        nav_result = await workfossa_automation.navigate_to_work_orders(session_id)
        if not nav_result['success']:
            raise Exception(f"Navigation failed: {nav_result.get('error')}")
        logger.info("   ✓ Navigation successful!")
        
        # Initialize scraper with browser automation
        logger.info("\n5. Initializing scraper...")
        scraper = WorkFossaScraper(browser_service)  # Use the global browser_service instance
        
        # Get page from session
        session_data = workfossa_automation.sessions.get(session_id)
        if not session_data:
            raise Exception("Session data not found")
        
        page = session_data.get('page')
        if not page:
            raise Exception("Page not found in session")
        
        # Scrape work orders
        logger.info("\n6. Scraping work orders...")
        work_orders = await scraper.scrape_work_orders(
            session_id=session_id,
            page=page
        )
        
        logger.info(f"\n   ✓ Found {len(work_orders)} work orders")
        
        # Display results
        if work_orders:
            logger.info("\n=== Work Orders Summary ===")
            
            # Show first 5 work orders
            for i, wo in enumerate(work_orders[:5], 1):
                logger.info(f"\n{i}. Work Order #{wo.external_id}")
                logger.info(f"   Site: {wo.site_name}")
                logger.info(f"   Address: {wo.address}")
                logger.info(f"   Status: {wo.status}")
                logger.info(f"   Scheduled: {wo.scheduled_date}")
                logger.info(f"   Customer URL: {wo.customer_url or 'Not found'}")
                logger.info(f"   Service: {wo.service_description}")
                
            # Count work orders with customer URLs
            orders_with_urls = [wo for wo in work_orders if wo.customer_url]
            logger.info(f"\n📊 Statistics:")
            logger.info(f"   Total work orders: {len(work_orders)}")
            logger.info(f"   Orders with customer URLs: {len(orders_with_urls)}")
            logger.info(f"   Orders without URLs: {len(work_orders) - len(orders_with_urls)}")
            
            # Test dispenser scraping if we have a customer URL
            if orders_with_urls:
                wo_to_test = orders_with_urls[0]
                logger.info(f"\n7. Testing dispenser scraping for #{wo_to_test.external_id}...")
                logger.info(f"   Customer URL: {wo_to_test.customer_url}")
                
                try:
                    dispensers = await scraper.scrape_dispensers_for_location(
                        session_id=session_id,
                        customer_url=wo_to_test.customer_url
                    )
                    
                    logger.info(f"\n   ✓ Found {len(dispensers)} dispensers")
                    
                    if dispensers:
                        logger.info("\n=== Dispensers ===")
                        for j, disp in enumerate(dispensers, 1):
                            logger.info(f"\n   {j}. Dispenser #{disp.get('number', 'Unknown')}")
                            logger.info(f"      Type: {disp.get('type', 'Unknown')}")
                            logger.info(f"      Fuel Grades: {', '.join(disp.get('fuel_grades', []))}")
                            logger.info(f"      Status: {disp.get('status', 'Unknown')}")
                            
                except Exception as e:
                    logger.error(f"   ❌ Dispenser scraping failed: {e}")
            else:
                logger.warning("\n⚠️  No work orders found with customer URLs for dispenser testing")
                logger.info("This might mean:")
                logger.info("  - The work orders don't have linked customer locations")
                logger.info("  - The page structure has changed")
                logger.info("  - Need to check the selectors in _extract_customer_url method")
                
        else:
            logger.warning("\n⚠️  No work orders found!")
            logger.info("This might mean:")
            logger.info("  - No scheduled work orders in the account")
            logger.info("  - The page didn't load properly")
            logger.info("  - The selectors need updating")
            
            # Take screenshot for debugging
            await page.screenshot(path="debug_no_work_orders.png")
            logger.info("Debug screenshot saved: debug_no_work_orders.png")
        
        logger.info("\n✅ Test completed successfully!")
        
    except Exception as e:
        logger.error(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Try to take debug screenshot
        try:
            session_data = workfossa_automation.sessions.get(session_id)
            if session_data and session_data.get('page'):
                await session_data['page'].screenshot(path=f"debug_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
                logger.info("Debug screenshot saved")
        except:
            pass
        
    finally:
        # Cleanup
        logger.info("\n🧹 Cleaning up...")
        
        if session_id and workfossa_automation.sessions.get(session_id):
            try:
                await workfossa_automation.close_session(session_id)
                logger.info("   ✓ Session closed")
            except Exception as e:
                logger.error(f"   Error closing session: {e}")
        
        if workfossa_automation.browser:
            try:
                await workfossa_automation.browser.close()
                logger.info("   ✓ Browser closed")
            except Exception as e:
                logger.error(f"   Error closing browser: {e}")
        
        if workfossa_automation.playwright:
            try:
                await workfossa_automation.playwright.stop()
                logger.info("   ✓ Playwright stopped")
            except Exception as e:
                logger.error(f"   Error stopping playwright: {e}")

if __name__ == "__main__":
    # Create credentials directory if it doesn't exist
    creds_dir = Path(__file__).parent.parent.parent / "data" / "credentials"
    creds_dir.mkdir(parents=True, exist_ok=True)
    
    asyncio.run(test_scraping_with_credentials())