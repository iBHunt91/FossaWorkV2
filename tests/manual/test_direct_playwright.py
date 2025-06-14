#!/usr/bin/env python3
"""
Direct Playwright test for dispenser scraping
"""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
import logging

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from enhanced_logging_system import EnhancedLogger
from screenshot_capture_system import ScreenshotCapture
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

# Set up logging
logger = EnhancedLogger("DirectPlaywrightTest").get_logger()

async def main():
    """Direct test using Playwright"""
    
    logger.info("🧪 DIRECT PLAYWRIGHT DISPENSER TEST")
    logger.info("="*60)
    
    # Get credentials
    logger.info("🔑 Getting credentials...")
    creds = get_workfossa_credentials()
    
    if not creds:
        logger.error("No credentials found!")
        return
    
    logger.info(f"✅ Using credentials for: {creds['username']}")
    
    # Initialize screenshot capture
    screenshot_capture = ScreenshotCapture()
    
    async with async_playwright() as p:
        # Launch browser
        logger.info("🌐 Launching browser...")
        browser = await p.chromium.launch(
            headless=False,  # Set to False to see what's happening
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()
        
        try:
            # Navigate to login
            logger.info("📍 Navigating to WorkFossa login...")
            await page.goto("https://app.workfossa.com/users/sign_in", wait_until="networkidle")
            await screenshot_capture.capture(page, "Login Page", "WorkFossa login page")
            
            # Login
            logger.info("🔐 Logging in...")
            await page.fill('input[id="user_email"]', creds['username'])
            await page.fill('input[id="user_password"]', creds['password'])
            await page.click('button[type="submit"]')
            
            # Wait for navigation
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(2000)
            
            # Check if logged in
            if "sign_in" in page.url:
                logger.error("❌ Login failed - still on login page")
                await screenshot_capture.capture(page, "Login Failed", "Failed to login")
                return
            
            logger.info("✅ Successfully logged in!")
            await screenshot_capture.capture(page, "Dashboard", "After successful login")
            
            # Navigate to work orders
            logger.info("📋 Navigating to work orders...")
            await page.goto("https://app.workfossa.com/work/visits", wait_until="networkidle")
            await page.wait_for_timeout(2000)
            await screenshot_capture.capture(page, "Work Orders Page", "Work orders listing")
            
            # Check for page size dropdown
            logger.info("🔍 Looking for page size controls...")
            page_size_selectors = [
                'select[name="per_page"]',
                'select[name="pageSize"]',
                '.pagination select',
                'select:has(option[value="25"])',
                '[data-testid*="page-size"]',
                '.page-size-selector'
            ]
            
            page_size_found = False
            for selector in page_size_selectors:
                element = await page.query_selector(selector)
                if element:
                    logger.info(f"✅ Found page size control: {selector}")
                    page_size_found = True
                    try:
                        await element.select_option("100")
                        await page.wait_for_timeout(2000)
                        logger.info("Changed page size to 100")
                        await screenshot_capture.capture(page, "Page Size Changed", "After changing page size")
                    except:
                        logger.warning("Could not change page size")
                    break
            
            if not page_size_found:
                logger.warning("⚠️ No page size control found")
            
            # Look for work order rows
            logger.info("🔍 Looking for work order rows...")
            rows = await page.query_selector_all('tbody tr')
            logger.info(f"Found {len(rows)} work order rows")
            
            # Check for customer URLs
            customer_urls_found = []
            for i, row in enumerate(rows[:5]):  # Check first 5
                # Get work order ID
                wo_link = await row.query_selector('a[href*="/work/visits/"]')
                wo_id = None
                if wo_link:
                    wo_id = await wo_link.inner_text()
                    logger.info(f"\n  Checking work order: {wo_id}")
                
                # Look for customer links
                customer_links = await row.query_selector_all('a[href*="/customers/locations/"]')
                if customer_links:
                    for link in customer_links:
                        href = await link.get_attribute('href')
                        text = await link.inner_text()
                        logger.info(f"  ✅ Found customer link: {text} -> {href}")
                        customer_urls_found.append({
                            'wo_id': wo_id,
                            'href': href,
                            'text': text
                        })
                else:
                    # Debug what links ARE present
                    all_links = await row.query_selector_all('a')
                    logger.info(f"  ❌ No customer URL found. Links present: {len(all_links)}")
                    for link in all_links[:3]:  # Show first 3 links
                        href = await link.get_attribute('href')
                        text = await link.inner_text()
                        logger.info(f"     - {text}: {href}")
            
            logger.info(f"\n📊 Customer URLs found: {len(customer_urls_found)}")
            
            # If we found customer URLs, try to scrape dispensers
            if customer_urls_found:
                logger.info("\n⛽ Testing dispenser scraping...")
                
                # Navigate to first customer page
                first_customer = customer_urls_found[0]
                full_url = f"https://app.workfossa.com{first_customer['href']}"
                logger.info(f"Navigating to: {full_url}")
                
                await page.goto(full_url, wait_until="networkidle")
                await page.wait_for_timeout(2000)
                await screenshot_capture.capture(page, "Customer Page", "Customer location page")
                
                # Look for Equipment tab
                logger.info("Looking for Equipment tab...")
                equipment_tab = await page.query_selector('text="Equipment"')
                if equipment_tab:
                    logger.info("✅ Found Equipment tab")
                    await equipment_tab.click()
                    await page.wait_for_timeout(2000)
                    await screenshot_capture.capture(page, "Equipment Tab", "After clicking Equipment")
                    
                    # Look for dispensers
                    logger.info("Looking for dispensers...")
                    dispenser_selectors = [
                        'text="Dispensers"',
                        '[data-testid*="dispenser"]',
                        '.dispenser-item',
                        'div:has-text("Dispenser #")'
                    ]
                    
                    for selector in dispenser_selectors:
                        elements = await page.query_selector_all(selector)
                        if elements:
                            logger.info(f"✅ Found {len(elements)} elements with selector: {selector}")
                            await screenshot_capture.capture(page, "Dispensers Found", f"Found dispensers with {selector}")
                            break
                else:
                    logger.warning("❌ No Equipment tab found")
                    
                    # Try to understand page structure
                    logger.info("📸 Capturing page structure...")
                    tabs = await page.query_selector_all('[role="tab"], .tab, .nav-link')
                    logger.info(f"Found {len(tabs)} tab-like elements")
                    for tab in tabs[:5]:
                        text = await tab.inner_text()
                        logger.info(f"  Tab: {text}")
            else:
                logger.warning("⚠️ No customer URLs found - cannot test dispenser scraping")
                
                # Let's examine the page structure more
                logger.info("\n🔍 Debugging page structure...")
                
                # Check table headers
                headers = await page.query_selector_all('thead th')
                if headers:
                    logger.info("Table headers:")
                    for h in headers:
                        text = await h.inner_text()
                        logger.info(f"  - {text}")
                
                # Check first row in detail
                first_row = rows[0] if rows else None
                if first_row:
                    logger.info("\nFirst row HTML structure:")
                    cells = await first_row.query_selector_all('td')
                    for i, cell in enumerate(cells):
                        text = await cell.inner_text()
                        logger.info(f"  Cell {i}: {text[:50]}...")
                        
                        # Check for links in this cell
                        links = await cell.query_selector_all('a')
                        if links:
                            for link in links:
                                href = await link.get_attribute('href')
                                link_text = await link.inner_text()
                                logger.info(f"    Link: {link_text} -> {href}")
            
            # Save screenshot index
            screenshot_index = screenshot_capture.save_index()
            logger.info(f"\n📸 Screenshots saved to: {screenshot_index}")
            
        except Exception as e:
            logger.error(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            
            # Try to capture error state
            try:
                await screenshot_capture.capture(page, "Error State", str(e))
            except:
                pass
        
        finally:
            await browser.close()
    
    # Final summary
    from enhanced_logging_system import enhanced_logger
    print("\n" + enhanced_logger.get_log_summary())
    
    logger.info("\n✅ Test complete!")

if __name__ == "__main__":
    asyncio.run(main())