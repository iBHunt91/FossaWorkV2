#!/usr/bin/env python3
"""Direct test of scraping functionality"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger(__name__)

async def test_scraping():
    """Test the scraping functionality directly"""
    
    logger.info("Starting direct scraping test...")
    
    try:
        # Import the services
        from app.services.workfossa_automation import WorkFossaAutomationService
        from app.services.workfossa_scraper import workfossa_scraper
        
        # Test credentials
        credentials = {
            "username": "bruce.hunt@owlservices.com",
            "password": "Crompco0511"
        }
        
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        session_id = f"test_scrape_{user_id}"
        
        # Create automation service
        logger.info("Creating WorkFossa automation service...")
        automation = WorkFossaAutomationService(headless=True)
        
        # Test if create_session method exists
        if hasattr(automation, 'create_session'):
            logger.info("✅ create_session method exists")
        else:
            logger.error("❌ create_session method not found!")
            logger.info(f"Available methods: {[m for m in dir(automation) if not m.startswith('_')]}")
            return
        
        # Create session
        logger.info("Creating browser session...")
        await automation.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        logger.info("✅ Browser session created")
        
        # Login
        logger.info("Logging in to WorkFossa...")
        login_success = await automation.login_to_workfossa(session_id)
        if not login_success:
            logger.error("❌ Failed to login to WorkFossa")
            await automation.cleanup_session(session_id)
            return
        logger.info("✅ Successfully logged in")
        
        # Get the page
        session_data = automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            logger.error("❌ No page found in session")
            await automation.cleanup_session(session_id)
            return
        
        page = session_data['page']
        
        # Scrape work orders
        logger.info("Starting work order scraping...")
        work_orders = await workfossa_scraper.scrape_work_orders(session_id, page=page)
        
        logger.info(f"✅ Scraped {len(work_orders)} work orders")
        
        # Show details of first few work orders
        for i, wo in enumerate(work_orders[:3]):
            logger.info(f"\nWork Order {i+1}:")
            logger.info(f"  ID: {wo.external_id}")
            logger.info(f"  Site: {wo.site_name}")
            logger.info(f"  Address: {wo.address}")
            logger.info(f"  Service: {wo.service_code} - {wo.service_description}")
            logger.info(f"  Dispensers: {len(wo.dispensers)}")
            
            # Show dispenser details
            for j, disp in enumerate(wo.dispensers[:2]):
                logger.info(f"    Dispenser {j+1}: {disp.get('dispenser_number', 'N/A')} - {disp.get('dispenser_type', 'Unknown')}")
        
        # Cleanup
        await automation.cleanup_session(session_id)
        logger.info("\n✅ Test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_scraping())