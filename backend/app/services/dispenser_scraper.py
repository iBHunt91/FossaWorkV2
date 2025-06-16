#!/usr/bin/env python3
"""
Enhanced Dispenser Information Scraper for WorkFossa
Based on V1 implementation with improvements for V2 architecture
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path

from .smart_wait import SmartWait
from .enhanced_smart_wait import EnhancedSmartWait
from .content_based_wait import ContentBasedWait

logger = logging.getLogger(__name__)


@dataclass
class DispenserInfo:
    """Detailed dispenser information structure"""
    dispenser_id: str
    title: str
    serial_number: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    dispenser_number: Optional[str] = None  # e.g., "1/2" for dual-sided or "1" for single-sided
    dispenser_numbers: List[str] = None  # e.g., ["1", "2"] for dual-sided or ["1"] for single-sided
    stand_alone_code: Optional[str] = None
    number_of_nozzles: Optional[str] = None
    meter_type: Optional[str] = None
    location: Optional[str] = None
    fuel_grades: Dict[str, Any] = None
    grades_list: List[str] = None  # Ordered list of fuel grades
    custom_fields: Dict[str, str] = None
    raw_html: Optional[str] = None
    last_updated: datetime = None
    
    def __post_init__(self):
        if self.last_updated is None:
            self.last_updated = datetime.now()
        if self.fuel_grades is None:
            self.fuel_grades = {}
        if self.custom_fields is None:
            self.custom_fields = {}
        if self.dispenser_numbers is None:
            self.dispenser_numbers = []
        if self.grades_list is None:
            self.grades_list = []


class DispenserScraper:
    """Enhanced dispenser scraping service for WorkFossa"""
    
    def __init__(self):
        # Increased timeouts for better reliability
        self.timeouts = {
            'navigation': 30000,  # 30 seconds for page navigation
            'equipment_tab': 10000,  # 10 seconds to find/click equipment tab
            'dispenser_expand': 10000,  # 10 seconds for dispenser section to expand
            'data_load': 5000,  # 5 seconds for data to load after expansion
            'element_wait': 5000  # 5 seconds for individual elements
        }
        
        self.selectors = {
            # Equipment tab selectors
            'equipment_tab': [
                'button:has-text("Equipment")',
                'a:has-text("Equipment")',
                '[data-tab="equipment"]',
                '[dusk="equipment-tab"]',
                '.tab-equipment',
                'text=Equipment'
            ],
            
            # Dispenser section selectors
            'dispenser_section': [
                '.group-heading:has-text("Dispenser")',
                'a[title*="equipment"]:has-text("Dispenser")',
                '.equipment-group:has-text("Dispenser")',
                'h3:has-text("Dispenser")',
                '.bold:has-text("Dispenser")'
            ],
            
            # Dispenser item selectors
            'dispenser_items': [
                '.dispenser-item',
                '.equipment-item:has-text("Dispenser")',
                '.px-2:has(.custom-fields-view)',
                '[data-equipment-type="dispenser"]'
            ],
            
            # Field selectors
            'dispenser_title': '.flex.align-start > div',
            'serial_number': '.muted.text-tiny:has-text("S/N:")',
            'make_model': '.text-tiny div',
            'custom_fields': '.custom-fields-view .row > div'
        }
    
    async def scrape_dispensers_for_work_order(
        self, 
        page, 
        work_order_id: str, 
        visit_url: Optional[str] = None,
        max_retries: int = 2
    ) -> Tuple[List[DispenserInfo], Optional[str]]:
        """
        Scrape dispenser information for a specific work order with retry logic
        
        Args:
            page: Playwright page object
            work_order_id: The work order ID
            visit_url: Optional visit URL to navigate to
            max_retries: Maximum number of retry attempts (default: 2)
            
        Returns:
            Tuple of (dispensers list, raw HTML content)
        """
        # Try up to max_retries times
        for attempt in range(max_retries + 1):
            try:
                if attempt > 0:
                    logger.info(f"🔄 Retry attempt {attempt}/{max_retries} for work order {work_order_id}")
                
                result = await self._scrape_dispensers_internal(page, work_order_id, visit_url)
                
                # If we got dispensers, return them
                if result[0]:  # If dispensers list is not empty
                    return result
                
                # If no dispensers found and we have retries left, try again
                if attempt < max_retries:
                    logger.warning(f"⚠️ No dispensers found on attempt {attempt + 1}, retrying...")
                    await page.wait_for_timeout(2000)  # Wait before retry
                    continue
                
                # No more retries, return empty result
                return result
                
            except Exception as e:
                logger.error(f"❌ Error on attempt {attempt + 1} for work order {work_order_id}: {e}")
                
                # If we have retries left and it's not a critical error, try again
                if attempt < max_retries and "closed" not in str(e).lower():
                    await page.wait_for_timeout(2000)  # Wait before retry
                    continue
                
                # Critical error or no more retries
                raise
        
        # Should not reach here, but return empty result just in case
        return [], None
    
    async def _scrape_dispensers_internal(
        self, 
        page, 
        work_order_id: str, 
        visit_url: Optional[str] = None
    ) -> Tuple[List[DispenserInfo], Optional[str]]:
        """Internal method that does the actual scraping"""
        logger.info(f"🔧 Starting dispenser scrape for work order: {work_order_id}")
        
        # Navigate to visit URL if provided
        if visit_url:
            logger.info(f"Navigating to visit URL: {visit_url}")
            try:
                await page.goto(visit_url, wait_until="domcontentloaded", timeout=self.timeouts['navigation'])
            except Exception as nav_error:
                logger.error(f"Failed to navigate to {visit_url}: {nav_error}")
                # Check if it's a connection closed error
                if "closed" in str(nav_error).lower() or "transport" in str(nav_error).lower():
                    logger.error("Browser connection was closed. Session may have timed out.")
                raise
            
            # Use content-based wait for Equipment tab
            logger.info("⏳ Waiting for Equipment tab to be ready...")
            if not await ContentBasedWait.wait_for_equipment_tab(page):
                logger.warning("Equipment tab not found")
                return [], None
            
            # Click Equipment tab
            logger.info("👆 Clicking Equipment tab...")
            await page.click('text="Equipment"')
            
            # Wait for loader to disappear
            logger.info("⏳ Waiting for Equipment tab to finish loading...")
            await ContentBasedWait.wait_for_loader_to_disappear(page)
            
            # Wait for Dispenser toggle to appear
            logger.info("⏳ Waiting for Dispenser toggle...")
            toggle_text = await ContentBasedWait.wait_for_dispenser_toggle(page)
            if not toggle_text:
                logger.warning("Dispenser toggle not found")
                return [], await self._capture_page_html(page)
            
            logger.info(f"✅ Found: {toggle_text}")
            
            # Extract expected count
            expected_count = await ContentBasedWait.extract_dispenser_count_from_toggle(page)
            logger.info(f"📊 Expected dispensers: {expected_count}")
            
            # Close modal if present
            await ContentBasedWait.wait_for_modal_and_close(page)
            
            # Check if content already visible
            already_visible, initial_count = await ContentBasedWait.wait_for_dispenser_content(
                page, timeout=1000, min_containers=1
            )
            
            if already_visible and initial_count > 0:
                logger.info(f"✅ Dispenser content already visible ({initial_count} containers)")
            else:
                # Click Dispenser toggle to expand
                logger.info("👆 Clicking Dispenser toggle to expand...")
                if await ContentBasedWait.click_dispenser_toggle_safely(page):
                    # Wait for content to appear
                    success, container_count = await ContentBasedWait.wait_for_dispenser_content(
                        page, timeout=5000, min_containers=expected_count if expected_count > 0 else 1
                    )
                    
                    if success:
                        logger.info(f"✅ Dispenser section expanded ({container_count} containers)")
                    else:
                        logger.warning("⚠️ Dispenser content did not appear after clicking")
                else:
                    logger.warning("Could not click Dispenser toggle")
            
            
            # Capture dispenser HTML
            dispenser_html = await self._capture_dispenser_html(page)
            
            # Extract dispenser information
            dispensers = await self._extract_dispensers_simple(page, work_order_id)
            
            # Enhanced logging for debugging
            if dispensers:
                logger.info(f"✅ Found {len(dispensers)} dispensers for work order {work_order_id}")
                for d in dispensers:
                    logger.debug(f"  - {d.title}: {d.make} {d.model} (S/N: {d.serial_number})")
            else:
                logger.warning(f"⚠️ No dispensers found for work order {work_order_id}")
                # Log page URL for debugging
                current_url = page.url
                logger.debug(f"  Current URL: {current_url}")
                # Check if we're on the right tab
                is_equipment_tab = await page.evaluate("""
                    () => {
                        const activeTab = document.querySelector('.tab-pane.active');
                        return activeTab ? activeTab.getAttribute('id') : 'unknown';
                    }
                """)
                logger.debug(f"  Active tab: {is_equipment_tab}")
            
            return dispensers, dispenser_html
    
    async def _click_equipment_tab(self, page) -> bool:
        """Click the Equipment tab and wait for it to load"""
        try:
            logger.info("🔍 Looking for Equipment tab...")
            
            # First, try to find and click the Equipment tab
            equipment_clicked = False
            
            for selector in self.selectors['equipment_tab']:
                try:
                    # Try different methods to find and click
                    if selector.startswith('text='):
                        element = await page.get_by_text(selector.replace('text=', ''))
                        if element:
                            await element.click()
                            logger.info(f"✅ Clicked Equipment tab using text selector")
                            equipment_clicked = True
                            break
                    else:
                        element = await page.query_selector(selector)
                        if element:
                            await element.click()
                            logger.info(f"✅ Clicked Equipment tab using selector: {selector}")
                            equipment_clicked = True
                            break
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue
            
            # Alternative: try JavaScript click
            if not equipment_clicked:
                clicked = await page.evaluate("""
                    () => {
                        const elements = document.querySelectorAll('button, a, div[role="tab"]');
                        for (const el of elements) {
                            if (el.textContent && el.textContent.includes('Equipment')) {
                                el.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                if clicked:
                    logger.info("✅ Clicked Equipment tab using JavaScript")
                    equipment_clicked = True
            
            if not equipment_clicked:
                logger.warning("❌ Could not find Equipment tab to click")
                return False
            
            # Use smart wait for Equipment tab to be ready
            logger.info("⏳ Smart waiting for Equipment tab content...")
            
            # Wait for page to stabilize
            await SmartWait.wait_for_page_idle(page, timeout=3000)
            
            # Check if a modal opened and close it
            try:
                cancel_button = await page.query_selector('button:has-text("Cancel")')
                if cancel_button:
                    logger.info("📋 Modal detected, closing it...")
                    await cancel_button.click()
                    await EnhancedSmartWait.wait_for_page_stable(page, stability_timeout=300, max_wait=2000)
                    logger.info("✅ Modal closed")
            except:
                pass
            
            # Use enhanced wait for better reliability
            await EnhancedSmartWait.wait_for_page_stable(page, stability_timeout=500, max_wait=3000)
            
            # Wait for Dispenser toggle to be ready
            toggle_ready = await EnhancedSmartWait.wait_for_element_ready(
                page,
                'a:has-text("Dispenser"), button:has-text("Dispenser")',
                checks={'visible': True, 'stable': True},
                timeout=5000
            )
            
            if toggle_ready:
                logger.info("✅ Equipment tab ready - Dispenser toggle is stable")
                return True
            else:
                logger.warning("⚠️ Could not detect stable Dispenser toggle")
                return True  # Continue anyway
                
        except Exception as e:
            logger.error(f"❌ Error clicking Equipment tab: {e}")
            return False
    
    async def _click_dispenser_section(self, page) -> bool:
        """Click the Dispenser section to expand it and wait for content"""
        try:
            logger.info("🔍 Looking for Dispenser section to expand...")
            
            # First, inject reload prevention to avoid page reloads when clicking toggles
            await page.evaluate("""
                () => {
                    if (!window.__dispenserClickHandler) {
                        window.__dispenserClickHandler = true;
                        
                        // Intercept clicks on dispenser toggles to prevent page reloads
                        document.addEventListener('click', (e) => {
                            const target = e.target;
                            const link = target.closest('a');
                            
                            // Check if it's a dispenser toggle link
                            if (link && link.textContent && link.textContent.includes('Dispenser')) {
                                const href = link.getAttribute('href');
                                
                                // If it's a hash link (like #dispenser-section), prevent reload
                                if (href && href.startsWith('#')) {
                                    console.log('Preventing reload for Dispenser toggle');
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    // Manually toggle the target element
                                    const targetId = href.substring(1);
                                    const targetElement = document.getElementById(targetId);
                                    
                                    if (targetElement) {
                                        // Toggle visibility
                                        if (targetElement.style.display === 'none' || 
                                            targetElement.classList.contains('collapse')) {
                                            targetElement.style.display = 'block';
                                            targetElement.classList.remove('collapse');
                                            targetElement.classList.add('show');
                                            link.setAttribute('aria-expanded', 'true');
                                        } else {
                                            targetElement.style.display = 'none';
                                            targetElement.classList.add('collapse');
                                            targetElement.classList.remove('show');
                                            link.setAttribute('aria-expanded', 'false');
                                        }
                                    }
                                }
                            }
                        }, true);  // Use capture phase to intercept early
                    }
                }
            """)
            
            # Check if dispenser information is already visible (not collapsed)
            already_visible = await page.evaluate("""
                () => {
                    // Look for detailed dispenser information (serial numbers, models, etc.)
                    const dispenserDetails = document.querySelectorAll('*');
                    for (const el of dispenserDetails) {
                        const text = el.textContent || '';
                        if (text.includes('S/N:') || text.includes('Serial') || 
                            text.includes('Wayne') || text.includes('Gilbarco') ||
                            text.includes('Tokheim') || text.includes('Dresser')) {
                            return true;
                        }
                    }
                    return false;
                }
            """)
            
            if already_visible:
                logger.info("✅ Dispenser information already visible - no need to expand")
                return True
            
            # Try to find and click the dispenser toggle using improved method
            dispenser_clicked = await ContentBasedWait.click_dispenser_toggle_safely(page)
            
            if dispenser_clicked:
                logger.info("✅ Successfully clicked Dispenser toggle")
                
                # Wait for content to appear after clicking
                success, count = await ContentBasedWait.wait_for_dispenser_content(
                    page, timeout=3000, min_containers=1
                )
                
                if success:
                    logger.info(f"✅ Dispenser content expanded - found {count} containers")
                else:
                    logger.warning("⚠️ Clicked toggle but content not visible yet")
            else:
                logger.warning("⚠️ Could not click Dispenser toggle, trying fallback methods...")
                
                # Fallback: Try original method
                clicked = await page.evaluate("""
                    () => {
                        const headings = Array.from(document.querySelectorAll('.group-heading .text-normal .bold'));
                        const dispenserHeading = headings.find(el => el.textContent.includes('Dispenser'));
                        if (dispenserHeading) {
                            const link = dispenserHeading.closest('a');
                            if (link) {
                                link.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                if clicked:
                    logger.info("✅ Clicked Dispenser section using fallback method")
                    dispenser_clicked = True
            
            if not dispenser_clicked:
                logger.warning("⚠️ Could not find Dispenser section to click")
                # Still continue - content might already be visible or have different structure
                return True
            
            return True
                
        except Exception as e:
            logger.error(f"❌ Error clicking Dispenser section: {e}")
            return False
    
    async def _capture_dispenser_html(self, page) -> str:
        """Capture the HTML content of the dispenser section"""
        try:
            logger.info("Capturing dispenser HTML content...")
            
            dispenser_html = await page.evaluate("""
                () => {
                    // Look for expanded dispenser section (V1 method)
                    const dispenserSection = document.querySelector('.group-heading a[title="Hide equipment"] span.bold');
                    
                    if (dispenserSection && dispenserSection.textContent.includes('Dispenser')) {
                        const groupHeading = dispenserSection.closest('.group-heading');
                        const equipmentList = groupHeading.parentElement;
                        return equipmentList.outerHTML;
                    }
                    
                    // Alternative: look for dispenser list container
                    // Note: :has() is not supported in all browsers, use a different approach
                    const mt4Divs = document.querySelectorAll('.mt-4');
                    for (const div of mt4Divs) {
                        if (div.querySelector('div.py-1\\\\.5')) {
                            return div.outerHTML;
                        }
                    }
                    
                    // Look for equipment tab content
                    const equipmentTab = document.querySelector('.active-tab[dusk="equipment-tab"]');
                    if (equipmentTab) {
                        return equipmentTab.outerHTML;
                    }
                    
                    // Get the main content area
                    const mainContent = document.querySelector('main, .main-content, [role="main"]');
                    if (mainContent) {
                        return mainContent.innerHTML;
                    }
                    
                    // Last resort
                    return document.body.innerHTML;
                }
            """)
            
            logger.info(f"Captured HTML content: {len(dispenser_html)} characters")
            return dispenser_html
            
        except Exception as e:
            logger.error(f"Error capturing dispenser HTML: {e}")
            return ""
    
    async def _capture_page_html(self, page) -> str:
        """Capture full page HTML as fallback"""
        try:
            return await page.content()
        except:
            return ""
    
    async def _extract_dispensers_old(self, page, work_order_id: str) -> List[DispenserInfo]:
        """Extract dispenser information from the page with enhanced logging and debugging"""
        logger.info(f"🔍 [EXTRACT] Extracting dispenser information for work order {work_order_id}...")
        
        # Get current URL for debugging
        current_url = page.url
        logger.info(f"🔍 [EXTRACT] Current page URL: {current_url}")
        
        # Debug: Check what's actually on the page
        page_debug = await page.evaluate("""
            () => {
                return {
                    title: document.title,
                    bodyText: document.body.textContent.slice(0, 500),
                    hasEquipmentTab: document.body.textContent.includes('Equipment'),
                    hasDispenserText: document.body.textContent.toLowerCase().includes('dispenser'),
                    activeTab: document.querySelector('.active-tab, .tab-active, [aria-selected="true"]')?.textContent || 'unknown'
                };
            }
        """)
        logger.info(f"🔍 [EXTRACT] Page debug info: {page_debug}")
        
        # Check for error messages
        error_check = await page.evaluate("""
            () => {
                const text = document.body.textContent.toLowerCase();
                return {
                    hasDeletedError: text.includes('could not find this location') || text.includes('may have been deleted'),
                    hasAccessError: text.includes('access denied') || text.includes('permission'),
                    hasNetworkError: text.includes('network error') || text.includes('connection'),
                    hasGeneralError: text.includes('error occurred') || text.includes('something went wrong')
                };
            }
        """)
        
        if error_check['hasDeletedError']:
            logger.error(f"❌ [EXTRACT] Location deleted error detected for work order {work_order_id}")
            return []
        elif error_check['hasAccessError']:
            logger.error(f"❌ [EXTRACT] Access denied error detected for work order {work_order_id}")
            return []
        elif error_check['hasNetworkError']:
            logger.error(f"❌ [EXTRACT] Network error detected for work order {work_order_id}")
            return []
        elif error_check['hasGeneralError']:
            logger.error(f"❌ [EXTRACT] General error detected for work order {work_order_id}")
            return []
        
        try:
            # Method 1: Current WorkFossa UI extraction (V2)
            logger.info(f"🔍 [EXTRACT] Method 1: Using current WorkFossa UI extraction method...")
            
            # Enhanced debugging version
            raw_dispensers = await page.evaluate("""
                () => {
                    console.log('🔍 Starting V1 dispenser extraction...');
                    
                    // Debug: Look for all sections with class mt-4
                    const mt4Elements = document.querySelectorAll('.mt-4');
                    console.log(`Found ${mt4Elements.length} elements with class .mt-4`);
                    
                    // Debug: Check each mt-4 element
                    const sectionDebugging = [];
                    mt4Elements.forEach((el, index) => {
                        const boldText = el.querySelector('.bold')?.textContent?.trim() || 'no bold text';
                        sectionDebugging.push(`Section ${index}: "${boldText}"`);
                    });
                    console.log('mt-4 sections found:', sectionDebugging);
                    
                    // Find dispenser section - try multiple methods
                    let dispenserSection = null;
                    
                    // Method 1: Look for expanded dispenser section (V2 - Equipment tab style)
                    // After clicking "Dispenser (8)", the dispensers appear in a list
                    const dispenserListContainers = document.querySelectorAll('.mt-4, .equipment-list, .dispenser-list, div[class*="py-"]');
                    for (const container of dispenserListContainers) {
                        // Check if this container has dispenser items
                        const hasDispenserItems = container.querySelectorAll('.py-1\\\\.5, .py-1\\\\.5.bg-gray-50').length > 0;
                        const hasSerialNumbers = container.textContent.includes('S/N:');
                        
                        if (hasDispenserItems || hasSerialNumbers) {
                            dispenserSection = container;
                            console.log('✅ Found dispenser section (V2 method)');
                            break;
                        }
                    }
                    
                    // Method 2: Original V1 method
                    if (!dispenserSection) {
                        dispenserSection = Array.from(document.querySelectorAll('.mt-4')).find(el => 
                            el.querySelector('.bold')?.textContent.trim().startsWith('Dispenser')
                        );
                        if (dispenserSection) {
                            console.log('✅ Found dispenser section (V1 method)');
                        }
                    }
                    
                    // Method 3: Find parent of dispenser items
                    if (!dispenserSection) {
                        // Find dispenser items without using :has() selector
                        const pyDivs = document.querySelectorAll('.py-1\\\\.5, .py-1\\\\.5.bg-gray-50');
                        let firstDispenserItem = null;
                        for (const div of pyDivs) {
                            if (div.querySelector('.px-2')) {
                                firstDispenserItem = div;
                                break;
                            }
                        }
                        
                        if (firstDispenserItem) {
                            // Get the parent container that holds all dispensers
                            dispenserSection = firstDispenserItem.parentElement;
                            while (dispenserSection && dispenserSection.querySelectorAll('.py-1\\\\.5').length < 2) {
                                dispenserSection = dispenserSection.parentElement;
                            }
                            if (dispenserSection) {
                                console.log('✅ Found dispenser section (parent method)');
                            }
                        }
                    }

                    if (!dispenserSection) {
                        console.log('❌ No dispenser section found');
                        
                        // Debug information
                        const allDispenser = Array.from(document.querySelectorAll('*')).filter(el => 
                            el.textContent && el.textContent.toLowerCase().includes('dispenser')
                        );
                        console.log(`Found ${allDispenser.length} elements containing "dispenser"`);
                        
                        return { 
                            success: false, 
                            dispensers: [], 
                            debug: {
                                message: 'No dispenser section found',
                                mt4Count: mt4Elements.length,
                                sectionDebugging: sectionDebugging,
                                dispenserElementsFound: allDispenser.length,
                                bodyContainsDispenser: document.body.textContent.toLowerCase().includes('dispenser')
                            }
                        };
                    }

                    console.log('✅ Found dispenser section');

                    // Get all dispenser containers - they have py-1.5 or py-1.5 bg-gray-50 classes
                    const dispenserContainers = dispenserSection.querySelectorAll('.py-1\\\\.5, .py-1\\\\.5.bg-gray-50');
                    console.log(`Found ${dispenserContainers.length} dispenser containers`);
                    
                    const dispensers = [];
                    
                    dispenserContainers.forEach((container, index) => {
                        try {
                            // Extract all text from the container
                            const fullText = container.textContent || '';
                            
                            // Skip if no serial number (not a dispenser container)
                            if (!fullText.includes('S/N:')) return;
                            
                            // Find the dispenser title - be more flexible with patterns
                            let title = '';
                            let dispenserNumber = '';
                            
                            // Try multiple patterns to find the title
                            // Pattern 1: "1/2 - Regular, Plus, Diesel..."
                            let titleMatch = fullText.match(/(\\d+\\/\\d+\\s*-\\s*[^\\n]+)/);
                            if (titleMatch) {
                                title = titleMatch[1].trim();
                            }
                            
                            // Pattern 2: Look for "Dispenser" followed by number
                            if (!title) {
                                titleMatch = fullText.match(/Dispenser\\s+(\\d+(?:\\/\\d+)?)/i);
                                if (titleMatch) {
                                    dispenserNumber = titleMatch[1];
                                    // Extract fuel grades from GRADE field
                                    const gradeMatch = fullText.match(/GRADE\\s*([^\\n]+?)(?=\\s*STAND|METER|$)/);
                                    if (gradeMatch) {
                                        title = `${dispenserNumber} - ${gradeMatch[1].trim()}`;
                                    } else {
                                        title = `Dispenser ${dispenserNumber}`;
                                    }
                                }
                            }
                            
                            // Pattern 3: Just find any number at start or "Dispenser #" pattern
                            if (!title) {
                                // Look for patterns like "1/2" or "1" at the beginning
                                const numberAtStart = fullText.match(/^(\\d+(?:\\/\\d+)?)/m);
                                if (numberAtStart) {
                                    dispenserNumber = numberAtStart[1];
                                    title = `Dispenser ${dispenserNumber}`;
                                }
                            }
                            
                            // If still no title, use index + 1 as a fallback
                            if (!title) {
                                dispenserNumber = String(index + 1);
                                title = `Dispenser ${dispenserNumber}`;
                                console.log(`Using fallback dispenser number ${dispenserNumber} for container`, index);
                            }
                            
                            // Extract make from title (e.g., "Gilbarco" at end of title)
                            let make = '';
                            let model = '';
                            
                            // Common dispenser manufacturers
                            const manufacturers = ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett'];
                            for (const mfr of manufacturers) {
                                if (title.includes(mfr)) {
                                    make = mfr;
                                    break;
                                }
                            }
                            
                            // Extract serial number (look for S/N: pattern)
                            let serial = '';
                            const snMatch = fullText.match(/S\\/N:\\s*([A-Z0-9]+)/);
                            if (snMatch) {
                                serial = snMatch[1];
                            }
                            
                            // Extract MAKE and MODEL if they're on separate lines (case-insensitive)
                            const makeLineMatch = fullText.match(/(?:MAKE|Make):\\s*([A-Za-z0-9\\s]+?)(?=\\n|(?:MODEL|Model):|$)/i);
                            if (makeLineMatch && !make) {
                                make = makeLineMatch[1].trim();
                            }
                            
                            const modelLineMatch = fullText.match(/(?:MODEL|Model):\\s*([A-Za-z0-9\\s]+?)(?=\\n|(?:GRADE|Grade)|$)/i);
                            if (modelLineMatch) {
                                model = modelLineMatch[1].trim();
                            }
                            
                            // Extract dispenser numbers from title or use already extracted number
                            let dispenserNumbers = [];
                            if (dispenserNumber) {
                                // We already have a dispenser number from pattern matching above
                                const parts = dispenserNumber.split('/');
                                dispenserNumbers = parts;
                            } else {
                                // Try to extract from title
                                const numberMatch = title.match(/^(\\d+)(?:\\/(\\d+))?/);
                                if (numberMatch) {
                                    dispenserNumbers.push(numberMatch[1]);
                                    if (numberMatch[2]) {
                                        dispenserNumbers.push(numberMatch[2]);
                                    }
                                    dispenserNumber = numberMatch[0]; // Full match (e.g., "1/2" or "1")
                                }
                            }
                            
                            // Try to find dispenser number in the full text if we still don't have it
                            if (!dispenserNumber || dispenserNumber === String(index + 1)) {
                                // Look for patterns like "Dispenser 1/2" or "Dispenser #1" anywhere in text
                                const dispenserTextMatch = fullText.match(/Dispenser\\s*#?(\\d+(?:\\/\\d+)?)/i);
                                if (dispenserTextMatch) {
                                    dispenserNumber = dispenserTextMatch[1];
                                    const parts = dispenserNumber.split('/');
                                    dispenserNumbers = parts;
                                    // Update title to include the dispenser number
                                    if (!title.includes(dispenserNumber)) {
                                        title = `Dispenser ${dispenserNumber}`;
                                    }
                                }
                            }
                            
                            // Ensure we have a dispenser number
                            if (!dispenserNumber) {
                                dispenserNumber = String(index + 1);
                                dispenserNumbers = [dispenserNumber];
                            }

                            // Get all custom fields - look for GRADE and other fields
                            const fields = {};
                            
                            // Extract GRADE
                            const gradeMatch = fullText.match(/GRADE\\s*([^\\n]+?)(?=\\s*STAND|\\s*METER|\\s*$)/);
                            if (gradeMatch) {
                                fields['GRADE'] = gradeMatch[1].trim();
                            }
                            
                            // Extract STAND ALONE CODE
                            const standAloneMatch = fullText.match(/STAND ALONE CODE\\s*([^\\n]+)/i);
                            if (standAloneMatch) {
                                fields['STAND_ALONE_CODE'] = standAloneMatch[1].trim();
                            }
                            
                            // Extract NUMBER OF NOZZLES (PER SIDE)
                            const nozzlesMatch = fullText.match(/NUMBER OF NOZZLES.*?\\s+(\\d+)/i);
                            if (nozzlesMatch) {
                                fields['NUMBER_OF_NOZZLES'] = nozzlesMatch[1].trim();
                            }
                            
                            // Extract METER TYPE
                            const meterTypeMatch = fullText.match(/METER TYPE\\s*([^\\n]+)/i);
                            if (meterTypeMatch) {
                                fields['METER_TYPE'] = meterTypeMatch[1].trim();
                            }

                            console.log(`Dispenser ${dispenserNumber}: "${title}" (${make} ${model})`);

                            dispensers.push({
                                title,
                                serial_number: serial,
                                make,
                                model,
                                fields,
                                dispenser_number: dispenserNumber,
                                dispenser_numbers: dispenserNumbers,
                                stand_alone_code: fields['STAND_ALONE_CODE'] || null,
                                number_of_nozzles: fields['NUMBER_OF_NOZZLES'] || null,
                                meter_type: fields['METER_TYPE'] || null,
                                fuel_grades: {},  // Will be parsed properly in Python
                                custom_fields: fields
                            });
                            
                        } catch (err) {
                            console.error(`Error parsing dispenser ${index + 1}:`, err);
                        }
                    });
                    
                    return { 
                        success: true, 
                        dispensers: dispensers, 
                        debug: {
                            message: `Found ${dispensers.length} dispensers`,
                            totalContainers: dispenserContainers.length,
                            dispensersFound: dispensers.length
                        }
                    };
                }
            """)
            
            if raw_dispensers['success'] and len(raw_dispensers['dispensers']) > 0:
                debug_info = raw_dispensers.get('debug', {})
                logger.info(f"✅ [EXTRACT] V1 method successful: {debug_info}")
                
                # Convert raw data to DispenserInfo objects
                dispensers = []
                for i, raw in enumerate(raw_dispensers['dispensers']):
                    # Parse fuel grades from custom fields
                    fuel_grades = self._parse_fuel_grades(raw.get('fields', {}))
                    
                    # Extract fuel grade list from title
                    grades_list = self._extract_grades_from_title(raw.get('title', ''))
                    
                    # CRITICAL FIX: Ensure grades_list NEVER contains field labels or non-fuel items
                    # This prevents the bug where "Stand Alone Code", "Number of Nozzles", etc. appear as fuel grades
                    if grades_list:
                        # Filter out any non-fuel items that might have been incorrectly extracted
                        original_grades = grades_list[:]
                        grades_list = [g for g in grades_list if isinstance(g, str) and not any(
                            keyword in g.lower() for keyword in [
                                'stand alone', 'standalone', 'code', 'nozzle', 'nozzles',
                                'meter', 'type', 'number of', 'per side', 'serial'
                            ]
                        )]
                        if len(grades_list) < len(original_grades):
                            logger.warning(f"📋 [EXTRACT] Filtered out non-fuel items from grades_list: {set(original_grades) - set(grades_list)}")
                    
                    # If grades_list is empty and we have a GRADE field, try to decode it
                    if not grades_list and raw.get('fields', {}).get('GRADE'):
                        try:
                            from app.data.fuel_grade_codes import decode_fuel_grade_string
                            decoded_grades = decode_fuel_grade_string(raw['fields']['GRADE'])
                            if decoded_grades:
                                grades_list = decoded_grades
                                logger.info(f"📋 [EXTRACT] Decoded fuel grades from codes: {raw['fields']['GRADE']} -> {grades_list}")
                        except ImportError:
                            logger.warning("Could not import fuel grade decoder")
                    
                    # IMPORTANT: Ensure grades_list only contains fuel grades, not other custom fields
                    # This prevents UI from showing "Stand Alone Code", "Number of Nozzles", etc. as fuel grades
                    if not grades_list:
                        # Don't use all custom fields as grades - leave it empty
                        grades_list = []
                        logger.info(f"📋 [EXTRACT] No fuel grades found - keeping grades_list empty")
                    
                    # If still no grades list but we have fuel_grades dict, extract from there
                    if not grades_list and fuel_grades:
                        grades_list = [info['name'] for info in fuel_grades.values() if isinstance(info, dict) and 'name' in info]
                    
                    # Final validation: ensure grades_list only contains actual fuel grades
                    if grades_list:
                        try:
                            from app.services.fuel_grade_validator import clean_grades_list
                            original_count = len(grades_list)
                            grades_list = clean_grades_list(grades_list)
                            if len(grades_list) < original_count:
                                logger.info(f"📋 [EXTRACT] Cleaned grades_list from {original_count} to {len(grades_list)} items")
                        except ImportError:
                            logger.warning("Could not import fuel grade validator")
                    
                    dispenser = DispenserInfo(
                        dispenser_id=f"{work_order_id}_dispenser_{raw.get('dispenser_number', i+1)}",
                        title=raw.get('title', f'Dispenser {i+1}'),
                        serial_number=raw.get('serial_number'),
                        make=raw.get('make'),
                        model=raw.get('model'),
                        dispenser_number=raw.get('dispenser_number', str(i+1)),
                        dispenser_numbers=raw.get('dispenser_numbers', []),
                        stand_alone_code=raw.get('stand_alone_code'),
                        number_of_nozzles=raw.get('number_of_nozzles'),
                        meter_type=raw.get('meter_type'),
                        fuel_grades=fuel_grades,
                        grades_list=grades_list,
                        custom_fields=raw.get('fields', {}),
                        raw_html=raw.get('rawHtml', '')
                    )
                    
                    dispensers.append(dispenser)
                    logger.info(f"📋 [EXTRACT] Dispenser {i+1}: {dispenser.title} (S/N: {dispenser.serial_number}) - {dispenser.make} {dispenser.model}")
                
                logger.info(f"✅ [EXTRACT] Extracted {len(dispensers)} dispensers with details using V1 method")
                return dispensers
            
            else:
                debug_info = raw_dispensers.get('debug', {})
                logger.warning(f"⚠️ [EXTRACT] V1 method failed for work order {work_order_id}")
                logger.warning(f"⚠️ [EXTRACT] Debug details: {debug_info}")
                
                # Log specific debugging information
                if isinstance(debug_info, dict):
                    if 'mt4Count' in debug_info:
                        logger.warning(f"⚠️ [EXTRACT] Found {debug_info['mt4Count']} .mt-4 sections")
                    if 'sectionDebugging' in debug_info:
                        logger.warning(f"⚠️ [EXTRACT] Section headers: {debug_info['sectionDebugging']}")
                    if 'dispenserElementsFound' in debug_info:
                        logger.warning(f"⚠️ [EXTRACT] Elements containing 'dispenser': {debug_info['dispenserElementsFound']}")
                    if 'alternativeSections' in debug_info:
                        logger.warning(f"⚠️ [EXTRACT] Alternative sections: {debug_info['alternativeSections']}")
                    if 'bodyContainsDispenser' in debug_info:
                        logger.warning(f"⚠️ [EXTRACT] Page contains 'dispenser' text: {debug_info['bodyContainsDispenser']}")
                        
                # Take a screenshot for debugging failed extractions
                try:
                    screenshot_path = f"debug_extraction_failed_{work_order_id[:8]}.png"
                    await page.screenshot(path=screenshot_path)
                    logger.warning(f"⚠️ [EXTRACT] Debug screenshot saved: {screenshot_path}")
                except:
                    pass
            
            # Method 2: Pattern-based extraction (from screenshots)
            logger.info(f"🔍 [EXTRACT] Method 2: Using pattern-based extraction...")
            pattern_result = await page.evaluate("""
                () => {
                    const dispensers = [];
                    const dispenserPattern = /^(\\d+)\\/(\\d+)\\s*-\\s*(.+?)\\s*-\\s*(.+)$/;
                    const textElements = document.querySelectorAll('*');
                    
                    textElements.forEach(el => {
                        if (el.textContent && el.children.length === 0) {  // Only text nodes
                            const text = el.textContent.trim();
                            const match = text.match(dispenserPattern);
                            if (match) {
                                console.log('✅ Found dispenser pattern:', text);
                                dispensers.push({
                                    dispenser_number: match[1],
                                    total_dispensers: match[2],
                                    fuel_types: match[3],
                                    manufacturer: match[4],
                                    raw_text: text
                                });
                            }
                        }
                    });
                    
                    return { success: dispensers.length > 0, dispensers: dispensers, debug: `Found ${dispensers.length} pattern matches` };
                }
            """)
            
            if pattern_result['success']:
                logger.info(f"✅ [EXTRACT] Pattern method successful: {pattern_result['debug']}")
                
                dispensers = []
                for i, raw in enumerate(pattern_result['dispensers']):
                    # Parse fuel types
                    fuel_types = raw.get('fuel_types', '').split(',')
                    fuel_grades = {}
                    
                    for fuel_type in fuel_types:
                        fuel_type = fuel_type.strip()
                        fuel_key = fuel_type.lower().replace(' ', '_').replace('-', '_')
                        fuel_grades[fuel_key] = {'name': fuel_type}
                    
                    # Don't add default fuel grades - only use what we find
                    
                    # Extract dispenser numbers
                    dispenser_num = raw.get('dispenser_number', str(i+1))
                    dispenser_numbers = [dispenser_num]
                    if raw.get('total_dispensers'):
                        dispenser_numbers.append(raw.get('total_dispensers'))
                    
                    # Get fuel types as list
                    fuel_types_list = [ft.strip() for ft in raw.get('fuel_types', '').split(',')]
                    
                    dispenser = DispenserInfo(
                        dispenser_id=f"{work_order_id}_dispenser_{raw.get('dispenser_number', i+1)}",
                        title=f"Dispenser {raw.get('dispenser_number', i+1)}",
                        serial_number=None,
                        make=raw.get('manufacturer', 'Unknown'),
                        model='Unknown',
                        dispenser_number=raw.get('dispenser_number', str(i+1)),
                        dispenser_numbers=dispenser_numbers,
                        fuel_grades=fuel_grades,
                        grades_list=fuel_types_list,
                        custom_fields={'raw_text': raw.get('raw_text', '')},
                        raw_html=''
                    )
                    
                    dispensers.append(dispenser)
                    logger.info(f"📋 [EXTRACT] Pattern Dispenser {i+1}: {dispenser.title} - {dispenser.make} (Fuels: {list(fuel_grades.keys())})")
                
                logger.info(f"✅ [EXTRACT] Extracted {len(dispensers)} dispensers using pattern method")
                return dispensers
            
            else:
                logger.warning(f"⚠️ [EXTRACT] Pattern method failed: {pattern_result.get('debug', 'No patterns found')}")
            
            # Method 3: General debugging and content analysis
            logger.info(f"🔍 [EXTRACT] Method 3: General debugging and content analysis...")
            debug_info = await page.evaluate("""
                () => {
                    const debug = {
                        dispenserText: [],
                        sections: [],
                        headings: [],
                        allEquipmentText: []
                    };
                    
                    // Look for any text containing "dispenser"
                    const allElements = document.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.textContent && el.children.length === 0) {  // Text nodes only
                            const text = el.textContent.trim();
                            if (text.toLowerCase().includes('dispenser')) {
                                debug.dispenserText.push(text);
                            }
                            if (text.toLowerCase().includes('equipment')) {
                                debug.allEquipmentText.push(text);
                            }
                        }
                    });
                    
                    // Look for sections
                    const sections = document.querySelectorAll('.group-heading, .section, h3, h4');
                    sections.forEach(section => {
                        const text = section.textContent?.trim();
                        if (text) {
                            debug.sections.push(text);
                        }
                    });
                    
                    // Look for headings
                    const headings = document.querySelectorAll('.bold, .font-bold, strong, b');
                    headings.forEach(heading => {
                        const text = heading.textContent?.trim();
                        if (text) {
                            debug.headings.push(text);
                        }
                    });
                    
                    return debug;
                }
            """)
            
            logger.info(f"🔍 [EXTRACT] Debug - Dispenser text found: {len(debug_info.get('dispenserText', []))}")
            for text in debug_info.get('dispenserText', [])[:10]:  # Log first 10
                logger.info(f"🔍 [EXTRACT] Dispenser text: '{text}'")
            
            logger.info(f"🔍 [EXTRACT] Debug - Equipment text found: {len(debug_info.get('allEquipmentText', []))}")
            for text in debug_info.get('allEquipmentText', [])[:5]:  # Log first 5
                logger.info(f"🔍 [EXTRACT] Equipment text: '{text}'")
            
            logger.info(f"🔍 [EXTRACT] Debug - Sections found: {len(debug_info.get('sections', []))}")
            for text in debug_info.get('sections', [])[:10]:  # Log first 10
                logger.info(f"🔍 [EXTRACT] Section: '{text}'")
            
            logger.info(f"🔍 [EXTRACT] Debug - Headings found: {len(debug_info.get('headings', []))}")
            for text in debug_info.get('headings', [])[:10]:  # Log first 10
                logger.info(f"🔍 [EXTRACT] Heading: '{text}'")
            
            # Return empty list with full debug info
            logger.error(f"❌ [EXTRACT] All extraction methods failed - no dispensers found")
            return []
            
        except Exception as e:
            logger.error(f"❌ [EXTRACT] Error extracting dispensers: {e}")
            import traceback
            logger.error(f"❌ [EXTRACT] Traceback: {traceback.format_exc()}")
            return []
    
    async def _extract_dispensers_simple(self, page, work_order_id: str) -> List[DispenserInfo]:
        """Simplified extraction based on working interactive script"""
        try:
            logger.info(f"🔍 [EXTRACT_SIMPLE] Starting simple extraction for work order {work_order_id}")
            
            # Wait for content to settle
            await page.wait_for_timeout(1000)
            
            # Use the selector that works in the interactive script - includes both variations
            dispenser_containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
            logger.info(f"🔍 [EXTRACT_SIMPLE] Found {len(dispenser_containers)} potential containers")
            
            dispensers = []
            for i, container in enumerate(dispenser_containers):
                try:
                    # Get the text content
                    text = await container.text_content()
                    if not text:
                        continue
                    
                    # Log what we're seeing
                    logger.debug(f"Container {i+1} text preview: {text[:100]}...")
                    
                    # Check if this container has dispenser info (not just the word "Dispenser")
                    has_serial = 'S/N' in text or 'Serial' in text
                    has_make = any(mfr in text for mfr in ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett', 'MAKE:', 'Make:'])
                    has_model = 'MODEL:' in text or 'Model:' in text
                    has_grade = 'GRADE' in text or 'Grade' in text
                    
                    # If it doesn't have any dispenser-specific info, skip
                    if not (has_serial or has_make or has_model or has_grade):
                        logger.debug(f"Container {i+1} doesn't have dispenser info, skipping")
                        continue
                    
                    logger.debug(f"🔍 [EXTRACT_SIMPLE] Processing container {i+1} with text: {text[:100]}...")
                    
                    # Extract basic info using regex
                    # Extract dispenser number/title (e.g., "1/2" or "1")
                    # The dispenser number appears after menu text, look for pattern anywhere
                    title_match = re.search(r'(\d+(?:/\d+)?)\s*-\s*([^-]+?)\s*-\s*(\w+)', text)
                    if title_match:
                        dispenser_num = title_match.group(1)
                        fuel_part = title_match.group(2).strip()
                        manufacturer_part = title_match.group(3).strip()
                    else:
                        # Fallback to simpler pattern
                        simple_match = re.search(r'(\d+(?:/\d+)?)\s*-', text)
                        dispenser_num = simple_match.group(1) if simple_match else str(i+1)
                        fuel_part = None
                        manufacturer_part = None
                    
                    # Extract the full title line for better parsing
                    # Find the line containing the dispenser number pattern
                    title_line = None
                    for line in text.split('\n'):
                        if re.search(r'\d+(?:/\d+)?\s*-', line):
                            title_line = line.strip()
                            break
                    if not title_line:
                        title_line = text.split('\n')[0] if '\n' in text else text[:50]
                    
                    # Extract serial number
                    serial_match = re.search(r'S/N[:\s]+([A-Z0-9-]+)', text, re.IGNORECASE)
                    serial_number = serial_match.group(1) if serial_match else None
                    
                    # Extract make
                    make = None
                    manufacturers = ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett']
                    for mfr in manufacturers:
                        if mfr in text:
                            make = mfr
                            break
                    
                    # If no make found in common list, try pattern
                    if not make:
                        make_match = re.search(r'(?:MAKE|Make)[:\s]+([A-Za-z0-9\s]+?)(?=\n|MODEL|Model|$)', text)
                        make = make_match.group(1).strip() if make_match else 'Unknown'
                    
                    # Extract model
                    model_match = re.search(r'(?:MODEL|Model)[:\s]+([A-Za-z0-9\s-]+?)(?=\n|GRADE|Grade|$)', text)
                    model = model_match.group(1).strip() if model_match else 'Unknown'
                    
                    # Extract meter type
                    meter_match = re.search(r'(?:METER TYPE|Meter Type|METER)[:\s]+([A-Za-z0-9\s-]+?)(?=\n|$)', text, re.IGNORECASE)
                    meter_type = meter_match.group(1).strip() if meter_match else None
                    
                    # Extract number of nozzles
                    nozzles_match = re.search(r'(?:NUMBER OF NOZZLES|Number of Nozzles|NOZZLES).*?[:\s]+(\d+)', text, re.IGNORECASE)
                    number_of_nozzles = nozzles_match.group(1) if nozzles_match else None
                    
                    # Extract stand alone code
                    stand_alone_match = re.search(r'(?:STAND ALONE CODE|Stand Alone Code).*?\n\s*([^\n]+)', text, re.IGNORECASE)
                    stand_alone_code = stand_alone_match.group(1).strip() if stand_alone_match else None
                    
                    # Extract fuel types from the parsed fuel part or Grade field
                    fuel_types = []
                    
                    # Try to extract from Grade field first (most reliable)
                    # Look for GRADE field followed by fuel codes (e.g., "0126 0135 0136")
                    # First try the custom field format (GRADE on one line, value on next)
                    grade_match = re.search(r'GRADE\s*\n\s*([^\n]+?)(?:\n|$)', text, re.IGNORECASE)
                    
                    # If that doesn't work, try to find fuel codes after Grade marker
                    if not grade_match:
                        # Look for Grade followed by lines containing 4-digit codes
                        # This handles the case where Grade is followed by field labels mixed with codes
                        grade_section_match = re.search(r'Grade\s*\n((?:[^\n]*\n?){1,10})', text, re.IGNORECASE)
                        if grade_section_match:
                            grade_section = grade_section_match.group(1)
                            # Extract only the 4-digit fuel codes from this section
                            fuel_codes = re.findall(r'\b\d{4}\b', grade_section)
                            if fuel_codes:
                                # Create a match-like object for consistency
                                grade_match = type('obj', (object,), {'group': lambda self, n: ' '.join(fuel_codes)})()
                                logger.debug(f"Extracted fuel codes from Grade section: {fuel_codes}")
                    
                    if grade_match:
                        grade_value = grade_match.group(1).strip()
                        logger.debug(f"Found GRADE field value: {grade_value}")
                        
                        # Check if it contains fuel codes (4-digit numbers)
                        if re.search(r'\d{4}', grade_value):
                            # Import and use fuel grade decoder
                            try:
                                from app.data.fuel_grade_codes import decode_fuel_grade_string
                                decoded_grades = decode_fuel_grade_string(grade_value)
                                if decoded_grades:
                                    fuel_types = decoded_grades
                                    logger.debug(f"Decoded fuel grades: {grade_value} -> {fuel_types}")
                                else:
                                    # If decoding fails, try to extract individual codes
                                    fuel_codes = re.findall(r'\d{4}', grade_value)
                                    fuel_types = fuel_codes  # Will be decoded later
                                    logger.debug(f"Extracted fuel codes: {fuel_types}")
                            except ImportError:
                                logger.warning("Could not import fuel grade decoder")
                                # Fall back to extracting codes
                                fuel_codes = re.findall(r'\d{4}', grade_value)
                                fuel_types = fuel_codes
                        else:
                            # If no codes, split by common separators
                            fuel_list = [f.strip() for f in re.split(r'[,\n]', grade_value) if f.strip()]
                            fuel_types = fuel_list
                            logger.debug(f"Extracted fuel grades from Grade field: {fuel_types}")
                    elif fuel_part:
                        # Use the parsed fuel part from title
                        fuel_list = [f.strip() for f in fuel_part.split(',')]
                        fuel_types = fuel_list
                        logger.debug(f"Extracted fuel grades from title: {fuel_types}")
                    
                    # Create fuel grades dict - only store what we actually scrape
                    fuel_grades = {}
                    
                    # If fuel_types contains codes, decode them first
                    if fuel_types and all(isinstance(f, str) and f.isdigit() and len(f) == 4 for f in fuel_types):
                        try:
                            from app.data.fuel_grade_codes import decode_fuel_grade_string
                            # Join codes and decode
                            codes_string = ' '.join(fuel_types)
                            decoded = decode_fuel_grade_string(codes_string)
                            if decoded:
                                fuel_types = decoded
                                logger.debug(f"Decoded fuel codes to names: {codes_string} -> {fuel_types}")
                        except ImportError:
                            logger.warning("Could not import fuel grade decoder for final decoding")
                    
                    # Now create the fuel grades dict
                    for fuel in fuel_types:
                        # Skip any non-fuel items that might have slipped through
                        if isinstance(fuel, str) and not any(keyword in fuel.lower() for keyword in [
                            'stand alone', 'code', 'nozzle', 'meter', 'number of', 'per side'
                        ]):
                            # Use the fuel name as both key and value - no octane numbers
                            fuel_key = fuel.lower().replace(' ', '_').replace('-', '_')
                            fuel_grades[fuel_key] = {'name': fuel}
                    
                    # If no fuels found, store empty dict (don't make up data)
                    if not fuel_grades and not fuel_types:
                        fuel_grades = {}
                    
                    # Parse dispenser numbers (for dual-sided dispensers like "1/2")
                    dispenser_numbers = []
                    if '/' in dispenser_num:
                        parts = dispenser_num.split('/')
                        dispenser_numbers = [p.strip() for p in parts]
                    else:
                        dispenser_numbers = [dispenser_num]
                    
                    # Use the full title line as the title if we found it
                    if title_line and dispenser_num in title_line:
                        full_title = title_line.strip()
                    else:
                        # Fallback to constructed title with all fuel grades
                        if fuel_types:
                            full_title = f"{dispenser_num} - {', '.join(fuel_types)} - {make}"
                        else:
                            full_title = f"Dispenser {dispenser_num}"
                    
                    dispenser = DispenserInfo(
                        dispenser_id=f"{work_order_id}_dispenser_{dispenser_num.replace('/', '_')}",
                        title=full_title,  # Use the full descriptive title
                        serial_number=serial_number,
                        make=make,
                        model=model,
                        dispenser_number=dispenser_num,  # Keep the full number (e.g., "1/2")
                        dispenser_numbers=dispenser_numbers,  # Individual numbers (e.g., ["1", "2"])
                        stand_alone_code=stand_alone_code,
                        meter_type=meter_type,
                        number_of_nozzles=number_of_nozzles,
                        fuel_grades=fuel_grades,
                        grades_list=fuel_types,
                        custom_fields={'raw_text': text[:500]},  # Store first 500 chars
                        raw_html=''
                    )
                    
                    dispensers.append(dispenser)
                    logger.info(f"✅ [EXTRACT_SIMPLE] Found Dispenser {dispenser_num}: {make} {model} S/N: {serial_number}, Meter: {meter_type}, Nozzles: {number_of_nozzles}")
                    
                except Exception as e:
                    logger.debug(f"Failed to process container {i+1}: {e}")
                    continue
            
            logger.info(f"✅ [EXTRACT_SIMPLE] Extracted {len(dispensers)} dispensers")
            return dispensers
            
        except Exception as e:
            logger.error(f"❌ [EXTRACT_SIMPLE] Error in simple extraction: {e}")
            return []
    
    def _parse_fuel_grades(self, fields: Dict[str, str]) -> Dict[str, Any]:
        """Parse fuel grade information from custom fields"""
        fuel_grades = {}
        
        # Import fuel grade decoder
        try:
            from app.data.fuel_grade_codes import decode_fuel_grade_string
        except ImportError:
            decode_fuel_grade_string = None
        
        # Look for Grade field in custom fields
        for field_name, field_value in fields.items():
            if 'grade' in field_name.lower():
                # First try to decode fuel grade codes (like "0126 0135 0136")
                if decode_fuel_grade_string and field_value and any(c.isdigit() for c in field_value):
                    decoded_grades = decode_fuel_grade_string(field_value)
                    if decoded_grades:
                        # Use decoded grade names
                        for grade in decoded_grades:
                            grade_key = grade.lower().replace(' ', '_').replace('-', '_')
                            fuel_grades[grade_key] = {
                                'name': grade,
                                'field_name': field_name,
                                'original_code': field_value
                            }
                        continue
                
                # Fall back to original parsing if no decoder or no codes found
                if '\n' in field_value:
                    grades = [g.strip() for g in field_value.split('\n') if g.strip()]
                elif ',' in field_value:
                    grades = [g.strip() for g in field_value.split(',') if g.strip()]
                else:
                    grades = [field_value.strip()]
                
                # Store each grade as found
                for grade in grades:
                    grade_key = grade.lower().replace(' ', '_').replace('-', '_')
                    fuel_grades[grade_key] = {
                        'name': grade,
                        'field_name': field_name
                    }
        
        return fuel_grades
    
    def _extract_grades_from_title(self, title: str) -> List[str]:
        """Extract fuel grades list from dispenser title"""
        # Example: "1/2 - Regular, Plus, Diesel, Ethanol-Free Gasoline Plus, Super - Gilbarco"
        # Extract the part between the dash and the manufacturer
        
        parts = title.split(' - ')
        if len(parts) >= 2:
            # Get the fuel grades part (between first and last dash)
            if len(parts) == 3:
                # Format: "1/2 - grades - manufacturer"
                grades_text = parts[1]
            else:
                # Format: "1/2 - grades" (no manufacturer at end)
                grades_text = parts[1]
                # Remove manufacturer names if they're at the end
                for mfr in ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett']:
                    if grades_text.endswith(f' {mfr}'):
                        grades_text = grades_text[:-len(f' {mfr}')]
                        break
            
            # Split by comma and clean up
            grades = [g.strip() for g in grades_text.split(',')]
            
            # Import the fuel grades ordering
            try:
                from app.data.fuel_grades import get_ordered_fuel_grades
                return get_ordered_fuel_grades(grades)
            except ImportError:
                return grades
        
        return []


# Global instance
dispenser_scraper = DispenserScraper()