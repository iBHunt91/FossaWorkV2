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
        visit_url: Optional[str] = None
    ) -> Tuple[List[DispenserInfo], Optional[str]]:
        """
        Scrape dispenser information for a specific work order
        
        Args:
            page: Playwright page object
            work_order_id: The work order ID
            visit_url: Optional visit URL to navigate to
            
        Returns:
            Tuple of (dispensers list, raw HTML content)
        """
        try:
            logger.info(f"🔧 Starting dispenser scrape for work order: {work_order_id}")
            
            # Navigate to visit URL if provided
            if visit_url:
                logger.info(f"Navigating to visit URL: {visit_url}")
                await page.goto(visit_url, wait_until="networkidle")
                await page.wait_for_timeout(2000)
            
            # Click Equipment tab
            equipment_clicked = await self._click_equipment_tab(page)
            if not equipment_clicked:
                logger.warning("Could not find Equipment tab")
                return [], None
            
            # Wait for equipment content to load
            await page.wait_for_timeout(2000)
            
            # Click Dispenser section
            dispenser_clicked = await self._click_dispenser_section(page)
            if not dispenser_clicked:
                logger.warning("Could not find Dispenser section")
                return [], await self._capture_page_html(page)
            
            # Wait for dispenser content to expand
            await page.wait_for_timeout(2000)
            
            # Capture dispenser HTML
            dispenser_html = await self._capture_dispenser_html(page)
            
            # Extract dispenser information
            dispensers = await self._extract_dispensers(page, work_order_id)
            
            logger.info(f"✅ Found {len(dispensers)} dispensers for work order {work_order_id}")
            
            return dispensers, dispenser_html
            
        except Exception as e:
            logger.error(f"Error scraping dispensers for work order {work_order_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return [], await self._capture_page_html(page)
    
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
            
            # Wait for Equipment tab content to load - look for dispenser toggle/section
            logger.info("⏳ Waiting for Equipment tab content to load...")
            
            # First, check if a modal opened and close it
            await page.wait_for_timeout(1000)
            try:
                cancel_button = await page.query_selector('button:has-text("Cancel")')
                if cancel_button:
                    logger.info("📋 Modal detected, closing it...")
                    await cancel_button.click()
                    await page.wait_for_timeout(1000)
                    logger.info("✅ Modal closed")
            except:
                pass
            
            try:
                # Wait for dispenser section to appear (up to 10 seconds)
                await page.wait_for_function("""
                    () => {
                        // Look for dispenser-related elements that indicate the tab has loaded
                        const dispenserElements = document.querySelectorAll('*');
                        for (const el of dispenserElements) {
                            if (el.textContent && el.textContent.toLowerCase().includes('dispenser')) {
                                return true;
                            }
                        }
                        return false;
                    }
                """, timeout=10000)
                logger.info("✅ Equipment tab content loaded - dispenser section found")
                return True
                
            except Exception as e:
                logger.warning(f"⚠️ Timeout waiting for Equipment tab to load: {e}")
                # Continue anyway - maybe the content is there but we can't detect it
                await page.wait_for_timeout(3000)  # Give it 3 more seconds
                return True
                
        except Exception as e:
            logger.error(f"❌ Error clicking Equipment tab: {e}")
            return False
    
    async def _click_dispenser_section(self, page) -> bool:
        """Click the Dispenser section to expand it and wait for content"""
        try:
            logger.info("🔍 Looking for Dispenser section to expand...")
            
            # First, check if dispenser information is already visible (not collapsed)
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
            
            # Try to find and click the dispenser toggle/section
            dispenser_clicked = False
            
            # Method 1: Click "Dispenser (X)" text directly
            try:
                # Try to click "Dispenser (number)" text
                await page.click('text=/Dispenser \\(\\d+\\)/', timeout=5000)
                logger.info("✅ Clicked Dispenser section in Equipment tab")
                dispenser_clicked = True
            except:
                pass
            
            # Method 2: JavaScript click as backup
            if not dispenser_clicked:
                clicked = await page.evaluate("""
                    () => {
                        // Look for "Dispenser (8)" or similar text
                        const elements = document.querySelectorAll('*');
                        for (const el of elements) {
                            const text = el.textContent?.trim() || '';
                            // Match "Dispenser (number)" pattern
                            if (text.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                                console.log('Found Dispenser section:', text);
                                el.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                if clicked:
                    logger.info("✅ Clicked Dispenser section using JavaScript")
                    dispenser_clicked = True
            
            # Method 3: Original V1 method (for different page structures)
            if not dispenser_clicked:
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
                    logger.info("✅ Clicked Dispenser section using V1 method")
                    dispenser_clicked = True
            
            # Method 4: Try other selectors
            if not dispenser_clicked:
                for selector in self.selectors['dispenser_section']:
                    try:
                        element = await page.query_selector(selector)
                        if element:
                            await element.click()
                            logger.info(f"✅ Clicked Dispenser section using selector: {selector}")
                            dispenser_clicked = True
                            break
                    except:
                        continue
            
            # Method 5: Alternative text search
            if not dispenser_clicked:
                clicked = await page.evaluate("""
                    () => {
                        const elements = document.querySelectorAll('a, button, div[role="button"], span');
                        for (const el of elements) {
                            if (el.textContent && el.textContent.includes('Dispenser') && 
                                !el.textContent.includes('Add Dispenser')) {
                                el.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                if clicked:
                    logger.info("✅ Clicked Dispenser section using text search")
                    dispenser_clicked = True
            
            if not dispenser_clicked:
                logger.warning("⚠️ Could not find Dispenser section to click, but may already be expanded")
                return True  # Continue anyway - content might already be visible
            
            # Wait for dispenser information to appear after clicking
            logger.info("⏳ Waiting for dispenser information to load...")
            try:
                # Wait for detailed dispenser info to appear (up to 10 seconds)
                await page.wait_for_function("""
                    () => {
                        // Look for detailed dispenser information that appears after expansion
                        const elements = document.querySelectorAll('*');
                        for (const el of elements) {
                            const text = el.textContent || '';
                            // Look for dispenser-specific details
                            if (text.includes('S/N:') || text.includes('Serial Number') || 
                                text.includes('Wayne') || text.includes('Gilbarco') ||
                                text.includes('Tokheim') || text.includes('Dresser') ||
                                text.includes('Make:') || text.includes('Model:') ||
                                text.includes('Dispenser 1') || text.includes('Dispenser 2')) {
                                return true;
                            }
                        }
                        return false;
                    }
                """, timeout=10000)
                logger.info("✅ Dispenser information loaded successfully")
                return True
                
            except Exception as e:
                logger.warning(f"⚠️ Timeout waiting for dispenser info to load: {e}")
                # Continue anyway - the information might be there in a different format
                await page.wait_for_timeout(2000)  # Give it 2 more seconds
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
    
    async def _extract_dispensers(self, page, work_order_id: str) -> List[DispenserInfo]:
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
            # Method 1: Original V1 method with enhanced debugging
            logger.info(f"🔍 [EXTRACT] Method 1: Using original V1 extraction method...")
            
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
                            
                            // Find the dispenser title (e.g., "1/2 - Regular, Plus, Diesel...")
                            // It's the line that matches the pattern: number/number - fuel types
                            let title = '';
                            const titleMatch = fullText.match(/(\\d+\\/\\d+\\s*-\\s*[^\\n]+)/);
                            if (titleMatch) {
                                title = titleMatch[1].trim();
                            }
                            
                            if (!title) {
                                console.log('No title found for container', index);
                                return; // Skip if no valid title found
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
                            
                            // Extract dispenser numbers from title (e.g., "1/2" or "1")
                            let dispenserNumbers = [];
                            const numberMatch = title.match(/^(\\d+)(?:\\/(\\d+))?/);
                            if (numberMatch) {
                                dispenserNumbers.push(numberMatch[1]);
                                if (numberMatch[2]) {
                                    dispenserNumbers.push(numberMatch[2]);
                                }
                                dispenserNumber = numberMatch[0]; // Full match (e.g., "1/2" or "1")
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
                                fuel_grades: fields['Grade'] ? 
                                    { description: fields['Grade'] } : {},
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
                        fuel_type = fuel_type.strip().lower()
                        if 'regular' in fuel_type:
                            fuel_grades['regular'] = {'octane': 87}
                        elif 'plus' in fuel_type:
                            fuel_grades['plus'] = {'octane': 89}
                        elif 'premium' in fuel_type:
                            fuel_grades['premium'] = {'octane': 91}
                        elif 'diesel' in fuel_type:
                            fuel_grades['diesel'] = {'octane': None}
                    
                    # Default fuel grades if none found
                    if not fuel_grades:
                        fuel_grades = {
                            'regular': {'octane': 87},
                            'plus': {'octane': 89},
                            'premium': {'octane': 91}
                        }
                    
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
    
    def _parse_fuel_grades(self, fields: Dict[str, str]) -> Dict[str, Any]:
        """Parse fuel grade information from custom fields"""
        fuel_grades = {}
        
        # Common fuel grade patterns to look for
        grade_patterns = {
            'regular': ['regular', 'unleaded', '87'],
            'plus': ['plus', 'mid', 'midgrade', '89'],
            'premium': ['premium', 'super', '91', '93'],
            'diesel': ['diesel', 'dsl']
        }
        
        for field_name, field_value in fields.items():
            field_lower = field_name.lower()
            value_lower = field_value.lower()
            
            # Check if field relates to fuel grades
            if any(term in field_lower for term in ['fuel', 'grade', 'product', 'octane']):
                # Try to identify the grade type
                for grade_type, patterns in grade_patterns.items():
                    if any(pattern in value_lower for pattern in patterns):
                        octane = None
                        # Try to extract octane number
                        octane_match = re.search(r'\b(87|89|91|93)\b', field_value)
                        if octane_match:
                            octane = int(octane_match.group(1))
                        
                        fuel_grades[grade_type] = {
                            'name': field_value,
                            'octane': octane,
                            'field_name': field_name
                        }
                        break
        
        # If no fuel grades found, return default set
        if not fuel_grades:
            fuel_grades = {
                'regular': {'name': 'Regular', 'octane': 87},
                'plus': {'name': 'Plus', 'octane': 89},
                'premium': {'name': 'Premium', 'octane': 91}
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