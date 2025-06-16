#!/usr/bin/env python3
"""
Enhanced Dispenser Scraper Service V2
Based on current WorkFossa UI structure from screenshots
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class DispenserInfo:
    """Enhanced dispenser information structure"""
    dispenser_id: str
    title: str
    serial_number: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    dispenser_number: Optional[str] = None
    dispenser_numbers: List[str] = field(default_factory=list)
    stand_alone_code: Optional[str] = None
    number_of_nozzles: Optional[str] = None
    meter_type: Optional[str] = None
    fuel_grades: Dict[str, Any] = field(default_factory=dict)
    grades_list: List[str] = field(default_factory=list)
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    raw_html: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class DispenserScraperV2:
    """Enhanced dispenser scraper based on current WorkFossa UI"""
    
    def __init__(self):
        self.config = {
            'wait_for_equipment_tab': 5000,
            'wait_for_dispenser_expand': 3000,
            'wait_for_data_load': 2000,
            'screenshot_on_failure': True
        }
    
    async def scrape_dispensers_for_work_order(self, page, work_order_id: str, customer_url: str) -> List[DispenserInfo]:
        """Main entry point for scraping dispensers"""
        logger.info(f"🚀 [SCRAPER V2] Starting dispenser scraping for work order {work_order_id}")
        logger.info(f"📍 [SCRAPER V2] Customer URL: {customer_url}")
        
        try:
            # Navigate to customer page
            if not page.url.startswith(customer_url):
                logger.info(f"🔄 [SCRAPER V2] Navigating to customer page...")
                await page.goto(customer_url, wait_until='networkidle')
                await page.wait_for_timeout(2000)
            
            # Click Equipment tab
            if not await self._click_equipment_tab(page):
                logger.error("❌ [SCRAPER V2] Failed to click Equipment tab")
                return []
            
            # Click Dispenser section to expand it
            if not await self._click_dispenser_section(page):
                logger.error("❌ [SCRAPER V2] Failed to expand Dispenser section")
                return []
            
            # Extract dispensers
            dispensers = await self._extract_dispensers_v2(page, work_order_id)
            
            if dispensers:
                logger.info(f"✅ [SCRAPER V2] Successfully extracted {len(dispensers)} dispensers")
            else:
                logger.warning(f"⚠️ [SCRAPER V2] No dispensers found")
                if self.config['screenshot_on_failure']:
                    await page.screenshot(path=f"debug_no_dispensers_{work_order_id}.png")
            
            return dispensers
            
        except Exception as e:
            logger.error(f"❌ [SCRAPER V2] Error scraping dispensers: {e}")
            if self.config['screenshot_on_failure']:
                await page.screenshot(path=f"debug_error_{work_order_id}.png")
            return []
    
    async def _click_equipment_tab(self, page) -> bool:
        """Click the Equipment tab"""
        try:
            logger.info("🔍 [SCRAPER V2] Looking for Equipment tab...")
            
            # Try multiple selectors for Equipment tab
            equipment_selectors = [
                'text=Equipment',
                'button:has-text("Equipment")',
                'a:has-text("Equipment")',
                '[role="tab"]:has-text("Equipment")',
                'span:has-text("Equipment")',
                'div:has-text("Equipment")'
            ]
            
            clicked = False
            for selector in equipment_selectors:
                try:
                    await page.click(selector, timeout=3000)
                    logger.info(f"✅ [SCRAPER V2] Clicked Equipment tab using selector: {selector}")
                    clicked = True
                    break
                except:
                    continue
            
            if not clicked:
                logger.warning("⚠️ [SCRAPER V2] Could not click Equipment tab with selectors, trying JavaScript")
                clicked = await page.evaluate("""
                    () => {
                        const elements = Array.from(document.querySelectorAll('*'));
                        const equipmentTab = elements.find(el => 
                            el.textContent?.trim() === 'Equipment' && 
                            (el.tagName === 'BUTTON' || el.tagName === 'A' || el.role === 'tab')
                        );
                        if (equipmentTab) {
                            equipmentTab.click();
                            return true;
                        }
                        return false;
                    }
                """)
            
            if clicked:
                await page.wait_for_timeout(self.config['wait_for_equipment_tab'])
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ [SCRAPER V2] Error clicking Equipment tab: {e}")
            return False
    
    async def _click_dispenser_section(self, page) -> bool:
        """Click the Dispenser section to expand it"""
        try:
            logger.info("🔍 [SCRAPER V2] Looking for Dispenser section...")
            
            # Check if dispensers are already visible
            already_visible = await page.evaluate("""
                () => {
                    const text = document.body.textContent || '';
                    return text.includes('S/N:') && (
                        text.includes('MAKE:') || 
                        text.includes('MODEL:') ||
                        text.includes('STAND ALONE CODE')
                    );
                }
            """)
            
            if already_visible:
                logger.info("✅ [SCRAPER V2] Dispensers already visible")
                return True
            
            # Try to click "Dispenser (X)" to expand
            clicked = await page.evaluate("""
                () => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const dispenserSection = elements.find(el => {
                        const text = el.textContent?.trim() || '';
                        return text.match(/^Dispenser\\s*\\(\\d+\\)$/);
                    });
                    if (dispenserSection) {
                        dispenserSection.click();
                        return true;
                    }
                    return false;
                }
            """)
            
            if clicked:
                logger.info("✅ [SCRAPER V2] Clicked Dispenser section")
                await page.wait_for_timeout(self.config['wait_for_dispenser_expand'])
                return True
            
            # Alternative: Try clicking text that contains "Dispenser ("
            try:
                await page.click('text=/Dispenser \\(\\d+\\)/', timeout=3000)
                logger.info("✅ [SCRAPER V2] Clicked Dispenser section using regex")
                await page.wait_for_timeout(self.config['wait_for_dispenser_expand'])
                return True
            except:
                pass
            
            logger.warning("⚠️ [SCRAPER V2] Could not click Dispenser section")
            return False
            
        except Exception as e:
            logger.error(f"❌ [SCRAPER V2] Error clicking Dispenser section: {e}")
            return False
    
    async def _extract_dispensers_v2(self, page, work_order_id: str) -> List[DispenserInfo]:
        """Extract dispensers using the current UI structure"""
        logger.info("🔍 [SCRAPER V2] Extracting dispensers...")
        
        raw_data = await page.evaluate("""
            () => {
                const dispensers = [];
                const debug = {
                    totalElements: 0,
                    dispenserBlocks: 0,
                    method: ''
                };
                
                // Method 1: Find dispenser blocks by pattern
                const allText = document.body.textContent || '';
                const lines = allText.split('\\n').map(line => line.trim()).filter(line => line);
                
                // Find lines that match dispenser pattern: "X/Y - Fuel Types - Manufacturer"
                const dispenserTitles = [];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.match(/^\\d+\\/\\d+\\s*-\\s*.+\\s*-\\s*.+$/)) {
                        dispenserTitles.push({ index: i, title: line });
                    }
                }
                
                debug.method = 'Line-by-line parsing';
                debug.dispenserBlocks = dispenserTitles.length;
                
                // Extract data for each dispenser
                dispenserTitles.forEach(({ index, title }) => {
                    try {
                        // Parse title
                        const titleMatch = title.match(/^(\\d+\\/\\d+)\\s*-\\s*(.+?)\\s*-\\s*(.+)$/);
                        if (!titleMatch) return;
                        
                        const dispenserNumber = titleMatch[1];
                        const fuelTypes = titleMatch[2].trim();
                        const manufacturer = titleMatch[3].trim();
                        
                        // Look for associated data in following lines
                        const dataLines = {};
                        for (let j = index + 1; j < Math.min(index + 20, lines.length); j++) {
                            const line = lines[j];
                            
                            // Check for S/N
                            if (line.startsWith('S/N:')) {
                                dataLines.serialNumber = line.replace('S/N:', '').trim();
                            }
                            // Check for labeled fields
                            else if (line === 'MAKE' && j + 1 < lines.length) {
                                dataLines.make = lines[j + 1];
                            }
                            else if (line === 'MODEL' && j + 1 < lines.length) {
                                dataLines.model = lines[j + 1];
                            }
                            else if (line === 'GRADE' && j + 1 < lines.length) {
                                dataLines.grade = lines[j + 1];
                            }
                            else if (line === 'STAND ALONE CODE' && j + 1 < lines.length) {
                                dataLines.standAloneCode = lines[j + 1];
                            }
                            else if (line.includes('NUMBER OF NOZZLES') && j + 1 < lines.length) {
                                dataLines.numberOfNozzles = lines[j + 1];
                            }
                            else if (line === 'METER TYPE' && j + 1 < lines.length) {
                                dataLines.meterType = lines[j + 1];
                            }
                            
                            // Stop if we hit another dispenser title
                            if (line.match(/^\\d+\\/\\d+\\s*-\\s*.+\\s*-\\s*.+$/)) {
                                break;
                            }
                        }
                        
                        const dispenser = {
                            title: title,
                            dispenser_number: dispenserNumber,
                            dispenser_numbers: dispenserNumber.split('/'),
                            serial_number: dataLines.serialNumber || '',
                            make: dataLines.make || manufacturer,
                            model: dataLines.model || '',
                            fuel_types: fuelTypes,
                            fields: {
                                'STAND_ALONE_CODE': dataLines.standAloneCode || '',
                                'NUMBER_OF_NOZZLES': dataLines.numberOfNozzles || '',
                                'METER_TYPE': dataLines.meterType || '',
                                'Grade': dataLines.grade || fuelTypes
                            }
                        };
                        
                        dispensers.push(dispenser);
                        
                    } catch (err) {
                        console.error('Error parsing dispenser:', err);
                    }
                });
                
                return {
                    success: dispensers.length > 0,
                    dispensers: dispensers,
                    debug: debug
                };
            }
        """)
        
        if not raw_data['success']:
            logger.warning(f"⚠️ [SCRAPER V2] No dispensers found. Debug: {raw_data['debug']}")
            return []
        
        # Convert to DispenserInfo objects
        dispensers = []
        for i, raw in enumerate(raw_data['dispensers']):
            try:
                # Parse fuel grades
                fuel_types = raw.get('fuel_types', '').split(',')
                fuel_grades = {}
                grades_list = []
                
                for fuel_type in fuel_types:
                    fuel_type = fuel_type.strip()
                    grades_list.append(fuel_type)
                    
                    # Map to standard fuel grades
                    if 'Regular' in fuel_type:
                        fuel_grades['regular'] = {'octane': 87}
                    elif 'Plus' in fuel_type:
                        fuel_grades['plus'] = {'octane': 89}
                    elif 'Premium' in fuel_type:
                        fuel_grades['premium'] = {'octane': 91}
                    elif 'Diesel' in fuel_type:
                        fuel_grades['diesel'] = {'octane': None}
                    elif 'Super' in fuel_type:
                        fuel_grades['super'] = {'octane': 93}
                    elif 'Ethanol-Free' in fuel_type:
                        fuel_grades['ethanol_free'] = {'octane': 87, 'ethanol_content': 0}
                
                dispenser = DispenserInfo(
                    dispenser_id=f"{work_order_id}_dispenser_{raw.get('dispenser_number', i+1)}",
                    title=raw.get('title', f'Dispenser {i+1}'),
                    serial_number=raw.get('serial_number'),
                    make=raw.get('make'),
                    model=raw.get('model'),
                    dispenser_number=raw.get('dispenser_number'),
                    dispenser_numbers=raw.get('dispenser_numbers', []),
                    stand_alone_code=raw['fields'].get('STAND_ALONE_CODE'),
                    number_of_nozzles=raw['fields'].get('NUMBER_OF_NOZZLES'),
                    meter_type=raw['fields'].get('METER_TYPE'),
                    fuel_grades=fuel_grades,
                    grades_list=grades_list,
                    custom_fields=raw.get('fields', {})
                )
                
                dispensers.append(dispenser)
                logger.info(f"📋 [SCRAPER V2] Dispenser {i+1}: {dispenser.title} (S/N: {dispenser.serial_number})")
                
            except Exception as e:
                logger.error(f"❌ [SCRAPER V2] Error creating DispenserInfo {i+1}: {e}")
        
        return dispensers

# Singleton instance
dispenser_scraper_v2 = DispenserScraperV2()