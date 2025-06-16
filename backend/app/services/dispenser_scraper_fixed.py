#!/usr/bin/env python3
"""
Fixed Dispenser Information Scraper for WorkFossa
Based on comparison with working interactive script
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
    """Fixed dispenser scraping service for WorkFossa"""
    
    def __init__(self):
        # Adjusted timeouts based on working interactive script
        self.timeouts = {
            'navigation': 30000,  # 30 seconds for page navigation
            'after_navigation': 3000,  # 3 seconds after navigation (from interactive)
            'after_equipment_click': 3000,  # 3 seconds after equipment click (increased from 2000)
            'after_dispenser_click': 2000,  # 2 seconds after dispenser click
            'modal_check': 2000,  # 2 seconds before checking for modal (increased from 1000)
            'element_wait': 5000  # 5 seconds for individual elements
        }
        
        self.selectors = {
            # Equipment tab selectors (simplified from interactive script)
            'equipment_tab': [
                'text="Equipment"',
                'a:has-text("Equipment")',
                'button:has-text("Equipment")',
                '[href*="equipment"]',
                'li:has-text("Equipment")',
                '.nav-link:has-text("Equipment")',
                '.tab:has-text("Equipment")'
            ],
            
            # Dispenser section selectors (simplified)
            'dispenser_section': [
                'text="Dispenser"',
                'text="Dispensers"',
                'button:has-text("Dispenser")',
                'h3:has-text("Dispenser")',
                '.accordion:has-text("Dispenser")',
                '[data-toggle]:has-text("Dispenser")'
            ],
            
            # Dispenser container selector (from interactive script)
            'dispenser_containers': 'div.py-1\\.5, div.py-1\\.5.bg-gray-50'
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
                try:
                    await page.goto(visit_url, wait_until="networkidle", timeout=self.timeouts['navigation'])
                    # CRITICAL: Wait 3 seconds after navigation (from interactive script)
                    await page.wait_for_timeout(self.timeouts['after_navigation'])
                    logger.info("✅ Navigation complete, waited 3 seconds for page to settle")
                except Exception as nav_error:
                    logger.error(f"Failed to navigate to {visit_url}: {nav_error}")
                    if "closed" in str(nav_error).lower() or "transport" in str(nav_error).lower():
                        logger.error("Browser connection was closed. Session may have timed out.")
                    raise
            
            # Click Equipment tab with simplified approach
            equipment_clicked = await self._click_equipment_tab_simple(page)
            if not equipment_clicked:
                logger.warning("Could not find Equipment tab")
                return [], None
            
            # CRITICAL: Wait 3 seconds after Equipment tab click (increased from 2000)
            await page.wait_for_timeout(self.timeouts['after_equipment_click'])
            logger.info("✅ Waited 3 seconds after Equipment tab click")
            
            # Check for and close modal if present (with longer initial wait)
            await self._handle_modal(page)
            
            # Click Dispenser section with simplified approach
            dispenser_clicked = await self._click_dispenser_section_simple(page)
            if not dispenser_clicked:
                logger.warning("Could not find Dispenser section")
                return [], await self._capture_page_html(page)
            
            # Wait for dispenser content to expand
            await page.wait_for_timeout(self.timeouts['after_dispenser_click'])
            logger.info("✅ Waited 2 seconds after Dispenser section click")
            
            # Capture dispenser HTML
            dispenser_html = await self._capture_dispenser_html(page)
            
            # Extract dispenser information using the working method from interactive script
            dispensers = await self._extract_dispensers_simple(page, work_order_id)
            
            logger.info(f"✅ Found {len(dispensers)} dispensers for work order {work_order_id}")
            
            return dispensers, dispenser_html
            
        except Exception as e:
            logger.error(f"Error scraping dispensers for work order {work_order_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return [], await self._capture_page_html(page)
    
    async def _click_equipment_tab_simple(self, page) -> bool:
        """Simplified Equipment tab click based on interactive script"""
        try:
            logger.info("🔍 Looking for Equipment tab...")
            
            # Try each selector from the interactive script
            for selector in self.selectors['equipment_tab']:
                try:
                    element = await page.locator(selector).first.element_handle(timeout=1000)
                    if element:
                        logger.info(f"   ✅ Found Equipment tab with selector: {selector}")
                        await page.click(selector, timeout=5000)
                        logger.info("✅ Clicked Equipment tab")
                        return True
                except:
                    pass
            
            # Fallback: JavaScript click (from batch scraper)
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
                return True
            
            logger.warning("❌ Could not find Equipment tab to click")
            return False
            
        except Exception as e:
            logger.error(f"❌ Error clicking Equipment tab: {e}")
            return False
    
    async def _handle_modal(self, page):
        """Handle modal if it appears after Equipment tab click"""
        try:
            # Wait longer before checking for modal
            await page.wait_for_timeout(self.timeouts['modal_check'])
            
            cancel_button = await page.query_selector('button:has-text("Cancel")')
            if cancel_button:
                logger.info("📋 Modal detected, closing it...")
                await cancel_button.click()
                await page.wait_for_timeout(1000)
                logger.info("✅ Modal closed")
        except:
            # Modal not found or error closing it - continue anyway
            pass
    
    async def _click_dispenser_section_simple(self, page) -> bool:
        """Simplified Dispenser section click based on interactive script"""
        try:
            logger.info("🔍 Looking for Dispenser section...")
            
            # Check if dispenser content is already visible
            dispenser_containers = await page.locator(self.selectors['dispenser_containers']).all()
            if len(dispenser_containers) > 0:
                logger.info(f"✅ Found {len(dispenser_containers)} dispenser containers - section already expanded")
                return True
            
            # Try to click Dispenser section header
            for selector in self.selectors['dispenser_section']:
                try:
                    element = await page.locator(selector).first.element_handle(timeout=1000)
                    if element:
                        logger.info(f"   ✅ Found Dispenser section with selector: {selector}")
                        await page.click(selector)
                        logger.info("✅ Clicked to expand Dispenser section")
                        return True
                except:
                    pass
            
            # Try regex pattern for "Dispenser (X)"
            try:
                await page.click('text=/Dispenser \\(\\d+\\)/', timeout=5000)
                logger.info("✅ Clicked Dispenser section using regex pattern")
                return True
            except:
                pass
            
            logger.warning("⚠️ Could not find Dispenser section to click, but continuing anyway")
            return True  # Continue even if we can't find it - content might be visible
            
        except Exception as e:
            logger.error(f"❌ Error clicking Dispenser section: {e}")
            return False
    
    async def _capture_dispenser_html(self, page) -> str:
        """Capture the HTML content of the dispenser section"""
        try:
            logger.info("Capturing dispenser HTML content...")
            
            dispenser_html = await page.evaluate("""
                () => {
                    // Look for the container with dispenser items
                    const dispenserContainers = document.querySelectorAll('div.py-1\\\\.5, div.py-1\\\\.5.bg-gray-50');
                    if (dispenserContainers.length > 0) {
                        // Get the parent that contains all dispensers
                        let parent = dispenserContainers[0].parentElement;
                        while (parent && parent.querySelectorAll('div.py-1\\\\.5').length < dispenserContainers.length) {
                            parent = parent.parentElement;
                        }
                        if (parent) {
                            return parent.outerHTML;
                        }
                    }
                    
                    // Fallback: get the main content area
                    const mainContent = document.querySelector('main, .main-content, [role="main"]');
                    if (mainContent) {
                        return mainContent.innerHTML;
                    }
                    
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
    
    async def _extract_dispensers_simple(self, page, work_order_id: str) -> List[DispenserInfo]:
        """Simplified extraction based on working interactive script"""
        logger.info(f"🔍 Extracting dispenser information for work order {work_order_id}...")
        
        try:
            # Use the exact selector from interactive script
            dispenser_containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
            logger.info(f"   Found {len(dispenser_containers)} dispenser containers")
            
            # Import the fuel grades ordering function
            try:
                from app.data.fuel_grades import get_ordered_fuel_grades
            except ImportError:
                def get_ordered_fuel_grades(grades):
                    return grades
            
            dispensers = []
            for i, container in enumerate(dispenser_containers):
                try:
                    # Check if this is a dispenser container
                    if await container.locator('.px-2').count() > 0:
                        # Get all text content
                        container_text = await container.inner_text()
                        
                        # Extract title
                        title_elem = container.locator('.px-2 .flex.align-start > div').first
                        title_text = ""
                        if await title_elem.count() > 0:
                            title_text = await title_elem.inner_text()
                            title_lines = title_text.strip().split('\n')
                            if title_lines:
                                title_text = title_lines[0].strip()
                        
                        if not title_text or 'S/N:' not in container_text:
                            continue  # Skip non-dispenser containers
                        
                        # Extract S/N
                        serial = ""
                        sn_match = re.search(r'S/N:\s*([A-Z0-9]+)', container_text)
                        if sn_match:
                            serial = sn_match[1]
                        
                        # Extract Make and Model
                        make = ""
                        model = ""
                        
                        # Check title for manufacturer
                        manufacturers = ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett']
                        for mfr in manufacturers:
                            if mfr in title_text:
                                make = mfr
                                break
                        
                        # Extract from fields if not in title
                        if not make:
                            make_match = re.search(r'(?:MAKE|Make):\s*([A-Za-z0-9\s]+?)(?=\n|(?:MODEL|Model):|$)', container_text, re.IGNORECASE)
                            if make_match:
                                make = make_match.group(1).strip()
                        
                        model_match = re.search(r'(?:MODEL|Model):\s*([A-Za-z0-9\s]+?)(?=\n|(?:GRADE|Grade)|$)', container_text, re.IGNORECASE)
                        if model_match:
                            model = model_match.group(1).strip()
                        
                        # Extract additional fields
                        stand_alone_code = ""
                        sa_match = re.search(r'STAND ALONE CODE\s*(\d+)', container_text, re.IGNORECASE)
                        if sa_match:
                            stand_alone_code = sa_match.group(1).strip()
                        
                        number_of_nozzles = ""
                        nozzles_match = re.search(r'NUMBER OF NOZZLES.*?\s+(\d+)', container_text, re.IGNORECASE)
                        if nozzles_match:
                            number_of_nozzles = nozzles_match.group(1).strip()
                        
                        meter_type = ""
                        meter_match = re.search(r'METER TYPE\s*([^\n]+)', container_text, re.IGNORECASE)
                        if meter_match:
                            meter_type = meter_match.group(1).strip()
                        
                        # Extract grades
                        grades = ""
                        grades_list = []
                        grade_match = re.search(r'GRADE\s*([^\n]+?)(?=\s*STAND|$)', container_text, re.IGNORECASE)
                        if grade_match:
                            grades = grade_match.group(1).strip()
                            grades_list = [g.strip() for g in grades.split(',')]
                            grades_list = get_ordered_fuel_grades(grades_list)
                        
                        # Extract dispenser number
                        dispenser_number = ""
                        dispenser_numbers = []
                        num_match = re.match(r'^(\d+)(?:/(\d+))?', title_text)
                        if num_match:
                            dispenser_number = num_match.group(0)
                            dispenser_numbers.append(num_match.group(1))
                            if num_match.group(2):
                                dispenser_numbers.append(num_match.group(2))
                        
                        # Create DispenserInfo object
                        dispenser = DispenserInfo(
                            dispenser_id=f"{work_order_id}_dispenser_{dispenser_number or (i+1)}",
                            title=title_text,
                            serial_number=serial,
                            make=make,
                            model=model,
                            dispenser_number=dispenser_number,
                            dispenser_numbers=dispenser_numbers,
                            stand_alone_code=stand_alone_code,
                            number_of_nozzles=number_of_nozzles,
                            meter_type=meter_type,
                            fuel_grades={'description': grades} if grades else {},
                            grades_list=grades_list,
                            custom_fields={
                                'GRADE': grades,
                                'STAND_ALONE_CODE': stand_alone_code,
                                'NUMBER_OF_NOZZLES': number_of_nozzles,
                                'METER_TYPE': meter_type
                            }
                        )
                        
                        dispensers.append(dispenser)
                        logger.info(f"   ✅ Dispenser found: {title_text} (S/N: {serial})")
                        
                except Exception as e:
                    logger.error(f"   Error extracting dispenser {i+1}: {e}")
                    continue
            
            logger.info(f"✅ Extracted {len(dispensers)} dispensers")
            return dispensers
            
        except Exception as e:
            logger.error(f"Error extracting dispensers: {e}")
            import traceback
            logger.error(traceback.format_exc())
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
dispenser_scraper_fixed = DispenserScraper()