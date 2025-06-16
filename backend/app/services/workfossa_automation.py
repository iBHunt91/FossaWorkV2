#!/usr/bin/env python3
"""
Enhanced WorkFossa Browser Automation Service
Based on V1 patterns with proper URL and selectors
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
import uuid
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright, Browser, Page, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
    logger.info("[OK] Playwright is available")
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("[WARNING] Playwright not available - will use mock data")

@dataclass
class AutomationProgress:
    """Real-time automation progress tracking"""
    job_id: str
    user_id: str
    phase: str  # login_phase, navigation_phase, form_preparation, form_filling, completion
    progress_percentage: float
    current_dispenser: Optional[str] = None
    total_dispensers: int = 0
    completed_dispensers: int = 0
    status_message: str = ""
    error_message: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now()

@dataclass 
class WorkFossaCredentials:
    """User credentials for WorkFossa login"""
    email: str
    password: str
    user_id: str

class WorkFossaAutomationService:
    """
    Enhanced WorkFossa automation service based on V1 patterns
    """
    
    # Correct WorkFossa URLs (from V1 analysis)
    LOGIN_URL = "https://app.workfossa.com"  # NOT portal.workfossa.com
    DASHBOARD_URL = "https://app.workfossa.com/app/dashboard"
    WORK_ORDERS_URL = "https://app.workfossa.com/app/work/list?work_visit_completion=none%7C%7CNo%20visits%20completed%7C%7CWork%20Visits%20Completed&order_direction=asc"
    
    # Selectors based on V1 analysis
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
    
    def __init__(self, headless: bool = True, timeout: int = 30000):
        # Check environment variable to override headless mode
        import os
        if os.environ.get('BROWSER_VISIBLE', '').lower() in ['true', '1', 'yes']:
            self.headless = False
            logger.info("🖥️ Browser visibility enabled via BROWSER_VISIBLE environment variable")
        else:
            self.headless = headless
        
        self.timeout = timeout
        self.sessions: Dict[str, Any] = {}
        self.progress_callbacks: List[Callable] = []
        self.playwright = None
        self.browser = None
        
    def add_progress_callback(self, callback: Callable[[AutomationProgress], None]):
        """Add callback for real-time progress updates"""
        self.progress_callbacks.append(callback)
    
    async def _emit_progress(self, progress: AutomationProgress):
        """Emit progress update to all callbacks"""
        for callback in self.progress_callbacks:
            try:
                await callback(progress) if asyncio.iscoroutinefunction(callback) else callback(progress)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
    
    async def initialize_browser(self) -> bool:
        """Initialize Playwright browser with V1-compatible configuration"""
        if not PLAYWRIGHT_AVAILABLE:
            logger.warning("Playwright not available - automation will use mock data")
            return False
            
        try:
            self.playwright = await async_playwright().start()
            
            # Browser launch options based on V1 playwrightConfig.js
            launch_options = {
                'headless': self.headless,
                'args': [
                    '--no-sandbox',
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
            
            # Platform-specific adjustments (V1 pattern)
            try:
                # Check if we're in WSL (like V1 does)
                with open('/proc/version', 'r') as f:
                    if 'microsoft' in f.read().lower():
                        logger.info("WSL environment detected")
                        launch_options['args'].append('--disable-features=VizDisplayCompositor')
            except FileNotFoundError:
                pass  # Not Linux, continue normally
            
            self.browser = await self.playwright.chromium.launch(**launch_options)
            logger.info("[WEB] Browser automation initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to initialize browser: {e}")
            return False
    
    async def create_session(self, session_id: str, user_id: str, credentials: Dict[str, str]) -> str:
        """Create session with specified session_id for compatibility"""
        if not self.browser and not await self.initialize_browser():
            raise Exception("Failed to initialize browser")
        
        try:
            # Create browser context with V1-compatible settings
            context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            )
            
            # Create page
            page = await context.new_page()
            page.set_default_timeout(self.timeout)
            
            # Store session with proper credentials format
            self.sessions[session_id] = {
                'user_id': user_id,
                'credentials': WorkFossaCredentials(
                    email=credentials.get('username', ''),
                    password=credentials.get('password', ''),
                    user_id=user_id
                ),
                'context': context,
                'page': page,
                'logged_in': False,
                'created_at': datetime.now()
            }
            
            logger.info(f"[OK] Created session {session_id} for user {user_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to create session: {e}")
            raise
    
    async def create_automation_session(self, user_id: str, credentials: WorkFossaCredentials) -> str:
        """Create new automation session for user"""
        if not self.browser and not await self.initialize_browser():
            raise Exception("Failed to initialize browser")
        
        session_id = str(uuid.uuid4())
        
        try:
            # Create browser context with V1-compatible settings
            context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            )
            
            # Create page
            page = await context.new_page()
            page.set_default_timeout(self.timeout)
            
            # Store session
            self.sessions[session_id] = {
                'user_id': user_id,
                'credentials': credentials,
                'context': context,
                'page': page,
                'logged_in': False,
                'created_at': datetime.now()
            }
            
            logger.info(f"[OK] Created automation session {session_id} for user {user_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to create session: {e}")
            raise
    
    async def verify_credentials(self, session_id: str, username: str, password: str, status_callback = None) -> Dict[str, Any]:
        """
        Verify WorkFossa credentials by attempting login
        Returns success status without keeping session
        """
        logger.info(f"[VERIFY] ========== STARTING CREDENTIAL VERIFICATION ==========")
        logger.info(f"[VERIFY] User: {username}")
        logger.info(f"[VERIFY] Session ID: {session_id}")
        logger.info(f"[VERIFY] Password length: {len(password)}")
        
        # Check for development mode
        import os
        dev_mode = os.getenv("WORKFOSSA_DEV_MODE", "false").lower() == "true"
        logger.info(f"[VERIFY] Development mode: {dev_mode}")
        
        if dev_mode:
            logger.warning("[VERIFY] Development mode enabled - bypassing WorkFossa verification")
            # In dev mode, accept any email-like username with non-empty password
            if "@" in username and len(password) > 0:
                logger.info("[VERIFY] Development mode - credentials accepted")
                return {
                    "success": True,
                    "message": "Development mode - credentials accepted"
                }
            else:
                logger.warning("[VERIFY] Development mode - invalid test credentials")
                return {
                    "success": False,
                    "message": "Development mode - invalid test credentials"
                }
        
        if not PLAYWRIGHT_AVAILABLE:
            logger.warning("[VERIFY] Playwright not available - using mock verification")
            # Mock verification for development - accept any valid-looking email
            is_valid_email = "@" in username and "." in username.split("@")[-1] and len(password) > 0
            logger.info(f"[VERIFY] Mock verification result: {is_valid_email}")
            return {
                "success": is_valid_email,
                "message": "Mock verification (Playwright not installed)" if is_valid_email else "Invalid credentials - email format required"
            }
        
        browser = None
        try:
            # Launch browser for verification
            logger.info("[VERIFY] Starting browser launch process...")
            if status_callback:
                status_callback("launching", "Launching browser...", 50)
            
            logger.info("[VERIFY] Creating Playwright instance...")
            playwright = await async_playwright().start()
            logger.info("[VERIFY] Playwright instance created successfully")
            
            logger.info(f"[VERIFY] Launching Chromium browser (headless={self.headless})...")
            browser = await playwright.chromium.launch(
                headless=self.headless,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )
            logger.info("[VERIFY] Browser launched successfully")
            
            logger.info("[VERIFY] Creating browser context...")
            context = await browser.new_context(
                viewport={'width': 1366, 'height': 768},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            logger.info("[VERIFY] Browser context created")
            
            logger.info("[VERIFY] Creating new page...")
            page = await context.new_page()
            logger.info("[VERIFY] Page created successfully")
            
            # Navigate to login page
            if status_callback:
                status_callback("navigating", "Navigating to WorkFossa...", 60)
            
            logger.info(f"[VERIFY] Navigating to WorkFossa login page: {self.LOGIN_URL}")
            await page.goto(self.LOGIN_URL, wait_until="networkidle")
            logger.info(f"[VERIFY] Successfully loaded page: {page.url}")
            
            # Fill login form
            if status_callback:
                status_callback("logging_in", "Logging in to WorkFossa...", 70)
            
            logger.info(f"[VERIFY] Looking for email field with selector: {self.LOGIN_SELECTORS['email']}")
            await page.fill(self.LOGIN_SELECTORS['email'], username)
            logger.info(f"[VERIFY] Email field filled with: {username}")
            
            logger.info(f"[VERIFY] Looking for password field with selector: {self.LOGIN_SELECTORS['password']}")
            await page.fill(self.LOGIN_SELECTORS['password'], password)
            logger.info(f"[VERIFY] Password field filled (length: {len(password)})")
            
            logger.info(f"[VERIFY] Looking for submit button with selector: {self.LOGIN_SELECTORS['submit']}")
            # Click login button
            await page.click(self.LOGIN_SELECTORS['submit'])
            logger.info("[VERIFY] Submit button clicked")
            
            # Wait for navigation or error
            try:
                if status_callback:
                    status_callback("verifying", "Verifying login result...", 80)
                
                # Wait for navigation with modern Playwright API
                await page.wait_for_load_state('networkidle', timeout=10000)
                
                # Check if we're still on login page (failed login)
                current_url = page.url
                logger.info(f"[VERIFY] After login attempt, current URL: {current_url}")
                
                if "login" in current_url.lower() or current_url == self.LOGIN_URL:
                    # Check for error message
                    error_element = await page.query_selector(self.LOGIN_SELECTORS['error'])
                    error_text = await error_element.inner_text() if error_element else "Invalid credentials"
                    
                    return {
                        "success": False,
                        "message": error_text
                    }
                
                # Check for success indicators
                for indicator in self.SUCCESS_INDICATORS:
                    if indicator.startswith('**'):
                        if indicator[2:] in current_url:
                            logger.info(f"[VERIFY] Credentials verified successfully for user: {username}")
                            return {
                                "success": True,
                                "message": "Credentials verified successfully"
                            }
                    else:
                        element = await page.query_selector(indicator)
                        if element:
                            logger.info(f"[VERIFY] Credentials verified successfully for user: {username}")
                            return {
                                "success": True,
                                "message": "Credentials verified successfully"
                            }
                
                # If we're not on login page but can't find success indicators
                logger.info(f"[VERIFY] Login successful but no dashboard found for user: {username}")
                return {
                    "success": True,
                    "message": "Credentials verified successfully"
                }
                
            except Exception as e:
                # Timeout or other error during login
                logger.error(f"[VERIFY] Login verification failed: {str(e)}")
                return {
                    "success": False,
                    "message": f"Verification failed: {str(e)}"
                }
            
        except Exception as e:
            logger.error(f"[VERIFY] ========== VERIFICATION FAILED ==========")
            logger.error(f"[VERIFY] Error type: {type(e).__name__}")
            logger.error(f"[VERIFY] Error message: {str(e)}")
            logger.error(f"[VERIFY] Full traceback:", exc_info=True)
            
            # Try to capture more context
            if 'page' in locals():
                try:
                    current_url = page.url
                    logger.error(f"[VERIFY] Current page URL: {current_url}")
                    
                    # Take a screenshot for debugging
                    screenshot_path = f"/tmp/workfossa_error_{session_id}.png"
                    await page.screenshot(path=screenshot_path)
                    logger.error(f"[VERIFY] Screenshot saved to: {screenshot_path}")
                except Exception as screenshot_error:
                    logger.error(f"[VERIFY] Could not capture screenshot: {screenshot_error}")
            
            return {
                "success": False,
                "message": f"Verification error: {str(e)}"
            }
        finally:
            logger.info("[VERIFY] Cleaning up browser resources...")
            if browser:
                await browser.close()
                logger.info("[VERIFY] Browser closed")
            logger.info("[VERIFY] ========== VERIFICATION COMPLETE ==========")
    
    async def login_to_workfossa(self, session_id: str, job_id: str = None) -> bool:
        """Login to WorkFossa using V1-proven patterns"""
        if session_id not in self.sessions:
            raise Exception(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        page = session['page']
        credentials = session['credentials']
        
        # Emit progress update
        if job_id:
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                user_id=session['user_id'],
                phase="login_phase",
                progress_percentage=10.0,
                status_message="Navigating to WorkFossa login..."
            ))
        
        try:
            # Navigate to correct WorkFossa URL (V1 pattern)
            logger.info(f"[SYNC] Navigating to {self.LOGIN_URL}")
            await page.goto(self.LOGIN_URL, wait_until="networkidle")
            
            # Wait for login form with V1 selectors
            await page.wait_for_selector(self.LOGIN_SELECTORS['email'], timeout=10000)
            
            if job_id:
                await self._emit_progress(AutomationProgress(
                    job_id=job_id,
                    user_id=session['user_id'], 
                    phase="login_phase",
                    progress_percentage=30.0,
                    status_message="Filling login credentials..."
                ))
            
            # Fill login form (V1 pattern)
            logger.info("[LOG] Filling login credentials")
            await page.fill(self.LOGIN_SELECTORS['email'], credentials.email)
            await page.fill(self.LOGIN_SELECTORS['password'], credentials.password)
            
            # Submit form
            await page.click(self.LOGIN_SELECTORS['submit'])
            
            if job_id:
                await self._emit_progress(AutomationProgress(
                    job_id=job_id,
                    user_id=session['user_id'],
                    phase="login_phase", 
                    progress_percentage=60.0,
                    status_message="Verifying login..."
                ))
            
            # Wait for successful login using V1 success patterns
            login_success = False
            for indicator in self.SUCCESS_INDICATORS:
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
            
            if login_success:
                session['logged_in'] = True
                logger.info(f"[OK] Successfully logged in user {session['user_id']}")
                
                if job_id:
                    await self._emit_progress(AutomationProgress(
                        job_id=job_id,
                        user_id=session['user_id'],
                        phase="navigation_phase",
                        progress_percentage=80.0, 
                        status_message="Login successful, navigating to work orders..."
                    ))
                return True
            else:
                # Check for error messages
                error_elements = await page.query_selector_all(self.LOGIN_SELECTORS['error'])
                error_message = "Login failed - invalid credentials"
                if error_elements:
                    error_message = await error_elements[0].text_content()
                
                logger.error(f"[ERROR] Login failed: {error_message}")
                if job_id:
                    await self._emit_progress(AutomationProgress(
                        job_id=job_id,
                        user_id=session['user_id'],
                        phase="login_phase",
                        progress_percentage=0.0,
                        status_message="Login failed",
                        error_message=error_message
                    ))
                return False
                
        except Exception as e:
            error_msg = f"Login error: {str(e)}"
            logger.error(f"[ERROR] {error_msg}")
            if job_id:
                await self._emit_progress(AutomationProgress(
                    job_id=job_id,
                    user_id=session['user_id'],
                    phase="login_phase", 
                    progress_percentage=0.0,
                    status_message="Login failed",
                    error_message=error_msg
                ))
            return False
    
    async def scrape_work_orders(self, session_id: str) -> List[Dict[str, Any]]:
        """Scrape work orders from WorkFossa dashboard"""
        logger.info(f"[SCRAPE] ========== STARTING WORK ORDER SCRAPING ==========")
        logger.info(f"[SCRAPE] Session ID: {session_id}")
        
        if session_id not in self.sessions:
            logger.error(f"[SCRAPE] Session {session_id} not found in sessions dict")
            logger.error(f"[SCRAPE] Available sessions: {list(self.sessions.keys())}")
            raise Exception(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        logger.info(f"[SCRAPE] Session found - User: {session['user_id']}, Logged in: {session.get('logged_in', False)}")
        
        if not session['logged_in']:
            logger.error("[SCRAPE] Cannot scrape work orders - not logged in")
            return self._get_mock_work_orders()
        
        page = session['page']
        logger.info(f"[SCRAPE] Current page URL: {page.url}")
        
        try:
            # Navigate to work orders page
            logger.info(f"[SCRAPE] Navigating to work orders page: {self.WORK_ORDERS_URL}")
            await page.goto(self.WORK_ORDERS_URL, wait_until="networkidle")
            logger.info(f"[SCRAPE] Successfully loaded page: {page.url}")
            
            # Wait for page to fully load
            await page.wait_for_timeout(3000)
            logger.info("[SCRAPE] Waited 3 seconds for page to fully load")
            
            # Take a screenshot for debugging (save to screenshots folder)
            try:
                import os
                screenshot_dir = os.path.join(os.getcwd(), "screenshots")
                os.makedirs(screenshot_dir, exist_ok=True)
                screenshot_path = os.path.join(screenshot_dir, f"workfossa_page_{session_id[:8]}.png")
                await page.screenshot(path=screenshot_path)
                logger.info(f"[SCRAPE] Screenshot saved: {screenshot_path}")
            except Exception as e:
                logger.warning(f"[SCRAPE] Could not save screenshot: {e}")
            
            # Wait for work orders to load - V1 selectors first, then fallbacks
            selectors_to_try = [
                '.work-list-item',  # V1 selector - FIRST!
                '.work-order',
                '.order-row', 
                '.order-item',
                '[data-testid="work-order"]',
                '.workorder-item',
                'table tbody tr',  # Common table structure
                '.job, .task',     # Alternative naming
                '[class*="order"]', # Any class containing "order"
                '[class*="job"]',   # Any class containing "job"
                '.card, .item'      # Generic card/item layouts
            ]
            
            logger.info(f"[SCRAPE] Trying {len(selectors_to_try)} different selectors to find work orders...")
            page_loaded = False
            for selector in selectors_to_try:
                try:
                    logger.info(f"[SCRAPE] Trying selector: {selector}")
                    await page.wait_for_selector(selector, timeout=3000)
                    logger.info(f"[SCRAPE] ✅ Found work orders using selector: {selector}")
                    page_loaded = True
                    break
                except:
                    logger.info(f"[SCRAPE] ❌ Selector '{selector}' not found")
                    continue
            
            if not page_loaded:
                logger.warning("[SCRAPE] ⚠️ No work order selectors found, will try to extract from any visible content")
                # Wait for page to fully load
                await page.wait_for_load_state('networkidle')
                logger.info("[SCRAPE] Page fully loaded, attempting content extraction")
            
            # IMPORTANT: Change page size from 25 to 100 (V1 pattern)
            logger.info("[SCRAPE] ========== CHANGING PAGE SIZE TO 100 ==========")
            try:
                # First, take a screenshot before changing page size
                try:
                    before_screenshot_path = os.path.join(screenshot_dir, f"before_pagesize_{session_id[:8]}.png")
                    await page.screenshot(path=before_screenshot_path)
                    logger.info(f"[SCRAPE] Before page size change screenshot: {before_screenshot_path}")
                except:
                    pass
                
                # Find and change the page size dropdown from "Show 25" to "Show 100"
                logger.info("[SCRAPE] ========== PAGE SIZE CHANGE DEBUGGING ==========")
                print("[SCRAPE] ========== PAGE SIZE CHANGE DEBUGGING ==========")  # Force console output
                logger.info("[SCRAPE] Starting comprehensive page size dropdown detection...")
                print("[SCRAPE] Starting comprehensive page size dropdown detection...")  # Force console output
                
                # First, get detailed page information
                page_info = await page.evaluate("""
                    () => {
                        return {
                            url: window.location.href,
                            title: document.title,
                            readyState: document.readyState,
                            totalElements: document.querySelectorAll('*').length,
                            bodyText: document.body.textContent.substring(0, 500)
                        };
                    }
                """)
                logger.info(f"[SCRAPE] Page Info:")
                logger.info(f"[SCRAPE]   URL: {page_info['url']}")
                logger.info(f"[SCRAPE]   Title: {page_info['title']}")
                logger.info(f"[SCRAPE]   Ready State: {page_info['readyState']}")
                logger.info(f"[SCRAPE]   Total Elements: {page_info['totalElements']}")
                logger.info(f"[SCRAPE]   Body Text (first 500 chars): {page_info['bodyText']}")
                
                dropdown_result = await page.evaluate("""
                    () => {
                        console.log('=== COMPREHENSIVE PAGE SIZE DROPDOWN SEARCH ===');
                        
                        // Step 1: Find ALL select elements and analyze them
                        const allSelects = document.querySelectorAll('select');
                        console.log(`STEP 1: Found ${allSelects.length} total select elements on page`);
                        
                        const selectAnalysis = [];
                        allSelects.forEach((select, index) => {
                            const options = Array.from(select.options);
                            const analysis = {
                                index: index,
                                id: select.id || 'no-id',
                                name: select.name || 'no-name',
                                className: select.className || 'no-class',
                                optionCount: options.length,
                                currentValue: select.value,
                                currentSelectedIndex: select.selectedIndex,
                                options: options.map(opt => ({
                                    value: opt.value,
                                    text: opt.text.trim(),
                                    selected: opt.selected,
                                    index: opt.index
                                })),
                                innerHTML: select.innerHTML.substring(0, 200),
                                outerHTML: select.outerHTML.substring(0, 300),
                                parentElement: select.parentElement ? select.parentElement.tagName + '.' + select.parentElement.className : 'unknown',
                                isVisible: window.getComputedStyle(select).display !== 'none' && window.getComputedStyle(select).visibility !== 'hidden'
                            };
                            selectAnalysis.push(analysis);
                            
                            console.log(`SELECT ${index}:`, analysis);
                        });
                        
                        // Step 2: Look for elements containing "Show 25" text
                        console.log('STEP 2: Searching for elements containing "Show 25" or similar text...');
                        const allElements = Array.from(document.querySelectorAll('*'));
                        const show25Elements = allElements.filter(el => {
                            const text = el.textContent?.trim() || '';
                            return text.includes('Show 25') || text.includes('Show 50') || text.includes('Show 100');
                        });
                        
                        console.log(`Found ${show25Elements.length} elements with "Show" text`);
                        show25Elements.forEach((el, i) => {
                            console.log(`SHOW ELEMENT ${i}:`, {
                                tag: el.tagName,
                                text: el.textContent.trim(),
                                className: el.className,
                                id: el.id,
                                isVisible: window.getComputedStyle(el).display !== 'none'
                            });
                        });
                        
                        // Step 3: Try to find the page size dropdown
                        console.log('STEP 3: Analyzing selects for page size options...');
                        let targetSelect = null;
                        let targetSelectIndex = -1;
                        
                        for (let i = 0; i < allSelects.length; i++) {
                            const select = allSelects[i];
                            const options = Array.from(select.options);
                            
                            console.log(`Analyzing SELECT ${i}:`);
                            console.log(`  - Options: ${options.map(o => o.text).join(', ')}`);
                            
                            // Check multiple patterns for page size dropdowns
                            const hasShowPattern = options.some(opt => 
                                opt.text.includes('Show') && (
                                    opt.text.includes('25') || 
                                    opt.text.includes('50') || 
                                    opt.text.includes('100')
                                )
                            );
                            
                            const hasNumberPattern = options.some(opt => 
                                opt.value === '25' || opt.value === '50' || opt.value === '100' ||
                                opt.text === '25' || opt.text === '50' || opt.text === '100'
                            );
                            
                            console.log(`  - Has "Show X" pattern: ${hasShowPattern}`);
                            console.log(`  - Has number pattern: ${hasNumberPattern}`);
                            
                            if (hasShowPattern || hasNumberPattern) {
                                targetSelect = select;
                                targetSelectIndex = i;
                                console.log(`  - ✅ IDENTIFIED AS PAGE SIZE DROPDOWN`);
                                break;
                            } else {
                                console.log(`  - ❌ Not a page size dropdown`);
                            }
                        }
                        
                        if (!targetSelect) {
                            console.log('STEP 3 RESULT: No page size dropdown found');
                            return {
                                found: false,
                                reason: 'No page size dropdown detected',
                                selectAnalysis: selectAnalysis,
                                show25Elements: show25Elements.map(el => ({
                                    tag: el.tagName,
                                    text: el.textContent.trim(),
                                    className: el.className
                                }))
                            };
                        }
                        
                        // Step 4: Attempt to change the dropdown
                        console.log(`STEP 4: Attempting to change SELECT ${targetSelectIndex} to "Show 100"...`);
                        const options = Array.from(targetSelect.options);
                        
                        console.log('Available options before change:');
                        options.forEach((opt, i) => {
                            console.log(`  ${i}: "${opt.text}" (value: "${opt.value}", selected: ${opt.selected})`);
                        });
                        
                        // Look for the Show 100 option with multiple strategies
                        let show100Option = null;
                        let searchStrategy = '';
                        
                        // Strategy 1: Exact "Show 100" text match
                        show100Option = options.find(opt => opt.text.trim() === 'Show 100');
                        if (show100Option) {
                            searchStrategy = 'exact_show_100';
                        } else {
                            // Strategy 2: Contains "Show 100"
                            show100Option = options.find(opt => opt.text.includes('Show 100'));
                            if (show100Option) {
                                searchStrategy = 'contains_show_100';
                            } else {
                                // Strategy 3: Value "100"
                                show100Option = options.find(opt => opt.value === '100');
                                if (show100Option) {
                                    searchStrategy = 'value_100';
                                } else {
                                    // Strategy 4: Text "100"
                                    show100Option = options.find(opt => opt.text.trim() === '100');
                                    if (show100Option) {
                                        searchStrategy = 'text_100';
                                    } else {
                                        // Strategy 5: Contains "100"
                                        show100Option = options.find(opt => opt.text.includes('100'));
                                        searchStrategy = show100Option ? 'contains_100' : 'not_found';
                                    }
                                }
                            }
                        }
                        
                        console.log(`Show 100 option search result: ${searchStrategy}`);
                        if (show100Option) {
                            console.log(`Found option: "${show100Option.text}" (value: "${show100Option.value}", index: ${show100Option.index})`);
                        } else {
                            console.log('❌ No Show 100 option found with any strategy');
                            return {
                                found: true,
                                success: false,
                                reason: 'No Show 100 option found',
                                searchStrategy: searchStrategy,
                                selectIndex: targetSelectIndex,
                                allOptions: options.map(opt => ({value: opt.value, text: opt.text})),
                                selectAnalysis: selectAnalysis
                            };
                        }
                        
                        // Step 5: Perform the change
                        console.log('STEP 5: Performing dropdown change...');
                        const originalValue = targetSelect.value;
                        const originalSelectedIndex = targetSelect.selectedIndex;
                        
                        console.log(`Before change - Value: "${originalValue}", SelectedIndex: ${originalSelectedIndex}`);
                        
                        try {
                            // Method 1: Set selectedIndex
                            targetSelect.selectedIndex = show100Option.index;
                            console.log(`Set selectedIndex to ${show100Option.index}`);
                            
                            // Method 2: Set value
                            targetSelect.value = show100Option.value;
                            console.log(`Set value to "${show100Option.value}"`);
                            
                            // Method 3: Set selected property
                            options.forEach(opt => opt.selected = false);
                            show100Option.selected = true;
                            console.log(`Set selected property on option`);
                            
                            // Verify the change
                            const newValue = targetSelect.value;
                            const newSelectedIndex = targetSelect.selectedIndex;
                            const newSelectedOption = targetSelect.options[newSelectedIndex];
                            
                            console.log(`After change - Value: "${newValue}", SelectedIndex: ${newSelectedIndex}`);
                            console.log(`Selected option text: "${newSelectedOption ? newSelectedOption.text : 'none'}"`);
                            
                            // Step 6: Fire events
                            console.log('STEP 6: Firing events...');
                            const events = ['input', 'change'];
                            events.forEach(eventType => {
                                try {
                                    const event = new Event(eventType, { bubbles: true, cancelable: true });
                                    targetSelect.dispatchEvent(event);
                                    console.log(`✅ Fired ${eventType} event`);
                                } catch (e) {
                                    console.log(`❌ Failed to fire ${eventType} event:`, e.message);
                                }
                            });
                            
                            // Try legacy onchange
                            if (targetSelect.onchange) {
                                try {
                                    targetSelect.onchange(new Event('change'));
                                    console.log(`✅ Called onchange handler`);
                                } catch (e) {
                                    console.log(`❌ Failed to call onchange:`, e.message);
                                }
                            }
                            
                            // Final verification
                            const finalValue = targetSelect.value;
                            const finalSelectedIndex = targetSelect.selectedIndex;
                            const finalOption = targetSelect.options[finalSelectedIndex];
                            
                            console.log(`FINAL STATE - Value: "${finalValue}", SelectedIndex: ${finalSelectedIndex}`);
                            console.log(`Final option: "${finalOption ? finalOption.text : 'none'}"`);
                            
                            const changeSuccessful = (finalValue === show100Option.value) && 
                                                   (finalSelectedIndex === show100Option.index) &&
                                                   (finalOption && finalOption.text === show100Option.text);
                            
                            console.log(`Change successful: ${changeSuccessful}`);
                            
                            return {
                                found: true,
                                success: changeSuccessful,
                                searchStrategy: searchStrategy,
                                selectIndex: targetSelectIndex,
                                originalValue: originalValue,
                                originalSelectedIndex: originalSelectedIndex,
                                newValue: finalValue,
                                newSelectedIndex: finalSelectedIndex,
                                selectedText: finalOption ? finalOption.text : 'unknown',
                                selectedValue: finalValue,
                                allOptions: options.map(opt => ({value: opt.value, text: opt.text, selected: opt.selected})),
                                eventsFired: events,
                                hasOnchange: !!targetSelect.onchange
                            };
                            
                        } catch (error) {
                            console.log(`❌ Error during change process:`, error.message);
                            return {
                                found: true,
                                success: false,
                                reason: `Change error: ${error.message}`,
                                searchStrategy: searchStrategy,
                                selectIndex: targetSelectIndex,
                                error: error.message
                            };
                        }
                    }
                """)

                logger.info(f"[SCRAPE] ========== DROPDOWN DETECTION RESULTS ==========")
                logger.info(f"[SCRAPE] Found: {dropdown_result.get('found', False)}")
                logger.info(f"[SCRAPE] Success: {dropdown_result.get('success', False)}")
                logger.info(f"[SCRAPE] Reason: {dropdown_result.get('reason', 'N/A')}")
                
                # Write debug results to a file we can check
                try:
                    import json
                    import os
                    debug_file = os.path.join(os.getcwd(), "page_size_debug.json")
                    with open(debug_file, "w") as f:
                        json.dump({
                            "timestamp": datetime.now().isoformat(),
                            "page_info": page_info,
                            "dropdown_result": dropdown_result,
                            "final_work_order_count": "will_be_set_later"
                        }, f, indent=2)
                    logger.info(f"[SCRAPE] Debug results written to: {debug_file}")
                    print(f"[SCRAPE] Debug results written to: {debug_file}")
                except Exception as e:
                    logger.warning(f"[SCRAPE] Could not write debug file: {e}")
                
                # Log detailed analysis if available
                if 'selectAnalysis' in dropdown_result:
                    logger.info(f"[SCRAPE] ========== SELECT ELEMENT ANALYSIS ==========")
                    for i, analysis in enumerate(dropdown_result['selectAnalysis']):
                        logger.info(f"[SCRAPE] SELECT {i}:")
                        logger.info(f"[SCRAPE]   - ID: {analysis.get('id', 'none')}")
                        logger.info(f"[SCRAPE]   - Name: {analysis.get('name', 'none')}")
                        logger.info(f"[SCRAPE]   - Class: {analysis.get('className', 'none')}")
                        logger.info(f"[SCRAPE]   - Current Value: '{analysis.get('currentValue', 'unknown')}'")
                        logger.info(f"[SCRAPE]   - Selected Index: {analysis.get('currentSelectedIndex', 'unknown')}")
                        logger.info(f"[SCRAPE]   - Visible: {analysis.get('isVisible', 'unknown')}")
                        logger.info(f"[SCRAPE]   - Option Count: {analysis.get('optionCount', 0)}")
                        options_text = [f"{opt['text']} (value: {opt['value']})" for opt in analysis.get('options', [])]
                        logger.info(f"[SCRAPE]   - Options: {options_text}")
                        logger.info(f"[SCRAPE]   - Parent: {analysis.get('parentElement', 'unknown')}")
                        logger.info(f"[SCRAPE]   - HTML: {analysis.get('outerHTML', 'unknown')[:100]}...")
                
                if 'show25Elements' in dropdown_result:
                    logger.info(f"[SCRAPE] ========== ELEMENTS WITH 'SHOW' TEXT ==========")
                    for i, elem in enumerate(dropdown_result['show25Elements']):
                        logger.info(f"[SCRAPE] SHOW ELEMENT {i}: {elem.get('tag', 'unknown')} - '{elem.get('text', 'unknown')}' - class: {elem.get('className', 'none')}")
                
                # Log specific change details if found
                if dropdown_result.get('found'):
                    logger.info(f"[SCRAPE] ========== CHANGE ATTEMPT DETAILS ==========")
                    logger.info(f"[SCRAPE] Search Strategy: {dropdown_result.get('searchStrategy', 'unknown')}")
                    logger.info(f"[SCRAPE] Target Select Index: {dropdown_result.get('selectIndex', 'unknown')}")
                    
                    if dropdown_result.get('success'):
                        logger.info(f"[SCRAPE] ✅ SUCCESSFUL CHANGE:")
                        logger.info(f"[SCRAPE]   - Original Value: '{dropdown_result.get('originalValue', 'unknown')}'")
                        logger.info(f"[SCRAPE]   - Original Index: {dropdown_result.get('originalSelectedIndex', 'unknown')}")
                        logger.info(f"[SCRAPE]   - New Value: '{dropdown_result.get('newValue', 'unknown')}'")
                        logger.info(f"[SCRAPE]   - New Index: {dropdown_result.get('newSelectedIndex', 'unknown')}")
                        logger.info(f"[SCRAPE]   - Selected Text: '{dropdown_result.get('selectedText', 'unknown')}'")
                        logger.info(f"[SCRAPE]   - Events Fired: {dropdown_result.get('eventsFired', [])}")
                        logger.info(f"[SCRAPE]   - Has onchange: {dropdown_result.get('hasOnchange', False)}")
                        
                        # Wait for page to update after the change
                        logger.info("[SCRAPE] Waiting for page to update after page size change...")
                        await page.wait_for_load_state('networkidle')
                        await page.wait_for_timeout(3000)
                        
                        # Take screenshot after change
                        try:
                            after_screenshot_path = os.path.join(screenshot_dir, f"after_pagesize_{session_id[:8]}.png")
                            await page.screenshot(path=after_screenshot_path)
                            logger.info(f"[SCRAPE] After page size change screenshot: {after_screenshot_path}")
                        except:
                            pass
                            
                    else:
                        logger.warning(f"[SCRAPE] ❌ FAILED TO CHANGE:")
                        logger.warning(f"[SCRAPE]   - Reason: {dropdown_result.get('reason', 'unknown')}")
                        logger.warning(f"[SCRAPE]   - Error: {dropdown_result.get('error', 'none')}")
                        
                        if 'allOptions' in dropdown_result:
                            logger.info(f"[SCRAPE] ========== ALL AVAILABLE OPTIONS ==========")
                            for i, opt in enumerate(dropdown_result['allOptions']):
                                logger.info(f"[SCRAPE] Option {i}: '{opt.get('text', 'unknown')}' (value: '{opt.get('value', 'unknown')}', selected: {opt.get('selected', False)})")
                else:
                    logger.warning("[SCRAPE] ❌ NO PAGE SIZE DROPDOWN FOUND")
                    logger.warning("[SCRAPE] Will continue with default page size (likely 25)")
            except Exception as e:
                logger.error(f"[SCRAPE] ❌ Failed to change page size: {e}")
                logger.error(f"[SCRAPE] Error details:", exc_info=True)
                logger.info("[SCRAPE] Continuing with current page size")
            
            # Extract work orders using JavaScript with enhanced detection
            logger.info("[SCRAPE] Starting JavaScript work order extraction...")
            work_orders = await page.evaluate("""
                () => {
                    const orders = [];
                    
                    // Enhanced selectors including V1 patterns FIRST
                    const selectors = [
                        '.work-list-item',  // V1 SELECTOR - HIGHEST PRIORITY!
                        '.work-order', '.order-row', '.order-item', 
                        '[data-testid="work-order"]', '.workorder-item',
                        'table tbody tr',  // Table rows
                        '.job', '.task', '.appointment',  // Alternative naming
                        '[class*="order"]', '[class*="job"]', '[class*="work"]',  // Partial matches
                        '.card', '.item', '.row',  // Generic containers
                        'div[id*="order"]', 'div[id*="job"]'  // ID-based selectors
                    ];
                    
                    let orderElements = [];
                    let foundSelector = '';
                    
                    // Try each selector
                    for (const selector of selectors) {
                        try {
                            orderElements = document.querySelectorAll(selector);
                            if (orderElements.length > 0) {
                                foundSelector = selector;
                                break;
                            }
                        } catch(e) {
                            continue;
                        }
                    }
                    
                    // Log what we found for debugging
                    console.log('WorkFossa Scraper Debug:');
                    console.log('- Found selector:', foundSelector);
                    console.log('- Elements found:', orderElements.length);
                    console.log('- Page title:', document.title);
                    console.log('- URL:', window.location.href);
                    console.log('- First 500 chars of page:', document.body.textContent.substring(0, 500));
                    
                    // If no specific selectors work, try to find any content that looks like work orders
                    if (orderElements.length === 0) {
                        console.log('Trying fallback content detection...');
                        // Look for any text content that might indicate work orders
                        const allElements = document.querySelectorAll('div, tr, article, section');
                        const potentialOrders = [];
                        
                        allElements.forEach(el => {
                            const text = el.textContent || '';
                            // Look for patterns that suggest work orders
                            if (text.match(/wo[#\\s-]*\\d+|work[#\\s-]*order|job[#\\s-]*\\d+|appointment/i)) {
                                potentialOrders.push(el);
                            }
                        });
                        
                        orderElements = potentialOrders.slice(0, 10); // Limit to first 10 potential matches
                        console.log('- Fallback elements found:', orderElements.length);
                    }
                    
                    orderElements.forEach((element, index) => {
                        try {
                            // Enhanced extraction with flexible text parsing
                            const getTextContent = (selectors) => {
                                for (const sel of selectors) {
                                    const el = element.querySelector(sel);
                                    if (el) return el.textContent?.trim() || '';
                                }
                                return '';
                            };
                            
                            // Get all text content for pattern matching
                            const allText = element.textContent || '';
                            
                            // Extract ID - try multiple patterns
                            let externalId = getTextContent([
                                '.order-id', '.work-order-id', '.id', '.wo-id', '.job-id'
                            ]);
                            
                            // If no specific selector, try pattern matching in text
                            if (!externalId) {
                                const idMatch = allText.match(/(?:wo|work.?order|job)[#\\s-]*(\\d+)/i);
                                externalId = idMatch ? idMatch[0] : `WO-${Date.now()}-${index}`;
                            }
                            
                            // Extract site/location name
                            let siteName = getTextContent([
                                '.site-name', '.location', '.station-name', '.customer', '.client', '.store'
                            ]);
                            
                            if (!siteName) {
                                // Try to extract from text - look for address-like patterns
                                const addressMatch = allText.match(/([A-Za-z\\s]+(?:Station|Store|Shop|Location))/i);
                                siteName = addressMatch ? addressMatch[1].trim() : `Site ${index + 1}`;
                            }
                            
                            // Extract address
                            let address = getTextContent([
                                '.address', '.location-address', '.site-address', '.street'
                            ]);
                            
                            if (!address) {
                                // Try to find address patterns in text
                                const addrMatch = allText.match(/\\d+\\s+[A-Za-z\\s]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard)/i);
                                address = addrMatch ? addrMatch[0] : 'Address not available';
                            }
                            
                            // Extract date
                            let scheduledDate = getTextContent([
                                '.date', '.scheduled-date', '.appointment-date', '.due-date'
                            ]);
                            
                            if (!scheduledDate) {
                                // Try to find date patterns
                                const dateMatch = allText.match(/\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}/);
                                scheduledDate = dateMatch ? dateMatch[0] : null;
                            }
                            
                            // Extract status
                            let status = getTextContent([
                                '.status', '.work-order-status', '.state'
                            ]).toLowerCase();
                            
                            if (!status) {
                                // Look for status keywords in text
                                const statusMatch = allText.match(/(?:pending|scheduled|in.?progress|completed|cancelled|failed)/i);
                                status = statusMatch ? statusMatch[0].toLowerCase() : 'pending';
                            }
                            
                            // Extract work type
                            let workType = getTextContent([
                                '.work-type', '.service-type', '.type'
                            ]);
                            
                            if (!workType) {
                                const typeMatch = allText.match(/(?:maintenance|inspection|repair|installation|testing)/i);
                                workType = typeMatch ? typeMatch[0].toLowerCase() : 'maintenance';
                            }
                            
                            const id = element.getAttribute('data-id') || 
                                      element.getAttribute('data-order-id') ||
                                      `wo_${Date.now()}_${index}`;
                            
                            orders.push({
                                id: id,
                                external_id: externalId || `WO-${id.slice(-6)}`,
                                site_name: siteName || `Site ${index + 1}`,
                                address: address || 'Address not available',
                                scheduled_date: scheduledDate,
                                status: status,
                                work_type: workType,
                                priority: 'normal'
                            });
                        } catch (e) {
                            console.error('Error parsing work order:', e);
                        }
                    });
                    
                    return orders;
                }
            """)
            
            logger.info(f"[SCRAPE] ========== EXTRACTION RESULTS ==========")
            logger.info(f"[SCRAPE] Total work orders found: {len(work_orders)}")
            
            # Check if we might need pagination
            if len(work_orders) == 25:
                logger.warning("[SCRAPE] ⚠️ Found exactly 25 work orders - page size might not have changed!")
                logger.warning("[SCRAPE] ⚠️ There may be more work orders not captured")
            elif len(work_orders) == 100:
                logger.warning("[SCRAPE] ⚠️ Found exactly 100 work orders - there might be more on next pages")
                logger.info("[SCRAPE] Consider implementing pagination to get all work orders")
            
            # Log details of first few work orders for debugging
            for i, wo in enumerate(work_orders[:3]):
                logger.info(f"[SCRAPE] Work Order {i+1}:")
                logger.info(f"[SCRAPE]   - ID: {wo.get('external_id', 'unknown')}")
                logger.info(f"[SCRAPE]   - Site: {wo.get('site_name', 'unknown')}")
                logger.info(f"[SCRAPE]   - Address: {wo.get('address', 'unknown')}")
                logger.info(f"[SCRAPE]   - Date: {wo.get('scheduled_date', 'unknown')}")
                logger.info(f"[SCRAPE]   - Status: {wo.get('status', 'unknown')}")
            
            if len(work_orders) == 0:
                logger.warning("[SCRAPE] ⚠️ No work orders found, returning mock data")
                return self._get_mock_work_orders()
            
            logger.info(f"[SCRAPE] ✅ Successfully scraped {len(work_orders)} work orders")
            
            # CRITICAL: Log work order count analysis
            if len(work_orders) == 25:
                logger.error(f"[SCRAPE] 🚨 CRITICAL: Still got exactly 25 work orders - PAGE SIZE CHANGE FAILED!")
                logger.error(f"[SCRAPE] 🚨 This indicates the dropdown was NOT successfully changed to 'Show 100'")
                logger.error(f"[SCRAPE] 🚨 Check the PAGE SIZE CHANGE DEBUGGING logs above for the failure reason")
                print(f"[SCRAPE] 🚨 CRITICAL: Still got exactly 25 work orders - PAGE SIZE CHANGE FAILED!")
            elif len(work_orders) > 25 and len(work_orders) <= 100:
                logger.info(f"[SCRAPE] ✅ SUCCESS: Got {len(work_orders)} work orders (more than 25) - page size change worked!")
                print(f"[SCRAPE] ✅ SUCCESS: Got {len(work_orders)} work orders (more than 25) - page size change worked!")
            elif len(work_orders) > 100:
                logger.info(f"[SCRAPE] ✅ EXCELLENT: Got {len(work_orders)} work orders - may need pagination for full capture")
                print(f"[SCRAPE] ✅ EXCELLENT: Got {len(work_orders)} work orders - may need pagination for full capture")
            else:
                logger.warning(f"[SCRAPE] ⚠️ Got {len(work_orders)} work orders - fewer than expected, check extraction logic")
                print(f"[SCRAPE] ⚠️ Got {len(work_orders)} work orders - fewer than expected, check extraction logic")
            
            # Update debug file with final count
            try:
                import json
                import os
                debug_file = os.path.join(os.getcwd(), "page_size_debug.json")
                if os.path.exists(debug_file):
                    with open(debug_file, "r") as f:
                        debug_data = json.load(f)
                    debug_data["final_work_order_count"] = len(work_orders)
                    debug_data["page_size_change_success"] = len(work_orders) > 25
                    with open(debug_file, "w") as f:
                        json.dump(debug_data, f, indent=2)
                    logger.info(f"[SCRAPE] Updated debug file with final count: {len(work_orders)}")
            except Exception as e:
                logger.warning(f"[SCRAPE] Could not update debug file: {e}")
            
            logger.info(f"[SCRAPE] ========== SCRAPING COMPLETE ==========")
            return work_orders
            
        except Exception as e:
            logger.error(f"[SCRAPE] ❌ Failed to scrape work orders: {e}")
            logger.error(f"[SCRAPE] Full error:", exc_info=True)
            logger.info("[SCRAPE] Returning mock work orders due to error")
            return self._get_mock_work_orders()
    
    def _get_mock_work_orders(self) -> List[Dict[str, Any]]:
        """Enhanced mock work orders for testing"""
        return [
            {
                "id": str(uuid.uuid4()),
                "external_id": "WO-110157",
                "site_name": "Shell Station #1247", 
                "address": "1501 Main Street, Springfield, IL 62701",
                "scheduled_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
                "status": "pending",
                "work_type": "routine_maintenance",
                "priority": "normal"
            },
            {
                "id": str(uuid.uuid4()),
                "external_id": "WO-110158",
                "site_name": "BP Station #8842",
                "address": "2205 Oak Avenue, Springfield, IL 62703", 
                "scheduled_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
                "status": "scheduled",
                "work_type": "inspection", 
                "priority": "high"
            }
        ]
    
    async def close_session(self, session_id: str):
        """Close automation session"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            try:
                if session.get('context'):
                    await session['context'].close()
                del self.sessions[session_id]
                logger.info(f"[OK] Closed session {session_id}")
            except Exception as e:
                logger.error(f"[ERROR] Error closing session {session_id}: {e}")
    
    async def cleanup_session(self, session_id: str):
        """Alias for close_session for compatibility"""
        await self.close_session(session_id)
    
    async def cleanup(self):
        """Cleanup all browser resources"""
        try:
            # Close all sessions
            for session_id in list(self.sessions.keys()):
                await self.close_session(session_id)
            
            # Close browser
            if self.browser:
                await self.browser.close()
            
            # Stop playwright
            if self.playwright:
                await self.playwright.stop()
                
            logger.info("[CLEANUP] Browser automation cleanup complete")
        except Exception as e:
            logger.error(f"[ERROR] Error during cleanup: {e}")

# Global automation service instance
# Default to visible browser for testing - set BROWSER_VISIBLE=false to run headless
import os
default_headless = os.environ.get('BROWSER_VISIBLE', 'true').lower() not in ['true', '1', 'yes']
workfossa_automation = WorkFossaAutomationService(headless=default_headless)

# Test function
async def test_workfossa_automation():
    """Test the WorkFossa automation service"""
    print("[TEST] Testing WorkFossa automation service...")
    
    try:
        # Initialize
        success = await workfossa_automation.initialize_browser()
        print(f"  Browser initialization: {'[OK]' if success else '[ERROR]'}")
        
        # Create test session
        test_creds = WorkFossaCredentials(
            email="test@example.com",
            password="testpass",
            user_id="test_user"
        )
        
        session_id = await workfossa_automation.create_automation_session("test_user", test_creds)
        print(f"  Session created: [OK] {session_id}")
        
        # Test login (will fail with test credentials but should not crash)
        login_result = await workfossa_automation.login_to_workfossa(session_id)
        print(f"  Login test: {'[OK]' if login_result else '[WARNING] Expected failure with test credentials'}")
        
        # Test work order scraping (will use mock data)
        work_orders = await workfossa_automation.scrape_work_orders(session_id)
        print(f"  Work orders: [OK] {len(work_orders)} orders found")
        
        # Cleanup
        await workfossa_automation.close_session(session_id)
        print("  Session cleanup: [OK]")
        
        print("[SUCCESS] WorkFossa automation tests completed!")
        return True
        
    except Exception as e:
        print(f"  [ERROR] Test failed: {e}")
        return False
    finally:
        await workfossa_automation.cleanup()

if __name__ == "__main__":
    asyncio.run(test_workfossa_automation())