#!/usr/bin/env python3
"""
Comprehensive dispenser scraping test with enhanced logging and screenshots
"""
import asyncio
import sys
import os
from datetime import datetime
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from enhanced_logging_system import EnhancedLogger
from screenshot_capture_system import ScreenshotCapture
from check_dispenser_results import format_dispenser_results

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomation
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

async def run_comprehensive_test():
    """Run a comprehensive test of dispenser scraping with all enhancements"""
    
    print("\n🧪 COMPREHENSIVE DISPENSER SCRAPING TEST")
    print("="*80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Initialize systems
    logger = EnhancedLogger("ComprehensiveDispenserTest").get_logger()
    screenshot_capture = ScreenshotCapture()
    
    logger.info("🚀 Starting comprehensive dispenser scraping test")
    
    # Get credentials
    logger.info("🔑 Retrieving WorkFossa credentials...")
    credentials = get_workfossa_credentials()
    
    if not credentials:
        logger.error("❌ No credentials found. Cannot proceed with test.")
        return
    
    logger.info(f"✅ Using credentials for user: {credentials['user_id']}")
    logger.info(f"   Username: {credentials['username']}")
    
    # Initialize services
    browser_automation = BrowserAutomation()
    automation_service = WorkFossaAutomationService(browser_automation)
    scraper = WorkFossaScraper(automation_service)
    
    try:
        # Create session and login
        logger.info("🌐 Creating browser session and logging in...")
        session = await automation_service.create_session(credentials['username'], credentials['password'])
        
        if not session or not session.get('page'):
            logger.error("❌ Failed to create session or login")
            return
        
        page = session['page']
        logger.info("✅ Successfully logged into WorkFossa")
        
        # Capture login success
        await screenshot_capture.capture(page, "Login Success", "Successfully logged into WorkFossa")
        
        # Navigate to work orders
        logger.info("📋 Navigating to work orders page...")
        await page.goto("https://app.workfossa.com/work/visits", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        await screenshot_capture.capture(page, "Work Orders Page", "Initial work orders listing")
        
        # Test 1: Extract customer URLs from work orders
        logger.info("\n🔍 TEST 1: Customer URL Extraction")
        logger.info("="*60)
        
        # Find work order rows
        work_order_rows = await page.query_selector_all('tbody tr')
        logger.info(f"Found {len(work_order_rows)} work order rows")
        
        customer_urls_found = 0
        dispenser_service_orders = []
        
        for i, row in enumerate(work_order_rows[:5]):  # Check first 5
            try:
                # Get work order ID
                wo_link = await row.query_selector('a[href*="/work/visits/"]')
                if wo_link:
                    wo_id = await wo_link.inner_text()
                    logger.info(f"\n  Checking work order: {wo_id}")
                    
                    # Check service description
                    cells = await row.query_selector_all('td')
                    if len(cells) > 2:
                        service_text = await cells[2].inner_text()
                        logger.info(f"  Service: {service_text}")
                        
                        # Check if it's a dispenser service
                        if any(code in service_text for code in ['2861', '2862', '3146', '3002']):
                            dispenser_service_orders.append(wo_id)
                            logger.info("  ✅ This is a dispenser service")
                    
                    # Look for customer URL
                    links = await row.query_selector_all('a')
                    for link in links:
                        href = await link.get_attribute('href')
                        if href and '/customers/locations/' in href:
                            customer_urls_found += 1
                            logger.info(f"  ✅ Found customer URL: {href}")
                            
                            # Capture element screenshot
                            await screenshot_capture.capture_element(
                                page, 
                                f'tr:has-text("{wo_id}")', 
                                f"Work Order Row {wo_id}",
                                "Row containing customer URL link"
                            )
                            break
                    else:
                        logger.warning(f"  ❌ No customer URL found for {wo_id}")
                        
            except Exception as e:
                logger.error(f"  Error processing row {i}: {e}")
        
        logger.info(f"\n📊 Customer URL Extraction Results:")
        logger.info(f"   - Total work orders checked: {min(5, len(work_order_rows))}")
        logger.info(f"   - Customer URLs found: {customer_urls_found}")
        logger.info(f"   - Dispenser service orders: {len(dispenser_service_orders)}")
        
        if customer_urls_found == 0:
            logger.error("❌ No customer URLs found! Cannot proceed with dispenser scraping")
            await screenshot_capture.capture(page, "No Customer URLs", "Failed to find any customer URLs")
            return
        
        # Test 2: Navigate to a customer page and scrape dispensers
        if dispenser_service_orders:
            logger.info("\n🔍 TEST 2: Dispenser Scraping from Customer Page")
            logger.info("="*60)
            
            # Click on first dispenser service order
            wo_id = dispenser_service_orders[0]
            logger.info(f"Testing with work order: {wo_id}")
            
            # Find and click the customer link
            wo_row = await page.query_selector(f'tr:has-text("{wo_id}")')
            if wo_row:
                customer_link = await wo_row.query_selector('a[href*="/customers/locations/"]')
                if customer_link:
                    customer_url = await customer_link.get_attribute('href')
                    full_url = f"https://app.workfossa.com{customer_url}"
                    logger.info(f"Navigating to customer page: {full_url}")
                    
                    await customer_link.click()
                    await page.wait_for_load_state("networkidle")
                    await page.wait_for_timeout(2000)
                    
                    await screenshot_capture.capture(page, "Customer Page", "Customer location details page")
                    
                    # Try to find equipment tab
                    logger.info("Looking for Equipment tab...")
                    equipment_tab = await page.query_selector('text="Equipment"')
                    if equipment_tab:
                        logger.info("✅ Found Equipment tab, clicking...")
                        await equipment_tab.click()
                        await page.wait_for_timeout(2000)
                        
                        await screenshot_capture.capture(page, "Equipment Tab", "After clicking Equipment tab")
                        
                        # Look for Dispensers section
                        logger.info("Looking for Dispensers section...")
                        dispensers_section = await page.query_selector('text="Dispensers"')
                        if dispensers_section:
                            logger.info("✅ Found Dispensers section")
                            
                            # Check if it needs to be expanded
                            expand_button = await page.query_selector('button:has-text("Dispensers")')
                            if expand_button:
                                logger.info("Clicking to expand Dispensers section...")
                                await expand_button.click()
                                await page.wait_for_timeout(1000)
                                
                                await screenshot_capture.capture(page, "Dispensers Expanded", "After expanding Dispensers section")
                            
                            # Look for dispenser information
                            dispenser_elements = await page.query_selector_all('[data-testid*="dispenser"], .dispenser-item, div:has-text("Dispenser #")')
                            logger.info(f"Found {len(dispenser_elements)} potential dispenser elements")
                            
                            if dispenser_elements:
                                await screenshot_capture.capture(page, "Dispensers Found", f"Found {len(dispenser_elements)} dispensers")
                            else:
                                # Try to capture what's visible for debugging
                                equipment_content = await page.query_selector('.equipment-content, main')
                                if equipment_content:
                                    await screenshot_capture.capture_element(
                                        page,
                                        '.equipment-content, main',
                                        "Equipment Content",
                                        "Content of equipment section for debugging"
                                    )
                        else:
                            logger.warning("❌ No Dispensers section found")
                    else:
                        logger.warning("❌ No Equipment tab found")
                        
                        # Capture page content for debugging
                        await screenshot_capture.capture(page, "No Equipment Tab", "Customer page without Equipment tab")
                else:
                    logger.error("❌ Could not find customer link in work order row")
            else:
                logger.error(f"❌ Could not find work order row for {wo_id}")
        
        # Save screenshot index
        screenshot_index = screenshot_capture.save_index()
        logger.info(f"\n📸 Screenshots saved to: {screenshot_capture.session_dir}")
        logger.info(f"🌐 View screenshots: {screenshot_index}")
        
        # Get log summary
        logger.info("\n📊 LOG SUMMARY")
        logger.info("="*60)
        from enhanced_logging_system import enhanced_logger
        print(enhanced_logger.get_log_summary())
        
        # Check database results
        logger.info("\n📊 DATABASE RESULTS")
        logger.info("="*60)
        format_dispenser_results()
        
    except Exception as e:
        logger.error(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        
        # Capture error screenshot if possible
        try:
            if 'page' in locals():
                await screenshot_capture.capture(page, "Error State", f"Error occurred: {str(e)}")
        except:
            pass
    
    finally:
        # Clean up
        logger.info("\n🧹 Cleaning up...")
        if 'page' in locals() and page:
            await page.close()
        if 'browser' in locals() and hasattr(automation_service, 'browser') and automation_service.browser:
            await automation_service.browser.close()
        
        logger.info("✅ Test completed")
        
        # Final summary
        print("\n" + "="*80)
        print("📊 FINAL TEST SUMMARY")
        print("="*80)
        print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"\n📸 Screenshots: {screenshot_capture.session_dir}")
        print(f"📄 View index: file://{screenshot_capture.session_dir}/index.html")
        print(f"\n📝 Log file: {enhanced_logger.log_file}")
        print("\n✅ All test outputs have been saved for analysis")

if __name__ == "__main__":
    asyncio.run(run_comprehensive_test())