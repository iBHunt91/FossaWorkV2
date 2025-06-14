#!/usr/bin/env python3
from pathlib import Path
"""
Test script for dispenser scraping functionality
"""
import asyncio
import logging
import sys
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import workfossa_scraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_dispenser_scraping():
    """Test dispenser scraping with a real work order"""
    
    # Test credentials (you'll need to update these)
    test_credentials = {
        "username": "your_username",  # Replace with actual username
        "password": "your_password"   # Replace with actual password
    }
    
    # Test parameters
    user_id = "test_user_123"
    session_id = f"test_dispenser_{datetime.now().timestamp()}"
    
    # Customer URL from the screenshots (7-Eleven Store #38437)
    customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
    work_order_id = "test_wo_123"
    
    logger.info("🚀 Starting dispenser scraping test...")
    logger.info(f"📍 Target customer URL: {customer_url}")
    
    try:
        # Create automation service
        logger.info("🔧 Creating WorkFossa automation service...")
        automation_service = WorkFossaAutomationService()
        
        # Create session
        logger.info("🌐 Creating browser session...")
        await automation_service.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=test_credentials
        )
        logger.info("✅ Browser session created")
        
        # Login to WorkFossa
        logger.info("🔐 Logging in to WorkFossa...")
        login_success = await automation_service.login_to_workfossa(session_id)
        
        if not login_success:
            logger.error("❌ Failed to login to WorkFossa")
            return
        
        logger.info("✅ Successfully logged in to WorkFossa")
        
        # Scrape dispensers from customer page
        logger.info("🔍 Starting dispenser scraping from customer page...")
        dispensers = await workfossa_scraper.scrape_dispenser_details(
            session_id=session_id,
            work_order_id=work_order_id,
            customer_url=customer_url
        )
        
        # Display results
        logger.info(f"\n{'='*60}")
        logger.info(f"📊 DISPENSER SCRAPING RESULTS")
        logger.info(f"{'='*60}")
        logger.info(f"Total dispensers found: {len(dispensers)}")
        
        for i, dispenser in enumerate(dispensers, 1):
            logger.info(f"\n📋 Dispenser #{i}:")
            logger.info(f"  - Number: {dispenser.get('dispenser_number', 'Unknown')}")
            logger.info(f"  - Type: {dispenser.get('dispenser_type', 'Unknown')}")
            logger.info(f"  - Make: {dispenser.get('make', 'Unknown')}")
            logger.info(f"  - Model: {dispenser.get('model', 'Unknown')}")
            logger.info(f"  - Serial: {dispenser.get('serial_number', 'Unknown')}")
            
            fuel_grades = dispenser.get('fuel_grades', {})
            if fuel_grades:
                logger.info(f"  - Fuel Grades:")
                for grade, info in fuel_grades.items():
                    logger.info(f"    • {grade}: {info}")
        
        logger.info(f"\n{'='*60}")
        logger.info("✅ Dispenser scraping test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed with error: {e}")
        import traceback
        logger.error(traceback.format_exc())
    
    finally:
        # Cleanup
        try:
            logger.info("🧹 Cleaning up session...")
            await automation_service.cleanup_session(session_id)
            logger.info("✅ Session cleaned up")
        except:
            pass

if __name__ == "__main__":
    # Check if credentials were provided as arguments
    if len(sys.argv) == 3:
        username = sys.argv[1]
        password = sys.argv[2]
        
        # Update the test function to use provided credentials
        async def test_with_credentials():
            global test_credentials
            test_credentials = {
                "username": username,
                "password": password
            }
            await test_dispenser_scraping()
        
        asyncio.run(test_with_credentials())
    else:
        print("Usage: python test_dispenser_scraping.py <username> <password>")
        print("\nOr update the credentials in the script and run without arguments.")
        print("\nRunning with placeholder credentials (will fail at login)...")
        asyncio.run(test_dispenser_scraping())