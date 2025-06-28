#!/usr/bin/env python3
"""
Monitor scraping logs in real-time to see page size dropdown detection
"""

import asyncio
import logging
import sys
import time
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.workfossa_scraper import workfossa_scraper

# Set up logging to capture scraper logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('scraping_debug.log')
    ]
)

logger = logging.getLogger(__name__)

# Also set the scraper logger to DEBUG level
scraper_logger = logging.getLogger('app.services.workfossa_scraper')
scraper_logger.setLevel(logging.DEBUG)

async def monitor_scraping():
    """Monitor the scraping process and log page size detection"""
    
    logger.info("🔍 Starting scraping log monitor...")
    logger.info("This will help us see exactly what happens with page size dropdown detection")
    
    # Create a mock session to test the page size detection
    try:
        from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials
        
        # Create automation service  
        automation_service = WorkFossaAutomationService(headless=False)
        await automation_service.initialize_browser()
        
        session_id = "monitor_session"
        user_id = "monitor_user"
        
        # Use demo credentials if available
        cred_file = backend_dir / "data" / "credentials" / "demo.cred"
        if cred_file.exists():
            logger.info("Using demo credentials for testing...")
            
            # For now, create mock credentials since decryption is complex
            credentials = WorkFossaCredentials(
                email="test@example.com",  # Replace with real credentials for testing
                password="test_password",   # Replace with real credentials for testing
                user_id=user_id
            )
            
            if credentials.email == "test@example.com":
                logger.warning("⚠️  No real credentials provided - cannot test live scraping")
                logger.info("But we can still test our page size detection logic...")
                
                # Just test the enhanced selector patterns
                logger.info("Enhanced page size selectors now include:")
                selectors = [
                    "select[name='per_page']",
                    "select[name='perPage']", 
                    "select[name='pageSize']",
                    ".per-page select",
                    ".page-size select",
                    "select:has(option[value='25'])",
                    ".pagination select",
                    "[class*='pagination'] select",
                    "select[data-testid*='page-size']"
                ]
                
                for i, selector in enumerate(selectors, 1):
                    logger.info(f"  {i:2d}. {selector}")
                
                logger.info("\n🔧 To debug the actual scraping:")
                logger.info("1. Add real credentials to this script")
                logger.info("2. Run a scraping operation") 
                logger.info("3. Watch for these log messages:")
                logger.info("   - 'Attempting to set page size to 100...'")
                logger.info("   - '🎯 Found page size dropdown with selector: ...'")
                logger.info("   - '✅ Successfully selected 100 items per page'")
                logger.info("   - 'Found X work orders to scrape'")
                
                return
        
        else:
            logger.error("Demo credentials file not found")
            return
            
    except Exception as e:
        logger.error(f"Monitor setup failed: {e}")
        import traceback
        traceback.print_exc()

async def test_page_size_detection_manually():
    """Test page size detection with manual inspection"""
    
    logger.info("📝 Testing page size detection logic manually...")
    
    # Simulate what our scraper does
    logger.info("Scraper will try these selectors in order:")
    
    page_size_selectors = [
        "select[name='per_page']",
        "select[name='perPage']", 
        "select[name='pageSize']",
        "select[name='limit']",
        "select[name='results_per_page']",
        ".per-page select",
        ".page-size select",
        ".results-per-page select", 
        ".pagination-controls select",
        ".table-pagination select",
        "select:has(option[value='25'])",
        "select:has(option[value='50'])",
        "select:has(option[value='100'])",
        ".pagination select",
        ".table-footer select", 
        ".table-controls select",
        ".results-info select",
        "[class*='pagination'] select",
        "[class*='per-page'] select",
        "[class*='page-size'] select",
        "select[data-testid*='page-size']",
        "select[data-testid*='per-page']", 
        "select[data-role='page-size']",
        "select[data-field='per_page']",
        "select[class*='page']",
        "select[class*='size']",
    ]
    
    for i, selector in enumerate(page_size_selectors, 1):
        logger.info(f"  {i:2d}. {selector}")
    
    logger.info(f"\nTotal: {len(page_size_selectors)} selectors will be tried")
    
    logger.info("\n📋 What to look for in logs when scraping:")
    logger.info("✅ SUCCESS indicators:")
    logger.info("  - 'Attempting to set page size to 100...'")
    logger.info("  - '🎯 Found page size dropdown with selector: [selector]'")
    logger.info("  - 'Available options: [list]'")
    logger.info("  - 'Matching page size values: [values]'")
    logger.info("  - '✅ Successfully selected 100 items per page'")
    logger.info("  - 'Confirmed new value: 100'")
    
    logger.info("\n❌ FAILURE indicators:")
    logger.info("  - 'Could not find page size dropdown with any method'")
    logger.info("  - All selectors showing 'failed' or 'not found'")
    logger.info("  - 'Found X work orders to scrape' where X is still 25")
    
    logger.info("\n🔧 If it's still finding only 25 work orders:")
    logger.info("1. Check if the selector is actually found but selection fails")
    logger.info("2. The dropdown might be a custom component, not a <select>")
    logger.info("3. Page might require additional wait time for dropdown to load")
    logger.info("4. JavaScript might be preventing the selection")
    logger.info("5. The dropdown might be in an iframe or shadow DOM")

if __name__ == "__main__":
    # First test our logic manually
    asyncio.run(test_page_size_detection_manually())
    
    print("\n" + "="*60)
    print("NEXT STEPS:")
    print("1. Run the work order scraping operation")
    print("2. Watch the logs for the indicators above")
    print("3. If still showing 25, we need to investigate further")
    print("="*60)