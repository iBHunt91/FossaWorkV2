#!/usr/bin/env python3
"""
Test dispenser scraping with fixed service integration
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
from app.database import SessionLocal
from app.models import WorkOrder
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_dispenser_scraping_fixed():
    """Test dispenser scraping with correct service integration"""
    
    logger.info("🔧 TESTING DISPENSER SCRAPING WITH FIXED INTEGRATION")
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
        
        # Initialize services CORRECTLY
        logger.info("\n🔧 Initializing services...")
        
        # Create automation service and pass it to scraper
        automation_service = WorkFossaAutomationService(headless=False)  # Visible for debugging
        scraper = WorkFossaScraper(automation_service)  # Pass automation service as browser_automation
        
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        logger.info("✅ Services initialized correctly")
        
        # Test dispenser scraping
        logger.info("\n⛽ Testing dispenser scraping...")
        
        try:
            # Create session first
            session_id = str(uuid.uuid4())
            await automation_service.create_session(session_id, user_id, credentials)
            await automation_service.login_to_workfossa(session_id)
            
            # Now scrape dispensers
            dispensers = await scraper.scrape_dispenser_details(session_id, wo.external_id, customer_url)
            
            # Format result like the API would
            result = {
                'status': 'success',
                'dispensers': dispensers
            }
            
            logger.info(f"Scraping result: {result}")
            
            if result['status'] == 'success':
                dispensers = result.get('dispensers', [])
                logger.info(f"✅ SUCCESS! Found {len(dispensers)} dispensers")
                
                for i, d in enumerate(dispensers):
                    logger.info(f"  {i+1}. Dispenser #{d.get('number', 'N/A')}")
                    logger.info(f"     Type: {d.get('type', 'N/A')}")
                    logger.info(f"     Fuels: {d.get('fuels', 'N/A')}")
                
                # Check if these are real dispensers (not defaults)
                real_dispensers = [d for d in dispensers if d.get('type') != 'Wayne 300']
                if real_dispensers:
                    logger.info(f"✅ Found {len(real_dispensers)} real dispensers (not defaults)")
                else:
                    logger.warning("⚠️ All dispensers appear to be defaults")
                
            else:
                logger.error(f"❌ FAILED: {result.get('message', 'Unknown error')}")
                
                # Analyze the error
                error_msg = result.get('message', '').lower()
                if 'session' in error_msg:
                    logger.info("💡 Session-related error")
                elif 'login' in error_msg:
                    logger.info("💡 Login-related error")
                elif 'navigation' in error_msg:
                    logger.info("💡 Navigation-related error")
                elif 'equipment' in error_msg:
                    logger.info("💡 Equipment tab or dispenser section not found")
                else:
                    logger.info("💡 Other error - see full message above")
                
        except Exception as e:
            logger.error(f"❌ Exception during scraping: {e}")
            import traceback
            traceback.print_exc()
            
    finally:
        db.close()
        
        # Clean up
        if hasattr(automation_service, 'browser') and automation_service.browser:
            logger.info("\n🧹 Closing browser...")
            await automation_service.browser.close()

if __name__ == "__main__":
    asyncio.run(test_dispenser_scraping_fixed())