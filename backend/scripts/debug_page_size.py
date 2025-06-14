#!/usr/bin/env python3
"""
Debug script to examine page size dropdown using existing scraper infrastructure
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.workfossa_scraper import workfossa_scraper
from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def debug_page_size_dropdown():
    """Debug the page size dropdown using existing infrastructure"""
    
    try:
        logger.info("🔍 Starting page size dropdown debug...")
        
        # Create automation service
        automation_service = WorkFossaAutomationService(headless=False)
        await automation_service.initialize_browser()
        
        # Create a session with demo credentials
        session_id = "debug_session"
        user_id = "demo"
        
        # Read demo credentials
        cred_file = backend_dir / "data" / "credentials" / "demo.cred"
        if cred_file.exists():
            import json
            from app.auth.security import decrypt_credentials
            
            with open(cred_file, 'r') as f:
                cred_data = json.load(f)
            
            # Decrypt credentials
            decrypted = decrypt_credentials(cred_data['encrypted_data'])
            if decrypted:
                credentials = WorkFossaCredentials(
                    email=decrypted['email'],
                    password=decrypted['password'], 
                    user_id=user_id
                )
                
                # Create session
                await automation_service.create_session(session_id, user_id, credentials)
                
                # Login
                await automation_service.login_to_workfossa(session_id)
                
                # Get the page from the session
                session = automation_service.sessions[session_id]
                page = session['page']
                
                # Navigate to work orders page
                work_orders_url = "https://app.workfossa.com/app/work/list"
                logger.info(f"Navigating to: {work_orders_url}")
                await page.goto(work_orders_url, wait_until="networkidle")
                await page.wait_for_timeout(3000)
                
                # Take screenshot
                await page.screenshot(path="debug_work_orders_page.png", full_page=True)
                logger.info("📸 Screenshot saved: debug_work_orders_page.png")
                
                # Now debug the page size dropdown detection
                logger.info("🔍 Starting detailed dropdown analysis...")
                
                # Test our existing method
                result = await test_page_size_method(page)
                
                if not result:
                    # Do manual inspection
                    await manual_dropdown_inspection(page)
                
                # Keep browser open for inspection
                logger.info("Browser staying open for 30 seconds for manual inspection...")
                await page.wait_for_timeout(30000)
                
                # Cleanup
                await automation_service.cleanup_session(session_id)
                
            else:
                logger.error("Failed to decrypt demo credentials")
        else:
            logger.error("Demo credentials file not found")
            
    except Exception as e:
        logger.error(f"Debug failed: {e}")
        import traceback
        traceback.print_exc()

async def test_page_size_method(page):
    """Test our current page size detection method"""
    logger.info("Testing current page size detection method...")
    
    # Use the same selectors as our scraper
    page_size_selectors = [
        "select[name='per_page']",
        "select[name='perPage']", 
        "select[name='pageSize']",
        "select[name='limit']",
        ".page-size-select select",
        ".per-page-select select", 
        ".results-per-page select",
        "select:has(option[value='25'])",
        "select:has(option[value='50'])",
        "select:has(option[value='100'])",
        "[data-testid*='page-size'] select",
        "[data-testid*='per-page'] select",
        ".pagination select",
        ".table-controls select",
        "select[class*='page']",
        "select[class*='size']",
    ]
    
    for i, selector in enumerate(page_size_selectors):
        try:
            logger.info(f"Testing selector {i+1}: {selector}")
            page_size_select = await page.query_selector(selector)
            
            if page_size_select:
                logger.info(f"✅ Found element with selector: {selector}")
                
                # Get element details
                tag_name = await page_size_select.evaluate("el => el.tagName")
                attributes = await page_size_select.evaluate("""
                    el => ({
                        name: el.name || '',
                        id: el.id || '',
                        className: el.className || '',
                        value: el.value || ''
                    })
                """)
                
                logger.info(f"Element details: tag={tag_name}, attrs={attributes}")
                
                # Get options if it's a select
                if tag_name.lower() == 'select':
                    options = await page_size_select.query_selector_all("option")
                    option_data = []
                    
                    for option in options:
                        value = await option.get_attribute("value")
                        text = await option.text_content()
                        selected = await option.get_attribute("selected") is not None
                        option_data.append({"value": value, "text": text, "selected": selected})
                    
                    logger.info(f"Options: {option_data}")
                    
                    # Check if it has page size options
                    option_values = [opt["value"] for opt in option_data]
                    page_size_indicators = ['25', '50', '100', '10', '20']
                    
                    if any(indicator in option_values for indicator in page_size_indicators):
                        logger.info(f"🎯 FOUND PAGE SIZE DROPDOWN! Options: {option_values}")
                        
                        # Try to select 100
                        if "100" in option_values:
                            logger.info("Attempting to select 100...")
                            await page_size_select.select_option("100")
                            await page.wait_for_timeout(2000)
                            await page.wait_for_load_state("networkidle")
                            logger.info("✅ Successfully selected 100!")
                            
                            # Take screenshot after change
                            await page.screenshot(path="debug_after_100_selected.png", full_page=True)
                            logger.info("📸 Screenshot after selecting 100: debug_after_100_selected.png")
                            return True
                        else:
                            logger.info("100 option not available")
                    else:
                        logger.info("Not a page size dropdown")
                else:
                    logger.info("Not a select element")
            else:
                logger.debug(f"No element found with selector: {selector}")
                
        except Exception as e:
            logger.debug(f"Selector {selector} failed: {e}")
    
    return False

async def manual_dropdown_inspection(page):
    """Manual inspection of all dropdowns"""
    logger.info("Starting manual dropdown inspection...")
    
    # Get all select elements
    all_selects = await page.query_selector_all("select")
    logger.info(f"Found {len(all_selects)} select elements")
    
    for i, select in enumerate(all_selects):
        try:
            # Get select details
            details = await select.evaluate("""
                el => ({
                    tagName: el.tagName,
                    name: el.name || '',
                    id: el.id || '',
                    className: el.className || '',
                    value: el.value || '',
                    outerHTML: el.outerHTML.substring(0, 200)
                })
            """)
            
            # Get options
            options = await select.query_selector_all("option")
            option_info = []
            
            for option in options:
                value = await option.get_attribute("value") or ""
                text = await option.text_content() or ""
                selected = await option.get_attribute("selected") is not None
                option_info.append({"value": value, "text": text, "selected": selected})
            
            logger.info(f"\n--- Select Element {i+1} ---")
            logger.info(f"Details: {details}")
            logger.info(f"Options: {option_info}")
            
            # Check if this looks like page size
            option_values = [opt["value"] for opt in option_info]
            has_page_size_values = any(val in ['10', '25', '50', '100', '200'] for val in option_values)
            
            if has_page_size_values:
                logger.info("🎯 This looks like a PAGE SIZE dropdown!")
                
                # Generate CSS selectors
                selectors = []
                if details['name']:
                    selectors.append(f"select[name='{details['name']}']")
                if details['id']:
                    selectors.append(f"#{details['id']}")
                if details['className']:
                    class_names = details['className'].strip().split()
                    if class_names:
                        selectors.append(f"select.{'.'.join(class_names)}")
                
                logger.info(f"Recommended selectors: {selectors}")
                
        except Exception as e:
            logger.error(f"Error inspecting select {i+1}: {e}")
    
    # Also look for custom dropdowns
    logger.info("\nLooking for custom dropdowns containing '25'...")
    
    elements_with_25 = await page.evaluate("""
        () => {
            const results = [];
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent || '';
                if (text.includes('25') && node.tagName) {
                    const rect = node.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        results.push({
                            tagName: node.tagName.toLowerCase(),
                            id: node.id || '',
                            className: node.className || '',
                            textContent: text.trim().substring(0, 50),
                            outerHTML: node.outerHTML.substring(0, 200)
                        });
                    }
                }
            }
            return results.slice(0, 10); // Limit results
        }
    """)
    
    logger.info(f"Found {len(elements_with_25)} visible elements containing '25'")
    for i, elem in enumerate(elements_with_25):
        logger.info(f"Element {i+1}: {elem}")

if __name__ == "__main__":
    asyncio.run(debug_page_size_dropdown())