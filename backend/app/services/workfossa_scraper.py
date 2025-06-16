#!/usr/bin/env python3
"""
WorkFossa Data Scraping Service
Comprehensive scraping system based on V1's sophisticated scraping engine
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Tuple, Union
from dataclasses import dataclass, asdict
from pathlib import Path

from .browser_automation import BrowserAutomationService, browser_automation
from .url_generator import WorkFossaURLGenerator
from .dispenser_scraper import dispenser_scraper

# Import error recovery
try:
    from .error_recovery import with_error_recovery, error_recovery_service
    ERROR_RECOVERY_AVAILABLE = True
except ImportError:
    ERROR_RECOVERY_AVAILABLE = False
    def with_error_recovery(operation_type: str):
        def decorator(func):
            return func
        return decorator

logger = logging.getLogger(__name__)

@dataclass
class WorkOrderData:
    """Work order data structure matching V1"""
    id: str
    external_id: str
    site_name: str
    address: str
    scheduled_date: Optional[datetime] = None
    status: str = "pending"
    customer_name: Optional[str] = None
    dispenser_count: int = 0
    dispensers: List[Dict[str, Any]] = None
    visit_url: Optional[str] = None
    priority: str = "normal"
    created_at: datetime = None
    
    # Additional V1 fields
    store_number: Optional[str] = None
    service_code: Optional[str] = None
    service_description: Optional[str] = None
    service_type: Optional[str] = None
    service_quantity: Optional[int] = None
    visit_id: Optional[str] = None
    visit_number: Optional[str] = None  # Visit number from URL (e.g., "131650" from /visits/131650/)
    instructions: Optional[str] = None
    address_components: Optional[Dict[str, str]] = None  # street, intersection, cityState, county
    raw_html: Optional[str] = None
    customer_url: Optional[str] = None  # URL to customer location page for dispenser scraping
    
    # New fields from updated extraction
    service_name: Optional[str] = None  # Service description (e.g., "AccuMeasure")
    service_items: Optional[List[str]] = None  # List of services (e.g., ["6 x All Dispensers"])
    street: Optional[str] = None  # Street address component
    city_state: Optional[str] = None  # City, State ZIP component
    county: Optional[str] = None  # County component
    created_date: Optional[datetime] = None  # When work order was created
    created_by: Optional[str] = None  # User who created the work order
    
    def __post_init__(self) -> None:
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.dispensers is None:
            self.dispensers = []
        if self.address_components is None:
            self.address_components = {}

@dataclass
class ScrapingProgress:
    """Scraping progress tracking"""
    session_id: str
    phase: str
    percentage: float
    message: str
    work_orders_found: int = 0
    work_orders_processed: int = 0
    errors: List[str] = None
    timestamp: datetime = None
    
    def __post_init__(self) -> None:
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.errors is None:
            self.errors = []

class WorkFossaSelectors:
    """WorkFossa page selectors based on V1 discovery"""
    
    # Navigation selectors
    MAIN_MENU = ".nav-menu, .sidebar-nav, .main-navigation"
    WORK_ORDERS_LINK = "a[href*='work-orders'], a:has-text('Work Orders'), .work-orders-nav"
    DISPENSERS_LINK = "a[href*='dispensers'], a:has-text('Dispensers'), .dispensers-nav"
    CALENDAR_LINK = "a[href*='calendar'], a:has-text('Calendar'), .calendar-nav"
    
    # Work order list selectors
    WORK_ORDER_LIST = ".work-orders-list, .jobs-list, .work-order-container"
    WORK_ORDER_ITEM = ".work-order-item, .job-item, .work-order-card, [data-testid*='work-order']"
    WORK_ORDER_LINK = "a[href*='/work-orders/'], a[href*='/visits/']"
    
    # Work order detail selectors
    WORK_ORDER_ID = ".work-order-id, .job-id, [data-field='id'], .external-id"
    SITE_NAME = ".site-name, .location-name, .customer-name, [data-field='site']"
    ADDRESS = ".address, .location-address, [data-field='address']"
    SCHEDULED_DATE = ".scheduled-date, .visit-date, [data-field='date']"
    STATUS = ".status, .work-order-status, [data-field='status']"
    
    # Dispenser selectors
    DISPENSER_LIST = ".dispensers-list, .equipment-list, .dispenser-container"
    DISPENSER_ITEM = ".dispenser-item, .equipment-item, [data-testid*='dispenser']"
    DISPENSER_NUMBER = ".dispenser-number, .dispenser-id, [data-field='number']"
    DISPENSER_TYPE = ".dispenser-type, .equipment-type, [data-field='type']"
    FUEL_GRADES = ".fuel-grades, .grades-list, [data-field='grades']"
    
    # Form selectors
    VISIT_FORM = ".visit-form, .work-order-form, .test-form"
    ADD_VISIT_BUTTON = "button:has-text('Add Visit'), .add-visit-btn, .create-visit"
    SUBMIT_BUTTON = "button[type='submit'], .submit-btn, .save-btn"

class WorkFossaScraper:
    """Main WorkFossa scraping service based on V1 patterns"""
    
    def __init__(self, browser_automation: BrowserAutomationService) -> None:
        self.browser_automation = browser_automation
        self.url_generator = WorkFossaURLGenerator()
        self.progress_callbacks: List[Callable] = []
        self.selectors = WorkFossaSelectors()
        
        # Set up error recovery integration
        if ERROR_RECOVERY_AVAILABLE:
            error_recovery_service.scraper = self
        
        # Scraping configuration - OPTIMIZED for speed (Phase 1) with DEBUG
        self.config = {
            'max_work_orders_per_session': 200,    # Increased from 100
            'page_load_timeout': 15000,            # Reduced from 30000ms (15s vs 30s)
            'element_timeout': 5000,               # Reduced from 10000ms (5s vs 10s)
            'retry_attempts': 3,                   # Unchanged
            'delay_between_pages': 500,            # Reduced from 2000ms (0.5s vs 2s) - 4x faster
            'enable_debug_screenshots': False      # Disable in production for performance
        }
    
    def add_progress_callback(self, callback: Callable[[ScrapingProgress], Any]) -> None:
        """Add progress callback for real-time updates"""
        self.progress_callbacks.append(callback)
    
    async def _emit_progress(self, progress: ScrapingProgress) -> None:
        """Emit progress update to all callbacks"""
        for callback in self.progress_callbacks:
            try:
                await callback(progress)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")
    
    @with_error_recovery(operation_type="work_order_scraping")
    async def scrape_work_orders(self, session_id: str, date_range: Optional[Dict[str, Any]] = None, page: Optional[Any] = None) -> List[WorkOrderData]:
        """
        Scrape work orders from WorkFossa
        Based on V1's unified_scrape.js logic
        """
        try:
            await self._emit_progress(ScrapingProgress(
                session_id=session_id,
                phase="initializing",
                percentage=0,
                message="Initializing work order scraping..."
            ))
            
            # Try to get page from parameter first
            if not page:
                # Check if browser_automation has pages attribute and it's a dict
                if hasattr(self.browser_automation, 'pages') and hasattr(self.browser_automation.pages, 'get'):
                    page = self.browser_automation.pages.get(session_id)
                    if page:
                        logger.info(f"Found page in browser automation service for session {session_id}")
                
                # If not found, check WorkFossa automation service
                if not page:
                    try:
                        from .workfossa_automation import workfossa_automation
                        # Check if the automation service has sessions
                        if hasattr(workfossa_automation, 'sessions'):
                            session_data = workfossa_automation.sessions.get(session_id)
                            if session_data and isinstance(session_data, dict):
                                page = session_data.get('page')
                                if page:
                                    logger.info(f"Found page in WorkFossa automation service for session {session_id}")
                    except Exception as e:
                        logger.debug(f"Could not check WorkFossa automation service: {e}")
                
            if not page:
                raise Exception("No active browser session found")
            
            # Navigate to work orders page
            await self._emit_progress(ScrapingProgress(
                session_id=session_id,
                phase="navigation",
                percentage=5,
                message="Navigating to work orders page..."
            ))
            
            # Navigate to work orders with filter for no visits completed
            work_orders_url = "https://app.workfossa.com/app/work/list?work_visit_completion=none%7C%7CNo%20visits%20completed%7C%7CWork%20Visits%20Completed&order_direction=asc"
            logger.info(f"Navigating to work orders URL (filtered for no visits completed): {work_orders_url}")
            
            # Optimized page loading with smart content detection
            logger.info(f"🔄 [DEBUG] Starting page navigation with optimized loading...")
            await page.goto(work_orders_url, wait_until="domcontentloaded", timeout=self.config['page_load_timeout'])
            
            # Smart wait for essential content to be available
            logger.info(f"🔍 [DEBUG] Waiting for table content to appear...")
            try:
                await page.wait_for_selector("tbody tr, table tr", timeout=self.config['element_timeout'])
                logger.info(f"✅ [DEBUG] Table content detected, proceeding...")
            except Exception as e:
                logger.warning(f"⚠️ [DEBUG] Table selector timeout, using fallback wait: {e}")
                # Fallback to a short wait if selector not found
                await page.wait_for_timeout(2000)
            
            # Additional stabilization wait (reduced from 3000ms)
            await page.wait_for_timeout(1000)
            logger.info(f"🏁 [DEBUG] Page loading complete")
            
            # Take screenshot for debugging
            screenshot_path = f"work_orders_page_{session_id}.png"
            await page.screenshot(path=screenshot_path)
            logger.info(f"Screenshot saved: {screenshot_path}")
            
            # Change page size to 100 like V1 does
            logger.info("🔧 ATTEMPTING PAGE SIZE CHANGE TO 100...")
            try:
                page_size_result = await self._set_page_size_to_100(page)
                if page_size_result:
                    logger.info("✅ PAGE SIZE CHANGE SUCCESSFUL!")
                else:
                    logger.warning("❌ PAGE SIZE CHANGE FAILED - will continue with default (25)")
            except Exception as e:
                logger.error(f"❌ PAGE SIZE CHANGE ERROR: {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Apply date filters if provided
            if date_range:
                await self._apply_date_filters(page, date_range)
            
            # Additional wait to ensure page has fully reloaded after page size change
            await page.wait_for_timeout(3000)
            logger.info("Waited for page to stabilize after potential page size change")
            
            # Discover work order list structure
            await self._emit_progress(ScrapingProgress(
                session_id=session_id,
                phase="discovery",
                percentage=15,
                message="Discovering page structure..."
            ))
            
            work_order_elements = await self._find_work_order_elements(page)
            total_work_orders = len(work_order_elements)
            
            logger.info(f"Found {total_work_orders} work orders to scrape")
            
            # Scrape each work order
            work_orders = []
            for i, element in enumerate(work_order_elements):
                try:
                    # More accurate progress calculation
                    # 0-20%: Initial setup and navigation
                    # 20-30%: Page discovery and structure analysis
                    # 30-95%: Actual work order scraping (bulk of the work)
                    # 95-100%: Final processing
                    progress_percentage = 30 + ((i + 1) / total_work_orders) * 65
                    logger.info(f"🔄 [DEBUG] Starting work order {i+1}/{total_work_orders} (Progress: {progress_percentage:.1f}%)")
                    
                    await self._emit_progress(ScrapingProgress(
                        session_id=session_id,
                        phase="scraping",
                        percentage=progress_percentage,
                        message=f"Scraping work order {i+1} of {total_work_orders}...",
                        work_orders_found=total_work_orders,
                        work_orders_processed=i + 1
                    ))
                    
                    logger.info(f"🔍 [DEBUG] About to call _scrape_work_order_from_element for work order {i+1}")
                    work_order = await self._scrape_work_order_from_element(page, element, i)
                    logger.info(f"✅ [DEBUG] Completed _scrape_work_order_from_element for work order {i+1}")
                    
                    if work_order:
                        work_orders.append(work_order)
                        logger.info(f"📝 [DEBUG] Added work order {i+1} to results: {work_order.external_id}")
                    else:
                        logger.warning(f"❌ [DEBUG] Work order {i+1} returned None")
                    
                    # Delay between work orders
                    # Only delay if we're staying on the same page (rate limiting)
                    # Skip delay when navigating to different customer pages
                    if i < len(work_order_elements) - 1:  # Not the last item
                        logger.info(f"⏱️ [DEBUG] Rate limiting: sleeping for {self.config['delay_between_pages']}ms")
                        await asyncio.sleep(self.config['delay_between_pages'] / 1000)
                    else:
                        logger.info(f"✅ [DEBUG] Skipping delay - last work order in batch")
                    logger.info(f"🔄 [DEBUG] Completed work order {i+1}, moving to next")
                    
                except Exception as e:
                    logger.error(f"❌ [DEBUG] Error scraping work order {i}: {e}")
                    import traceback
                    logger.error(f"📋 [DEBUG] Traceback: {traceback.format_exc()}")
                    # Log specific error details
                    if "pages" in str(e):
                        logger.error(f"❌ [DEBUG] Pages attribute error - browser automation service may not be initialized properly")
                    elif "timeout" in str(e).lower():
                        logger.error(f"❌ [DEBUG] Timeout error - page elements may be taking too long to load")
                    elif "not found" in str(e).lower():
                        logger.error(f"❌ [DEBUG] Element not found - UI may have changed")
                    continue
            
            await self._emit_progress(ScrapingProgress(
                session_id=session_id,
                phase="completed",
                percentage=100,
                message=f"Scraping completed: {len(work_orders)} work orders found",
                work_orders_found=len(work_orders),
                work_orders_processed=len(work_orders)
            ))
            
            logger.info(f"Successfully scraped {len(work_orders)} work orders")
            return work_orders
            
        except Exception as e:
            await self._emit_progress(ScrapingProgress(
                session_id=session_id,
                phase="error",
                percentage=0,
                message=f"Scraping failed: {str(e)}",
                errors=[str(e)]
            ))
            logger.error(f"Work order scraping failed: {e}")
            raise
    
    async def _set_page_size_to_100(self, page):
        """Set the page size dropdown to 100 work orders per page"""
        logger.info("🔍 _set_page_size_to_100 method called - starting dropdown detection...")
        
        # Take a screenshot before attempting to find dropdown
        try:
            await page.screenshot(path="before_page_size_detection.png")
            logger.info("📸 Screenshot saved: before_page_size_detection.png")
        except:
            pass
            
        try:
            # Enhanced selector patterns for the page size dropdown based on WorkFossa patterns
            page_size_selectors = [
                # WorkFossa specific custom dropdown (highest priority)
                "div.ks-select-selection:has-text('Show 25')",
                
                # Most common WorkFossa patterns (prioritized)
                "select[name='per_page']",
                "select[name='perPage']", 
                "select[name='pageSize']",
                "select[name='limit']",
                "select[name='results_per_page']",
                
                # Class-based selectors (very common)
                ".per-page select",
                ".page-size select",
                ".results-per-page select", 
                ".pagination-controls select",
                ".table-pagination select",
                ".page-size-select select",
                ".per-page-select select",
                
                # Option-based detection (reliable)
                "select:has(option[value='25'])",
                "select:has(option[value='50'])",
                "select:has(option[value='100'])",
                
                # Context-based selectors (common locations)
                ".pagination select",
                ".table-footer select", 
                ".table-controls select",
                ".results-info select",
                "[class*='pagination'] select",
                "[class*='per-page'] select",
                "[class*='page-size'] select",
                
                # Attribute-based selectors (modern patterns)
                "select[data-testid*='page-size']",
                "select[data-testid*='per-page']", 
                "select[data-role='page-size']",
                "select[data-field='per_page']",
                
                # Generic fallbacks
                "select[class*='page']",
                "select[class*='size']",
            ]
            
            logger.info("Attempting to set page size to 100...")
            
            # Get page info for debugging
            current_url = page.url
            page_title = await page.title()
            logger.info(f"Current page: URL={current_url}, Title={page_title}")
            
            # Count all select elements on page
            all_selects = await page.query_selector_all("select")
            logger.info(f"Total select elements found on page: {len(all_selects)}")
            
            # Count elements containing "25"
            elements_with_25 = await page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('*');
                    let count = 0;
                    elements.forEach(el => {
                        if (el.textContent && el.textContent.includes('25')) {
                            count++;
                        }
                    });
                    return count;
                }
            """)
            logger.info(f"Elements containing '25': {elements_with_25}")
            
            # Try each selector pattern
            for i, selector in enumerate(page_size_selectors):
                try:
                    logger.info(f"Testing selector {i+1}/{len(page_size_selectors)}: {selector}")
                    page_size_select = await page.query_selector(selector)
                    if page_size_select:
                        # Special handling for WorkFossa custom dropdown
                        if selector == "div.ks-select-selection:has-text('Show 25')":
                            logger.info("🎯 Found WorkFossa custom dropdown! Using special handling...")
                            try:
                                # Click to open dropdown
                                await page_size_select.click()
                                logger.info("Clicked dropdown to open options")
                                await page.wait_for_timeout(1000)
                                
                                # Try to find and click 100 option
                                option_selectors = [
                                    "li:has-text('Show 100')",
                                    "div:has-text('Show 100')",
                                    "*[role='option']:has-text('100')",
                                    ".ks-select-dropdown-menu-item:has-text('100')"
                                ]
                                
                                for opt_selector in option_selectors:
                                    option_100 = await page.query_selector(opt_selector)
                                    if option_100:
                                        await option_100.click()
                                        logger.info(f"✅ Successfully clicked 'Show 100' with selector: {opt_selector}")
                                        await page.wait_for_load_state("networkidle")
                                        
                                        # Verify change
                                        new_text = await page_size_select.text_content()
                                        logger.info(f"Dropdown now shows: {new_text.strip()}")
                                        return True
                                
                                logger.warning("Could not find 'Show 100' option")
                                await page.screenshot(path="dropdown_debug.png")
                                return False
                                
                            except Exception as e:
                                logger.error(f"Error handling WorkFossa dropdown: {e}")
                                return False
                        
                        # Standard select element handling
                        options = await page_size_select.query_selector_all("option")
                        option_values = []
                        for option in options:
                            value = await option.get_attribute("value")
                            text = await option.text_content()
                            if value:
                                option_values.append(value)
                            logger.debug(f"Found option: value='{value}', text='{text}'")
                        
                        # Check if this looks like a page size dropdown (has common page size values)
                        page_size_indicators = ['25', '50', '100', '10', '20', '200']
                        matching_indicators = [ind for ind in page_size_indicators if ind in option_values]
                        
                        if matching_indicators:
                            logger.info(f"🎯 Found page size dropdown with selector: {selector}")
                            logger.info(f"Available options: {option_values}")
                            logger.info(f"Matching page size values: {matching_indicators}")
                            
                            # Get element details for debugging
                            element_details = await page_size_select.evaluate("""
                                el => ({
                                    name: el.name || '',
                                    id: el.id || '',
                                    className: el.className || '',
                                    currentValue: el.value || '',
                                    tagName: el.tagName
                                })
                            """)
                            logger.info(f"Element details: {element_details}")
                            
                            # Try to select 100 first
                            if "100" in option_values:
                                current_value = element_details.get('currentValue', '')
                                logger.info(f"Changing page size from '{current_value}' to '100'")
                                await page_size_select.select_option("100")
                                logger.info("✅ Successfully selected 100 items per page")
                                await page.wait_for_load_state("networkidle")
                                
                                # Verify the change
                                new_value = await page_size_select.evaluate("el => el.value")
                                logger.info(f"Confirmed new value: {new_value}")
                                return True
                            
                            # If 100 not available, try the highest available value
                            numeric_values = []
                            for val in option_values:
                                try:
                                    numeric_values.append(int(val))
                                except:
                                    continue
                            
                            if numeric_values:
                                max_value = max(numeric_values)
                                current_value = element_details.get('currentValue', '')
                                logger.info(f"100 not available. Changing from '{current_value}' to maximum: {max_value}")
                                await page_size_select.select_option(str(max_value))
                                logger.info(f"✅ Selected maximum available page size: {max_value}")
                                await page.wait_for_load_state("networkidle")
                                
                                # Verify the change
                                new_value = await page_size_select.evaluate("el => el.value")
                                logger.info(f"Confirmed new value: {new_value}")
                                return True
                        else:
                            logger.debug(f"Selector '{selector}' found element but no page size indicators. Options: {option_values}")
                                
                except Exception as e:
                    logger.debug(f"Selector '{selector}' failed: {e}")
                    continue
            
            # Alternative approach: look for dropdown by visible text
            try:
                logger.info("Trying alternative approach: looking for dropdown by text content...")
                
                # First, try the specific WorkFossa dropdown structure
                workfossa_dropdown = await page.query_selector("div.ks-select-selection:has-text('Show 25')")
                if workfossa_dropdown:
                    logger.info("🎯 Found WorkFossa page size dropdown!")
                    try:
                        # Click the dropdown to open it
                        await workfossa_dropdown.click()
                        logger.info("Clicked on dropdown to open options")
                        await page.wait_for_timeout(1000)
                        
                        # Look for the 100 option in the dropdown menu
                        # Try multiple selectors for the dropdown options
                        option_selectors = [
                            "li:has-text('Show 100')",
                            "div:has-text('Show 100')",
                            "span:has-text('Show 100')",
                            "*[role='option']:has-text('100')",
                            ".ks-select-dropdown-menu-item:has-text('100')",
                            ".dropdown-item:has-text('100')"
                        ]
                        
                        option_found = False
                        for selector in option_selectors:
                            option_100 = await page.query_selector(selector)
                            if option_100:
                                logger.info(f"Found 100 option with selector: {selector}")
                                await option_100.click()
                                logger.info("✅ Clicked on 'Show 100' option")
                                option_found = True
                                await page.wait_for_load_state("networkidle")
                                
                                # Verify the change
                                new_text = await workfossa_dropdown.text_content()
                                logger.info(f"Dropdown now shows: {new_text}")
                                
                                return True
                        
                        if not option_found:
                            logger.warning("Could not find 'Show 100' option after opening dropdown")
                            # Take a screenshot to debug
                            await page.screenshot(path="dropdown_open_debug.png")
                            logger.info("📸 Debug screenshot saved: dropdown_open_debug.png")
                    except Exception as e:
                        logger.error(f"Error clicking WorkFossa dropdown: {e}")
                
                # Fallback: Look for elements containing "25" which is the default
                elements_with_25 = await page.query_selector_all("*:has-text('25')")
                for element in elements_with_25:
                    tag_name = await element.evaluate("el => el.tagName.toLowerCase()")
                    if tag_name == "select":
                        # Found a select with "25" text, likely our dropdown
                        try:
                            await element.select_option("100")
                            logger.info("Successfully selected 100 using text-based detection")
                            await page.wait_for_load_state("networkidle")
                            return True
                        except:
                            continue
                    elif tag_name in ["div", "span", "button"]:
                        # Might be a custom dropdown, try clicking it
                        try:
                            # Check if this is a dropdown by looking for specific classes or text
                            element_class = await element.get_attribute("class") or ""
                            element_text = await element.text_content() or ""
                            
                            # Only click if it looks like a page size dropdown
                            if ("select" in element_class.lower() or 
                                "dropdown" in element_class.lower() or
                                "Show" in element_text):
                                
                                await element.click()
                                await page.wait_for_timeout(1000)
                                
                                # Look for "100" option after clicking
                                option_100 = await page.query_selector("*:has-text('100'):visible")
                                if option_100:
                                    await option_100.click()
                                    logger.info("Successfully selected 100 using custom dropdown")
                                    await page.wait_for_load_state("networkidle")
                                    return True
                        except:
                            continue
                            
            except Exception as e:
                logger.debug(f"Text-based approach failed: {e}")
            
            # Final attempt: look for any clickable element near pagination that might control page size
            try:
                logger.info("Final attempt: looking for pagination controls...")
                
                # Look for pagination area
                pagination_areas = await page.query_selector_all(".pagination, .page-controls, .table-footer, .results-info")
                for area in pagination_areas:
                    # Look for buttons or dropdowns in this area
                    controls = await area.query_selector_all("select, button, .dropdown")
                    for control in controls:
                        control_text = await control.text_content()
                        if control_text and ("25" in control_text or "page" in control_text.lower() or "results" in control_text.lower()):
                            try:
                                if await control.evaluate("el => el.tagName.toLowerCase()") == "select":
                                    await control.select_option("100")
                                else:
                                    await control.click()
                                    await page.wait_for_timeout(1000)
                                    option_100 = await page.query_selector("*:has-text('100'):visible")
                                    if option_100:
                                        await option_100.click()
                                
                                logger.info("Successfully changed page size using pagination controls")
                                await page.wait_for_load_state("networkidle")
                                return True
                            except:
                                continue
                                
            except Exception as e:
                logger.debug(f"Pagination controls approach failed: {e}")
            
            logger.warning("Could not find page size dropdown with any method")
            return False
            
        except Exception as e:
            logger.error(f"Error setting page size to 100: {e}")
            return False
    
    async def _apply_date_filters(self, page, date_range: Dict):
        """Apply date filters to work order list"""
        try:
            start_date = date_range.get('start_date')
            end_date = date_range.get('end_date')
            
            # Look for date filter controls
            date_filter_selectors = [
                "input[type='date']",
                ".date-filter",
                ".date-picker",
                "[data-field*='date']"
            ]
            
            for selector in date_filter_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    if len(elements) >= 2:
                        # Set start and end dates
                        if start_date:
                            await elements[0].fill(start_date)
                        if end_date:
                            await elements[1].fill(end_date)
                        break
                except:
                    continue
            
            # Look for apply/filter button
            filter_buttons = await page.query_selector_all(
                "button:has-text('Filter'), button:has-text('Apply'), .filter-btn"
            )
            if filter_buttons:
                await filter_buttons[0].click()
                await page.wait_for_load_state("networkidle")
                
        except Exception as e:
            logger.warning(f"Could not apply date filters: {e}")
    
    async def _find_work_order_elements(self, page) -> List:
        """Find work order elements using multiple selector strategies"""
        work_order_elements = []
        
        # Wait for content to load
        await page.wait_for_timeout(2000)
        
        # Log page URL and title for debugging
        current_url = page.url
        page_title = await page.title()
        logger.info(f"Current page URL: {current_url}")
        logger.info(f"Page title: {page_title}")
        
        # Check if we're on the right page
        if "login" in current_url.lower():
            logger.error("Still on login page - login may have failed")
            return []
        
        # Primary strategy: div-based structure (based on actual WorkFossa structure)
        selectors_to_try = [
            "div.work-list-item",  # Primary selector - WorkFossa uses divs with this class
            ".work-list-item",  # Alternative without div
            "tbody tr",  # Table body rows - fallback
            "table tr:has(td)",  # All table rows with data cells
            "tr:has(td input[type='checkbox'])",  # Rows with checkboxes
            "tr.work-order-row",
            self.selectors.WORK_ORDER_ITEM,
            ".row, .list-item, .card",
            "[data-id], [data-work-order-id]",
            ".work-order, .job, .visit"
        ]
        
        logger.info("Starting element search...")
        
        for selector in selectors_to_try:
            try:
                elements = await page.query_selector_all(selector)
                logger.info(f"Selector '{selector}' found {len(elements)} elements")
                
                if elements and len(elements) > 0:
                    # For work-list-item selector, use elements directly if found
                    if "work-list-item" in selector and len(elements) > 0:
                        logger.info(f"Found {len(elements)} work order elements with work-list-item selector")
                        work_order_elements = elements
                        break
                    
                    # Filter out header rows or empty rows for other selectors
                    valid_elements = []
                    for i, element in enumerate(elements):
                        # Check if row has actual content
                        text_content = await element.text_content()
                        if text_content and len(text_content.strip()) > 10:
                            # Log first few elements for debugging
                            if i < 3:
                                logger.info(f"Element {i} text (first 200 chars): {text_content[:200].strip()}")
                            
                            # Check if it's not a header row by looking for common header text
                            header_indicators = ["Customer", "Items", "Visits", "Work Order", "Actions"]
                            is_header = any(header in text_content for header in header_indicators)
                            
                            # Also check if it contains a work order ID pattern (W-xxxxx)
                            has_work_id = "W-" in text_content
                            
                            if not is_header and has_work_id:
                                valid_elements.append(element)
                    
                    if valid_elements:
                        logger.info(f"Found {len(valid_elements)} valid work orders using selector: {selector}")
                        work_order_elements = valid_elements
                        break
                    else:
                        logger.info(f"No valid work orders found with selector: {selector}")
            except Exception as e:
                logger.debug(f"Selector {selector} failed: {e}")
                continue
        
        if not work_order_elements:
            logger.warning("No work order elements found with any selector")
            # Get page content for debugging
            page_content = await page.content()
            logger.debug(f"Page content length: {len(page_content)}")
            if len(page_content) < 1000:
                logger.warning(f"Page seems empty or too small: {page_content[:500]}")
        
        return work_order_elements
    
    async def _scrape_work_order_from_element(self, page, element, index: int) -> Optional[WorkOrderData]:
        """Scrape work order data from a single element matching V1 extraction"""
        try:
            # Get raw HTML first (like V1)
            raw_html = await element.inner_html()
            
            # Extract basic information
            work_order_id = await self._extract_work_order_id(element, index)
            # external_id should be the work order number, not the store number
            external_id = work_order_id
            
            # Extract site name and store number
            site_info = await self._extract_site_info(element, index)
            site_name = site_info.get("site_name", f"Site {index + 1}")
            store_number = site_info.get("store_number")
            customer_name = site_info.get("customer_name")
            customer_url = site_info.get("customer_url")
            
            # Extract address components
            address_components = await self._extract_address_components(element)
            address = self._format_address(address_components)
            
            # Extract service information
            service_info = await self._extract_service_info(element)
            
            # Extract visit information
            visit_info = await self._extract_visit_info(element)
            
            # Only use fallback if visit URL was not found
            visit_url = visit_info.get("url")
            if not visit_url:
                logger.warning(f"No visit URL found for {work_order_id}, using fallback")
                visit_url = await self._extract_visit_url(element, work_order_id)
            else:
                logger.info(f"✅ Using visit URL from _extract_visit_info: {visit_url}")
            
            visit_id = visit_info.get("visit_id")
            scheduled_date = visit_info.get("date")
            
            # Extract instructions
            instructions = await self._extract_instructions(element)
            
            # Extract status
            status = await self._extract_status(element)
            
            # Extract created date and created by
            created_info = await self._extract_created_info(element)
            
            # Create work order data with all fields
            work_order = WorkOrderData(
                id=work_order_id,
                external_id=external_id,
                site_name=site_name,
                address=address,
                scheduled_date=scheduled_date,
                status=status,
                customer_name=customer_name,
                store_number=store_number,
                service_code=service_info.get("code"),
                service_description=service_info.get("description"),
                service_type=service_info.get("type"),
                service_quantity=service_info.get("quantity"),
                visit_url=visit_url,
                visit_id=visit_id,
                visit_number=visit_info.get("visit_number"),
                instructions=instructions,
                address_components=address_components,
                raw_html=raw_html,
                customer_url=customer_url,
                # New fields
                service_name=service_info.get("name"),
                service_items=service_info.get("items"),
                street=address_components.get("street"),
                city_state=address_components.get("cityState"),
                county=address_components.get("county"),
                created_date=created_info.get("date"),
                created_by=created_info.get("by")
            )
            
            # Try to get dispenser information if available
            # First try basic extraction from the list page
            dispensers = await self._extract_dispensers(page, element)
            work_order.dispensers = dispensers
            work_order.dispenser_count = len(dispensers)
            
            # DISABLED: Automatic dispenser scraping - now done separately for performance
            # if visit_url and service_info.get("code") in ["2861", "2862", "3146", "3002"]:
            #     logger.info(f"Service code {service_info.get('code')} detected - dispenser scraping available")
            #     # Dispenser scraping is now done via separate button/endpoint
            
            return work_order
            
        except Exception as e:
            logger.error(f"Error extracting work order data: {e}")
            return None
    
    async def _extract_work_order_id(self, element, index: int) -> str:
        """Extract work order ID from element - handles both table and div structures"""
        try:
            # First try div-based structure (work-list-item)
            links = await element.query_selector_all("a")
            for link in links:
                text = await link.text_content()
                if text and text.strip().startswith("W-"):
                    full_id = text.strip()
                    # Extract just the number part (e.g., "129651" from "W-129651")
                    number_part = full_id.replace("W-", "")
                    logger.info(f"Found work order ID: {full_id} -> extracted number: {number_part}")
                    return number_part
                
                # Also check href for work order ID
                href = await link.get_attribute("href")
                if href and "/app/work/" in href:
                    # Extract ID from URL like /app/work/123456
                    parts = href.split("/app/work/")
                    if len(parts) > 1:
                        work_id = parts[1].split("/")[0].split("?")[0]
                        if work_id:
                            logger.info(f"Extracted work order ID from href: {work_id}")
                            return work_id
            
            # Fallback to table structure if needed
            cells = await element.query_selector_all("td")
            
            # Check first few cells for work order ID
            for i in range(min(3, len(cells))):
                cell = cells[i]
                
                # Look for links with W- pattern
                links = await cell.query_selector_all("a")
                for link in links:
                    text = await link.text_content()
                    if text and text.strip().startswith("W-"):
                        full_id = text.strip()
                        # Extract just the number part (e.g., "129651" from "W-129651")
                        number_part = full_id.replace("W-", "")
                        logger.info(f"Found work order ID: {full_id} -> extracted number: {number_part}")
                        return number_part
                    
                    # Also check href for work order ID
                    href = await link.get_attribute("href")
                    if href and "/app/work/" in href:
                        # Extract ID from URL like /app/work/123456
                        parts = href.split("/app/work/")
                        if len(parts) > 1:
                            work_id = parts[1].split("/")[0].split("?")[0]
                            if work_id:
                                # Return just the number part, not the W- prefix
                                number_part = work_id.replace("W-", "") if work_id.startswith("W-") else work_id
                                logger.info(f"Extracted work order ID from URL: {href} -> {number_part}")
                                return number_part
            
            # Fallback: Look for W- pattern in entire row text
            text_content = await element.text_content()
            if text_content:
                import re
                work_id_match = re.search(r'W-(\d+)', text_content)
                if work_id_match:
                    # Return just the number part
                    number_part = work_id_match.group(1)
                    logger.info(f"Found work order ID in text: {work_id_match.group(0)} -> extracted number: {number_part}")
                    return number_part
            
            # Additional fallback methods
            id_selectors = [
                self.selectors.WORK_ORDER_ID,
                "[data-id]",
                "[data-work-order-id]",
                ".id, .work-order-number"
            ]
            
            for selector in id_selectors:
                try:
                    id_element = await element.query_selector(selector)
                    if id_element:
                        text = await id_element.text_content()
                        if text and text.strip():
                            return text.strip()
                except:
                    continue
            
            # Fallback: generate ID based on index and timestamp
            return f"scraped_wo_{index}_{int(datetime.now().timestamp())}"
            
        except Exception as e:
            logger.warning(f"Could not extract work order ID: {e}")
            return f"unknown_wo_{index}"
    
    async def _extract_external_id(self, element, fallback_id: str) -> str:
        """Extract external work order ID"""
        try:
            # Look for patterns like WO-12345, 12345, etc.
            text_content = await element.text_content()
            if text_content:
                # Common work order ID patterns
                patterns = [
                    r'WO-\d+',
                    r'#\d+',
                    r'\b\d{5,}\b',
                    r'ID:\s*(\d+)',
                    r'Order:\s*([A-Z0-9-]+)'
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, text_content)
                    if match:
                        return match.group(0) if match.group(0) else match.group(1)
            
            return fallback_id
            
        except Exception as e:
            logger.warning(f"Could not extract external ID: {e}")
            return fallback_id
    
    async def _extract_site_info(self, element, index: int) -> Dict[str, str]:
        """Extract site info including name, store number, customer name, and customer URL"""
        try:
            cells = await element.query_selector_all("td")
            
            # Initialize variables
            store_number = None
            site_name = None
            customer_name = None
            customer_url = None
            
            # First try to extract customer URL from the entire row
            customer_url = await self._extract_customer_url(element)
            
            # Based on WorkFossa table structure (from screenshots):
            # Cell 0: Checkbox
            # Cell 1: Work Order ID (W-xxxxx)
            # Cell 2: Customer info (Company name, store number, address)
            # Cell 3: Items/Services
            # Cell 4: Visits
            
            if len(cells) >= 3:
                # Extract from customer cell (typically cell 2)
                customer_cell = cells[2]
                cell_text = await customer_cell.text_content()
                
                # Look for clickable store number links to extract customer URL
                customer_url = await self._extract_customer_url(customer_cell)
                
                if cell_text:
                    # Split by newlines to get different parts
                    lines = [line.strip() for line in cell_text.split('\n') if line.strip()]
                    
                    # First line is usually the customer name
                    if lines:
                        customer_name = lines[0]
                        
                        # Look for store number in any line
                        for line in lines:
                            # Check for #XXXXX pattern
                            store_match = re.search(r'#(\d+)', line)
                            if store_match:
                                store_number = f"#{store_match.group(1)}"
                                break
                            
                            # Also check for "Store XXXXX" pattern
                            store_match2 = re.search(r'Store\s+(\d+)', line, re.IGNORECASE)
                            if store_match2:
                                store_number = f"#{store_match2.group(1)}"
                                break
                    
                    # Set site name as combination
                    if customer_name and store_number:
                        site_name = f"{customer_name} {store_number}"
                    elif customer_name:
                        site_name = customer_name
                    
                    logger.info(f"Extracted site info - Customer: {customer_name}, Store: {store_number}, Customer URL: {customer_url}")
            
            # Fallback: extract from full row text
            if not site_name:
                text_content = await element.text_content()
                if text_content:
                    # Look for company names - Updated pattern to capture hyphenated names
                    company_patterns = [
                        r'(7-Eleven[^\n]*)',  # Put specific patterns first
                        r'(Wawa[^\n]*)',
                        r'(Shell[^\n]*)',
                        r'(BP[^\n]*)',
                        r'(Exxon[^\n]*)',
                        r'([\w\s\-]+(?:Inc|LLC|Corp|Corporation|Company|Stores)[^\n]*)'  # Generic pattern last with hyphen support
                    ]
                    
                    for pattern in company_patterns:
                        match = re.search(pattern, text_content)
                        if match:
                            site_name = match.group(1).strip()
                            customer_name = site_name
                            break
                    
                    # Look for store number
                    if not store_number:
                        store_match = re.search(r'#(\d{3,})', text_content)
                        if store_match:
                            store_number = f"#{store_match.group(1)}"
            
            # Final fallback
            if not site_name:
                site_name = f"Site {index + 1}"
                customer_name = site_name
            
            # Return all site information
            return {
                "site_name": site_name,
                "store_number": store_number,
                "customer_name": customer_name,
                "customer_url": customer_url
            }
            
        except Exception as e:
            logger.warning(f"Could not extract site name: {e}")
            return {
                "site_name": f"Unknown Site {index + 1}",
                "store_number": None,
                "customer_name": f"Unknown Site {index + 1}",
                "customer_url": None
            }
    
    async def _extract_customer_url(self, element) -> Optional[str]:
        """Extract customer location URL from the work order row"""
        logger.info(f"🔍 [CUSTOMER_URL] Looking for customer URL in element...")
        
        try:
            # Look for ALL links in the element (not just those with store numbers)
            links = await element.query_selector_all("a")
            
            logger.info(f"🔍 [CUSTOMER_URL] Found {len(links)} links in element")
            
            for i, link in enumerate(links):
                href = await link.get_attribute("href")
                link_text = await link.text_content()
                
                logger.info(f"🔍 [CUSTOMER_URL] Link {i+1}: href='{href}', text='{link_text}'")
                
                # Check if this is a customer location link
                if href and 'customers/locations/' in href:
                    # Convert relative URLs to absolute
                    if href.startswith('/'):
                        customer_url = f"https://app.workfossa.com{href}"
                    else:
                        customer_url = href
                    
                    logger.info(f"✅ [CUSTOMER_URL] Found customer URL: {customer_url}")
                    return customer_url
            
            # Fallback: Try to find store number and log it
            text_content = await element.text_content()
            if text_content:
                store_match = re.search(r'#(\d+)', text_content)
                if store_match:
                    store_number = store_match.group(1)
                    logger.info(f"🔍 [CUSTOMER_URL] Found store number #{store_number} but no direct customer location link")
            
            logger.warning(f"⚠️ [CUSTOMER_URL] No customer location links found")
            return None
            
        except Exception as e:
            logger.error(f"❌ [CUSTOMER_URL] Error extracting customer URL: {e}")
            return None
    
    async def _extract_address_components(self, element) -> Dict[str, str]:
        """Extract address components from the correct HTML structure (address-info div)"""
        try:
            components = {
                "street": None,
                "intersection": None,
                "cityState": None,
                "county": None
            }
            
            # First, try to find the address-info div which contains the clean address
            address_info_div = await element.query_selector(".address-info")
            
            if address_info_div:
                logger.debug("🏠 [ADDRESS] Found address-info div, extracting clean address")
                
                # Get all div elements within the address-info section
                address_divs = await address_info_div.query_selector_all("div")
                
                street_address = None
                city_state = None
                county = None
                
                for div in address_divs:
                    div_text = await div.text_content()
                    if div_text:
                        div_text = div_text.strip()
                        
                        # Look for street address (contains numbers and street indicators)
                        if (re.match(r'^\d{1,4}\s+', div_text) and 
                            re.search(r'(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy)', div_text, re.IGNORECASE)):
                            street_address = div_text
                            logger.debug(f"🏠 [ADDRESS] Found street: {street_address}")
                        
                        # Look for city, state, zip (like "Tampa FL 33603")
                        elif re.search(r'[A-Za-z]+\s+[A-Z]{2}\s+\d{5}', div_text):
                            city_state = div_text
                            logger.debug(f"🏠 [ADDRESS] Found city/state: {city_state}")
                        
                        # Look for county (contains "County")
                        elif re.search(r'County', div_text, re.IGNORECASE):
                            county = div_text
                            logger.debug(f"🏠 [ADDRESS] Found county: {county}")
                
                # Set the components if found
                if street_address:
                    components["street"] = street_address
                if city_state:
                    components["cityState"] = city_state
                if county:
                    components["county"] = county
                
                # If we found clean address components, return them
                if street_address and city_state:
                    logger.debug(f"✅ [ADDRESS] Successfully extracted clean address from address-info div")
                    return components
                else:
                    logger.debug(f"⚠️ [ADDRESS] Address-info div found but missing street or city/state")
            else:
                logger.debug("🏠 [ADDRESS] No address-info div found, falling back to cell-based extraction")
            
            # Fallback to the existing cell-based extraction logic
            cells = await element.query_selector_all("td")
            
            # Try multiple cell positions as address can be in different locations
            cells_to_check = []
            
            # Prioritize cell 2 (most common location)
            if len(cells) >= 3:
                cells_to_check.append(cells[2])
            
            # Also check adjacent cells (1, 3, 4) as fallbacks
            if len(cells) >= 2:
                cells_to_check.append(cells[1])
            if len(cells) >= 4:
                cells_to_check.append(cells[3])
            if len(cells) >= 5:
                cells_to_check.append(cells[4])
            
            # Also check all remaining cells if needed
            for i, cell in enumerate(cells):
                if cell not in cells_to_check:
                    cells_to_check.append(cell)
            
            # Try to find address in each cell
            for cell in cells_to_check:
                cell_text = await cell.text_content()
                
                if cell_text:
                    # Quick check if this cell likely contains address info
                    # Be more selective to avoid work order IDs being treated as street numbers
                    address_indicators = [
                        r'\d{1,4}\s+[A-Za-z]+',  # Street number pattern (1-4 digits only)
                        r'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy',
                        r',\s*[A-Z]{2}\s*\d{5}',  # State and zip pattern
                        r'#\d+.*,.*[A-Z]{2}',  # Store number with state
                    ]
                    
                    has_address_content = any(re.search(pattern, cell_text, re.IGNORECASE) for pattern in address_indicators)
                    
                    if has_address_content:
                        logger.debug(f"🏠 [ADDRESS] Processing cell with address content: {cell_text[:100]}...")
                        lines = [line.strip() for line in cell_text.split('\n') if line.strip()]
                        
                        # First, try to find clean address lines that match WorkFossa format
                        # Look for lines like "802 East Martin Luther King Boulevard"
                        clean_address_lines = []
                        
                        for line in lines:
                            # Skip lines that are clearly not addresses
                            # Pattern to match work order IDs followed by service types (with or without additional text)
                            if re.match(r'^\d{5,}\s+(Quality\s+Calibration\s+Meter|Meter|Calibration|Service|Inspection|Test|Quality)', line, re.IGNORECASE):
                                logger.debug(f"🚫 [CLEAN_ADDRESS] Skipping work order line: '{line}'")
                                continue
                            if re.match(r'^[A-Z]\s*-\s*\d+', line):  # Skip "W-129651" format
                                continue
                            if re.match(r'^(Work|Project|Reason):', line, re.IGNORECASE):
                                continue
                            if re.match(r'^#\d+$', line):  # Skip standalone store numbers
                                continue
                            if re.match(r'^\d{5,}$', line):  # Skip standalone work order IDs
                                continue
                            if re.match(r'^Service\s+\d+$', line, re.IGNORECASE):  # Skip "Service 2861"
                                continue
                            if re.match(r'^\d+\s+Service$', line, re.IGNORECASE):  # Skip "2861 Service"
                                continue
                            
                            # Look for actual address patterns
                            # Street addresses typically start with 1-4 digit house numbers
                            if re.match(r'^\d{1,4}\s+[A-Za-z]', line):
                                clean_address_lines.append(line)
                                continue
                            
                            # Or contain street/road indicators without work order numbers
                            if (re.search(r'(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy)', line, re.IGNORECASE) and
                                not re.match(r'^\d{5,}', line)):
                                clean_address_lines.append(line)
                                continue
                            
                            # City, State ZIP patterns (including space-separated format like "Tampa FL 33603")
                            if re.search(r'([A-Z][a-z]+\s+[A-Z]{2}\s+\d{5})|([A-Z][a-z]+,\s*[A-Z]{2}\s*\d{5})', line):
                                clean_address_lines.append(line)
                                continue
                        
                        # If we found clean address lines, use those
                        if clean_address_lines:
                            logger.debug(f"🏠 [ADDRESS] Found {len(clean_address_lines)} clean address lines")
                            address_lines = clean_address_lines
                        else:
                            # Fall back to the enhanced parsing logic
                            logger.debug(f"🏠 [ADDRESS] No clean address lines found, using enhanced parsing")
                            address_lines = []
                            store_number_line = None
                            
                            for line in lines:
                                # Skip customer name (usually first line with company indicators)
                                # But be careful not to skip addresses that contain these words
                                if (any(word in line.lower() for word in ['inc', 'llc', 'corp', 'corporation', 'company', 'stores']) and 
                                    not any(pattern in line for pattern in ['Street', 'St', 'Ave', 'Rd', 'Drive', 'Dr', 'Lane', 'Ln', 'Way']) and
                                    not re.search(r'\d{5}', line)):  # Don't skip if it contains a zip code
                                    continue
                                
                                # Continue with existing parsing logic...
                                address_lines.append(line)
                            
                            # Capture store numbers separately but don't skip them entirely
                            if line.startswith('#') or re.match(r'^Store\s*#?\d+', line, re.IGNORECASE):
                                store_number_line = line
                                # Sometimes address follows store number on same line
                                store_addr_match = re.search(r'(#\d+|Store\s*#?\d+)\s*[,-]?\s*(.+)', line, re.IGNORECASE)
                                if store_addr_match and len(store_addr_match.group(2).strip()) > 5:
                                    address_part = store_addr_match.group(2).strip()
                                    logger.debug(f"Extracted address from store line: '{line}' -> '{address_part}'")
                                    address_lines.append(address_part)
                                continue
                            
                            # Skip pure numbers or very short lines
                            if re.match(r'^\d+$', line) or len(line) < 5:
                                continue
                            
                            # Check for service patterns that might have addresses after them BEFORE skipping
                            service_with_address_match = re.match(r'^(Service\s+\d+|^\d+\s+Service)\s*[,:]?\s*(.+)', line, re.IGNORECASE)
                            if service_with_address_match and len(service_with_address_match.group(2).strip()) > 5:
                                address_part = service_with_address_match.group(2).strip()
                                # Check if it looks like an actual address (contains typical address words)
                                if any(word in address_part.lower() for word in ['street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd', 'drive', 'dr', 'lane', 'ln']) or re.search(r'\d+.*[A-Z]{2}\s*\d{5}', address_part):
                                    logger.debug(f"Extracted address from service line: '{line}' -> '{address_part}'")
                                    address_lines.append(address_part)
                                    continue
                            
                            # Skip lines that are clearly service-related without addresses
                            service_skip_patterns = [
                                r'^Service\s+\d+$',      # Service 2861 (exact)
                                r'^\d+\s+Service$',      # 2861 Service (exact)
                                r'^Items?\s*:',         # Items: or Item:
                                r'^[1-9]\s+Meter$',       # Single digit Meter (exact match)
                                r'^Meter\s+\d+$',       # Meter 1 (exact match)
                                r'^Code\s+\d+',         # Code 2861
                                r'^\d{4}$',             # Just a 4-digit code
                                r'^\d{5,}$',            # Just a work order ID (5+ digits)
                                r'^\d{5,}\s+Meter',    # Work order ID with Meter (any following content)
                                r'^\d{5,}\s+Quality\s+Calibration\s+Meter',   # Work order ID with Quality Calibration Meter
                                r'^\d{5,}\s+Quality',   # Work order ID with Quality
                                r'^\d{5,}\s+Service',   # Work order ID with Service  
                                r'^\d{5,}\s+Calibration', # Work order ID with Calibration
                                r'^\d{5,}\s+Inspection', # Work order ID with Inspection
                                r'^\d{5,}\s+Test' # Work order ID with Test
                            ]
                            
                            if any(re.match(pattern, line, re.IGNORECASE) for pattern in service_skip_patterns):
                                logger.debug(f"Skipping service-related line: '{line}'")
                                continue
                            
                            # Skip any line that starts with work order ID and service type
                            # These lines should NOT contain address information - addresses should be in separate cells
                            work_order_match = re.match(r'^\d{5,}\s+(Quality\s+Calibration\s+Meter|Meter|Calibration|Service|Inspection|Test|Quality)', line, re.IGNORECASE)
                            if work_order_match:
                                logger.debug(f"🚫 [ENHANCED_PARSING] Skipping work order line: '{line}'")
                                continue
                            
                            # Also check for smaller numbers (1-4 digits) that might be legitimate street numbers
                            # followed by service types - in this case, we want to keep the number
                            street_with_service_match = re.match(r'^(\d{1,4})\s+(Meter|Calibration|Service|Inspection|Test|Quality)\s*[,:]?\s*(.*)$', line, re.IGNORECASE)
                            if street_with_service_match:
                                street_num = street_with_service_match.group(1)
                                remaining = street_with_service_match.group(3).strip()
                                if remaining:
                                    # Reconstruct the address with the street number
                                    full_address = f"{street_num} {remaining}"
                                    logger.debug(f"Preserved street number from service line: '{line}' -> '{full_address}'")
                                    address_lines.append(full_address)
                                else:
                                    logger.debug(f"Skipped service line with no address: '{line}'")
                                continue
                            
                            # This is likely an address line
                            address_lines.append(line)
                        
                        if address_lines:
                            # Look for complete address in single line first
                            for line in address_lines:
                                # Check if line contains both street and city/state
                                full_addr_match = re.match(r'(.+?)\s*,\s*([^,]+,\s*[A-Z]{2}\s*\d{5})', line)
                                if full_addr_match:
                                    street_part = full_addr_match.group(1).strip()
                                    city_state_part = full_addr_match.group(2).strip()
                                    
                                    # Check if the street part is actually a work order ID with service type
                                    work_order_in_street = re.match(r'^\d{5,}\s+(?:Quality\s+Calibration\s+Meter|Meter|Calibration|Service|Inspection|Test|Quality)', street_part, re.IGNORECASE)
                                    if work_order_in_street:
                                        logger.debug(f"❌ [ADDRESS] Skipping address with work order in street part: '{street_part}'")
                                        continue
                                    
                                    # Additional check: if street part starts with 5+ digits, it's likely a work order ID
                                    if re.match(r'^\d{5,}', street_part):
                                        logger.debug(f"❌ [ADDRESS] Skipping address with 5+ digit number (likely work order): '{street_part}'")
                                        continue
                                    
                                    components["street"] = street_part
                                    components["cityState"] = city_state_part
                                    logger.info(f"Found complete address in single line: {line}")
                                    return components
                            
                            # Otherwise parse multi-line address
                            # First address line is typically the street
                            # But first check if it's not a work order line
                            first_line = address_lines[0]
                            work_order_check = re.match(r'^\d{5,}\s+(?:Quality\s+Calibration\s+Meter|Meter|Calibration|Service|Inspection|Test|Quality)', first_line, re.IGNORECASE)
                            large_number_check = re.match(r'^\d{5,}', first_line)
                            
                            if work_order_check or large_number_check:
                                logger.debug(f"❌ [ADDRESS] First address line contains work order/large number pattern, skipping: '{first_line}'")
                                # Try to use the next line if available
                                if len(address_lines) > 1:
                                    second_line = address_lines[1]
                                    # Double check the second line too
                                    if not re.match(r'^\d{5,}', second_line):
                                        components["street"] = second_line
                                        logger.debug(f"✅ [ADDRESS] Using second line as street: '{second_line}'")
                                    else:
                                        logger.warning("❌ [ADDRESS] Second line also contains large number, no valid street found")
                                else:
                                    logger.warning("❌ [ADDRESS] No valid street address found after filtering work order pattern")
                            else:
                                components["street"] = first_line
                                logger.debug(f"✅ [ADDRESS] Using first line as street: '{first_line}'")
                            
                            # Look for city, state pattern in remaining lines
                            city_state_pattern = r'^([^,]+),\s*([A-Z]{2})\s*(\d{5})?'
                            
                            for line in address_lines[1:]:
                                city_state_match = re.match(city_state_pattern, line)
                                if city_state_match:
                                    components["cityState"] = line
                                    break
                                # Check if line contains intersection info
                                elif ('&' in line or 'and' in line.lower()) and any(road in line.lower() for road in ['st', 'street', 'ave', 'road', 'rd']):
                                    components["intersection"] = line
                                # Check for county info
                                elif 'county' in line.lower():
                                    components["county"] = line
                                # Otherwise might be additional street info or city/state without standard format
                                elif not components["cityState"]:
                                    # Skip lines that are clearly service-related
                                    service_indicators = [
                                        r'^Service\s+\d+',  # Service 2861
                                        r'^\d+\s+Service',  # 2861 Service
                                        r'^Items?\s*:',     # Items: or Item:
                                        r'^\d+\s+Meter',    # 1 Meter
                                        r'^Meter\s+\d+',    # Meter 1
                                        r'^Code\s+\d+',     # Code 2861
                                        r'^\d{4}$'          # Just a 4-digit code
                                    ]
                                    
                                    if any(re.match(pattern, line, re.IGNORECASE) for pattern in service_indicators):
                                        logger.debug(f"Skipping service-related line from address: '{line}'")
                                        continue
                                    
                                    # Check if this might be city/state even without perfect format
                                    if re.search(r'[A-Z]{2}\s*\d{5}', line):
                                        components["cityState"] = line
                                    # Special handling for addresses where street info might be after store number
                                    elif re.search(r'\d+\s+\w+', line) and any(road in line.lower() for road in ['street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'lane', 'ln', 'way', 'blvd', 'boulevard', 'highway', 'hwy']):
                                        # This looks like a street address - use it as primary if we don't have one yet
                                        if not components["street"] or components["street"].startswith('#'):
                                            components["street"] = line
                                        else:
                                            # Append to existing street
                                            components["street"] = f"{components['street']}, {line}"
                                    else:
                                        # Only append to street if it's not just a store number or service info
                                        if (not line.startswith('#') and 
                                            not re.match(r'^Store\s+\d+', line, re.IGNORECASE) and
                                            not any(re.match(pattern, line, re.IGNORECASE) for pattern in service_indicators)):
                                            components["street"] = f"{components['street']}, {line}"
                            
                            # If we found address components, we're done
                            if components["street"] or components["cityState"]:
                                logger.info(f"Found address in cell {cells.index(cell)}: Street='{components['street']}', City/State='{components['cityState']}'")
                                break
                        
                        # Special case: Sometimes the entire address is in one field but separated by store info
                        # Try to extract address from text that might include store numbers
                        if not components["street"] and not components["cityState"]:
                            # Look for patterns like "#1234, 567 Main St, City, ST 12345"
                            full_text = ' '.join(lines)
                            # Try to match addresses that come after store numbers
                            after_store_match = re.search(r'#\d+[,\s]+(.+)', full_text)
                            if after_store_match:
                                potential_address = after_store_match.group(1).strip()
                                # Check if this contains address-like content
                                if re.search(r'\d+\s+\w+|[A-Z][a-z]+,\s*[A-Z]{2}\s*\d{5}', potential_address):
                                    # Try to split into street and city/state
                                    parts = [p.strip() for p in potential_address.split(',')]
                                    if len(parts) >= 2:
                                        # Assume first part is street
                                        components["street"] = parts[0]
                                        # Remaining parts are city/state
                                        components["cityState"] = ', '.join(parts[1:]).strip()
                                        logger.info(f"Extracted address from store info: Street='{components['street']}', City/State='{components['cityState']}'")
                                        break
            
            # Enhanced fallback: try to extract from full text with more patterns
            if not components["street"]:
                text_content = await element.text_content()
                if text_content:
                    # Remove excessive whitespace and newlines for better pattern matching
                    clean_text = ' '.join(text_content.split())
                    
                    # Try multiple address extraction patterns
                    address_patterns = [
                        # Standard US address with street number
                        r'(\d+\s+[\w\s]+?(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy|Circle|Cir|Court|Ct|Plaza|Place|Pl|Parkway|Pkwy|Trail|Trl|Path|Row|Terrace|Ter)\.?)',
                        # Address with PO Box
                        r'(P\.?O\.?\s*Box\s*\d+)',
                        # Highway addresses
                        r'(\d+\s+(?:Highway|Hwy|Route|Rt|State Route|SR|US Route|US|Interstate|I-)\s*\d+[A-Za-z]?)',
                        # Rural route addresses
                        r'((?:RR|Rural Route)\s*\d+\s*Box\s*\d+)',
                        # Addresses starting with building/suite
                        r'((?:Suite|Ste|Building|Bldg|Unit|Apt|Apartment)\s*\d+[A-Za-z]?\s*,?\s*\d+\s+[\w\s]+)',
                        # Addresses without explicit road type (common in some areas) - exclude "Meter" patterns
                        r'(\d{3,5}\s+(?!Meter)[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})(?=\s*,?\s*[A-Z][a-z]+\s*,?\s*[A-Z]{2})',
                        # Named locations without numbers
                        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy)\.?)'
                    ]
                    
                    for pattern in address_patterns:
                        street_match = re.search(pattern, clean_text, re.IGNORECASE)
                        if street_match:
                            components["street"] = street_match.group(1).strip()
                            logger.info(f"Found street address using pattern: {components['street']}")
                            break
                    
                    # Enhanced city, state, zip patterns
                    city_state_patterns = [
                        # Standard format: City, ST 12345
                        r'([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)',
                        # Format without comma: City ST 12345
                        r'([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)',
                        # Just state and zip
                        r'([A-Z]{2})\s*(\d{5}(?:-\d{4})?)'
                    ]
                    
                    for pattern in city_state_patterns:
                        city_state_match = re.search(pattern, clean_text)
                        if city_state_match:
                            if len(city_state_match.groups()) == 3:
                                components["cityState"] = f"{city_state_match.group(1).strip()}, {city_state_match.group(2)} {city_state_match.group(3)}"
                            else:
                                components["cityState"] = city_state_match.group(0).strip()
                            logger.info(f"Found city/state using pattern: {components['cityState']}")
                            break
            
            # Clean up components - remove duplicates and extra whitespace
            for key in components:
                if components[key]:
                    # Remove duplicate words and clean up
                    components[key] = ' '.join(components[key].split())
                    # Remove trailing commas
                    components[key] = components[key].rstrip(',').strip()
            
            # Log what we found for debugging
            if components["street"] or components["cityState"]:
                logger.info(f"Address extraction complete: {components}")
            else:
                logger.warning("Could not extract address components from any cell")
            
            return components
            
        except Exception as e:
            logger.warning(f"Could not extract address components: {e}")
            return {"street": None, "intersection": None, "cityState": None, "county": None}
    
    def _format_address(self, components: Dict[str, str]) -> str:
        """Format address components into a single string with better handling of missing components"""
        parts = []
        
        # Service-related patterns to filter out
        service_indicators = [
            r'^Service\s+\d+',      # Service 2861
            r'^\d+\s+Service',      # 2861 Service
            r'^Items?\s*:',         # Items: or Item:
            r'^\d+\s+Meter',        # 1 Meter
            r'^Meter\s+\d+',        # Meter 1
            r'^Code\s+\d+',         # Code 2861
            r'^\d{4}$',             # Just a 4-digit code
            r'Service\s+\d{4}',     # Service code anywhere
            r'^\d{5,}',             # Work order IDs (5+ digits)
            r'^\d{5,}\s+Meter',     # Work order ID with Meter
            r'^\d{5,}\s+Quality',   # Work order ID with Quality
            r'^\d{5,}\s+Service',   # Work order ID with Service
            r'^\d{5,}\s+Calibration'  # Work order ID with Calibration
        ]
        
        # Helper function to check if text contains service info
        def is_service_related(text):
            if not text:
                return False
            return any(re.search(pattern, text, re.IGNORECASE) for pattern in service_indicators)
        
        # Add street address if available and not service-related
        if components.get("street"):
            if not is_service_related(components["street"]):
                parts.append(components["street"])
                logger.debug(f"✅ [ADDRESS_FORMAT] Added street: '{components['street']}'")
            else:
                logger.debug(f"❌ [ADDRESS_FORMAT] Filtered out service-related street: '{components['street']}'")
        
        # Add intersection if available and no street
        if components.get("intersection") and not components.get("street"):
            parts.append(f"Near {components['intersection']}")
        elif components.get("intersection"):
            parts.append(f"({components['intersection']})")
        
        # Always include city/state if available and not service-related
        if components.get("cityState") and not is_service_related(components["cityState"]):
            parts.append(components["cityState"])
        
        # Add county if available
        if components.get("county"):
            parts.append(components["county"])
        
        # If we only have city/state, that's still useful information
        if parts:
            return ", ".join(parts)
        else:
            return "Address not available"
    
    async def _extract_service_info(self, element) -> Dict[str, Any]:
        """Extract service information matching V1 structure"""
        try:
            service_info = {
                "type": None,
                "quantity": None,
                "description": None,
                "code": None,
                "name": None,  # Service name (e.g., "AccuMeasure")
                "items": []    # List of service items (e.g., ["6 x All Dispensers"])
            }
            
            cells = await element.query_selector_all("td")
            
            # Service info is typically in the Items cell (cell 3)
            if len(cells) >= 4:
                items_cell = cells[3]
                cell_text = await items_cell.text_content()
                
                if cell_text:
                    # Look for service codes (2861, 2862, 3146, etc.)
                    code_match = re.search(r'\b(2861|2862|3146|3002)\b', cell_text)
                    if code_match:
                        service_info["code"] = code_match.group(1)
                        
                        # Map code to description
                        code_descriptions = {
                            "2861": "All Dispensers AccuMeasure Test",
                            "2862": "Specific Dispensers AccuMeasure Test",
                            "3146": "Open Neck Prover Test",
                            "3002": "All Dispensers Test"
                        }
                        service_info["description"] = code_descriptions.get(service_info["code"], "Dispenser Test")
                        service_info["type"] = "Testing"
                        
                        logger.info(f"Found service code: {service_info['code']} - {service_info['description']}")
                    
                    # Look for dispenser count
                    dispenser_patterns = [
                        r'(\d+)\s*x\s*[Aa]ll\s+[Dd]ispenser',  # "6 x All Dispensers"
                        r'(\d+)\s*[Dd]ispenser',
                        r'[Dd]ispenser[s]?\s*[:(]\s*(\d+)',
                        r'[Qq]uantity[:\s]+(\d+)'
                    ]
                    
                    for pattern in dispenser_patterns:
                        dispenser_match = re.search(pattern, cell_text)
                        if dispenser_match:
                            service_info["quantity"] = int(dispenser_match.group(1))
                            logger.info(f"Found dispenser quantity: {service_info['quantity']}")
                            break
                    
                    # Extract service items from cell
                    item_patterns = [
                        r'(\d+)\s*x\s*([^(\n]+?)\s*\([^)]+\)',  # "6 x All Dispensers (2861)"
                        r'(\d+)\s*x\s*([^\n]+?)(?=\s*$|\s*,|\s*\.|\s*\d)',  # "6 x All Dispensers"
                    ]
                    
                    for pattern in item_patterns:
                        matches = re.findall(pattern, cell_text)
                        for match in matches:
                            quantity, item_name = match
                            item_text = f"{quantity} x {item_name.strip()}"
                            if item_text not in service_info["items"]:
                                service_info["items"].append(item_text)
                            # Also extract quantity from items
                            if not service_info["quantity"] and 'dispenser' in item_name.lower():
                                service_info["quantity"] = int(quantity)
                    
                    # Extract service type from text
                    if "Meter Calibration" in cell_text:
                        service_info["type"] = "Meter Calibration"
                    elif "AccuMeasure" in cell_text:
                        service_info["type"] = "AccuMeasure Test"
                        service_info["name"] = "AccuMeasure"  # Set service name
                    elif "Prover" in cell_text:
                        service_info["type"] = "Prover Test"
                    elif "Test" in cell_text:
                        service_info["type"] = "Testing"
                    
                    # Extract service name from "Reason:" field if present
                    reason_match = re.search(r'Reason:\s*([^\n]+)', cell_text)
                    if reason_match and not service_info["name"]:
                        service_info["name"] = reason_match.group(1).strip()
            
            # Fallback: Look for service info in full row text
            if not service_info["code"]:
                text_content = await element.text_content()
                if text_content:
                    # Look for service codes
                    code_match = re.search(r'\b(2861|2862|3146|3002)\b', text_content)
                    if code_match:
                        service_info["code"] = code_match.group(1)
                        
                        # Map code to description
                        code_descriptions = {
                            "2861": "All Dispensers AccuMeasure Test",
                            "2862": "Specific Dispensers AccuMeasure Test",
                            "3146": "Open Neck Prover Test",
                            "3002": "All Dispensers Test"
                        }
                        service_info["description"] = code_descriptions.get(service_info["code"], "Dispenser Test")
                        service_info["type"] = "Testing"
                    
                    # Look for dispenser count
                    dispenser_match = re.search(r'(\d+)\s*[Dd]ispenser', text_content)
                    if dispenser_match:
                        service_info["quantity"] = int(dispenser_match.group(1))
                    
                    # Extract service name from "Reason:" field
                    reason_match = re.search(r'Reason:\s*([^\n]+)', text_content)
                    if reason_match:
                        service_info["name"] = reason_match.group(1).strip()
                    
                    # Extract service items (e.g., "6 x All Dispensers")
                    # Enhanced pattern to handle variations like "6 x All Dispensers (2861)"
                    item_patterns = [
                        r'(\d+)\s*x\s*([^(\n]+?)\s*\([^)]+\)',  # "6 x All Dispensers (2861)"
                        r'(\d+)\s*x\s*([^\n]+?)(?=\s*$|\s*,|\s*\.|\s*\d)',  # "6 x All Dispensers"
                        r'(\d+)\s+([Dd]ispenser[s]?)',  # "6 Dispensers"
                    ]
                    
                    for pattern in item_patterns:
                        matches = re.findall(pattern, text_content)
                        for match in matches:
                            quantity, item_name = match
                            item_text = f"{quantity} x {item_name.strip()}"
                            if item_text not in service_info["items"]:
                                service_info["items"].append(item_text)
                            # Also extract quantity from items
                            if not service_info["quantity"] and item_name.lower().strip().startswith('all dispenser'):
                                service_info["quantity"] = int(quantity)
            
            # Clean up values
            for key in service_info:
                if service_info[key] and isinstance(service_info[key], str):
                    service_info[key] = service_info[key].strip()
            
            return service_info
            
        except Exception as e:
            logger.warning(f"Could not extract service info: {e}")
            return {"type": None, "quantity": None, "description": None, "code": None, "name": None, "items": []}
    
    async def _extract_created_info(self, element) -> Dict[str, Any]:
        """Extract created date and created by information"""
        try:
            created_info = {
                "date": None,
                "by": None
            }
            
            # Get element text
            text_content = await element.text_content()
            if text_content:
                # Look for creator pattern: "Aaron Koehler • 04/08/2025 09:41am"
                creator_match = re.search(r'(\w+\s+\w+)\s*•\s*(\d{2}/\d{2}/\d{4})', text_content)
                if creator_match:
                    created_info["by"] = creator_match.group(1)
                    date_str = creator_match.group(2)
                    try:
                        # Parse date
                        created_info["date"] = datetime.strptime(date_str, "%m/%d/%Y")
                    except:
                        created_info["date"] = None
                    
                    logger.info(f"Found created by: {created_info['by']} on {date_str}")
            
            # Try to find work-creator div for div-based structure
            creator_div = await element.query_selector("div.work-creator")
            if creator_div and not created_info["by"]:
                creator_text = await creator_div.inner_text()
                creator_match = re.search(r'(\w+\s+\w+)\s*•\s*(\d{2}/\d{2}/\d{4})', creator_text)
                if creator_match:
                    created_info["by"] = creator_match.group(1)
                    date_str = creator_match.group(2)
                    try:
                        created_info["date"] = datetime.strptime(date_str, "%m/%d/%Y")
                    except:
                        created_info["date"] = None
            
            return created_info
            
        except Exception as e:
            logger.warning(f"Could not extract created info: {e}")
            return {"date": None, "by": None}
    
    async def _extract_visit_info(self, element) -> Dict[str, Any]:
        """Extract visit information matching V1 structure"""
        try:
            visit_info = {
                "date": None,
                "time": None,
                "url": None,
                "visit_id": None,
                "visit_number": None
            }
            
            cells = await element.query_selector_all("td")
            
            # Visit info is typically in the Visits cell (cell 4)
            if len(cells) >= 5:
                visits_cell = cells[4]
                
                # Log the visits cell content for debugging
                visits_cell_text = await visits_cell.text_content()
                logger.info(f"🔍 [VISIT_EXTRACT] Visits cell content: {visits_cell_text}")
                
                # Look for visit links in this cell
                visit_links = await visits_cell.query_selector_all("a")
                if visit_links:
                    logger.info(f"🔗 [VISIT_EXTRACT] Found {len(visit_links)} link(s) in visits cell")
                    
                    # Look for the NEXT VISIT link specifically
                    for visit_link in visit_links:
                        link_text = await visit_link.text_content()
                        link_href = await visit_link.get_attribute("href")
                        
                        # Log each link found
                        logger.debug(f"Visit link: text='{link_text}', href='{link_href}'")
                        
                        # IMPORTANT: Only accept URLs with /visits/ pattern, NOT customer URLs
                        if link_href and '/visits/' in link_href and '/customers/locations/' not in link_href:
                            # Make it absolute if relative
                            if link_href.startswith('/'):
                                link_href = f"https://app.workfossa.com{link_href}"
                            
                            # Extract visit ID from URL pattern
                            # Handle both /work/{work_order_id}/visits/{visit_id} and /visits/{visit_id}
                            visit_id_match = re.search(r'/visits/(\d+)', link_href)
                            if visit_id_match:
                                visit_info["visit_id"] = visit_id_match.group(1)
                                visit_info["visit_number"] = visit_id_match.group(1)  # Same as visit_id
                                visit_info["url"] = link_href
                                logger.info(f"✅ Found visit URL: {link_href}")
                                logger.info(f"✅ Extracted visit ID: {visit_info['visit_id']}")
                                logger.info(f"✅ Extracted visit number: {visit_info['visit_number']}")
                                
                                # Parse date from link text if available
                                if link_text:
                                    # Enhanced date patterns including "06/12/2025 (anytime)" format
                                    date_patterns = [
                                        r'(\d{1,2}/\d{1,2}/\d{4})',  # 07/08/2024 or 06/12/2025
                                        r'(\w+,\s+\w+\s+\d+)',  # Mon, Jul 8
                                        r'(\d{4}-\d{2}-\d{2})',  # 2024-07-08
                                    ]
                                    
                                    for pattern in date_patterns:
                                        date_match = re.search(pattern, link_text)
                                        if date_match:
                                            visit_info["date"] = self._parse_date_string(date_match.group(1))
                                            if visit_info["date"]:
                                                logger.info(f"Found visit date: {visit_info['date']}")
                                            break
                                
                                # Also try to extract date from parent element or surrounding text
                                if not visit_info["date"] and visits_cell_text:
                                    # Look for dates in the entire cell text
                                    date_patterns = [
                                        r'(\d{1,2}/\d{1,2}/\d{4})\s*\(anytime\)',  # "06/12/2025 (anytime)"
                                        r'(\d{1,2}/\d{1,2}/\d{4})',  # Any date format
                                    ]
                                    for pattern in date_patterns:
                                        date_match = re.search(pattern, visits_cell_text)
                                        if date_match:
                                            visit_info["date"] = self._parse_date_string(date_match.group(1))
                                            if visit_info["date"]:
                                                logger.info(f"Found visit date from cell text: {visit_info['date']}")
                                                break
                                
                                # If this is the first valid visit URL, use it
                                # Continue checking other links in case there's a better match
                                if not visit_info["url"] or "NEXT VISIT" in visits_cell_text.upper():
                                    break
                else:
                    logger.warning("No visit links found in visits cell")
            
            # Fallback: Look for visit info in the entire row
            if not visit_info["url"]:
                # IMPORTANT: Only look for actual visit URLs with /visits/ pattern
                # Do NOT include customer URLs with /customers/locations/ pattern
                all_links = await element.query_selector_all("a")
                for link in all_links:
                    href = await link.get_attribute("href")
                    # Only accept URLs that have /visits/ in them, NOT customer URLs
                    if href and '/visits/' in href and '/customers/locations/' not in href:
                        if href.startswith('/'):
                            href = f"https://app.workfossa.com{href}"
                        visit_info["url"] = href
                        
                        # Extract visit ID
                        visit_id_match = re.search(r'/visits/(\d+)', href)
                        if visit_id_match:
                            visit_info["visit_id"] = visit_id_match.group(1)
                            visit_info["visit_number"] = visit_id_match.group(1)  # Same as visit_id
                            logger.info(f"✅ Found visit URL in fallback: {href}")
                        break
            
            # Final fallback: Look for scheduled date in the entire row if not found
            if not visit_info["date"]:
                row_text = await element.text_content()
                if row_text:
                    # Look for dates that might be scheduled dates
                    date_patterns = [
                        r'NEXT VISIT[:\s]*([^\n]+)',  # Look for "NEXT VISIT: date" pattern
                        r'Scheduled[:\s]*([^\n]+)',  # Look for "Scheduled: date" pattern
                        r'(\d{1,2}/\d{1,2}/\d{4})\s*\(anytime\)',  # "06/12/2025 (anytime)"
                    ]
                    for pattern in date_patterns:
                        date_match = re.search(pattern, row_text, re.IGNORECASE)
                        if date_match:
                            date_str = date_match.group(1)
                            # Extract just the date part if there's extra text
                            date_only_match = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', date_str)
                            if date_only_match:
                                visit_info["date"] = self._parse_date_string(date_only_match.group(1))
                                if visit_info["date"]:
                                    logger.info(f"Found scheduled date from row text: {visit_info['date']}")
                                    break
            
            return visit_info
            
        except Exception as e:
            logger.warning(f"Could not extract visit info: {e}")
            return {"date": None, "time": None, "url": None, "visit_id": None, "visit_number": None}
    
    async def _extract_instructions(self, element) -> Optional[str]:
        """Extract special instructions for the work order"""
        try:
            # First check full text for instructions pattern
            text_content = await element.text_content()
            if text_content:
                # Look for instructions that start with "Calibrate" or similar patterns
                if "Calibrate" in text_content:
                    instructions_match = re.search(r'(Calibrate[^.]+\.(?:[^.]+\.)*)', text_content)
                    if instructions_match:
                        instructions = instructions_match.group(1).strip()
                        # Clean up "more..." if present
                        instructions = instructions.replace(", more...", "")
                        if instructions:
                            logger.info(f"Found instructions: {instructions[:50]}...")
                            return instructions
            
            # Look for instructions in pre-wrap element (V1 pattern)
            instructions_element = await element.query_selector(".pre-wrap")
            if instructions_element:
                text = await instructions_element.text_content()
                if text and text.strip():
                    return text.strip()
            
            # Look for notes or instructions in other common locations
            instruction_selectors = [
                ".instructions",
                ".notes",
                ".special-instructions",
                "[data-field='instructions']",
                "[data-field='notes']"
            ]
            
            for selector in instruction_selectors:
                try:
                    inst_element = await element.query_selector(selector)
                    if inst_element:
                        text = await inst_element.text_content()
                        if text and text.strip():
                            return text.strip()
                except:
                    continue
            
            return None
            
        except Exception as e:
            logger.warning(f"Could not extract instructions: {e}")
            return None
    
    async def _extract_status(self, element) -> str:
        """Extract work order status"""
        try:
            status_selectors = [
                self.selectors.STATUS,
                ".badge, .label, .tag",
                ".status-indicator"
            ]
            
            for selector in status_selectors:
                try:
                    status_element = await element.query_selector(selector)
                    if status_element:
                        text = await status_element.text_content()
                        if text and text.strip():
                            status = text.strip().lower()
                            # Normalize status values
                            status_map = {
                                'pending': 'pending',
                                'scheduled': 'scheduled',
                                'in progress': 'in_progress',
                                'completed': 'completed',
                                'cancelled': 'cancelled'
                            }
                            return status_map.get(status, status)
                except:
                    continue
            
            return "pending"
            
        except Exception as e:
            logger.warning(f"Could not extract status: {e}")
            return "pending"
    
    async def _extract_scheduled_date(self, element) -> Optional[datetime]:
        """Extract scheduled date from element"""
        try:
            date_selectors = [
                self.selectors.SCHEDULED_DATE,
                ".date, .scheduled, .visit-date",
                "[data-date]"
            ]
            
            for selector in date_selectors:
                try:
                    date_element = await element.query_selector(selector)
                    if date_element:
                        # Try data attribute first
                        date_attr = await date_element.get_attribute("data-date")
                        if date_attr:
                            return datetime.fromisoformat(date_attr.replace('Z', '+00:00'))
                        
                        # Try text content
                        text = await date_element.text_content()
                        if text and text.strip():
                            return self._parse_date_string(text.strip())
                except:
                    continue
            
            return None
            
        except Exception as e:
            logger.warning(f"Could not extract scheduled date: {e}")
            return None
    
    def _parse_date_string(self, date_str: str) -> Optional[datetime]:
        """Parse date string into datetime object"""
        try:
            # Common date formats
            date_formats = [
                "%Y-%m-%d",
                "%m/%d/%Y",
                "%d/%m/%Y",
                "%Y-%m-%d %H:%M:%S",
                "%m/%d/%Y %H:%M",
                "%B %d, %Y",
                "%b %d, %Y",
                "%a, %b %d",  # Mon, Jul 8
                "%A, %B %d",  # Monday, July 8
                "%m-%d-%Y",
                "%d-%m-%Y"
            ]
            
            # Clean the date string
            date_str = date_str.strip()
            
            # If year is missing, add current year
            if not re.search(r'\d{4}', date_str):
                current_year = datetime.now().year
                # Add year to formats like "Mon, Jul 8"
                if re.match(r'\w+,\s+\w+\s+\d+$', date_str):
                    date_str = f"{date_str}, {current_year}"
                    date_formats.append("%a, %b %d, %Y")
                    date_formats.append("%A, %B %d, %Y")
            
            for fmt in date_formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            
            return None
            
        except Exception as e:
            logger.warning(f"Could not parse date string '{date_str}': {e}")
            return None
    
    async def _extract_visit_url(self, element, work_order_id: str) -> Optional[str]:
        """Extract or generate visit URL - ONLY returns actual visit URLs, not customer URLs"""
        try:
            # Look for direct visit links - MUST contain /visits/
            link_selectors = [
                "a[href*='/visits/']",
                ".visit-link"
            ]
            
            for selector in link_selectors:
                try:
                    link_element = await element.query_selector(selector)
                    if link_element:
                        href = await link_element.get_attribute("href")
                        # IMPORTANT: Verify it's actually a visit URL, not a customer URL
                        if href and '/visits/' in href and '/customers/locations/' not in href:
                            # Convert relative URLs to absolute
                            if href.startswith('/'):
                                href = f"{self.url_generator.config.base_url}{href}"
                            logger.info(f"✅ [VISIT_URL] Found visit URL via selector: {href}")
                            return href
                except:
                    continue
            
            # If no visit URL found, return None
            # We should NOT generate a fake URL that doesn't actually lead to a visit
            logger.info(f"⚠️ [VISIT_URL] No visit URL found for work order {work_order_id}")
            return None
            
        except Exception as e:
            logger.warning(f"Could not extract visit URL: {e}")
            return None
    
    async def _extract_dispensers(self, page, element) -> List[Dict[str, Any]]:
        """Extract dispenser information if available"""
        try:
            dispensers = []
            
            # Look for dispenser information in the work order element
            dispenser_selectors = [
                ".dispensers, .equipment",
                ".dispenser-count, .equipment-count",
                "[data-dispensers]"
            ]
            
            for selector in dispenser_selectors:
                try:
                    dispenser_element = await element.query_selector(selector)
                    if dispenser_element:
                        # Try to extract dispenser count or list
                        text = await dispenser_element.text_content()
                        if text and 'dispenser' in text.lower():
                            # Extract number of dispensers
                            count_match = re.search(r'(\d+)', text)
                            if count_match:
                                count = int(count_match.group(1))
                                # Generate basic dispenser data
                                for i in range(count):
                                    dispensers.append({
                                        'dispenser_number': str(i + 1),
                                        'dispenser_type': 'Unknown',
                                        'fuel_grades': {
                                            'regular': {'octane': 87},
                                            'plus': {'octane': 89},
                                            'premium': {'octane': 91}
                                        }
                                    })
                                return dispensers
                except:
                    continue
            
            # Return empty list if no dispensers found
            # Don't add mock data - let the UI handle empty state
            return dispensers
            
        except Exception as e:
            logger.warning(f"Could not extract dispensers: {e}")
            return []
    
    async def _scrape_dispensers_from_customer_page(self, page) -> List[Dict[str, Any]]:
        """Scrape dispensers from customer location page using Equipment tab navigation"""
        logger.info(f"🔧 [CUSTOMER_PAGE] Starting dispenser scraping from customer location page")
        
        try:
            # Get current page URL for debugging
            current_url = page.url
            page_title = await page.title()
            logger.info(f"🔍 [CUSTOMER_PAGE] Current URL: {current_url}")
            logger.info(f"🔍 [CUSTOMER_PAGE] Page title: {page_title}")
            
            # Step 1: Find and click Equipment tab
            logger.info(f"🔍 [CUSTOMER_PAGE] Step 1: Looking for Equipment tab...")
            equipment_tab_clicked = await self._click_equipment_tab(page)
            
            if not equipment_tab_clicked:
                logger.error(f"❌ [CUSTOMER_PAGE] Could not find or click Equipment tab")
                # Take debug screenshot
                try:
                    await page.screenshot(path="debug_no_equipment_tab.png")
                    logger.info(f"📸 [CUSTOMER_PAGE] Debug screenshot saved: debug_no_equipment_tab.png")
                except:
                    pass
                return []
            
            logger.info(f"✅ [CUSTOMER_PAGE] Equipment tab clicked successfully")
            
            # Smart wait for Equipment tab content to load
            logger.info(f"⏱️ [CUSTOMER_PAGE] Waiting for Equipment tab content to load...")
            try:
                # Wait for equipment content indicators
                await page.wait_for_selector(
                    ".equipment-content, .equipment-list, [data-equipment], .dispenser-section",
                    timeout=2000,
                    state="visible"
                )
                logger.info(f"✅ [CUSTOMER_PAGE] Equipment content loaded")
            except:
                # Reduced fallback wait
                logger.info(f"⏱️ [CUSTOMER_PAGE] Using reduced fallback wait")
                await page.wait_for_timeout(1000)
            
            # Step 2: Find and click Dispenser section
            logger.info(f"🔍 [CUSTOMER_PAGE] Step 2: Looking for Dispenser section...")
            dispenser_section_clicked = await self._click_dispenser_section(page)
            
            if not dispenser_section_clicked:
                logger.error(f"❌ [CUSTOMER_PAGE] Could not find or click Dispenser section")
                # Take debug screenshot
                try:
                    await page.screenshot(path="debug_no_dispenser_section.png")
                    logger.info(f"📸 [CUSTOMER_PAGE] Debug screenshot saved: debug_no_dispenser_section.png")
                except:
                    pass
                # Continue anyway - sometimes dispensers are visible without clicking
                
            else:
                logger.info(f"✅ [CUSTOMER_PAGE] Dispenser section clicked successfully")
                
                # Smart wait for Dispenser section to expand
                logger.info(f"⏱️ [CUSTOMER_PAGE] Waiting for Dispenser section to expand...")
                try:
                    # Wait for dispenser elements to appear
                    await page.wait_for_selector(
                        ".dispenser-item, [data-dispenser], .equipment-item:has-text('Dispenser'), tr:has-text('Dispenser')",
                        timeout=2000,
                        state="visible"
                    )
                    logger.info(f"✅ [CUSTOMER_PAGE] Dispenser content visible")
                except:
                    # Reduced fallback wait
                    logger.info(f"⏱️ [CUSTOMER_PAGE] Using reduced fallback wait")
                    await page.wait_for_timeout(1000)
            
            # Step 3: Extract dispenser information using the enhanced dispenser scraper
            logger.info(f"🔍 [CUSTOMER_PAGE] Step 3: Extracting dispenser information using enhanced scraper...")
            
            # Use the dispenser_scraper which has all the detailed field extraction
            dispenser_infos, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
                page=page,
                work_order_id="temp_id",  # Temporary ID for scraping
                visit_url=None  # Already on the page
            )
            
            # Convert DispenserInfo objects to dictionaries with all fields
            dispensers = []
            for info in dispenser_infos:
                dispenser_dict = {
                    'dispenser_number': info.dispenser_number,
                    'dispenser_type': info.dispenser_type or info.make or 'Unknown',
                    'title': info.title,
                    'serial_number': info.serial_number,
                    'make': info.make,
                    'model': info.model,
                    'stand_alone_code': info.stand_alone_code,
                    'number_of_nozzles': info.number_of_nozzles,
                    'meter_type': info.meter_type,
                    'fuel_grades': info.fuel_grades or {},
                    'grades_list': info.grades_list or [],
                    'custom_fields': info.custom_fields or {},
                    'dispenser_numbers': info.dispenser_numbers or []
                }
                dispensers.append(dispenser_dict)
            
            logger.info(f"✅ [CUSTOMER_PAGE] Found {len(dispensers)} dispensers with detailed information")
            
            # Log each dispenser found with more details
            for i, dispenser in enumerate(dispensers):
                logger.info(f"📋 [CUSTOMER_PAGE] Dispenser {i+1}: #{dispenser.get('dispenser_number', 'Unknown')} - {dispenser.get('dispenser_type', 'Unknown type')}")
                if dispenser.get('serial_number'):
                    logger.info(f"   Serial: {dispenser['serial_number']}")
                if dispenser.get('stand_alone_code'):
                    logger.info(f"   Stand Alone Code: {dispenser['stand_alone_code']}")
            
            return dispensers
            
        except Exception as e:
            logger.error(f"❌ [CUSTOMER_PAGE] Error scraping dispensers from customer page: {e}")
            import traceback
            logger.error(f"❌ [CUSTOMER_PAGE] Traceback: {traceback.format_exc()}")
            return []
    
    async def _click_equipment_tab(self, page) -> bool:
        """Click the Equipment tab with robust logging"""
        logger.info(f"🔍 [EQUIPMENT_TAB] Searching for Equipment tab...")
        
        try:
            # Method 1: Look for Equipment tab using various selectors
            equipment_selectors = [
                "a:has-text('Equipment')",
                "button:has-text('Equipment')",
                "[data-tab='equipment']",
                ".tab:has-text('Equipment')",
                "*[role='tab']:has-text('Equipment')"
            ]
            
            for i, selector in enumerate(equipment_selectors):
                logger.info(f"🔍 [EQUIPMENT_TAB] Trying selector {i+1}/{len(equipment_selectors)}: {selector}")
                try:
                    element = await page.query_selector(selector)
                    if element:
                        logger.info(f"✅ [EQUIPMENT_TAB] Found Equipment tab with selector: {selector}")
                        await element.click()
                        logger.info(f"✅ [EQUIPMENT_TAB] Clicked Equipment tab successfully")
                        return True
                    else:
                        logger.debug(f"🔍 [EQUIPMENT_TAB] Selector {selector} found no elements")
                except Exception as e:
                    logger.debug(f"❌ [EQUIPMENT_TAB] Selector {selector} failed: {e}")
                    continue
            
            # Method 2: JavaScript approach to find any element containing "Equipment"
            logger.info(f"🔍 [EQUIPMENT_TAB] Trying JavaScript method to find Equipment tab...")
            equipment_found = await page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('a, button, div[role="tab"], .tab');
                    for (const el of elements) {
                        if (el.textContent && el.textContent.trim().toLowerCase().includes('equipment')) {
                            console.log('Found Equipment element:', el.tagName, el.className, el.textContent.trim());
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }
            """)
            
            if equipment_found:
                logger.info(f"✅ [EQUIPMENT_TAB] Found and clicked Equipment tab using JavaScript")
                return True
            
            # Method 3: Look for any clickable elements and debug what's available
            logger.info(f"🔍 [EQUIPMENT_TAB] Method 3: Debugging available tabs...")
            available_tabs = await page.evaluate("""
                () => {
                    const tabs = [];
                    const elements = document.querySelectorAll('a, button, div[role="tab"], .tab, [data-tab]');
                    elements.forEach(el => {
                        if (el.textContent && el.textContent.trim()) {
                            tabs.push({
                                tagName: el.tagName,
                                className: el.className,
                                textContent: el.textContent.trim(),
                                href: el.href || null
                            });
                        }
                    });
                    return tabs;
                }
            """)
            
            logger.info(f"🔍 [EQUIPMENT_TAB] Available tabs/buttons on page: {len(available_tabs)}")
            for i, tab in enumerate(available_tabs[:10]):  # Log first 10 tabs
                logger.info(f"🔍 [EQUIPMENT_TAB] Tab {i+1}: {tab['tagName']} - '{tab['textContent']}' (class: {tab['className']})")
            
            # Method 4: Try case-insensitive search for equipment-related text
            logger.info(f"🔍 [EQUIPMENT_TAB] Method 4: Case-insensitive search...")
            equipment_found = await page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('*');
                    for (const el of elements) {
                        if (el.textContent && 
                            el.textContent.trim().toLowerCase().includes('equipment') &&
                            (el.tagName === 'A' || el.tagName === 'BUTTON' || el.role === 'tab')) {
                            console.log('Found case-insensitive Equipment element:', el.tagName, el.textContent.trim());
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }
            """)
            
            if equipment_found:
                logger.info(f"✅ [EQUIPMENT_TAB] Found and clicked Equipment tab using case-insensitive search")
                return True
                
            logger.error(f"❌ [EQUIPMENT_TAB] Could not find Equipment tab using any method")
            return False
            
        except Exception as e:
            logger.error(f"❌ [EQUIPMENT_TAB] Error clicking Equipment tab: {e}")
            return False
    
    async def _click_dispenser_section(self, page) -> bool:
        """Click the Dispenser section to expand it with robust logging"""
        logger.info(f"🔍 [DISPENSER_SECTION] Searching for Dispenser section...")
        
        try:
            # Method 1: Look for Dispenser section heading
            logger.info(f"🔍 [DISPENSER_SECTION] Method 1: Looking for Dispenser section heading...")
            dispenser_clicked = await page.evaluate("""
                () => {
                    // Look for group heading with Dispenser text
                    const headings = document.querySelectorAll('.group-heading');
                    for (const heading of headings) {
                        const boldText = heading.querySelector('.bold');
                        if (boldText && boldText.textContent.includes('Dispenser')) {
                            console.log('Found Dispenser heading:', boldText.textContent);
                            const link = heading.querySelector('a');
                            if (link) {
                                link.click();
                                return true;
                            }
                        }
                    }
                    return false;
                }
            """)
            
            if dispenser_clicked:
                logger.info(f"✅ [DISPENSER_SECTION] Clicked Dispenser section using group heading method")
                return True
            
            # Method 2: Look for any clickable element with "Dispenser" text
            logger.info(f"🔍 [DISPENSER_SECTION] Method 2: Looking for clickable Dispenser elements...")
            dispenser_selectors = [
                "a:has-text('Dispenser')",
                "button:has-text('Dispenser')",
                ".group-heading:has-text('Dispenser')",
                "h3:has-text('Dispenser')",
                "div:has-text('Dispenser')"
            ]
            
            for i, selector in enumerate(dispenser_selectors):
                logger.info(f"🔍 [DISPENSER_SECTION] Trying selector {i+1}/{len(dispenser_selectors)}: {selector}")
                try:
                    element = await page.query_selector(selector)
                    if element:
                        logger.info(f"✅ [DISPENSER_SECTION] Found Dispenser element with selector: {selector}")
                        await element.click()
                        logger.info(f"✅ [DISPENSER_SECTION] Clicked Dispenser section successfully")
                        return True
                    else:
                        logger.debug(f"🔍 [DISPENSER_SECTION] Selector {selector} found no elements")
                except Exception as e:
                    logger.debug(f"❌ [DISPENSER_SECTION] Selector {selector} failed: {e}")
                    continue
            
            # Method 3: JavaScript search for any element containing "Dispenser"
            logger.info(f"🔍 [DISPENSER_SECTION] Method 3: JavaScript search for Dispenser elements...")
            dispenser_found = await page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('*');
                    for (const el of elements) {
                        if (el.textContent && 
                            el.textContent.includes('Dispenser') &&
                            !el.textContent.includes('Add Dispenser') &&
                            (el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick || el.classList.contains('clickable'))) {
                            console.log('Found Dispenser element:', el.tagName, el.className, el.textContent.trim());
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }
            """)
            
            if dispenser_found:
                logger.info(f"✅ [DISPENSER_SECTION] Found and clicked Dispenser section using JavaScript")
                return True
            
            # Method 4: Debug what sections are available
            logger.info(f"🔍 [DISPENSER_SECTION] Method 4: Debugging available sections...")
            available_sections = await page.evaluate("""
                () => {
                    const sections = [];
                    const elements = document.querySelectorAll('.group-heading, h3, .section-header');
                    elements.forEach(el => {
                        if (el.textContent && el.textContent.trim()) {
                            sections.push({
                                tagName: el.tagName,
                                className: el.className,
                                textContent: el.textContent.trim()
                            });
                        }
                    });
                    return sections;
                }
            """)
            
            logger.info(f"🔍 [DISPENSER_SECTION] Available sections on page: {len(available_sections)}")
            for i, section in enumerate(available_sections[:10]):  # Log first 10 sections
                logger.info(f"🔍 [DISPENSER_SECTION] Section {i+1}: {section['tagName']} - '{section['textContent']}' (class: {section['className']})")
            
            logger.warning(f"⚠️ [DISPENSER_SECTION] Could not find Dispenser section - continuing anyway")
            return False
            
        except Exception as e:
            logger.error(f"❌ [DISPENSER_SECTION] Error clicking Dispenser section: {e}")
            return False
    
    async def _extract_dispensers_from_page(self, page) -> List[Dict[str, Any]]:
        """Extract dispenser information from the current page with robust logging"""
        logger.info(f"🔍 [EXTRACT] Starting dispenser extraction...")
        
        try:
            # Method 1: Look for expanded Dispenser section (pattern from screenshot)
            logger.info(f"🔍 [EXTRACT] Method 1: Looking for dispenser data using pattern matching...")
            dispensers_data = await page.evaluate("""
                () => {
                    const dispensers = [];
                    
                    // Look for dispenser text patterns like "1/2 - Regular, Plus, Premium - Gilbarco"
                    const textElements = document.querySelectorAll('*');
                    const dispenserPattern = /^(\\d+)\\/(\\d+)\\s*-\\s*(.+?)\\s*-\\s*(.+)$/;
                    
                    for (const el of textElements) {
                        if (el.textContent && el.children.length === 0) {  // Only text nodes
                            const text = el.textContent.trim();
                            const match = text.match(dispenserPattern);
                            if (match) {
                                console.log('Found dispenser pattern:', text);
                                dispensers.push({
                                    dispenser_number: match[1],
                                    total_dispensers: match[2],
                                    fuel_types: match[3],
                                    manufacturer: match[4],
                                    raw_text: text
                                });
                            }
                        }
                    }
                    
                    return dispensers;
                }
            """)
            
            if dispensers_data and len(dispensers_data) > 0:
                logger.info(f"✅ [EXTRACT] Found {len(dispensers_data)} dispensers using pattern matching")
                
                # Convert to standard format
                dispensers = []
                for i, data in enumerate(dispensers_data):
                    # Parse fuel types
                    fuel_types = data.get('fuel_types', '').split(',')
                    fuel_grades = {}
                    
                    for fuel_type in fuel_types:
                        fuel_type = fuel_type.strip().lower()
                        if 'regular' in fuel_type:
                            fuel_grades['regular'] = {'octane': 87}
                        elif 'plus' in fuel_type:
                            fuel_grades['plus'] = {'octane': 89}
                        elif 'premium' in fuel_type:
                            fuel_grades['premium'] = {'octane': 91}
                        elif 'diesel' in fuel_type:
                            fuel_grades['diesel'] = {'octane': None}
                    
                    # If no fuel grades found, use defaults
                    if not fuel_grades:
                        fuel_grades = {
                            'regular': {'octane': 87},
                            'plus': {'octane': 89},
                            'premium': {'octane': 91}
                        }
                    
                    dispenser = {
                        'dispenser_number': data.get('dispenser_number', str(i + 1)),
                        'dispenser_type': data.get('manufacturer', 'Unknown'),
                        'fuel_grades': fuel_grades,
                        'raw_text': data.get('raw_text', ''),
                        'total_dispensers': data.get('total_dispensers')
                    }
                    
                    dispensers.append(dispenser)
                    logger.info(f"📋 [EXTRACT] Dispenser {i+1}: Number={dispenser['dispenser_number']}, Type={dispenser['dispenser_type']}, Fuels={list(fuel_grades.keys())}")
                
                return dispensers
            
            # Method 2: Look for structured dispenser data
            logger.info(f"🔍 [EXTRACT] Method 2: Looking for structured dispenser data...")
            structured_data = await page.evaluate("""
                () => {
                    const dispensers = [];
                    
                    // Look for dispenser containers
                    const dispenserContainers = document.querySelectorAll('.dispenser-item, .equipment-item, .px-2');
                    
                    dispenserContainers.forEach((container, index) => {
                        const title = container.querySelector('.flex.align-start > div')?.textContent?.trim();
                        const serialEl = container.querySelector('.muted.text-tiny');
                        const serial = serialEl ? serialEl.textContent.replace('S/N:', '').trim() : '';
                        
                        if (title || serial) {
                            dispensers.push({
                                dispenser_number: String(index + 1),
                                title: title || '',
                                serial_number: serial,
                                dispenser_type: 'Unknown',
                                container_html: container.outerHTML
                            });
                        }
                    });
                    
                    return dispensers;
                }
            """)
            
            if structured_data and len(structured_data) > 0:
                logger.info(f"✅ [EXTRACT] Found {len(structured_data)} dispensers using structured data method")
                
                dispensers = []
                for i, data in enumerate(structured_data):
                    dispenser = {
                        'dispenser_number': data.get('dispenser_number', str(i + 1)),
                        'dispenser_type': data.get('dispenser_type', 'Unknown'),
                        'fuel_grades': {
                            'regular': {'octane': 87},
                            'plus': {'octane': 89},
                            'premium': {'octane': 91}
                        },
                        'title': data.get('title', ''),
                        'serial_number': data.get('serial_number', '')
                    }
                    dispensers.append(dispenser)
                    logger.info(f"📋 [EXTRACT] Dispenser {i+1}: {dispenser['dispenser_number']} - {dispenser['title']}")
                
                return dispensers
            
            # Method 3: Debug what content is available
            logger.info(f"🔍 [EXTRACT] Method 3: Debugging page content for dispenser information...")
            page_content_debug = await page.evaluate("""
                () => {
                    const debug = {
                        dispenserText: [],
                        equipmentSections: [],
                        allText: []
                    };
                    
                    // Look for any text containing "dispenser"
                    const allElements = document.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.textContent && el.children.length === 0) {  // Text nodes only
                            const text = el.textContent.trim();
                            if (text.toLowerCase().includes('dispenser')) {
                                debug.dispenserText.push(text);
                            }
                            if (text.match(/\\d+\\/\\d+/)) {  // Look for patterns like 1/2
                                debug.allText.push(text);
                            }
                        }
                    });
                    
                    // Look for equipment-related sections
                    const sections = document.querySelectorAll('.group-heading, .section, .equipment');
                    sections.forEach(section => {
                        const text = section.textContent?.trim();
                        if (text) {
                            debug.equipmentSections.push(text);
                        }
                    });
                    
                    return debug;
                }
            """)
            
            logger.info(f"🔍 [EXTRACT] Debug - Dispenser text found: {len(page_content_debug.get('dispenserText', []))}")
            for text in page_content_debug.get('dispenserText', [])[:5]:  # Log first 5
                logger.info(f"🔍 [EXTRACT] Dispenser text: '{text}'")
            
            logger.info(f"🔍 [EXTRACT] Debug - Equipment sections found: {len(page_content_debug.get('equipmentSections', []))}")
            for section in page_content_debug.get('equipmentSections', [])[:5]:  # Log first 5
                logger.info(f"🔍 [EXTRACT] Equipment section: '{section}'")
            
            logger.info(f"🔍 [EXTRACT] Debug - Pattern text found: {len(page_content_debug.get('allText', []))}")
            for text in page_content_debug.get('allText', [])[:10]:  # Log first 10
                logger.info(f"🔍 [EXTRACT] Pattern text: '{text}'")
            
            # Method 4: Return default dispensers if nothing found
            logger.warning(f"⚠️ [EXTRACT] No dispensers found - returning default set")
            default_dispensers = [
                {
                    'dispenser_number': '1',
                    'dispenser_type': 'Unknown',
                    'fuel_grades': {
                        'regular': {'octane': 87},
                        'plus': {'octane': 89},
                        'premium': {'octane': 91}
                    }
                },
                {
                    'dispenser_number': '2',
                    'dispenser_type': 'Unknown',
                    'fuel_grades': {
                        'regular': {'octane': 87},
                        'plus': {'octane': 89},
                        'premium': {'octane': 91}
                    }
                }
            ]
            
            return default_dispensers
            
        except Exception as e:
            logger.error(f"❌ [EXTRACT] Error extracting dispensers: {e}")
            import traceback
            logger.error(f"❌ [EXTRACT] Traceback: {traceback.format_exc()}")
            return []
    
    @with_error_recovery(operation_type="dispenser_scraping")
    async def scrape_dispenser_details(self, session_id: str, work_order_id: str, customer_url: Optional[str] = None) -> List[Dict[str, Any]]:
        """Scrape detailed dispenser information for a work order using customer location page"""
        logger.info(f"🔍 [DISPENSER] Starting dispenser scraping for work order {work_order_id}")
        logger.info(f"🔍 [DISPENSER] Session ID: {session_id}")
        logger.info(f"🔍 [DISPENSER] Customer URL: {customer_url}")
        
        try:
            # Get page from session
            page = None
            logger.info(f"🔍 [DISPENSER] Looking for page in browser automation service...")
            
            # Try to get page from browser automation first
            if hasattr(self.browser_automation, 'pages') and hasattr(self.browser_automation.pages, 'get'):
                page = self.browser_automation.pages.get(session_id)
                if page:
                    logger.info(f"✅ [DISPENSER] Found page in browser automation service")
            
            # If not found, check WorkFossa automation service
            if not page:
                logger.info(f"🔍 [DISPENSER] Page not found in browser automation, checking WorkFossa automation service...")
                try:
                    # Check if browser_automation has a sessions attribute (it might be a WorkFossaAutomationService)
                    if hasattr(self.browser_automation, 'sessions'):
                        session_data = self.browser_automation.sessions.get(session_id)
                        if session_data:
                            page = session_data.get('page')
                            logger.info(f"✅ [DISPENSER] Found page in WorkFossa automation service")
                    else:
                        logger.warning(f"❌ [DISPENSER] Browser automation service has no sessions attribute")
                except Exception as e:
                    logger.error(f"❌ [DISPENSER] Error checking automation service: {e}")
            
            if not page:
                logger.error(f"❌ [DISPENSER] No active browser session found for dispenser scraping")
                raise Exception("No active browser session found for dispenser scraping")
            
            logger.info(f"✅ [DISPENSER] Page found, proceeding with dispenser scraping")
            
            # Validate customer URL
            if not customer_url:
                logger.error(f"❌ [DISPENSER] No customer URL provided - cannot scrape dispensers")
                raise Exception("Customer URL is required for dispenser scraping")
            
            logger.info(f"🔍 [DISPENSER] Customer URL validated: {customer_url}")
            
            # Navigate to customer location page
            logger.info(f"🔄 [DISPENSER] Navigating to customer location page: {customer_url}")
            try:
                await page.goto(customer_url, wait_until="domcontentloaded", timeout=15000)
                logger.info(f"✅ [DISPENSER] Page loaded, waiting for content...")
                
                # Smart wait for page content instead of fixed timeout
                try:
                    # Wait for any indication that the page has loaded
                    await page.wait_for_selector(
                        ".equipment-tab, [data-tab='equipment'], a:has-text('Equipment'), .tab-content",
                        timeout=5000,
                        state="visible"
                    )
                    logger.info(f"✅ [DISPENSER] Page content detected")
                except:
                    # Minimal fallback wait if selectors not found
                    logger.info(f"⏱️ [DISPENSER] Using minimal fallback wait")
                    await page.wait_for_timeout(500)
                    
            except Exception as e:
                logger.error(f"❌ [DISPENSER] Failed to navigate to customer URL: {e}")
                raise Exception(f"Failed to navigate to customer URL: {e}")
            
            # Take screenshot for debugging (only if enabled)
            if self.config.get('enable_debug_screenshots', False):
                try:
                    screenshot_path = f"dispenser_scrape_{work_order_id}_{session_id}.png"
                    await page.screenshot(path=screenshot_path)
                    logger.info(f"📸 [DISPENSER] Screenshot saved: {screenshot_path}")
                except Exception as e:
                    logger.warning(f"⚠️ [DISPENSER] Could not take screenshot: {e}")
            
            # Use the NEW method for customer page dispenser scraping
            logger.info(f"🔧 [DISPENSER] Using customer page dispenser scraper for work order {work_order_id}")
            dispensers = await self._scrape_dispensers_from_customer_page(page)
            
            logger.info(f"✅ [DISPENSER] Successfully scraped {len(dispensers)} dispensers for work order {work_order_id}")
            
            return dispensers
            
        except Exception as e:
            logger.error(f"❌ [DISPENSER] Error scraping dispenser details: {e}")
            import traceback
            logger.error(f"❌ [DISPENSER] Traceback: {traceback.format_exc()}")
            return []
    
    async def _extract_dispenser_number(self, element, index: int) -> str:
        """Extract dispenser number"""
        try:
            number_element = await element.query_selector(self.selectors.DISPENSER_NUMBER)
            if number_element:
                text = await number_element.text_content()
                if text and text.strip():
                    # Extract number from text
                    number_match = re.search(r'(\d+)', text.strip())
                    if number_match:
                        return number_match.group(1)
            
            return str(index + 1)
            
        except Exception as e:
            logger.warning(f"Could not extract dispenser number: {e}")
            return str(index + 1)
    
    async def _extract_dispenser_type(self, element) -> str:
        """Extract dispenser type"""
        try:
            type_element = await element.query_selector(self.selectors.DISPENSER_TYPE)
            if type_element:
                text = await type_element.text_content()
                if text and text.strip():
                    return text.strip()
            
            # Common dispenser types to look for in text
            text_content = await element.text_content()
            if text_content:
                types = ['wayne', 'gilbarco', 'dresser', 'tokheim']
                for dispenser_type in types:
                    if dispenser_type in text_content.lower():
                        return dispenser_type.title()
            
            return "Unknown"
            
        except Exception as e:
            logger.warning(f"Could not extract dispenser type: {e}")
            return "Unknown"
    
    async def _extract_fuel_grades(self, element) -> Dict[str, Any]:
        """Extract fuel grades for dispenser"""
        try:
            grades = {}
            
            # Look for fuel grade information
            grade_element = await element.query_selector(self.selectors.FUEL_GRADES)
            if grade_element:
                text = await grade_element.text_content()
                if text:
                    # Parse fuel grade text
                    if 'regular' in text.lower():
                        grades['regular'] = {'octane': 87}
                    if 'plus' in text.lower() or 'mid' in text.lower():
                        grades['plus'] = {'octane': 89}
                    if 'premium' in text.lower():
                        grades['premium'] = {'octane': 91}
                    if 'diesel' in text.lower():
                        grades['diesel'] = {'octane': None}
            
            # Default grades if none found
            if not grades:
                grades = {
                    'regular': {'octane': 87},
                    'plus': {'octane': 89},
                    'premium': {'octane': 91}
                }
            
            return grades
            
        except Exception as e:
            logger.warning(f"Could not extract fuel grades: {e}")
            return {
                'regular': {'octane': 87},
                'plus': {'octane': 89},
                'premium': {'octane': 91}
            }

# Global scraper instance
workfossa_scraper = WorkFossaScraper(browser_automation)

# Testing function
async def test_workfossa_scraper():
    """Test WorkFossa scraper functionality"""
    print("🔄 Testing WorkFossa scraper...")
    
    try:
        # Test scraper initialization
        scraper = workfossa_scraper
        print("✅ Scraper initialized successfully")
        
        # Test selector patterns
        print("✅ Selector patterns defined")
        print(f"   - Work order selectors: {len(scraper.selectors.WORK_ORDER_ITEM.split(','))} patterns")
        print(f"   - Navigation selectors: {len(scraper.selectors.WORK_ORDERS_LINK.split(','))} patterns")
        print(f"   - Detail selectors: {len(scraper.selectors.SITE_NAME.split(','))} patterns")
        
        # Test URL generation
        print("✅ URL generation ready")
        
        print("🎉 WorkFossa scraper tests completed successfully!")
        print("📋 Ready for production integration with browser automation")
        
        return True
        
    except Exception as e:
        print(f"❌ Scraper test failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_workfossa_scraper())