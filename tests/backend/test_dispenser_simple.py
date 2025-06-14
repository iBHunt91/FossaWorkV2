#!/usr/bin/env python3
from pathlib import Path
"""
Simple test for dispenser scraping using existing credentials
"""
import asyncio
import logging
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.services.credential_manager import CredentialManager
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import workfossa_scraper
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_dispenser_scraping():
    """Test dispenser scraping with saved credentials"""
    
    # Use the demo user ID (from the credential files)
    user_id = "demo"
    
    # Load credentials
    logger.info("🔑 Loading saved credentials...")
    credential_manager = CredentialManager()
    credentials_obj = credential_manager.retrieve_credentials(user_id)
    
    if not credentials_obj or not credentials_obj.username or not credentials_obj.password:
        logger.error("❌ No credentials found for demo user")
        logger.info("💡 Please run the app and save WorkFossa credentials first")
        return
    
    credentials = {
        "username": credentials_obj.username,
        "password": credentials_obj.password
    }
    
    logger.info(f"✅ Loaded credentials for user: {credentials['username']}")
    
    # Test parameters
    session_id = f"test_dispenser_{datetime.now().timestamp()}"
    
    # Using the customer URL from the screenshots
    customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
    work_order_id = "W-38437"  # From the screenshot
    
    logger.info("🚀 Starting dispenser scraping test...")
    logger.info(f"📍 Target: 7-Eleven Store #38437")
    logger.info(f"🔗 Customer URL: {customer_url}")
    
    automation_service = None
    
    try:
        # Create automation service
        logger.info("\n🔧 Creating WorkFossa automation service...")
        automation_service = WorkFossaAutomationService()
        
        # Create session
        logger.info("🌐 Creating browser session...")
        await automation_service.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        logger.info("✅ Browser session created")
        
        # Login to WorkFossa
        logger.info("\n🔐 Logging in to WorkFossa...")
        login_success = await automation_service.login_to_workfossa(session_id)
        
        if not login_success:
            logger.error("❌ Failed to login to WorkFossa - please check your credentials")
            return
        
        logger.info("✅ Successfully logged in to WorkFossa")
        
        # Scrape dispensers
        logger.info("\n🔍 Scraping dispensers from customer page...")
        logger.info("📄 This will navigate to the customer page and extract dispenser details")
        
        dispensers = await workfossa_scraper.scrape_dispenser_details(
            session_id=session_id,
            work_order_id=work_order_id,
            customer_url=customer_url
        )
        
        # Display results
        print(f"\n{'='*70}")
        print(f"📊 DISPENSER SCRAPING RESULTS - 7-Eleven Store #38437")
        print(f"{'='*70}")
        print(f"Total dispensers found: {len(dispensers)}")
        
        if len(dispensers) == 0:
            print("\n⚠️  No dispensers found. This could mean:")
            print("   - The page structure has changed")
            print("   - The dispensers are not visible on this customer page")
            print("   - Additional navigation is required")
            print("\n💡 Check the screenshots in /backend/screenshots/ for debugging")
        else:
            for i, dispenser in enumerate(dispensers, 1):
                print(f"\n📋 Dispenser #{i}:")
                print(f"  - Number: {dispenser.get('dispenser_number', 'Unknown')}")
                print(f"  - Type: {dispenser.get('dispenser_type', 'Unknown')}")
                print(f"  - Make: {dispenser.get('make', 'Unknown')}")
                print(f"  - Model: {dispenser.get('model', 'Unknown')}")
                print(f"  - Serial: {dispenser.get('serial_number', 'Unknown')}")
                
                fuel_grades = dispenser.get('fuel_grades', {})
                if fuel_grades:
                    print(f"  - Fuel Grades:")
                    for grade, info in fuel_grades.items():
                        print(f"    • {grade}: {info}")
        
        print(f"\n{'='*70}")
        print("✅ Test completed!")
        
        # Check for screenshots
        screenshot_dir = "/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend/screenshots"
        if os.path.exists(screenshot_dir):
            screenshots = [f for f in os.listdir(screenshot_dir) if f.endswith('.png')]
            if screenshots:
                print(f"\n📸 Screenshots saved in {screenshot_dir}:")
                for screenshot in sorted(screenshots)[-5:]:  # Show last 5
                    print(f"   - {screenshot}")
        
    except Exception as e:
        logger.error(f"\n❌ Test failed with error: {e}")
        import traceback
        logger.error(traceback.format_exc())
    
    finally:
        # Cleanup
        if automation_service:
            try:
                logger.info("\n🧹 Cleaning up session...")
                await automation_service.cleanup_session(session_id)
                logger.info("✅ Session cleaned up")
            except:
                pass

if __name__ == "__main__":
    print("🧪 WorkFossa Dispenser Scraping Test")
    print("="*40)
    asyncio.run(test_dispenser_scraping())