#!/usr/bin/env python3
"""
Direct test of dispenser scraping with enhanced logging and screenshots
"""
import asyncio
import sys
import os
from datetime import datetime
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from enhanced_logging_system import EnhancedLogger, enhanced_logger
from screenshot_capture_system import ScreenshotCapture
from check_dispenser_results import format_dispenser_results

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

async def test_direct_scraping():
    """Test scraping directly using the WorkFossaScraper"""
    
    print("\n🧪 DIRECT DISPENSER SCRAPING TEST")
    print("="*80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Initialize logger
    logger = enhanced_logger.get_logger()
    logger.info("🚀 Starting direct dispenser scraping test")
    
    # Get credentials
    logger.info("🔑 Retrieving WorkFossa credentials...")
    credentials = get_workfossa_credentials()
    
    if not credentials:
        logger.error("❌ No credentials found. Cannot proceed with test.")
        return
    
    logger.info(f"✅ Using credentials for user: {credentials['user_id']}")
    logger.info(f"   Username: {credentials['username']}")
    
    # Create scraper instances
    try:
        # Get a test user ID (you may need to adjust this)
        user_id = credentials['user_id']
        
        # First, let's check what work orders we have
        db = SessionLocal()
        
        logger.info("\n📊 Checking existing work orders...")
        dispenser_codes = ["2861", "2862", "3146", "3002"]
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(dispenser_codes)
        ).limit(5).all()
        
        logger.info(f"Found {len(work_orders)} work orders with dispenser services")
        
        for wo in work_orders:
            logger.info(f"\n  Work Order: {wo.external_id}")
            logger.info(f"  Site: {wo.site_name}")
            logger.info(f"  Service: {wo.service_code} - {wo.service_description}")
            
            # Check for customer URL
            if wo.scraped_data and wo.scraped_data.get('customer_url'):
                logger.info(f"  ✅ Has customer URL: {wo.scraped_data['customer_url']}")
            else:
                logger.info("  ❌ No customer URL")
        
        db.close()
        
        # Now test scraping
        logger.info("\n🔧 Testing WorkFossa scraper...")
        
        # Import the actual service
        from app.services.browser_automation import BrowserAutomationService
        
        # Create automation service
        automation_service = WorkFossaAutomationService(BrowserAutomationService())
        
        # Create scraper
        scraper = WorkFossaScraper(automation_service)
        
        # Create credentials dict for scraper
        creds = {
            'username': credentials['username'],
            'password': credentials['password']
        }
        
        logger.info("📋 Scraping work orders...")
        
        # Scrape work orders
        result = await scraper.scrape_work_orders(user_id, creds)
        
        if result['status'] == 'success':
            logger.info(f"✅ Successfully scraped {result.get('work_orders_found', 0)} work orders")
            
            # Check for customer URLs
            customer_urls = 0
            if result.get('work_orders'):
                for wo in result['work_orders'][:5]:
                    if wo.get('customer_url'):
                        customer_urls += 1
                        logger.info(f"  Found customer URL for {wo.get('external_id', 'unknown')}")
            
            logger.info(f"  Customer URLs found: {customer_urls}")
            
            if customer_urls > 0:
                logger.info("\n⛽ Now scraping dispensers...")
                
                # Get work orders from DB to scrape dispensers
                db = SessionLocal()
                work_orders_to_scrape = db.query(WorkOrder).filter(
                    WorkOrder.service_code.in_(dispenser_codes),
                    WorkOrder.user_id == user_id
                ).limit(3).all()
                
                for wo in work_orders_to_scrape:
                    if wo.scraped_data and wo.scraped_data.get('customer_url'):
                        logger.info(f"\n  Scraping dispensers for {wo.external_id}...")
                        try:
                            disp_result = await scraper.scrape_dispensers_for_work_order(
                                user_id, 
                                creds, 
                                wo.external_id,
                                wo.scraped_data['customer_url']
                            )
                            
                            if disp_result['status'] == 'success':
                                logger.info(f"  ✅ Found {len(disp_result.get('dispensers', []))} dispensers")
                            else:
                                logger.error(f"  ❌ Failed: {disp_result.get('message', 'Unknown error')}")
                        except Exception as e:
                            logger.error(f"  ❌ Error scraping dispensers: {e}")
                
                db.close()
            else:
                logger.warning("⚠️ No customer URLs found, cannot scrape dispensers")
        else:
            logger.error(f"❌ Work order scraping failed: {result.get('message', 'Unknown error')}")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Get log summary
        print("\n" + enhanced_logger.get_log_summary())
        
        # Check database results
        print("\n📊 DATABASE CHECK:")
        print("="*60)
        format_dispenser_results()
        
        print(f"\n📄 Full log available at: {enhanced_logger.log_file}")
        print("✅ Test completed")

if __name__ == "__main__":
    asyncio.run(test_direct_scraping())