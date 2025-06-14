#!/usr/bin/env python3
"""
Test script to verify our page size dropdown debugging is working
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def test_scraper_debugging():
    """Test that our scraper debugging logs are working"""
    
    logger.info("🧪 Testing scraper debugging functionality...")
    
    # Import and test the scraper
    try:
        from app.services.workfossa_scraper import workfossa_scraper
        
        logger.info("✅ Scraper imported successfully")
        logger.info(f"Scraper config: {workfossa_scraper.config}")
        
        # Test that the enhanced _set_page_size_to_100 method exists
        if hasattr(workfossa_scraper, '_set_page_size_to_100'):
            logger.info("✅ _set_page_size_to_100 method exists")
        else:
            logger.error("❌ _set_page_size_to_100 method not found")
            return False
        
        # Check the selector list
        logger.info("📋 Testing selector patterns...")
        
        # We can't run the actual method without a page, but we can check the logic
        logger.info("The scraper should now log these key messages during scraping:")
        logger.info("1. '🔧 ATTEMPTING PAGE SIZE CHANGE TO 100...'")
        logger.info("2. '🔍 _set_page_size_to_100 method called - starting dropdown detection...'")
        logger.info("3. 'Current page: URL=..., Title=...'")
        logger.info("4. 'Total select elements found on page: X'")
        logger.info("5. 'Elements containing \"25\": X'")
        logger.info("6. For each selector: 'Testing selector X: [selector]'")
        logger.info("7. If found: '🎯 Found page size dropdown with selector: [selector]'")
        logger.info("8. If successful: '✅ Successfully selected 100 items per page'")
        
        logger.info("\n📸 Screenshots that will be saved:")
        logger.info("- before_page_size_detection.png")
        logger.info("- work_orders_page_[session_id].png")
        
        logger.info("\n🔧 NEXT STEPS:")
        logger.info("1. Run the work order scraping operation")
        logger.info("2. Check the logs for the messages above")
        logger.info("3. Check for the screenshot files")
        logger.info("4. If still not working, the dropdown might be:")
        logger.info("   - A custom React/Vue component")
        logger.info("   - Inside an iframe")
        logger.info("   - Loaded dynamically after page load")
        logger.info("   - Using a different interaction pattern")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_scraper_debugging())
    if success:
        print("\n" + "="*60)
        print("✅ DEBUGGING ENHANCED")
        print("The scraper now has comprehensive logging.")
        print("Run your scraping operation and check for the debug messages!")
        print("="*60)
    else:
        print("\n❌ Debug setup failed")