#!/usr/bin/env python3
"""
Test dispenser scraping with existing credentials from database
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

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    """Run the test with existing credentials"""
    
    # Get credentials
    logger.info("🔑 Getting credentials...")
    creds = get_workfossa_credentials()
    
    if not creds:
        logger.error("No credentials found!")
        return
    
    logger.info(f"✅ Using credentials for: {creds['username']}")
    
    # Initialize services
    browser_service = BrowserAutomationService()
    automation_service = WorkFossaAutomationService(browser_service)
    scraper = WorkFossaScraper(automation_service)
    
    # Prepare credentials for scraper
    credentials = {
        'username': creds['username'],
        'password': creds['password']
    }
    
    user_id = creds['user_id']
    
    try:
        # Test 1: Scrape work orders
        logger.info("\n📋 TEST 1: Scraping work orders...")
        result = await scraper.scrape_work_orders(user_id, credentials)
        
        if result['status'] == 'success':
            logger.info(f"✅ Success! Found {result.get('work_orders_found', 0)} work orders")
            
            # Check for customer URLs
            customer_urls = 0
            wo_with_urls = []
            
            if result.get('work_orders'):
                for wo in result['work_orders']:
                    if wo.get('customer_url'):
                        customer_urls += 1
                        wo_with_urls.append(wo)
                        logger.info(f"  ✅ Found customer URL for {wo.get('external_id')}")
            
            logger.info(f"\n📊 Customer URLs found: {customer_urls}")
            
            # Test 2: Scrape dispensers if we have customer URLs
            if wo_with_urls:
                logger.info("\n⛽ TEST 2: Scraping dispensers...")
                
                # Try first work order with customer URL
                test_wo = wo_with_urls[0]
                logger.info(f"Testing with work order: {test_wo['external_id']}")
                logger.info(f"Customer URL: {test_wo['customer_url']}")
                
                disp_result = await scraper.scrape_dispensers_for_work_order(
                    user_id,
                    credentials,
                    test_wo['external_id'],
                    test_wo['customer_url']
                )
                
                if disp_result['status'] == 'success':
                    logger.info(f"✅ Found {len(disp_result.get('dispensers', []))} dispensers!")
                    for d in disp_result.get('dispensers', [])[:3]:
                        logger.info(f"  - Dispenser #{d.get('number', 'N/A')}: {d.get('type', 'N/A')}")
                else:
                    logger.error(f"❌ Dispenser scraping failed: {disp_result.get('message')}")
            else:
                logger.warning("⚠️ No customer URLs found - cannot test dispenser scraping")
                logger.info("\n💡 This likely means:")
                logger.info("   1. Work orders were scraped before the customer URL fix")
                logger.info("   2. Need to clear and re-scrape work orders")
                logger.info("\n📝 To fix:")
                logger.info(f"   1. Clear work orders for user {user_id}")
                logger.info("   2. Run this test again to scrape fresh data")
                
        else:
            logger.error(f"❌ Scraping failed: {result.get('message')}")
            
    except Exception as e:
        logger.error(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Check database
        logger.info("\n📊 Checking database...")
        db = SessionLocal()
        
        # Count work orders with customer URLs
        total_wos = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).count()
        
        wos_with_urls = 0
        for wo in db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all():
            if wo.scraped_data and wo.scraped_data.get('customer_url'):
                wos_with_urls += 1
        
        logger.info(f"Total work orders in DB: {total_wos}")
        logger.info(f"Work orders with customer URLs: {wos_with_urls}")
        
        db.close()
        
        logger.info("\n✅ Test complete!")

if __name__ == "__main__":
    asyncio.run(main())