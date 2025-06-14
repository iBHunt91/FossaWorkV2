#!/usr/bin/env python3
"""
Debug exactly where dispenser scraping is failing
"""
import asyncio
import sys
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

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def debug_single_work_order():
    """Debug scraping for a single work order"""
    
    logger.info("🐛 DEBUGGING DISPENSER SCRAPING FAILURE")
    logger.info("="*60)
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        logger.error("No credentials found!")
        return
    
    user_id = creds['user_id']
    
    # Get a work order to test with
    db = SessionLocal()
    try:
        # Get a work order with dispenser service
        wo = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"]),
            WorkOrder.user_id == user_id
        ).first()
        
        if not wo:
            logger.error("No dispenser work orders found!")
            return
        
        logger.info(f"Testing with work order: {wo.external_id}")
        logger.info(f"Site: {wo.site_name}")
        logger.info(f"Service: {wo.service_code}")
        
        # Check if it has customer URL
        customer_url = None
        if wo.scraped_data:
            customer_url = wo.scraped_data.get('customer_url')
            logger.info(f"Customer URL: {customer_url}")
        else:
            logger.warning("No scraped_data found!")
            
        if not customer_url:
            logger.error("❌ No customer URL - cannot scrape dispensers")
            logger.info("This is why the batch scraping is failing!")
            logger.info("Work orders need to be re-scraped to get customer URLs")
            return
        
        # Try to scrape dispensers for this work order
        logger.info("\n🔧 Attempting dispenser scraping...")
        
        # Initialize services
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
        else:
            logger.error(f"❌ Failed: {result.get('message', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"❌ Debug error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

async def check_all_work_orders():
    """Check why ALL work orders are failing"""
    
    logger.info("\n🔍 CHECKING ALL WORK ORDERS")
    logger.info("="*60)
    
    db = SessionLocal()
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    try:
        # Get all dispenser work orders
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"]),
            WorkOrder.user_id == user_id
        ).all()
        
        logger.info(f"Found {len(work_orders)} dispenser work orders")
        
        # Check each one
        with_customer_url = 0
        without_customer_url = 0
        invalid_customer_url = 0
        
        for wo in work_orders[:10]:  # Check first 10
            logger.info(f"\nWork Order: {wo.external_id}")
            
            if not wo.scraped_data:
                logger.info("  ❌ No scraped_data")
                without_customer_url += 1
                continue
                
            customer_url = wo.scraped_data.get('customer_url')
            if not customer_url:
                logger.info("  ❌ No customer_url in scraped_data")
                without_customer_url += 1
            elif customer_url == "null" or customer_url is None:
                logger.info("  ❌ customer_url is null")
                without_customer_url += 1
            elif not customer_url.startswith('http'):
                logger.info(f"  ❌ Invalid customer_url: {customer_url}")
                invalid_customer_url += 1
            else:
                logger.info(f"  ✅ Has customer_url: {customer_url}")
                with_customer_url += 1
                
        logger.info(f"\n📊 SUMMARY:")
        logger.info(f"  Work orders with valid customer URLs: {with_customer_url}")
        logger.info(f"  Work orders without customer URLs: {without_customer_url}")
        logger.info(f"  Work orders with invalid customer URLs: {invalid_customer_url}")
        
        if with_customer_url == 0:
            logger.error("\n❌ ROOT CAUSE: NO WORK ORDERS HAVE CUSTOMER URLs!")
            logger.info("This is why ALL 56 dispenser scrapes are failing.")
            logger.info("\n💡 SOLUTION:")
            logger.info("1. Clear existing work orders")
            logger.info("2. Re-scrape work orders with the fixed customer URL extraction")
            logger.info("3. Then run dispenser scraping")
            
            logger.info("\n🛠️ COMMANDS TO RUN:")
            logger.info(f"curl -X DELETE 'http://localhost:8000/api/v1/work-orders/clear-all?user_id={user_id}'")
            logger.info(f"curl -X POST 'http://localhost:8000/api/v1/work-orders/scrape?user_id={user_id}'")
            logger.info(f"curl -X POST 'http://localhost:8000/api/v1/work-orders/scrape-dispensers-batch?user_id={user_id}'")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(debug_single_work_order())
    asyncio.run(check_all_work_orders())