#!/usr/bin/env python3
"""
Simple script to inspect page size dropdown elements on WorkFossa
This will help identify the correct selector
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

async def inspect_page_size_dropdown():
    """Simple inspection of page size dropdown using existing session approach"""
    
    async with async_playwright() as p:
        # Launch browser in non-headless mode for manual inspection
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            logger.info("🔍 Starting simple page size dropdown inspection...")
            
            # Navigate directly to work orders page (will show login if needed)
            work_orders_url = "https://app.workfossa.com/app/work/list"
            logger.info(f"Navigating to: {work_orders_url}")
            await page.goto(work_orders_url, wait_until="networkidle")
            
            # Wait for user to manually log in if needed
            print("\n" + "="*60)
            print("MANUAL STEP: Please log in to WorkFossa if needed")
            print("Make sure you're on the work orders page")
            print("Look for the dropdown that shows '25' items per page")
            print("="*60)
            input("Press Enter when you're ready to inspect the page...")
            
            # Wait a moment for page to stabilize
            await page.wait_for_timeout(2000)
            
            # Take initial screenshot
            await page.screenshot(path="page_before_inspection.png", full_page=True)
            logger.info("📸 Screenshot saved: page_before_inspection.png")
            
            # Simple approach: log all elements containing "25"
            logger.info("\n🔍 Looking for elements containing '25'...")
            
            # Execute JavaScript to find all elements containing "25"
            elements_info = await page.evaluate("""
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
                            results.push({
                                tagName: node.tagName.toLowerCase(),
                                id: node.id || '',
                                className: node.className || '',
                                textContent: text.trim().substring(0, 100),
                                innerHTML: node.innerHTML.substring(0, 200),
                                name: node.name || '',
                                value: node.value || '',
                                type: node.type || '',
                                visible: rect.width > 0 && rect.height > 0,
                                selector: node.tagName.toLowerCase() + 
                                    (node.id ? '#' + node.id : '') +
                                    (node.className ? '.' + node.className.split(' ').join('.') : '')
                            });
                        }
                    }
                    return results;
                }
            """)
            
            logger.info(f"Found {len(elements_info)} elements containing '25'")
            
            # Filter and display potential page size dropdowns
            for i, elem in enumerate(elements_info):
                if elem['visible'] and elem['tagName'] in ['select', 'div', 'button', 'span']:
                    logger.info(f"\n--- Element {i+1} ---")
                    logger.info(f"Tag: {elem['tagName']}")
                    logger.info(f"ID: {elem['id']}")
                    logger.info(f"Class: {elem['className']}")
                    logger.info(f"Name: {elem['name']}")
                    logger.info(f"Type: {elem['type']}")
                    logger.info(f"Value: {elem['value']}")
                    logger.info(f"Text: {elem['textContent']}")
                    logger.info(f"HTML: {elem['innerHTML']}")
                    logger.info(f"Suggested selector: {elem['selector']}")
                    
                    # Check if it's likely a page size dropdown
                    is_select = elem['tagName'] == 'select'
                    has_size_text = any(word in elem['textContent'].lower() for word in ['per page', 'page size', 'results', 'show'])
                    has_dropdown_class = any(word in elem['className'].lower() for word in ['dropdown', 'select', 'page', 'size'])
                    
                    if is_select or has_size_text or has_dropdown_class:
                        logger.info("🎯 This looks like a potential page size dropdown!")
            
            # Also find all select elements and check their options
            logger.info("\n🔍 Examining all SELECT elements...")
            
            all_selects = await page.query_selector_all("select")
            logger.info(f"Found {len(all_selects)} select elements")
            
            for i, select in enumerate(all_selects):
                try:
                    # Get select attributes
                    attrs = await page.evaluate("""
                        (select) => ({
                            name: select.name || '',
                            id: select.id || '',
                            className: select.className || '',
                            value: select.value || ''
                        })
                    """, select)
                    
                    # Get options
                    options = await select.query_selector_all("option")
                    option_values = []
                    option_texts = []
                    
                    for option in options:
                        value = await option.get_attribute("value") or ""
                        text = await option.text_content() or ""
                        option_values.append(value)
                        option_texts.append(text)
                    
                    logger.info(f"\n--- Select {i+1} ---")
                    logger.info(f"Name: {attrs['name']}")
                    logger.info(f"ID: {attrs['id']}")
                    logger.info(f"Class: {attrs['className']}")
                    logger.info(f"Current Value: {attrs['value']}")
                    logger.info(f"Option Values: {option_values}")
                    logger.info(f"Option Texts: {option_texts}")
                    
                    # Check if this contains typical page size values
                    page_size_values = ['10', '25', '50', '100', '200']
                    matching_values = [val for val in option_values if val in page_size_values]
                    
                    if matching_values:
                        logger.info(f"🎯 FOUND PAGE SIZE DROPDOWN! Matching values: {matching_values}")
                        
                        # Generate selectors for this dropdown
                        selectors = []
                        if attrs['name']:
                            selectors.append(f"select[name='{attrs['name']}']")
                        if attrs['id']:
                            selectors.append(f"select#{attrs['id']}")
                        if attrs['className']:
                            class_selector = '.' + attrs['className'].replace(' ', '.')
                            selectors.append(f"select{class_selector}")
                        
                        logger.info(f"Recommended selectors: {selectors}")
                        
                        # Try to select 100 if available
                        if "100" in option_values:
                            logger.info("Attempting to select '100'...")
                            try:
                                await select.select_option("100")
                                await page.wait_for_timeout(2000)
                                await page.wait_for_load_state("networkidle")
                                logger.info("✅ Successfully selected 100!")
                                
                                # Take screenshot after change
                                await page.screenshot(path="page_after_100_selected.png", full_page=True)
                                logger.info("📸 Screenshot after selecting 100: page_after_100_selected.png")
                            except Exception as e:
                                logger.error(f"Failed to select 100: {e}")
                
                except Exception as e:
                    logger.error(f"Error examining select {i+1}: {e}")
            
            logger.info("\n✅ Inspection complete!")
            logger.info("Check the screenshots and logs above for the correct selector")
            
            # Keep browser open for manual inspection
            print("\nBrowser will stay open for 60 seconds for manual inspection...")
            await page.wait_for_timeout(60000)
            
        except Exception as e:
            logger.error(f"❌ Error during inspection: {e}")
            await page.screenshot(path="error_screenshot.png")
            
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_page_size_dropdown())