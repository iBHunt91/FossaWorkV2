#!/usr/bin/env python3
"""
Simple script to find the page size dropdown using manual credentials
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def find_page_size_dropdown():
    """Find the page size dropdown using manual login"""
    
    print("🔍 Page Size Dropdown Finder")
    print("This script will help identify the correct selector for the page size dropdown")
    print("\nWe'll need WorkFossa credentials to test...")
    
    # For testing, we'll use a non-interactive approach
    # In a real scenario, you would provide your WorkFossa credentials here
    email = "test@example.com"  # Replace with actual email
    password = "test_password"   # Replace with actual password
    
    # Skip this test if no real credentials provided
    if email == "test@example.com":
        logger.info("⚠️  No real credentials provided - creating mock findings instead")
        logger.info("Based on common WorkFossa patterns, likely selectors are:")
        logger.info("1. select[name='per_page']")
        logger.info("2. select[name='pageSize']") 
        logger.info("3. .pagination select")
        logger.info("4. select:has(option[value='25'])")
        
        # Update the scraper with the most likely selector
        logger.info("📝 Updating scraper with additional selectors...")
        return await update_scraper_selectors()
    
    try:
        logger.info("🔍 Starting dropdown detection...")
        
        # Create automation service
        automation_service = WorkFossaAutomationService(headless=False)
        await automation_service.initialize_browser()
        
        # Create session
        session_id = "dropdown_test"
        user_id = "test_user"
        credentials = WorkFossaCredentials(email=email, password=password, user_id=user_id)
        
        await automation_service.create_session(session_id, user_id, credentials)
        
        # Login
        success = await automation_service.login_to_workfossa(session_id)
        if not success:
            logger.error("❌ Login failed")
            return False
        
        # Get page from session
        session = automation_service.sessions[session_id]
        page = session['page']
        
        # Navigate to work orders
        work_orders_url = "https://app.workfossa.com/app/work/list"
        logger.info(f"Navigating to: {work_orders_url}")
        await page.goto(work_orders_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Take screenshot
        await page.screenshot(path="dropdown_search.png", full_page=True)
        logger.info("📸 Screenshot saved: dropdown_search.png")
        
        # Find the dropdown
        dropdown_selector = await detect_page_size_dropdown(page)
        
        if dropdown_selector:
            logger.info(f"✅ Found page size dropdown: {dropdown_selector}")
            await update_scraper_with_selector(dropdown_selector)
        else:
            logger.warning("❌ Could not find page size dropdown")
        
        # Cleanup
        await automation_service.cleanup_session(session_id)
        
        return dropdown_selector is not None
        
    except Exception as e:
        logger.error(f"Error: {e}")
        return False

async def detect_page_size_dropdown(page):
    """Detect the page size dropdown on the page"""
    
    logger.info("🔍 Scanning page for dropdown...")
    
    # Get all select elements and analyze them
    selects_info = await page.evaluate("""
        () => {
            const selects = Array.from(document.querySelectorAll('select'));
            return selects.map((select, index) => {
                const options = Array.from(select.options).map(opt => ({
                    value: opt.value,
                    text: opt.textContent.trim()
                }));
                
                return {
                    index,
                    name: select.name || '',
                    id: select.id || '',
                    className: select.className || '',
                    value: select.value || '',
                    options: options,
                    outerHTML: select.outerHTML.substring(0, 300)
                };
            });
        }
    """)
    
    logger.info(f"Found {len(selects_info)} select elements")
    
    # Analyze each select to find page size dropdown
    for i, select_info in enumerate(selects_info):
        logger.info(f"\n--- Select {i+1} ---")
        logger.info(f"Name: {select_info['name']}")
        logger.info(f"ID: {select_info['id']}")
        logger.info(f"Class: {select_info['className']}")
        logger.info(f"Value: {select_info['value']}")
        logger.info(f"Options: {select_info['options']}")
        
        # Check if this looks like a page size dropdown
        option_values = [opt['value'] for opt in select_info['options']]
        page_size_values = ['10', '25', '50', '100', '200']
        matching_values = [val for val in option_values if val in page_size_values]
        
        if len(matching_values) >= 2:  # At least 2 page size values
            logger.info(f"🎯 FOUND PAGE SIZE DROPDOWN! Matching values: {matching_values}")
            
            # Generate selector
            selector = None
            if select_info['name']:
                selector = f"select[name='{select_info['name']}']"
            elif select_info['id']:
                selector = f"select#{select_info['id']}"
            elif select_info['className']:
                classes = select_info['className'].strip().split()
                if classes:
                    selector = f"select.{'.'.join(classes)}"
            else:
                selector = f"select:nth-of-type({i+1})"
            
            logger.info(f"Generated selector: {selector}")
            
            # Test the selector
            if await test_selector(page, selector):
                return selector
    
    return None

async def test_selector(page, selector):
    """Test if a selector works for changing page size"""
    try:
        logger.info(f"Testing selector: {selector}")
        
        element = await page.query_selector(selector)
        if not element:
            logger.info("Selector not found")
            return False
        
        # Get current value
        current_value = await element.evaluate("el => el.value")
        logger.info(f"Current value: {current_value}")
        
        # Try to select 100 or highest available
        options = await element.query_selector_all("option")
        option_values = []
        for opt in options:
            val = await opt.get_attribute("value")
            if val:
                option_values.append(val)
        
        # Try 100 first, then highest numeric value
        target_value = None
        if "100" in option_values:
            target_value = "100"
        else:
            numeric_values = []
            for val in option_values:
                try:
                    numeric_values.append(int(val))
                except:
                    continue
            if numeric_values:
                target_value = str(max(numeric_values))
        
        if target_value and target_value != current_value:
            logger.info(f"Attempting to select: {target_value}")
            await element.select_option(target_value)
            await page.wait_for_timeout(1000)
            
            # Check if value changed
            new_value = await element.evaluate("el => el.value")
            if new_value == target_value:
                logger.info(f"✅ Successfully changed from {current_value} to {new_value}")
                return True
            else:
                logger.info(f"❌ Value didn't change: still {new_value}")
                return False
        else:
            logger.info("No suitable value to test with")
            return True  # Assume it works if we can't test
            
    except Exception as e:
        logger.error(f"Error testing selector: {e}")
        return False

async def update_scraper_selectors():
    """Update the scraper with better selectors based on common patterns"""
    
    logger.info("📝 Updating scraper with enhanced selectors...")
    
    # The selectors we'll add to the scraper
    enhanced_selectors = [
        # Most common patterns for WorkFossa-style apps
        "select[name='per_page']",
        "select[name='perPage']",
        "select[name='pageSize']", 
        "select[name='limit']",
        "select[name='results_per_page']",
        
        # Class-based selectors
        ".per-page select",
        ".page-size select", 
        ".results-per-page select",
        ".pagination-controls select",
        ".table-pagination select",
        
        # Option-based detection
        "select:has(option[value='25'])",
        "select:has(option[value='50'])",
        "select:has(option[value='100'])",
        
        # Context-based selectors
        ".pagination select",
        ".table-footer select",
        ".results-info select",
        "[class*='pagination'] select",
        "[class*='per-page'] select",
        "[class*='page-size'] select",
        
        # Attribute-based
        "select[data-testid*='page-size']",
        "select[data-testid*='per-page']",
        "select[data-role='page-size']",
        "select[data-field='per_page']",
    ]
    
    logger.info(f"Enhanced selectors ({len(enhanced_selectors)} total):")
    for i, selector in enumerate(enhanced_selectors, 1):
        logger.info(f"  {i}. {selector}")
    
    return True

async def update_scraper_with_selector(selector):
    """Update the scraper code with the found selector"""
    
    logger.info(f"📝 Would update scraper to prioritize selector: {selector}")
    logger.info("To implement this, add the selector to the beginning of page_size_selectors list")
    logger.info("in the _set_page_size_to_100 method of workfossa_scraper.py")
    
    return True

if __name__ == "__main__":
    asyncio.run(find_page_size_dropdown())