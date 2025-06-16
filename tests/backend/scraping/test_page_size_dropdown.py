#!/usr/bin/env python3
"""
Test script to examine the page size dropdown on WorkFossa work orders page
This will help identify the correct selector for changing from 25 to 100 work orders
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from playwright.async_api import async_playwright

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def examine_page_size_dropdown():
    """Navigate to WorkFossa and examine the page size dropdown structure"""
    
    # Get credentials from user
    print("Please enter WorkFossa credentials:")
    email = input("Email: ")
    password = input("Password: ")
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)  # Non-headless to see what's happening
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            logger.info("🔍 Starting page size dropdown examination...")
            
            # Use proven login method from automation service
            LOGIN_URL = "https://app.workfossa.com"  # Correct URL from automation service
            WORK_ORDERS_URL = "https://app.workfossa.com/app/work/list?visit_scheduled=scheduled%7C%7C%7C%7CWith%20Scheduled%20Visits&work_visit_completion=none%7C%7CNo%20visits%20completed%7C%7CWork%20Visits%20Completed&order_direction=asc"
            
            LOGIN_SELECTORS = {
                'email': 'input[type="email"][name="email"]',
                'password': 'input[type="password"][name="password"]', 
                'submit': 'button[type="submit"], input[type="submit"]',
                'error': '.error-message, .form-error, .alert-danger'
            }
            
            SUCCESS_INDICATORS = [
                '**/app/dashboard',
                'nav.main-nav',
                '.dashboard-content',
                '.work-orders-nav'
            ]
            
            # Navigate to correct WorkFossa URL
            logger.info(f"Navigating to: {LOGIN_URL}")
            await page.goto(LOGIN_URL, wait_until="networkidle")
            
            # Wait for login form
            await page.wait_for_selector(LOGIN_SELECTORS['email'], timeout=10000)
            
            # Fill login form
            logger.info("Filling login credentials...")
            await page.fill(LOGIN_SELECTORS['email'], email)
            await page.fill(LOGIN_SELECTORS['password'], password)
            
            # Submit form
            await page.click(LOGIN_SELECTORS['submit'])
            
            # Wait for successful login
            login_success = False
            for indicator in SUCCESS_INDICATORS:
                try:
                    if indicator.startswith('**/'):
                        # URL pattern
                        await page.wait_for_url(indicator, timeout=10000)
                        login_success = True
                        break
                    else:
                        # Selector pattern  
                        await page.wait_for_selector(indicator, timeout=5000)
                        login_success = True
                        break
                except:
                    continue
            
            if not login_success:
                logger.error("❌ Login failed!")
                return
            
            logger.info("✅ Login successful!")
            
            # Navigate to work orders page
            logger.info(f"Navigating to work orders: {WORK_ORDERS_URL}")
            await page.goto(WORK_ORDERS_URL, wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            # Take a screenshot for reference
            await page.screenshot(path="work_orders_page_before.png")
            logger.info("📸 Screenshot saved: work_orders_page_before.png")
            
            # Get current URL
            current_url = page.url
            logger.info(f"Current URL: {current_url}")
            
            logger.info("🔎 Examining page structure for dropdowns...")
            
            # Find all select elements on the page
            all_selects = await page.query_selector_all("select")
            logger.info(f"Found {len(all_selects)} select elements on the page")
            
            for i, select in enumerate(all_selects):
                try:
                    # Get select attributes
                    name = await select.get_attribute("name") or "no-name"
                    id_attr = await select.get_attribute("id") or "no-id"
                    class_attr = await select.get_attribute("class") or "no-class"
                    
                    # Get options
                    options = await select.query_selector_all("option")
                    option_info = []
                    for option in options:
                        value = await option.get_attribute("value") or ""
                        text = await option.text_content() or ""
                        selected = await option.get_attribute("selected") is not None
                        option_info.append(f"value='{value}', text='{text}', selected={selected}")
                    
                    logger.info(f"Select {i+1}:")
                    logger.info(f"  Name: {name}")
                    logger.info(f"  ID: {id_attr}")
                    logger.info(f"  Class: {class_attr}")
                    logger.info(f"  Options: {option_info}")
                    
                    # Check if this looks like a page size dropdown
                    page_size_indicators = ['25', '50', '100', '10', '20']
                    option_values = [await opt.get_attribute("value") for opt in options]
                    if any(indicator in str(option_values) for indicator in page_size_indicators):
                        logger.info(f"  🎯 This looks like the PAGE SIZE dropdown!")
                        
                        # Try to select 100
                        if "100" in option_values:
                            logger.info(f"  ✅ Found option '100', attempting to select it...")
                            await select.select_option("100")
                            await page.wait_for_timeout(2000)
                            await page.wait_for_load_state("networkidle")
                            logger.info(f"  ✅ Successfully selected 100!")
                            
                            # Take screenshot after change
                            await page.screenshot(path="work_orders_page_after_100.png")
                            logger.info("📸 Screenshot after selecting 100: work_orders_page_after_100.png")
                        else:
                            logger.info(f"  ❌ Option '100' not available in this dropdown")
                    
                except Exception as e:
                    logger.error(f"Error examining select {i+1}: {e}")
            
            # Also look for custom dropdowns (non-select elements)
            logger.info("\n🔎 Looking for custom dropdowns...")
            
            # Look for elements that might be custom dropdowns containing "25"
            elements_with_25 = await page.query_selector_all("*:has-text('25')")
            logger.info(f"Found {len(elements_with_25)} elements containing '25'")
            
            for i, element in enumerate(elements_with_25[:10]):  # Limit to first 10
                try:
                    tag_name = await element.evaluate("el => el.tagName.toLowerCase()")
                    class_attr = await element.get_attribute("class") or "no-class"
                    text_content = await element.text_content()
                    
                    # Only show elements that might be dropdowns
                    if tag_name in ["div", "button", "span"] and "25" in text_content:
                        logger.info(f"Custom dropdown candidate {i+1}:")
                        logger.info(f"  Tag: {tag_name}")
                        logger.info(f"  Class: {class_attr}")
                        logger.info(f"  Text: {text_content[:100]}...")
                        
                        # Check if it's clickable and might open a dropdown
                        if tag_name == "button" or "dropdown" in class_attr.lower() or "select" in class_attr.lower():
                            logger.info(f"  🎯 This might be a custom dropdown!")
                            
                except Exception as e:
                    logger.debug(f"Error examining element {i+1}: {e}")
            
            # Look specifically in pagination areas
            logger.info("\n🔎 Looking in pagination areas...")
            pagination_selectors = [
                ".pagination",
                ".page-controls", 
                ".table-footer",
                ".results-info",
                ".per-page",
                ".page-size",
                "[class*='pagination']",
                "[class*='page']"
            ]
            
            for selector in pagination_selectors:
                try:
                    pagination_areas = await page.query_selector_all(selector)
                    if pagination_areas:
                        logger.info(f"Found pagination area with selector: {selector}")
                        
                        for i, area in enumerate(pagination_areas):
                            area_text = await area.text_content()
                            if area_text and "25" in area_text:
                                logger.info(f"  Pagination area {i+1} contains '25': {area_text[:100]}...")
                                
                                # Look for selects or buttons in this area
                                controls = await area.query_selector_all("select, button, [role='button']")
                                for j, control in enumerate(controls):
                                    control_tag = await control.evaluate("el => el.tagName.toLowerCase()")
                                    control_text = await control.text_content()
                                    logger.info(f"    Control {j+1}: {control_tag} - {control_text}")
                                    
                except Exception as e:
                    logger.debug(f"Error checking pagination selector {selector}: {e}")
            
            # Generate a comprehensive CSS selector report
            logger.info("\n📋 Generating comprehensive selector report...")
            
            # Get page HTML for analysis
            page_content = await page.content()
            
            # Save the HTML for manual inspection if needed
            with open("work_orders_page.html", "w", encoding="utf-8") as f:
                f.write(page_content)
            logger.info("💾 Full page HTML saved: work_orders_page.html")
            
            logger.info("\n✅ Page size dropdown examination complete!")
            logger.info("Check the screenshots and HTML file for manual analysis if needed.")
            
        except Exception as e:
            logger.error(f"❌ Error during examination: {e}")
            await page.screenshot(path="error_screenshot.png")
            logger.info("📸 Error screenshot saved: error_screenshot.png")
            
        finally:
            logger.info("🔄 Keeping browser open for 30 seconds for manual inspection...")
            await page.wait_for_timeout(30000)  # Keep open for 30 seconds
            await browser.close()

if __name__ == "__main__":
    asyncio.run(examine_page_size_dropdown())