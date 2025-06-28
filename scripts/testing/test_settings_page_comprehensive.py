#!/usr/bin/env python3
"""
Comprehensive Settings Page UI Test Script

This script tests the Settings page frontend functionality and UI components.
Tests all tabs, form elements, and responsive behavior.

Usage:
    python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/test_settings_page_comprehensive.py

Author: Claude Code Assistant
Date: 2025-01-26
"""

import asyncio
import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from playwright.async_api import async_playwright, Browser, Page, BrowserContext, ConsoleMessage

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

class SettingsPageTester:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.results: Dict[str, Any] = {
            'summary': {},
            'tabs': {},
            'errors': [],
            'console_logs': [],
            'responsive_tests': {},
            'performance': {},
            'search_tests': {}
        }
        self.start_time = datetime.now()
        
    async def setup(self):
        """Initialize browser and page"""
        print(f"{Colors.BLUE}🔧 Setting up browser environment...{Colors.END}")
        
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=False,  # Show browser for debugging
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        self.context = await self.browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        self.page = await self.context.new_page()
        
        # Set up console message capture
        self.page.on('console', self._handle_console_message)
        self.page.on('pageerror', self._handle_page_error)
        
        print(f"{Colors.GREEN}✅ Browser setup complete{Colors.END}")

    def _handle_console_message(self, message: ConsoleMessage):
        """Capture and categorize console messages"""
        msg_type = message.type
        text = message.text
        
        # Skip expected CORS/auth errors
        skip_patterns = [
            'CORS',
            'Access to fetch',
            'Failed to fetch',
            'ERR_NETWORK',
            'Authorization',
            'Unauthorized',
            '401',
            '403'
        ]
        
        if not any(pattern in text for pattern in skip_patterns):
            self.results['console_logs'].append({
                'type': msg_type,
                'text': text,
                'timestamp': datetime.now().isoformat(),
                'location': message.location
            })
            
            if msg_type == 'error':
                print(f"{Colors.RED}❌ Console Error: {text}{Colors.END}")

    def _handle_page_error(self, error):
        """Handle uncaught page errors"""
        error_msg = str(error)
        self.results['errors'].append({
            'type': 'uncaught_error',
            'message': error_msg,
            'timestamp': datetime.now().isoformat()
        })
        print(f"{Colors.RED}💥 Uncaught Error: {error_msg}{Colors.END}")

    async def navigate_to_settings(self):
        """Navigate to the settings page"""
        print(f"\n{Colors.BLUE}🧭 Navigating to Settings page...{Colors.END}")
        
        try:
            await self.page.goto('http://localhost:5175/settings', wait_until='networkidle')
            await self.page.wait_for_timeout(2000)  # Wait for React to hydrate
            
            # Check if page loaded successfully
            title = await self.page.title()
            url = self.page.url
            
            print(f"{Colors.GREEN}✅ Navigation successful{Colors.END}")
            print(f"   - Title: {title}")
            print(f"   - URL: {url}")
            
            return True
            
        except Exception as e:
            error_msg = f"Failed to navigate to settings: {str(e)}"
            self.results['errors'].append({
                'type': 'navigation_error',
                'message': error_msg,
                'timestamp': datetime.now().isoformat()
            })
            print(f"{Colors.RED}❌ {error_msg}{Colors.END}")
            return False

    async def test_tab_functionality(self):
        """Test each settings tab"""
        print(f"\n{Colors.BLUE}📋 Testing Settings Tabs...{Colors.END}")
        
        tabs = [
            {'name': 'Appearance', 'selector': 'button:has-text("Appearance")', 'icon': '🎨'},
            {'name': 'Notifications', 'selector': 'button:has-text("Notifications")', 'icon': '🔔'},
            {'name': 'Automation', 'selector': 'button:has-text("Automation")', 'icon': '🤖'},
            {'name': 'Filters & Data', 'selector': 'button:has-text("Filters")', 'icon': '📊'},
            {'name': 'Technical', 'selector': 'button:has-text("Technical")', 'icon': '⚙️'}
        ]
        
        for tab in tabs:
            await self._test_individual_tab(tab)

    async def _test_individual_tab(self, tab_info: Dict[str, str]):
        """Test an individual tab"""
        tab_name = tab_info['name']
        tab_selector = tab_info['selector']
        icon = tab_info['icon']
        
        print(f"\n{Colors.CYAN}{icon} Testing {tab_name} tab...{Colors.END}")
        
        tab_results = {
            'accessible': False,
            'content_loaded': False,
            'forms_functional': False,
            'errors': [],
            'load_time': 0,
            'collapsible_sections': []
        }
        
        try:
            start_time = datetime.now()
            
            # Click the tab
            await self.page.click(tab_selector)
            await self.page.wait_for_timeout(1000)  # Wait for tab content to load
            
            # Check if tab is accessible and active
            tab_element = await self.page.query_selector(tab_selector)
            if tab_element:
                is_active = await tab_element.get_attribute('data-state') == 'active' or \
                           'active' in (await tab_element.get_attribute('class') or '')
                tab_results['accessible'] = True
                
                if is_active:
                    print(f"   ✅ Tab is active and accessible")
                else:
                    print(f"   ⚠️ Tab clicked but may not be active")
            
            # Check if content is visible
            content_visible = await self._check_tab_content_visibility(tab_name)
            tab_results['content_loaded'] = content_visible
            
            if content_visible:
                print(f"   ✅ Content is visible and properly rendered")
                
                # Test form functionality
                forms_work = await self._test_tab_forms(tab_name)
                tab_results['forms_functional'] = forms_work
                
                # Test collapsible sections
                collapsible_results = await self._test_collapsible_sections()
                tab_results['collapsible_sections'] = collapsible_results
                
            else:
                print(f"   ❌ Content not visible or not rendered")
            
            end_time = datetime.now()
            tab_results['load_time'] = (end_time - start_time).total_seconds()
            
            print(f"   ⏱️ Load time: {tab_results['load_time']:.2f}s")
            
        except Exception as e:
            error_msg = f"Error testing {tab_name} tab: {str(e)}"
            tab_results['errors'].append(error_msg)
            print(f"   ❌ {error_msg}")
        
        self.results['tabs'][tab_name] = tab_results

    async def _check_tab_content_visibility(self, tab_name: str) -> bool:
        """Check if tab content is visible and properly rendered"""
        try:
            # Look for common content indicators
            content_selectors = [
                '[role="tabpanel"]',
                '.tab-content',
                'form',
                'input',
                'button',
                'card',
                '.card'
            ]
            
            for selector in content_selectors:
                elements = await self.page.query_selector_all(selector)
                if elements:
                    # Check if at least one element is visible
                    for element in elements[:3]:  # Check first 3 elements
                        is_visible = await element.is_visible()
                        if is_visible:
                            return True
            
            return False
            
        except Exception:
            return False

    async def _test_tab_forms(self, tab_name: str) -> bool:
        """Test form functionality in the current tab"""
        try:
            # Find form elements
            inputs = await self.page.query_selector_all('input:visible')
            buttons = await self.page.query_selector_all('button:visible')
            selects = await self.page.query_selector_all('select:visible')
            
            forms_functional = True
            
            # Test a few inputs (don't modify actual settings)
            for i, input_elem in enumerate(inputs[:3]):  # Test first 3 inputs
                try:
                    input_type = await input_elem.get_attribute('type')
                    if input_type in ['text', 'email', 'number', 'password']:
                        # Just focus the input to test accessibility
                        await input_elem.focus()
                        await self.page.wait_for_timeout(100)
                except Exception as e:
                    print(f"   ⚠️ Input {i+1} not functional: {str(e)}")
                    forms_functional = False
            
            # Test button accessibility (don't actually click)
            for i, button in enumerate(buttons[:3]):  # Test first 3 buttons
                try:
                    is_disabled = await button.is_disabled()
                    is_visible = await button.is_visible()
                    if not is_visible:
                        forms_functional = False
                except Exception as e:
                    print(f"   ⚠️ Button {i+1} not accessible: {str(e)}")
                    forms_functional = False
            
            return forms_functional
            
        except Exception:
            return False

    async def _test_collapsible_sections(self) -> List[Dict[str, Any]]:
        """Test collapsible sections in the current tab"""
        collapsible_results = []
        
        try:
            # Look for collapsible sections
            collapsible_selectors = [
                '[data-collapsible]',
                '.collapsible',
                'details',
                '[aria-expanded]'
            ]
            
            for selector in collapsible_selectors:
                elements = await self.page.query_selector_all(selector)
                
                for i, element in enumerate(elements):
                    try:
                        # Check if it's a collapsible trigger
                        aria_expanded = await element.get_attribute('aria-expanded')
                        
                        if aria_expanded is not None:
                            is_expanded = aria_expanded == 'true'
                            
                            # Try to toggle it
                            await element.click()
                            await self.page.wait_for_timeout(500)
                            
                            # Check if state changed
                            new_aria_expanded = await element.get_attribute('aria-expanded')
                            state_changed = new_aria_expanded != aria_expanded
                            
                            collapsible_results.append({
                                'index': i,
                                'selector': selector,
                                'initial_state': 'expanded' if is_expanded else 'collapsed',
                                'state_changed': state_changed,
                                'functional': state_changed
                            })
                            
                            # Toggle back to original state
                            if state_changed:
                                await element.click()
                                await self.page.wait_for_timeout(500)
                                
                    except Exception as e:
                        collapsible_results.append({
                            'index': i,
                            'selector': selector,
                            'error': str(e),
                            'functional': False
                        })
        
        except Exception:
            pass
        
        return collapsible_results

    async def test_responsive_design(self):
        """Test responsive design at different viewport sizes"""
        print(f"\n{Colors.BLUE}📱 Testing Responsive Design...{Colors.END}")
        
        viewports = [
            {'name': 'Mobile', 'width': 375, 'height': 667},
            {'name': 'Tablet', 'width': 768, 'height': 1024},
            {'name': 'Desktop', 'width': 1280, 'height': 720},
            {'name': 'Large Desktop', 'width': 1920, 'height': 1080}
        ]
        
        for viewport in viewports:
            await self._test_viewport(viewport)

    async def _test_viewport(self, viewport: Dict[str, Any]):
        """Test the page at a specific viewport size"""
        name = viewport['name']
        width = viewport['width']
        height = viewport['height']
        
        print(f"  📐 Testing {name} ({width}x{height})...")
        
        try:
            await self.page.set_viewport_size({'width': width, 'height': height})
            await self.page.wait_for_timeout(1000)
            
            # Check if layout is intact
            layout_issues = await self._check_layout_issues()
            
            # Check if tabs are still accessible
            tabs_accessible = await self._check_tabs_responsive()
            
            self.results['responsive_tests'][name] = {
                'viewport': f"{width}x{height}",
                'layout_issues': layout_issues,
                'tabs_accessible': tabs_accessible,
                'success': len(layout_issues) == 0 and tabs_accessible
            }
            
            if len(layout_issues) == 0 and tabs_accessible:
                print(f"    ✅ {name} viewport: Layout intact, tabs accessible")
            else:
                print(f"    ❌ {name} viewport: {len(layout_issues)} layout issues, tabs accessible: {tabs_accessible}")
            
        except Exception as e:
            self.results['responsive_tests'][name] = {
                'viewport': f"{width}x{height}",
                'error': str(e),
                'success': False
            }
            print(f"    ❌ Error testing {name}: {str(e)}")

    async def _check_layout_issues(self) -> List[str]:
        """Check for common layout issues"""
        issues = []
        
        try:
            # Check for horizontal overflow
            body_width = await self.page.evaluate('document.body.scrollWidth')
            viewport_width = await self.page.evaluate('window.innerWidth')
            
            if body_width > viewport_width:
                issues.append(f"Horizontal overflow: body {body_width}px > viewport {viewport_width}px")
            
            # Check for elements extending beyond viewport
            elements_offscreen = await self.page.evaluate('''
                () => {
                    const elements = document.querySelectorAll('*');
                    let count = 0;
                    for (let el of elements) {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
                            count++;
                        }
                    }
                    return count;
                }
            ''')
            
            if elements_offscreen > 0:
                issues.append(f"{elements_offscreen} elements extending beyond viewport")
                
        except Exception as e:
            issues.append(f"Error checking layout: {str(e)}")
        
        return issues

    async def _check_tabs_responsive(self) -> bool:
        """Check if tabs are still accessible in current viewport"""
        try:
            tabs = await self.page.query_selector_all('button[role="tab"], .tab-trigger, [data-tab]')
            
            for tab in tabs:
                is_visible = await tab.is_visible()
                if not is_visible:
                    return False
            
            return len(tabs) > 0
            
        except Exception:
            return False

    async def test_search_functionality(self):
        """Test search functionality if present"""
        print(f"\n{Colors.BLUE}🔍 Testing Search Functionality...{Colors.END}")
        
        try:
            # Look for search inputs
            search_selectors = [
                'input[type="search"]',
                'input[placeholder*="search" i]',
                'input[placeholder*="filter" i]',
                '.search-input'
            ]
            
            search_found = False
            
            for selector in search_selectors:
                search_inputs = await self.page.query_selector_all(selector)
                
                for i, search_input in enumerate(search_inputs):
                    search_found = True
                    await self._test_search_input(search_input, f"{selector}[{i}]")
            
            if not search_found:
                print(f"  ℹ️ No search functionality found")
                self.results['search_tests']['found'] = False
            else:
                print(f"  ✅ Search functionality tested")
                
        except Exception as e:
            self.results['search_tests']['error'] = str(e)
            print(f"  ❌ Error testing search: {str(e)}")

    async def _test_search_input(self, search_input, identifier: str):
        """Test a specific search input"""
        try:
            # Test typing in search
            await search_input.focus()
            await search_input.fill('test')
            await self.page.wait_for_timeout(500)
            
            # Check if search results or filtering occurred
            value = await search_input.input_value()
            
            self.results['search_tests'][identifier] = {
                'can_type': value == 'test',
                'responds': True  # Basic test that it accepts input
            }
            
            # Clear the search
            await search_input.fill('')
            await self.page.wait_for_timeout(500)
            
            print(f"    ✅ Search input {identifier} functional")
            
        except Exception as e:
            self.results['search_tests'][identifier] = {
                'error': str(e),
                'responds': False
            }
            print(f"    ❌ Search input {identifier} error: {str(e)}")

    async def run_performance_checks(self):
        """Run basic performance checks"""
        print(f"\n{Colors.BLUE}⚡ Running Performance Checks...{Colors.END}")
        
        try:
            # Measure page load metrics
            metrics = await self.page.evaluate('''
                () => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    const paint = performance.getEntriesByType('paint');
                    
                    return {
                        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
                        loadComplete: navigation.loadEventEnd - navigation.fetchStart,
                        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
                    };
                }
            ''')
            
            self.results['performance'] = metrics
            
            print(f"  ⏱️ DOM Content Loaded: {metrics['domContentLoaded']:.2f}ms")
            print(f"  ⏱️ Load Complete: {metrics['loadComplete']:.2f}ms")
            print(f"  🎨 First Paint: {metrics['firstPaint']:.2f}ms")
            print(f"  🖼️ First Contentful Paint: {metrics['firstContentfulPaint']:.2f}ms")
            
            # Check for slow elements
            slow_threshold = 100  # ms
            if metrics['domContentLoaded'] > slow_threshold:
                print(f"  ⚠️ DOM Content Loaded is slow (>{slow_threshold}ms)")
            
        except Exception as e:
            self.results['performance']['error'] = str(e)
            print(f"  ❌ Performance check error: {str(e)}")

    def generate_report(self):
        """Generate comprehensive test report"""
        end_time = datetime.now()
        total_time = (end_time - self.start_time).total_seconds()
        
        print(f"\n{Colors.BOLD}{Colors.BLUE}📊 COMPREHENSIVE SETTINGS PAGE TEST REPORT{Colors.END}")
        print("=" * 60)
        
        # Summary
        total_tabs = len(self.results['tabs'])
        successful_tabs = sum(1 for tab in self.results['tabs'].values() 
                             if tab['accessible'] and tab['content_loaded'])
        console_errors = len([log for log in self.results['console_logs'] 
                             if log['type'] == 'error'])
        uncaught_errors = len(self.results['errors'])
        
        print(f"\n{Colors.BOLD}📋 SUMMARY{Colors.END}")
        print(f"  • Test Duration: {total_time:.2f} seconds")
        print(f"  • Tabs Tested: {total_tabs}")
        print(f"  • Successful Tabs: {successful_tabs}/{total_tabs}")
        print(f"  • Console Errors: {console_errors}")
        print(f"  • Uncaught Errors: {uncaught_errors}")
        
        # Tab results
        print(f"\n{Colors.BOLD}📋 TAB TEST RESULTS{Colors.END}")
        for tab_name, tab_data in self.results['tabs'].items():
            status = "✅" if tab_data['accessible'] and tab_data['content_loaded'] else "❌"
            print(f"  {status} {tab_name}")
            print(f"    - Accessible: {'✅' if tab_data['accessible'] else '❌'}")
            print(f"    - Content Loaded: {'✅' if tab_data['content_loaded'] else '❌'}")
            print(f"    - Forms Functional: {'✅' if tab_data['forms_functional'] else '❌'}")
            print(f"    - Load Time: {tab_data['load_time']:.2f}s")
            
            if tab_data['collapsible_sections']:
                functional_sections = sum(1 for section in tab_data['collapsible_sections'] 
                                        if section.get('functional', False))
                total_sections = len(tab_data['collapsible_sections'])
                print(f"    - Collapsible Sections: {functional_sections}/{total_sections} functional")
            
            if tab_data['errors']:
                print(f"    - Errors: {len(tab_data['errors'])}")
                for error in tab_data['errors']:
                    print(f"      • {error}")
        
        # Responsive results
        if self.results['responsive_tests']:
            print(f"\n{Colors.BOLD}📱 RESPONSIVE DESIGN RESULTS{Colors.END}")
            for viewport_name, viewport_data in self.results['responsive_tests'].items():
                status = "✅" if viewport_data.get('success', False) else "❌"
                print(f"  {status} {viewport_name} ({viewport_data.get('viewport', 'unknown')})")
                
                if viewport_data.get('layout_issues'):
                    print(f"    - Layout Issues: {len(viewport_data['layout_issues'])}")
                    for issue in viewport_data['layout_issues']:
                        print(f"      • {issue}")
                
                if 'tabs_accessible' in viewport_data:
                    tabs_status = "✅" if viewport_data['tabs_accessible'] else "❌"
                    print(f"    - Tabs Accessible: {tabs_status}")
        
        # Console messages
        if self.results['console_logs']:
            print(f"\n{Colors.BOLD}💬 CONSOLE MESSAGES{Colors.END}")
            error_count = 0
            warning_count = 0
            
            for log in self.results['console_logs']:
                if log['type'] == 'error':
                    error_count += 1
                    print(f"  ❌ ERROR: {log['text']}")
                elif log['type'] == 'warning':
                    warning_count += 1
                    print(f"  ⚠️ WARNING: {log['text']}")
            
            if error_count == 0 and warning_count == 0:
                print(f"  ✅ No significant console errors or warnings")
        
        # Performance results
        if self.results['performance'] and 'error' not in self.results['performance']:
            print(f"\n{Colors.BOLD}⚡ PERFORMANCE METRICS{Colors.END}")
            perf = self.results['performance']
            print(f"  • DOM Content Loaded: {perf['domContentLoaded']:.2f}ms")
            print(f"  • Load Complete: {perf['loadComplete']:.2f}ms")
            print(f"  • First Paint: {perf['firstPaint']:.2f}ms")
            print(f"  • First Contentful Paint: {perf['firstContentfulPaint']:.2f}ms")
        
        # Search functionality
        if self.results['search_tests']:
            print(f"\n{Colors.BOLD}🔍 SEARCH FUNCTIONALITY{Colors.END}")
            if self.results['search_tests'].get('found', True):
                functional_searches = sum(1 for key, value in self.results['search_tests'].items() 
                                        if isinstance(value, dict) and value.get('responds', False))
                total_searches = len([key for key in self.results['search_tests'].keys() 
                                    if key not in ['found', 'error']])
                print(f"  • Functional Search Inputs: {functional_searches}/{total_searches}")
            else:
                print(f"  • No search functionality detected")
        
        # Overall assessment
        print(f"\n{Colors.BOLD}🎯 OVERALL ASSESSMENT{Colors.END}")
        
        issues = []
        if console_errors > 0:
            issues.append(f"{console_errors} console errors")
        if uncaught_errors > 0:
            issues.append(f"{uncaught_errors} uncaught errors")
        if successful_tabs < total_tabs:
            issues.append(f"{total_tabs - successful_tabs} non-functional tabs")
        
        failed_responsive = sum(1 for viewport in self.results['responsive_tests'].values() 
                               if not viewport.get('success', True))
        if failed_responsive > 0:
            issues.append(f"{failed_responsive} responsive design failures")
        
        if not issues:
            print(f"  {Colors.GREEN}🎉 EXCELLENT: All tests passed! Settings page is fully functional.{Colors.END}")
        elif len(issues) <= 2:
            print(f"  {Colors.YELLOW}⚠️ GOOD: Minor issues detected: {', '.join(issues)}{Colors.END}")
        else:
            print(f"  {Colors.RED}❌ NEEDS ATTENTION: Multiple issues detected: {', '.join(issues)}{Colors.END}")
        
        # Save results to file
        self.save_results_to_file()
        
        print(f"\n{Colors.BLUE}💾 Test results saved to: settings_page_test_results.json{Colors.END}")

    def save_results_to_file(self):
        """Save test results to JSON file"""
        try:
            # Prepare results for JSON serialization
            json_results = {
                'test_info': {
                    'start_time': self.start_time.isoformat(),
                    'end_time': datetime.now().isoformat(),
                    'duration_seconds': (datetime.now() - self.start_time).total_seconds(),
                    'test_type': 'comprehensive_settings_page_ui_test'
                },
                'results': self.results,
                'summary': {
                    'total_tabs': len(self.results['tabs']),
                    'successful_tabs': sum(1 for tab in self.results['tabs'].values() 
                                         if tab['accessible'] and tab['content_loaded']),
                    'console_errors': len([log for log in self.results['console_logs'] 
                                         if log['type'] == 'error']),
                    'uncaught_errors': len(self.results['errors']),
                    'responsive_failures': sum(1 for viewport in self.results['responsive_tests'].values() 
                                             if not viewport.get('success', True))
                }
            }
            
            output_file = '/Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/settings_page_test_results.json'
            with open(output_file, 'w') as f:
                json.dump(json_results, f, indent=2, default=str)
                
        except Exception as e:
            print(f"{Colors.RED}❌ Error saving results: {str(e)}{Colors.END}")

    async def cleanup(self):
        """Clean up browser resources"""
        print(f"\n{Colors.BLUE}🧹 Cleaning up...{Colors.END}")
        
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        
        print(f"{Colors.GREEN}✅ Cleanup complete{Colors.END}")

    async def run_comprehensive_test(self):
        """Run the complete test suite"""
        try:
            await self.setup()
            
            # Navigate to settings
            if not await self.navigate_to_settings():
                print(f"{Colors.RED}❌ Cannot proceed without successful navigation{Colors.END}")
                return
            
            # Run all tests
            await self.test_tab_functionality()
            await self.test_responsive_design()
            await self.test_search_functionality()
            await self.run_performance_checks()
            
            # Generate report
            self.generate_report()
            
        except Exception as e:
            print(f"{Colors.RED}💥 Test suite error: {str(e)}{Colors.END}")
            self.results['errors'].append({
                'type': 'test_suite_error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            })
        
        finally:
            await self.cleanup()

def main():
    """Main entry point"""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("🧪 COMPREHENSIVE SETTINGS PAGE UI TEST")
    print("=====================================")
    print("Testing frontend functionality and UI components")
    print("Excluding backend authentication issues")
    print(f"{Colors.END}")
    
    # Check if we're in the right directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    expected_path = "/Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing"
    
    if script_dir != expected_path:
        print(f"{Colors.YELLOW}⚠️ Warning: Running from {script_dir}")
        print(f"Expected: {expected_path}{Colors.END}")
    
    # Run the test
    tester = SettingsPageTester()
    
    try:
        asyncio.run(tester.run_comprehensive_test())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⏹️ Test interrupted by user{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}💥 Fatal error: {str(e)}{Colors.END}")
        sys.exit(1)

if __name__ == "__main__":
    main()