#!/usr/bin/env python3
"""
Interactive Settings Page UI Test Script

This script provides step-by-step interactive testing of the Settings page.
Perfect for manual verification and debugging of UI issues.

Usage:
    python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/interactive_settings_page_test.py

Author: Claude Code Assistant
Date: 2025-01-26
"""

import asyncio
import sys
import os
from datetime import datetime
from playwright.async_api import async_playwright, Browser, Page, BrowserContext

# Color codes for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

class InteractiveSettingsTester:
    def __init__(self):
        self.browser: Browser = None
        self.context: BrowserContext = None
        self.page: Page = None
        self.console_errors = []
        self.page_errors = []
        
    async def wait_for_user(self, message: str = "Press Enter to continue..."):
        """Wait for user input before proceeding"""
        print(f"\n{Colors.YELLOW}⏸️  {message}{Colors.END}")
        await asyncio.get_event_loop().run_in_executor(None, input)

    async def setup_browser(self):
        """Initialize browser with visible window"""
        print(f"{Colors.BLUE}🔧 Setting up browser for interactive testing...{Colors.END}")
        print("  • Browser will open in visible mode")
        print("  • Console errors will be captured and displayed")
        print("  • You can interact with the page between test steps")
        
        await self.wait_for_user("Ready to launch browser?")
        
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=False,
            slow_mo=500,  # Slow down actions for visibility
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        self.context = await self.browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        self.page = await self.context.new_page()
        
        # Set up error capture
        self.page.on('console', self._handle_console)
        self.page.on('pageerror', self._handle_page_error)
        
        print(f"{Colors.GREEN}✅ Browser launched successfully{Colors.END}")

    def _handle_console(self, message):
        """Capture console messages"""
        msg_type = message.type
        text = message.text
        
        # Filter out expected auth/CORS errors
        skip_patterns = ['CORS', 'fetch', 'ERR_NETWORK', 'Authorization', '401', '403']
        
        if msg_type == 'error' and not any(pattern in text for pattern in skip_patterns):
            self.console_errors.append({
                'type': msg_type,
                'text': text,
                'timestamp': datetime.now().strftime("%H:%M:%S")
            })
            print(f"{Colors.RED}🚨 Console Error: {text}{Colors.END}")

    def _handle_page_error(self, error):
        """Handle uncaught page errors"""
        error_text = str(error)
        self.page_errors.append({
            'error': error_text,
            'timestamp': datetime.now().strftime("%H:%M:%S")
        })
        print(f"{Colors.RED}💥 Page Error: {error_text}{Colors.END}")

    async def navigate_to_settings(self):
        """Navigate to the settings page"""
        print(f"\n{Colors.BLUE}🧭 Step 1: Navigating to Settings Page{Colors.END}")
        print("  • URL: http://localhost:5175/settings")
        print("  • Waiting for page to load completely")
        
        await self.wait_for_user("Navigate to settings page?")
        
        try:
            await self.page.goto('http://localhost:5175/settings', wait_until='networkidle')
            await self.page.wait_for_timeout(2000)
            
            title = await self.page.title()
            url = self.page.url
            
            print(f"{Colors.GREEN}✅ Navigation successful{Colors.END}")
            print(f"   - Page Title: {title}")
            print(f"   - Current URL: {url}")
            
            await self.wait_for_user("Page loaded. Check the browser window. Continue to tab testing?")
            return True
            
        except Exception as e:
            print(f"{Colors.RED}❌ Navigation failed: {str(e)}{Colors.END}")
            return False

    async def test_tabs_interactively(self):
        """Test each tab with user interaction"""
        tabs = [
            {'name': 'Appearance', 'selector': 'button:has-text("Appearance")', 'icon': '🎨'},
            {'name': 'Notifications', 'selector': 'button:has-text("Notifications")', 'icon': '🔔'},
            {'name': 'Automation', 'selector': 'button:has-text("Automation")', 'icon': '🤖'},
            {'name': 'Filters & Data', 'selector': 'button:has-text("Filters")', 'icon': '📊'},
            {'name': 'Technical', 'selector': 'button:has-text("Technical")', 'icon': '⚙️'}
        ]
        
        print(f"\n{Colors.BLUE}📋 Step 2: Testing Settings Tabs{Colors.END}")
        print(f"  • Found {len(tabs)} tabs to test")
        print("  • Each tab will be clicked and examined")
        print("  • You can manually inspect each tab's content")
        
        for i, tab in enumerate(tabs, 1):
            await self._test_tab_interactive(tab, i, len(tabs))

    async def _test_tab_interactive(self, tab_info, tab_num, total_tabs):
        """Test individual tab with user interaction"""
        tab_name = tab_info['name']
        tab_selector = tab_info['selector']
        icon = tab_info['icon']
        
        print(f"\n{Colors.CYAN}{icon} Testing Tab {tab_num}/{total_tabs}: {tab_name}{Colors.END}")
        print(f"  • Selector: {tab_selector}")
        
        await self.wait_for_user(f"Ready to test {tab_name} tab?")
        
        try:
            # Try to find and click the tab
            print(f"  🖱️ Clicking {tab_name} tab...")
            await self.page.click(tab_selector)
            await self.page.wait_for_timeout(1000)
            
            print(f"{Colors.GREEN}  ✅ Tab clicked successfully{Colors.END}")
            
            # Check if content is visible
            await self._check_tab_content_interactive(tab_name)
            
            # Test form elements
            await self._test_form_elements_interactive(tab_name)
            
            print(f"  📊 {tab_name} tab testing complete")
            
            await self.wait_for_user(f"Inspect {tab_name} tab content. Continue to next tab?")
            
        except Exception as e:
            print(f"{Colors.RED}  ❌ Error testing {tab_name} tab: {str(e)}{Colors.END}")
            await self.wait_for_user("Tab failed. Continue anyway?")

    async def _check_tab_content_interactive(self, tab_name):
        """Check tab content with user feedback"""
        print(f"  🔍 Checking {tab_name} content visibility...")
        
        try:
            # Look for various content elements
            content_checks = [
                ('Forms', 'form, input, select, textarea'),
                ('Buttons', 'button'),
                ('Cards', '.card, [class*="card"]'),
                ('Text Content', 'p, h1, h2, h3, h4, h5, h6, span, div'),
                ('Lists', 'ul, ol, li')
            ]
            
            for content_type, selector in content_checks:
                elements = await self.page.query_selector_all(selector)
                visible_count = 0
                
                for element in elements:
                    if await element.is_visible():
                        visible_count += 1
                
                if visible_count > 0:
                    print(f"    ✅ {content_type}: {visible_count} visible elements")
                else:
                    print(f"    ⚠️ {content_type}: No visible elements")
            
        except Exception as e:
            print(f"    ❌ Content check error: {str(e)}")

    async def _test_form_elements_interactive(self, tab_name):
        """Test form elements with user interaction"""
        print(f"  🎛️ Testing form elements in {tab_name}...")
        
        try:
            # Find form elements
            inputs = await self.page.query_selector_all('input:visible')
            buttons = await self.page.query_selector_all('button:visible')
            selects = await self.page.query_selector_all('select:visible')
            
            print(f"    📝 Found {len(inputs)} inputs, {len(buttons)} buttons, {len(selects)} selects")
            
            # Test a couple inputs without modifying settings
            for i, input_elem in enumerate(inputs[:2]):
                try:
                    input_type = await input_elem.get_attribute('type')
                    placeholder = await input_elem.get_attribute('placeholder')
                    
                    print(f"    🔤 Input {i+1}: type={input_type}, placeholder='{placeholder}'")
                    
                    # Just focus to test accessibility
                    await input_elem.focus()
                    await self.page.wait_for_timeout(300)
                    
                    print(f"      ✅ Input {i+1} is focusable")
                    
                except Exception as e:
                    print(f"      ❌ Input {i+1} error: {str(e)}")
            
            # Check button accessibility
            for i, button in enumerate(buttons[:3]):
                try:
                    button_text = await button.inner_text()
                    is_disabled = await button.is_disabled()
                    
                    status = "disabled" if is_disabled else "enabled"
                    print(f"    🔘 Button {i+1}: '{button_text}' ({status})")
                    
                except Exception as e:
                    print(f"      ❌ Button {i+1} error: {str(e)}")
                    
        except Exception as e:
            print(f"    ❌ Form element test error: {str(e)}")

    async def test_responsive_interactive(self):
        """Test responsive design interactively"""
        print(f"\n{Colors.BLUE}📱 Step 3: Testing Responsive Design{Colors.END}")
        print("  • Will test different viewport sizes")
        print("  • You can observe layout changes")
        
        viewports = [
            {'name': 'Mobile Portrait', 'width': 375, 'height': 667},
            {'name': 'Tablet Portrait', 'width': 768, 'height': 1024},
            {'name': 'Desktop', 'width': 1280, 'height': 720},
            {'name': 'Large Desktop', 'width': 1920, 'height': 1080}
        ]
        
        for viewport in viewports:
            await self._test_viewport_interactive(viewport)

    async def _test_viewport_interactive(self, viewport):
        """Test viewport with user observation"""
        name = viewport['name']
        width = viewport['width']
        height = viewport['height']
        
        print(f"\n  📐 Testing {name} ({width}x{height})")
        
        await self.wait_for_user(f"Ready to resize to {name}?")
        
        try:
            await self.page.set_viewport_size({'width': width, 'height': height})
            await self.page.wait_for_timeout(1000)
            
            print(f"    🖥️ Resized to {width}x{height}")
            
            # Check for layout issues
            layout_info = await self._check_layout_interactive()
            
            if layout_info['overflow']:
                print(f"    ⚠️ Horizontal overflow detected")
            else:
                print(f"    ✅ No horizontal overflow")
            
            # Check tab accessibility
            tabs_visible = await self._check_tabs_visibility()
            if tabs_visible:
                print(f"    ✅ Tabs are visible and accessible")
            else:
                print(f"    ⚠️ Some tabs may not be visible")
            
            await self.wait_for_user(f"Observe {name} layout. Continue to next size?")
            
        except Exception as e:
            print(f"    ❌ Viewport test error: {str(e)}")

    async def _check_layout_interactive(self):
        """Check layout with detailed feedback"""
        try:
            layout_info = await self.page.evaluate('''
                () => {
                    const body = document.body;
                    const bodyWidth = body.scrollWidth;
                    const viewportWidth = window.innerWidth;
                    const bodyHeight = body.scrollHeight;
                    const viewportHeight = window.innerHeight;
                    
                    return {
                        bodyWidth,
                        viewportWidth,
                        bodyHeight,
                        viewportHeight,
                        overflow: bodyWidth > viewportWidth,
                        verticalOverflow: bodyHeight > viewportHeight
                    };
                }
            ''')
            
            print(f"      📏 Body: {layout_info['bodyWidth']}x{layout_info['bodyHeight']}")
            print(f"      📏 Viewport: {layout_info['viewportWidth']}x{layout_info['viewportHeight']}")
            
            return layout_info
            
        except Exception as e:
            print(f"      ❌ Layout check error: {str(e)}")
            return {'overflow': False}

    async def _check_tabs_visibility(self):
        """Check if tabs are still visible"""
        try:
            tabs = await self.page.query_selector_all('button[role="tab"], .tab-trigger, [data-tab]')
            visible_tabs = 0
            
            for tab in tabs:
                if await tab.is_visible():
                    visible_tabs += 1
            
            print(f"      👁️ Visible tabs: {visible_tabs}/{len(tabs)}")
            return visible_tabs == len(tabs)
            
        except Exception:
            return False

    async def test_console_errors(self):
        """Review captured console errors"""
        print(f"\n{Colors.BLUE}🚨 Step 4: Console Error Review{Colors.END}")
        
        if not self.console_errors and not self.page_errors:
            print(f"{Colors.GREEN}  ✅ No console errors or page errors detected!{Colors.END}")
        else:
            if self.console_errors:
                print(f"\n  📝 Console Errors ({len(self.console_errors)}):")
                for i, error in enumerate(self.console_errors, 1):
                    print(f"    {i}. [{error['timestamp']}] {error['text']}")
            
            if self.page_errors:
                print(f"\n  💥 Page Errors ({len(self.page_errors)}):")
                for i, error in enumerate(self.page_errors, 1):
                    print(f"    {i}. [{error['timestamp']}] {error['error']}")
        
        await self.wait_for_user("Error review complete. Continue to final tests?")

    async def test_search_interactive(self):
        """Test search functionality interactively"""
        print(f"\n{Colors.BLUE}🔍 Step 5: Search Functionality{Colors.END}")
        
        # Look for search inputs
        search_selectors = [
            'input[type="search"]',
            'input[placeholder*="search" i]',
            'input[placeholder*="filter" i]'
        ]
        
        search_found = False
        
        for selector in search_selectors:
            elements = await self.page.query_selector_all(selector)
            if elements:
                search_found = True
                print(f"  🔍 Found search input: {selector}")
                
                await self.wait_for_user("Test search functionality?")
                
                for i, element in enumerate(elements):
                    try:
                        placeholder = await element.get_attribute('placeholder')
                        print(f"    📝 Testing search input {i+1}: '{placeholder}'")
                        
                        await element.focus()
                        await element.fill('test search')
                        await self.page.wait_for_timeout(1000)
                        
                        value = await element.input_value()
                        if value == 'test search':
                            print(f"      ✅ Search input {i+1} accepts text")
                        else:
                            print(f"      ⚠️ Search input {i+1} value mismatch")
                        
                        # Clear search
                        await element.fill('')
                        await self.page.wait_for_timeout(500)
                        
                    except Exception as e:
                        print(f"      ❌ Search test error: {str(e)}")
        
        if not search_found:
            print(f"  ℹ️ No search functionality found in Settings page")

    async def final_assessment(self):
        """Provide final test assessment"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}🏁 FINAL ASSESSMENT{Colors.END}")
        print("=" * 50)
        
        # Summary statistics
        total_errors = len(self.console_errors) + len(self.page_errors)
        
        print(f"\n📊 Test Summary:")
        print(f"  • Console Errors: {len(self.console_errors)}")
        print(f"  • Page Errors: {len(self.page_errors)}")
        print(f"  • Total Issues: {total_errors}")
        
        # Overall assessment
        if total_errors == 0:
            print(f"\n{Colors.GREEN}🎉 EXCELLENT: No errors detected!{Colors.END}")
            print("  The Settings page appears to be functioning correctly.")
        elif total_errors <= 2:
            print(f"\n{Colors.YELLOW}👍 GOOD: Minor issues detected.{Colors.END}")
            print("  Most functionality is working with minimal errors.")
        else:
            print(f"\n{Colors.RED}⚠️ NEEDS ATTENTION: Multiple errors detected.{Colors.END}")
            print("  Review the errors above and fix critical issues.")
        
        print(f"\n📋 Recommendations:")
        print("  1. Check all console errors listed above")
        print("  2. Verify form validation is working correctly")
        print("  3. Test tab switching multiple times")
        print("  4. Ensure responsive design works on all devices")
        print("  5. Validate that settings save properly")
        
        await self.wait_for_user("Review complete. Close browser?")

    async def cleanup(self):
        """Clean up browser resources"""
        print(f"\n{Colors.BLUE}🧹 Cleaning up browser resources...{Colors.END}")
        
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        
        print(f"{Colors.GREEN}✅ Cleanup complete{Colors.END}")

    async def run_interactive_test(self):
        """Run the complete interactive test"""
        try:
            await self.setup_browser()
            
            if not await self.navigate_to_settings():
                print(f"{Colors.RED}❌ Cannot continue without successful navigation{Colors.END}")
                return
            
            await self.test_tabs_interactively()
            await self.test_responsive_interactive()
            await self.test_console_errors()
            await self.test_search_interactive()
            await self.final_assessment()
            
        except Exception as e:
            print(f"{Colors.RED}💥 Interactive test error: {str(e)}{Colors.END}")
        
        finally:
            await self.cleanup()

def main():
    """Main entry point"""
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("🧪 INTERACTIVE SETTINGS PAGE UI TEST")
    print("===================================")
    print("Step-by-step manual testing with browser interaction")
    print("Perfect for debugging and detailed inspection")
    print(f"{Colors.END}")
    
    print(f"\n{Colors.BLUE}ℹ️ Test Features:{Colors.END}")
    print("  • Visible browser window for real-time observation")
    print("  • Step-by-step progression with user control")
    print("  • Detailed error capture and reporting")
    print("  • Manual inspection opportunities")
    print("  • Responsive design testing")
    print("  • Form functionality verification")
    
    # Check prerequisites
    print(f"\n{Colors.YELLOW}📋 Prerequisites:{Colors.END}")
    print("  1. Frontend server running on http://localhost:5175")
    print("  2. Backend server running (for complete functionality)")
    print("  3. Playwright browser dependencies installed")
    
    try:
        input(f"\n{Colors.GREEN}Press Enter when ready to start testing...{Colors.END}")
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test cancelled by user{Colors.END}")
        return
    
    # Run the interactive test
    tester = InteractiveSettingsTester()
    
    try:
        asyncio.run(tester.run_interactive_test())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⏹️ Test interrupted by user{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}💥 Fatal error: {str(e)}{Colors.END}")
        sys.exit(1)

if __name__ == "__main__":
    main()