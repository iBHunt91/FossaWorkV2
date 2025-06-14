#!/usr/bin/env python3
"""
Debug dispenser scraping when work orders DO have customer URLs
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
from app.database import SessionLocal
from app.models import WorkOrder
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def debug_dispenser_scraping():
    """Debug dispenser scraping with customer URLs present"""
    
    logger.info("🐛 DEBUGGING DISPENSER SCRAPING WITH CUSTOMER URLs")
    logger.info("="*60)
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        logger.error("No credentials found!")
        return
    
    user_id = creds['user_id']
    
    # Get a work order with customer URL
    db = SessionLocal()
    try:
        wo = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"]),
            WorkOrder.user_id == user_id
        ).first()
        
        if not wo:
            logger.error("No dispenser work orders found!")
            return
        
        customer_url = wo.scraped_data.get('customer_url') if wo.scraped_data else None
        
        logger.info(f"Testing with work order: {wo.external_id}")
        logger.info(f"Site: {wo.site_name}")
        logger.info(f"Customer URL: {customer_url}")
        
        if not customer_url:
            logger.error("No customer URL found!")
            return
        
        # Try to scrape dispensers
        logger.info("\n🔧 Attempting dispenser scraping...")
        
        # Initialize services - but handle the browser automation issue
        try:
            # Try the simple approach first
            browser_service = BrowserAutomationService()
            automation_service = WorkFossaAutomationService(browser_service)
            scraper = WorkFossaScraper(automation_service)
            
            credentials = {
                'username': creds['username'],
                'password': creds['password']
            }
            
            # Try to scrape dispensers
            result = await scraper.scrape_dispensers_for_work_order(
                user_id,
                credentials,
                wo.external_id,
                customer_url
            )
            
            logger.info(f"Scraping result: {result}")
            
            if result['status'] == 'success':
                logger.info(f"✅ Success! Found {len(result.get('dispensers', []))} dispensers")
                for d in result.get('dispensers', []):
                    logger.info(f"  - Dispenser #{d.get('number', 'N/A')}: {d.get('type', 'N/A')}")
            else:
                logger.error(f"❌ Failed: {result.get('message', 'Unknown error')}")
                logger.info("This is where the dispenser scraping is failing!")
                
                # Check what type of error
                error_msg = result.get('message', '')
                if 'session' in error_msg.lower():
                    logger.info("💡 Error is related to browser sessions")
                elif 'login' in error_msg.lower():
                    logger.info("💡 Error is related to login")
                elif 'navigation' in error_msg.lower():
                    logger.info("💡 Error is related to page navigation")
                elif 'timeout' in error_msg.lower():
                    logger.info("💡 Error is related to timeouts")
                else:
                    logger.info("💡 Error is unknown - check the full error message")
                
        except Exception as e:
            logger.error(f"❌ Exception during scraping: {e}")
            logger.info("This exception is likely the root cause of all failures")
            
            # Check the exception type
            exception_type = type(e).__name__
            logger.info(f"Exception type: {exception_type}")
            
            if 'Browser' in str(e) or 'browser' in str(e):
                logger.info("💡 Browser-related error - automation service has issues")
            elif 'Session' in str(e) or 'session' in str(e):
                logger.info("💡 Session-related error - session management has issues")
            elif 'Login' in str(e) or 'login' in str(e):
                logger.info("💡 Login-related error - credentials or login process has issues")
            else:
                logger.info("💡 Other error - see full traceback below")
            
            import traceback
            traceback.print_exc()
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(debug_dispenser_scraping())