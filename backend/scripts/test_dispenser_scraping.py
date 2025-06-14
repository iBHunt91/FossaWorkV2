#!/usr/bin/env python3
"""
Test dispenser scraping functionality
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger(__name__)

# Also set scraper logger to INFO
scraper_logger = logging.getLogger('app.services.workfossa_scraper')
scraper_logger.setLevel(logging.INFO)

dispenser_logger = logging.getLogger('app.services.dispenser_scraper')
dispenser_logger.setLevel(logging.INFO)


async def test_dispenser_scraping():
    """Test the dispenser scraping functionality"""
    
    logger.info("🧪 Testing Dispenser Scraping")
    logger.info("="*60)
    
    try:
        from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials
        from app.services.workfossa_scraper import workfossa_scraper
        from app.services.credential_manager import CredentialManager
        
        # Get the actual user's credentials
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        cred_manager = CredentialManager()
        user_cred_obj = cred_manager.retrieve_credentials(user_id)
        
        if not user_cred_obj:
            logger.error(f"❌ User credentials not found for user: {user_id}")
            return
            
        logger.info(f"✅ Found credentials for user: {user_id}")
        
        # Convert to dict format
        user_creds = {
            'username': user_cred_obj.username,
            'password': user_cred_obj.password
        }
        
        # Create automation service with visible browser
        automation = WorkFossaAutomationService(headless=False)
        await automation.initialize_browser()
        
        # Create credentials object
        credentials = WorkFossaCredentials(
            email=user_creds['username'],
            password=user_creds['password'],
            user_id=user_id
        )
        
        # Create session
        await automation.create_automation_session(user_id, credentials)
        
        # Login to WorkFossa
        logger.info("🔐 Logging in to WorkFossa...")
        login_success = await automation.login_to_workfossa(user_id)
        
        if not login_success:
            logger.error("❌ Login failed!")
            return
            
        logger.info("✅ Login successful!")
        
        # First, scrape work orders to get some to test with
        logger.info("\n📋 SCRAPING WORK ORDERS...")
        work_orders = await workfossa_scraper.scrape_work_orders(
            session_id=user_id,
            date_range=None,
            page=automation.sessions[user_id]['page']
        )
        
        logger.info(f"Found {len(work_orders)} work orders")
        
        # Find work orders with dispenser service codes
        dispenser_work_orders = []
        for wo in work_orders:
            service_code = wo.service_code
            if service_code in ["2861", "2862", "3146", "3002"]:
                dispenser_work_orders.append(wo)
                logger.info(f"  - {wo.external_id}: {wo.site_name} (Service code: {service_code})")
        
        if not dispenser_work_orders:
            logger.warning("⚠️  No work orders found with dispenser service codes")
            logger.info("Looking for any work orders...")
            if work_orders:
                dispenser_work_orders = work_orders[:3]  # Take first 3
        
        if not dispenser_work_orders:
            logger.error("❌ No work orders available for testing")
            return
        
        # Test dispenser scraping on first work order
        test_wo = dispenser_work_orders[0]
        logger.info(f"\n🔧 TESTING DISPENSER SCRAPING FOR: {test_wo.external_id}")
        logger.info(f"  Site: {test_wo.site_name}")
        logger.info(f"  Visit URL: {test_wo.visit_url}")
        
        # Test the dispenser scraping
        dispensers = await workfossa_scraper.scrape_dispenser_details(
            session_id=user_id,
            work_order_id=test_wo.id,
            visit_url=test_wo.visit_url
        )
        
        logger.info(f"\n✅ DISPENSER SCRAPING RESULTS:")
        logger.info(f"Found {len(dispensers)} dispensers")
        
        for i, dispenser in enumerate(dispensers):
            logger.info(f"\n📊 Dispenser {i+1}:")
            logger.info(f"  - Number: {dispenser.get('dispenser_number')}")
            logger.info(f"  - Title: {dispenser.get('title')}")
            logger.info(f"  - Type: {dispenser.get('dispenser_type')}")
            logger.info(f"  - Serial: {dispenser.get('serial_number')}")
            logger.info(f"  - Make: {dispenser.get('make')}")
            logger.info(f"  - Model: {dispenser.get('model')}")
            
            fuel_grades = dispenser.get('fuel_grades', {})
            if fuel_grades:
                logger.info(f"  - Fuel Grades:")
                for grade, info in fuel_grades.items():
                    logger.info(f"    • {grade}: {info}")
            
            custom_fields = dispenser.get('custom_fields', {})
            if custom_fields:
                logger.info(f"  - Custom Fields:")
                for field, value in custom_fields.items():
                    logger.info(f"    • {field}: {value}")
        
        # Test on multiple work orders if available
        if len(dispenser_work_orders) > 1:
            logger.info(f"\n🔄 Testing additional work orders...")
            for wo in dispenser_work_orders[1:3]:  # Test up to 2 more
                logger.info(f"\n  Testing {wo.external_id}...")
                try:
                    dispensers = await workfossa_scraper.scrape_dispenser_details(
                        session_id=user_id,
                        work_order_id=wo.id,
                        visit_url=wo.visit_url
                    )
                    logger.info(f"  ✅ Found {len(dispensers)} dispensers")
                except Exception as e:
                    logger.error(f"  ❌ Error: {e}")
        
        # Keep browser open for inspection
        logger.info("\n🔍 Browser will stay open for 30 seconds for inspection...")
        await asyncio.sleep(30)
        
        # Cleanup
        await automation.cleanup_session(user_id)
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_dispenser_scraping())