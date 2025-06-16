#!/usr/bin/env python3
"""
Simple test to check if page size dropdown detection is working
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

async def test_page_size():
    """Test page size dropdown detection"""
    
    logger.info("🧪 Testing Page Size Dropdown Detection")
    logger.info("="*60)
    
    try:
        from app.services.workfossa_scraper import workfossa_scraper
        from app.services.browser_automation import browser_automation
        from playwright.async_api import async_playwright
        
        # Start playwright manually for testing
        async with async_playwright() as p:
            # Launch browser in visible mode
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context()
            page = await context.new_page()
            
            logger.info("Browser launched - please navigate to WorkFossa and log in manually")
            
            # Navigate to WorkFossa
            await page.goto("https://app.workfossa.com")
            
            # Wait for manual login
            logger.info("⏰ You have 30 seconds to log in manually...")
            await page.wait_for_timeout(30000)
            
            # Navigate to work orders page
            logger.info("Navigating to work orders page...")
            await page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            # Take initial screenshot
            await page.screenshot(path="test_before_page_size.png")
            logger.info("📸 Screenshot saved: test_before_page_size.png")
            
            # Test the page size method directly
            logger.info("\n" + "="*60)
            logger.info("🔧 TESTING PAGE SIZE DETECTION")
            logger.info("="*60)
            
            # Call the scraper's page size method
            result = await workfossa_scraper._set_page_size_to_100(page)
            
            logger.info("="*60)
            logger.info(f"RESULT: {'✅ SUCCESS' if result else '❌ FAILED'}")
            logger.info("="*60)
            
            # Take screenshot after attempt
            await page.screenshot(path="test_after_page_size.png")
            logger.info("📸 Screenshot saved: test_after_page_size.png")
            
            # Do manual analysis
            logger.info("\n📋 MANUAL ANALYSIS:")
            
            # Count work order rows
            work_order_count = await page.evaluate("""
                () => {
                    // Count table rows (excluding header)
                    const rows = document.querySelectorAll('tbody tr');
                    return rows.length;
                }
            """)
            logger.info(f"Work order rows found: {work_order_count}")
            
            # Find all select elements
            selects = await page.query_selector_all("select")
            logger.info(f"Total select elements: {len(selects)}")
            
            # Analyze each select
            for i, select in enumerate(selects):
                try:
                    info = await select.evaluate("""
                        el => ({
                            name: el.name || '',
                            id: el.id || '',
                            className: el.className || '',
                            value: el.value || '',
                            options: Array.from(el.options).map(opt => ({
                                value: opt.value,
                                text: opt.textContent.trim()
                            }))
                        })
                    """)
                    
                    # Check if this looks like a page size dropdown
                    option_values = [opt['value'] for opt in info['options']]
                    if any(val in ['10', '25', '50', '100'] for val in option_values):
                        logger.info(f"\n🎯 POTENTIAL PAGE SIZE DROPDOWN - Select #{i+1}:")
                        logger.info(f"  Name: {info['name']}")
                        logger.info(f"  ID: {info['id']}")
                        logger.info(f"  Class: {info['className']}")
                        logger.info(f"  Current value: {info['value']}")
                        logger.info(f"  Options: {option_values}")
                except:
                    pass
            
            # Look for custom dropdowns
            logger.info("\n🔍 Looking for custom dropdowns...")
            custom_dropdowns = await page.evaluate("""
                () => {
                    const results = [];
                    // Look for elements that might be dropdowns containing "25"
                    document.querySelectorAll('button, div[role="button"], span').forEach(el => {
                        const text = el.textContent || '';
                        if (text.includes('25') || text.includes('per page') || text.includes('Page size')) {
                            results.push({
                                tag: el.tagName.toLowerCase(),
                                text: text.trim(),
                                className: el.className || '',
                                id: el.id || ''
                            });
                        }
                    });
                    return results;
                }
            """)
            
            if custom_dropdowns:
                logger.info(f"Found {len(custom_dropdowns)} potential custom dropdowns:")
                for dropdown in custom_dropdowns[:5]:  # Show first 5
                    logger.info(f"  - {dropdown}")
            
            # Keep browser open for inspection
            logger.info("\n🔍 Browser will stay open for 30 seconds for inspection...")
            await page.wait_for_timeout(30000)
            
            await browser.close()
            
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_page_size())