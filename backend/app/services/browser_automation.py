#!/usr/bin/env python3
"""
Browser Automation Service
Comprehensive Playwright-based automation for WorkFossa form filling
Based on V1's sophisticated automation engine (3000+ lines) but modernized
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum

try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    # Create mock types for when Playwright is not available
    class Page:
        pass
    class Browser:
        pass
    class BrowserContext:
        pass
    class Playwright:
        pass

# Import exception handling
from ..core.exceptions import (
    BrowserError,
    BrowserInitializationError,
    PageLoadError,
    ElementNotFoundError,
    AuthenticationError
)

logger = logging.getLogger(__name__)

class AutomationPhase(Enum):
    """Automation phases for progress tracking"""
    INITIALIZING = "initializing"
    LAUNCHING_BROWSER = "launching_browser"
    NAVIGATING = "navigating"
    LOGGING_IN = "logging_in"
    LOADING_VISIT = "loading_visit"
    DETECTING_FORM = "detecting_form"
    FILLING_FORM = "filling_form"
    SUBMITTING = "submitting"
    VERIFICATION = "verification"
    CLEANUP = "cleanup"
    COMPLETED = "completed"
    FAILED = "failed"

class FormFieldType(Enum):
    """Types of form fields detected"""
    TEXT_INPUT = "text_input"
    NUMBER_INPUT = "number_input"
    DROPDOWN = "dropdown"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    DATE_INPUT = "date_input"
    TIME_INPUT = "time_input"
    TEXTAREA = "textarea"

@dataclass
class FuelGrade:
    """Fuel grade configuration"""
    name: str
    octane: Optional[int] = None
    ethanol_content: Optional[float] = None
    is_diesel: bool = False
    is_ethanol_free: bool = False
    is_premium: bool = False
    color_code: Optional[str] = None

@dataclass
class DispenserConfig:
    """Dispenser configuration for automation"""
    dispenser_number: str
    dispenser_type: str
    fuel_grades: Dict[str, FuelGrade]
    has_card_reader: bool = True
    has_receipt_printer: bool = True
    nozzle_count: int = 2
    location: Optional[str] = None

@dataclass
class FormField:
    """Detected form field"""
    field_id: str
    field_type: FormFieldType
    label: str
    selector: str
    required: bool = False
    value: Optional[str] = None
    options: List[str] = None

@dataclass
class AutomationProgress:
    """Progress tracking for automation"""
    session_id: str
    phase: AutomationPhase
    percentage: float
    message: str
    dispenser_id: Optional[str] = None
    dispenser_title: Optional[str] = None
    fuel_grades: List[str] = None
    timestamp: datetime = None
    error: Optional[str] = None
    screenshot_path: Optional[str] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.fuel_grades is None:
            self.fuel_grades = []

class FuelGradeDetector:
    """Advanced fuel grade detection based on V1 logic"""
    
    # Common fuel grade patterns from V1
    GRADE_PATTERNS = {
        "regular": {
            "keywords": ["regular", "87", "unleaded", "base", "economy"],
            "octane": 87,
            "ethanol_content": 10.0
        },
        "plus": {
            "keywords": ["plus", "89", "mid", "midgrade", "medium"],
            "octane": 89,
            "ethanol_content": 10.0
        },
        "premium": {
            "keywords": ["premium", "91", "92", "93", "super", "high"],
            "octane": 91,
            "ethanol_content": 10.0,
            "is_premium": True
        },
        "diesel": {
            "keywords": ["diesel", "dsl", "d2", "ulsd", "bio"],
            "is_diesel": True
        },
        "ethanol_free": {
            "keywords": ["ethanol free", "no ethanol", "pure", "recreation"],
            "ethanol_content": 0.0,
            "is_ethanol_free": True
        },
        "e85": {
            "keywords": ["e85", "flex", "ethanol"],
            "ethanol_content": 85.0
        }
    }
    
    @classmethod
    def detect_fuel_grades(cls, page_content: str, dispenser_config: Dict[str, Any]) -> List[FuelGrade]:
        """Detect available fuel grades from page content"""
        detected_grades = []
        
        content_lower = page_content.lower()
        
        for grade_name, pattern in cls.GRADE_PATTERNS.items():
            for keyword in pattern["keywords"]:
                if keyword in content_lower:
                    grade = FuelGrade(
                        name=grade_name.title(),
                        octane=pattern.get("octane"),
                        ethanol_content=pattern.get("ethanol_content"),
                        is_diesel=pattern.get("is_diesel", False),
                        is_ethanol_free=pattern.get("is_ethanol_free", False),
                        is_premium=pattern.get("is_premium", False)
                    )
                    
                    # Avoid duplicates
                    if not any(g.name == grade.name for g in detected_grades):
                        detected_grades.append(grade)
                    break
        
        # Fallback to common grades if none detected
        if not detected_grades:
            detected_grades = [
                FuelGrade("Regular", octane=87, ethanol_content=10.0),
                FuelGrade("Plus", octane=89, ethanol_content=10.0),
                FuelGrade("Premium", octane=91, ethanol_content=10.0, is_premium=True)
            ]
        
        return detected_grades

class FormFieldDetector:
    """Advanced form field detection based on V1 patterns"""
    
    FIELD_SELECTORS = {
        # AccuMeasure form patterns from V1
        "dispenser_number": [
            "input[name*='dispenser']",
            "input[id*='dispenser']", 
            "select[name*='dispenser']",
            "input[placeholder*='dispenser']"
        ],
        "fuel_grade": [
            "select[name*='grade']",
            "select[name*='fuel']",
            "input[name*='octane']",
            "select[id*='grade']"
        ],
        "test_date": [
            "input[type='date']",
            "input[name*='date']",
            "input[id*='date']"
        ],
        "test_time": [
            "input[type='time']",
            "input[name*='time']",
            "input[id*='time']"
        ],
        "temperature": [
            "input[name*='temp']",
            "input[name*='temperature']",
            "input[id*='temp']"
        ],
        "volume": [
            "input[name*='volume']",
            "input[name*='gallon']",
            "input[name*='amount']"
        ],
        "error_amount": [
            "input[name*='error']",
            "input[name*='difference']",
            "input[name*='variance']"
        ]
    }
    
    @classmethod
    async def detect_form_fields(cls, page: Page) -> List[FormField]:
        """Detect all form fields on the page"""
        fields = []
        
        for field_category, selectors in cls.FIELD_SELECTORS.items():
            for selector in selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for i, element in enumerate(elements):
                        field_id = f"{field_category}_{i}"
                        
                        # Get field properties
                        tag_name = await element.evaluate("el => el.tagName.toLowerCase()")
                        field_type = await element.get_attribute("type") or "text"
                        label = await cls._get_field_label(page, element)
                        required = await element.get_attribute("required") is not None
                        
                        # Determine field type
                        form_field_type = cls._determine_field_type(tag_name, field_type)
                        
                        # Get options for select fields
                        options = []
                        if tag_name == "select":
                            option_elements = await element.query_selector_all("option")
                            options = [await opt.text_content() for opt in option_elements if await opt.text_content()]
                        
                        field = FormField(
                            field_id=field_id,
                            field_type=form_field_type,
                            label=label or field_category,
                            selector=selector,
                            required=required,
                            options=options
                        )
                        
                        fields.append(field)
                        
                except Exception as e:
                    logger.debug(f"Error detecting field with selector {selector}: {e}")
                    continue
        
        return fields
    
    @classmethod
    async def _get_field_label(cls, page: Page, element) -> Optional[str]:
        """Extract field label"""
        try:
            # Try to find associated label
            field_id = await element.get_attribute("id")
            if field_id:
                label = await page.query_selector(f"label[for='{field_id}']")
                if label:
                    return await label.text_content()
            
            # Try placeholder
            placeholder = await element.get_attribute("placeholder")
            if placeholder:
                return placeholder
            
            # Try name attribute
            name = await element.get_attribute("name")
            if name:
                return name.replace("_", " ").title()
                
        except Exception:
            pass
        
        return None
    
    @classmethod
    def _determine_field_type(cls, tag_name: str, input_type: str) -> FormFieldType:
        """Determine FormFieldType from HTML element"""
        if tag_name == "select":
            return FormFieldType.DROPDOWN
        elif tag_name == "textarea":
            return FormFieldType.TEXTAREA
        elif tag_name == "input":
            type_map = {
                "text": FormFieldType.TEXT_INPUT,
                "number": FormFieldType.NUMBER_INPUT,
                "email": FormFieldType.TEXT_INPUT,
                "password": FormFieldType.TEXT_INPUT,
                "date": FormFieldType.DATE_INPUT,
                "time": FormFieldType.TIME_INPUT,
                "checkbox": FormFieldType.CHECKBOX,
                "radio": FormFieldType.RADIO
            }
            return type_map.get(input_type, FormFieldType.TEXT_INPUT)
        
        return FormFieldType.TEXT_INPUT

class BrowserAutomationService:
    """Main browser automation service based on V1's complex automation engine"""
    
    def __init__(self, headless: bool = True, timeout: int = 30000):
        self.headless = headless
        self.timeout = timeout
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.contexts: Dict[str, BrowserContext] = {}
        self.pages: Dict[str, Page] = {}
        self.progress_callbacks: List[Callable] = []
        self.screenshots_dir = Path("data/screenshots")
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)
        
        # Browser automation service initialized
        if not PLAYWRIGHT_AVAILABLE:
            logger.warning("Playwright not available. Install with: pip install playwright")
    
    async def initialize(self) -> bool:
        """Initialize browser automation system"""
        try:
            if not PLAYWRIGHT_AVAILABLE:
                logger.error("Cannot initialize - Playwright not available")
                return False
                
            logger.info("Initializing browser automation service...")
            self.playwright = await async_playwright().start()
            
            # Launch browser with optimized settings
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images',  # Speed optimization
                    '--disable-javascript-harmony-shipping',
                    '--memory-pressure-off',
                    '--max_old_space_size=4096'
                ]
            )
            
            logger.info("Browser automation service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize browser automation: {e}")
            return False
    
    async def create_session(self, session_id: str, user_agent: Optional[str] = None) -> bool:
        """Create new automation session"""
        try:
            logger.info(f"create_session called for {session_id}")
            logger.info(f"browser exists: {self.browser is not None}")
            logger.info(f"browser type: {type(self.browser)}")
            
            if not self.browser:
                logger.info("Browser not initialized, initializing...")
                success = await self.initialize()
                if not success:
                    return False
            
            logger.info("Creating browser context...")
            # Create browser context with stealth settings
            try:
                context = await self.browser.new_context(
                    user_agent=user_agent or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    viewport={"width": 1366, "height": 768},
                    ignore_https_errors=True
                )
            except Exception as ctx_error:
                logger.error(f"Error creating context: {ctx_error}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise
            
            # Add stealth scripts
            logger.info("Adding stealth scripts...")
            try:
                await context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                """)
            except Exception as script_error:
                logger.error(f"Error adding init script: {script_error}")
                # Continue anyway
            
            # Create page
            logger.info("Creating page...")
            try:
                page = await context.new_page()
                logger.info(f"Page created, setting timeout to {self.timeout}ms...")
                page.set_default_timeout(self.timeout)
            except Exception as page_error:
                logger.error(f"Error creating page: {page_error}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise
            
            # Store session
            self.contexts[session_id] = context
            self.pages[session_id] = page
            
            logger.info(f"Created automation session: {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create session {session_id}: {e}")
            return False
    
    async def close_session(self, session_id: str) -> bool:
        """Close automation session"""
        try:
            if session_id in self.contexts:
                await self.contexts[session_id].close()
                del self.contexts[session_id]
                
            if session_id in self.pages:
                del self.pages[session_id]
            
            logger.info(f"Closed automation session: {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to close session {session_id}: {e}")
            return False
    
    async def navigate_to_workfossa(self, session_id: str, credentials: Dict[str, str]) -> bool:
        """Navigate to WorkFossa and login"""
        try:
            page = self.pages.get(session_id)
            if not page:
                raise Exception(f"Session {session_id} not found")
            
            await self._emit_progress(session_id, AutomationPhase.NAVIGATING, 10, "Navigating to WorkFossa...")
            
            # Navigate to WorkFossa login
            await page.goto("https://app.workfossa.com", wait_until="networkidle")
            await self._take_screenshot(session_id, "workfossa_login_page")
            
            await self._emit_progress(session_id, AutomationPhase.LOGGING_IN, 20, "Logging into WorkFossa...")
            
            # Login process
            await page.fill("input[name='email'], input[type='email']", credentials["username"])
            await page.fill("input[name='password'], input[type='password']", credentials["password"])
            
            # Click login button
            login_button = page.locator("input[type='submit'][value='Log In']")
            await login_button.click()
            
            # Wait for login to complete
            await page.wait_for_load_state("networkidle", timeout=10000)
            await self._take_screenshot(session_id, "workfossa_logged_in")
            
            # Verify login success
            current_url = page.url
            if "login" in current_url.lower():
                raise Exception("Login failed - still on login page")
            
            await self._emit_progress(session_id, AutomationPhase.LOADING_VISIT, 30, "Login successful")
            logger.info(f"Successfully logged into WorkFossa for session {session_id}")
            return True
            
        except Exception as e:
            await self._emit_progress(session_id, AutomationPhase.FAILED, 0, f"Login failed: {str(e)}")
            logger.error(f"WorkFossa login failed for session {session_id}: {e}")
            return False
    
    async def process_visit_automation(self, session_id: str, visit_url: str, 
                                     dispensers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process visit automation - main automation workflow"""
        try:
            page = self.pages.get(session_id)
            if not page:
                raise Exception(f"Session {session_id} not found")
            
            results = {
                "success": False,
                "dispensers_processed": 0,
                "dispensers_failed": 0,
                "errors": [],
                "screenshots": []
            }
            
            await self._emit_progress(session_id, AutomationPhase.LOADING_VISIT, 40, 
                                    f"Loading visit: {visit_url}")
            
            # Navigate to visit page
            await page.goto(visit_url, wait_until="networkidle")
            await self._take_screenshot(session_id, "visit_page_loaded")
            
            # Detect page structure and forms
            await self._emit_progress(session_id, AutomationPhase.DETECTING_FORM, 50, 
                                    "Analyzing page structure...")
            
            page_content = await page.content()
            form_fields = await FormFieldDetector.detect_form_fields(page)
            
            logger.info(f"Detected {len(form_fields)} form fields on visit page")
            
            # Process each dispenser
            for i, dispenser in enumerate(dispensers):
                try:
                    await self._emit_progress(session_id, AutomationPhase.FILLING_FORM, 
                                            50 + (40 * i / len(dispensers)),
                                            f"Processing dispenser {dispenser.get('dispenser_number', i+1)}",
                                            dispenser_id=str(i))
                    
                    # Detect fuel grades for this dispenser
                    fuel_grades = FuelGradeDetector.detect_fuel_grades(page_content, dispenser)
                    
                    # Fill form for this dispenser
                    success = await self._fill_dispenser_form(session_id, page, dispenser, fuel_grades, form_fields)
                    
                    if success:
                        results["dispensers_processed"] += 1
                    else:
                        results["dispensers_failed"] += 1
                        results["errors"].append(f"Failed to process dispenser {dispenser.get('dispenser_number')}")
                    
                except Exception as e:
                    logger.error(f"Error processing dispenser {i}: {e}")
                    results["dispensers_failed"] += 1
                    results["errors"].append(f"Dispenser {i} error: {str(e)}")
            
            # Submit the form
            if results["dispensers_processed"] > 0:
                await self._emit_progress(session_id, AutomationPhase.SUBMITTING, 90, "Submitting form...")
                await self._submit_form(session_id, page)
            
            await self._emit_progress(session_id, AutomationPhase.COMPLETED, 100, 
                                    f"Automation completed: {results['dispensers_processed']} dispensers processed")
            
            results["success"] = results["dispensers_processed"] > 0
            return results
            
        except Exception as e:
            await self._emit_progress(session_id, AutomationPhase.FAILED, 0, f"Automation failed: {str(e)}")
            logger.error(f"Visit automation failed for session {session_id}: {e}")
            results["errors"].append(str(e))
            return results
    
    async def _fill_dispenser_form(self, session_id: str, page: Page, dispenser: Dict[str, Any], 
                                  fuel_grades: List[FuelGrade], form_fields: List[FormField]) -> bool:
        """Fill form for a specific dispenser - core automation logic from V1"""
        try:
            dispenser_number = dispenser.get("dispenser_number", "1")
            
            # Fill dispenser number
            dispenser_field = next((f for f in form_fields if "dispenser" in f.field_id), None)
            if dispenser_field:
                await page.fill(dispenser_field.selector, dispenser_number)
            
            # Fill fuel grade information
            for grade in fuel_grades:
                try:
                    # Find fuel grade dropdown/field
                    grade_field = next((f for f in form_fields if "fuel" in f.field_id or "grade" in f.field_id), None)
                    if grade_field and grade_field.field_type == FormFieldType.DROPDOWN:
                        # Try to select the grade
                        await page.select_option(grade_field.selector, label=grade.name)
                    
                    # Fill octane if available
                    if grade.octane:
                        octane_field = next((f for f in form_fields if "octane" in f.field_id), None)
                        if octane_field:
                            await page.fill(octane_field.selector, str(grade.octane))
                    
                    # Fill standard test values (based on V1 logic)
                    await self._fill_standard_test_values(page, form_fields)
                    
                except Exception as e:
                    logger.warning(f"Error filling grade {grade.name}: {e}")
                    continue
            
            await self._take_screenshot(session_id, f"dispenser_{dispenser_number}_filled")
            return True
            
        except Exception as e:
            logger.error(f"Error filling dispenser form: {e}")
            return False
    
    async def _fill_standard_test_values(self, page: Page, form_fields: List[FormField]):
        """Fill standard test values based on V1 automation logic"""
        try:
            # Fill test date (today)
            date_field = next((f for f in form_fields if f.field_type == FormFieldType.DATE_INPUT), None)
            if date_field:
                today = datetime.now().strftime("%Y-%m-%d")
                await page.fill(date_field.selector, today)
            
            # Fill test time (current time)
            time_field = next((f for f in form_fields if f.field_type == FormFieldType.TIME_INPUT), None)
            if time_field:
                current_time = datetime.now().strftime("%H:%M")
                await page.fill(time_field.selector, current_time)
            
            # Fill temperature (70°F default)
            temp_field = next((f for f in form_fields if "temp" in f.field_id), None)
            if temp_field:
                await page.fill(temp_field.selector, "70")
            
            # Fill volume (5 gallons standard test)
            volume_field = next((f for f in form_fields if "volume" in f.field_id), None)
            if volume_field:
                await page.fill(volume_field.selector, "5.00")
            
            # Fill error amount (0.00 for passing test)
            error_field = next((f for f in form_fields if "error" in f.field_id), None)
            if error_field:
                await page.fill(error_field.selector, "0.00")
                
        except Exception as e:
            logger.warning(f"Error filling standard test values: {e}")
    
    async def _submit_form(self, session_id: str, page: Page) -> bool:
        """Submit the completed form"""
        try:
            # Look for submit button
            submit_selectors = [
                "button[type='submit']",
                "input[type='submit']",
                "button:has-text('Submit')",
                "button:has-text('Save')",
                "button:has-text('Complete')"
            ]
            
            for selector in submit_selectors:
                try:
                    submit_button = await page.query_selector(selector)
                    if submit_button:
                        await submit_button.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        await self._take_screenshot(session_id, "form_submitted")
                        return True
                except Exception:
                    continue
            
            logger.warning("No submit button found")
            return False
            
        except Exception as e:
            logger.error(f"Error submitting form: {e}")
            return False
    
    async def _take_screenshot(self, session_id: str, name: str) -> Optional[str]:
        """Take screenshot for debugging/documentation"""
        try:
            page = self.pages.get(session_id)
            if not page:
                return None
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{session_id}_{name}_{timestamp}.png"
            filepath = self.screenshots_dir / filename
            
            await page.screenshot(path=str(filepath), full_page=True)
            logger.debug(f"Screenshot saved: {filepath}")
            return str(filepath)
            
        except Exception as e:
            logger.warning(f"Failed to take screenshot: {e}")
            return None
    
    async def _emit_progress(self, session_id: str, phase: AutomationPhase, percentage: float, 
                           message: str, dispenser_id: Optional[str] = None, 
                           dispenser_title: Optional[str] = None, fuel_grades: List[str] = None):
        """Emit progress update to all registered callbacks"""
        progress = AutomationProgress(
            session_id=session_id,
            phase=phase,
            percentage=percentage,
            message=message,
            dispenser_id=dispenser_id,
            dispenser_title=dispenser_title,
            fuel_grades=fuel_grades or []
        )
        
        for callback in self.progress_callbacks:
            try:
                await callback(progress)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")
    
    def add_progress_callback(self, callback: Callable):
        """Add progress callback"""
        self.progress_callbacks.append(callback)
    
    def remove_progress_callback(self, callback: Callable):
        """Remove progress callback"""
        if callback in self.progress_callbacks:
            self.progress_callbacks.remove(callback)
    
    async def cleanup(self):
        """Cleanup browser automation resources"""
        try:
            # Close all contexts
            for context in self.contexts.values():
                await context.close()
            
            # Close browser
            if self.browser:
                await self.browser.close()
                self.browser = None  # Important: set to None after closing
            
            # Stop playwright
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None  # Important: set to None after stopping
            
            # Clear all session data
            self.contexts.clear()
            self.pages.clear()
            
            logger.info("Browser automation service cleaned up")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

# Global browser automation service instance
browser_automation = BrowserAutomationService()

# Testing function
async def test_browser_automation():
    """Test browser automation functionality"""
    print("🔄 Testing Browser Automation Service...")
    
    if not PLAYWRIGHT_AVAILABLE:
        print("❌ Playwright not available - install with: playwright install")
        return False
    
    try:
        # Initialize service
        success = await browser_automation.initialize()
        if not success:
            print("❌ Failed to initialize browser automation")
            return False
        
        print("✅ Browser automation service initialized")
        
        # Create test session
        session_id = "test_session_001"
        session_created = await browser_automation.create_session(session_id)
        if not session_created:
            print("❌ Failed to create test session")
            return False
        
        print(f"✅ Test session created: {session_id}")
        
        # Test basic navigation
        page = browser_automation.pages[session_id]
        await page.goto("https://example.com")
        title = await page.title()
        print(f"✅ Navigation test successful: {title}")
        
        # Close test session
        await browser_automation.close_session(session_id)
        print("✅ Test session closed")
        
        # Cleanup
        await browser_automation.cleanup()
        print("✅ Browser automation service cleaned up")
        
        print("🎉 Browser automation tests completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Browser automation test failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_browser_automation())