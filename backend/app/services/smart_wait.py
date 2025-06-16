#!/usr/bin/env python3
"""
Smart wait utilities for intelligent page readiness detection
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from playwright.async_api import Page

logger = logging.getLogger(__name__)


class SmartWait:
    """Intelligent wait conditions for web automation"""
    
    @staticmethod
    async def wait_for_page_idle(page: Page, timeout: int = 10000) -> bool:
        """
        Wait for page to be truly idle by checking multiple signals
        Returns True if page is ready, False if timeout
        """
        try:
            # First, inject our monitoring if not already done
            await page.evaluate("""
                () => {
                    if (!window.__smartWaitMonitor) {
                        window.__smartWaitMonitor = {
                            requestCount: 0,
                            lastMutation: Date.now(),
                            initialized: true
                        };
                        
                        // Monitor fetch/XHR
                        const originalFetch = window.fetch;
                        window.fetch = function() {
                            window.__smartWaitMonitor.requestCount++;
                            return originalFetch.apply(this, arguments).finally(() => {
                                window.__smartWaitMonitor.requestCount--;
                            });
                        };
                        
                        // Monitor DOM mutations with debounce
                        const observer = new MutationObserver(() => {
                            window.__smartWaitMonitor.lastMutation = Date.now();
                        });
                        
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true,
                            attributes: true,
                            attributeFilter: ['class', 'style', 'hidden']
                        });
                    }
                }
            """)
            
            # Wait for page to be idle
            await page.wait_for_function("""
                () => {
                    const monitor = window.__smartWaitMonitor;
                    if (!monitor) return false;
                    
                    // Check if requests are complete
                    if (monitor.requestCount > 0) return false;
                    
                    // Check jQuery if available
                    if (typeof jQuery !== 'undefined' && jQuery.active > 0) return false;
                    
                    // Check if DOM has been stable for 300ms
                    const timeSinceLastMutation = Date.now() - monitor.lastMutation;
                    if (timeSinceLastMutation < 300) return false;
                    
                    // Check for loading indicators
                    const loadingElements = document.querySelectorAll(
                        '.loading, .spinner, [class*="load"], [aria-busy="true"]'
                    );
                    if (loadingElements.length > 0) return false;
                    
                    return true;
                }
            """, timeout=timeout)
            
            return True
            
        except Exception as e:
            logger.warning(f"Page idle wait timeout: {e}")
            return False
    
    @staticmethod
    async def wait_for_element_stable(page: Page, selector: str, timeout: int = 5000) -> bool:
        """
        Wait for an element to exist and be stable (no position/size changes)
        """
        try:
            # First wait for element to exist
            await page.wait_for_selector(selector, state='visible', timeout=timeout)
            
            # Then wait for it to be stable
            await page.wait_for_function("""
                (selector) => {
                    const element = document.querySelector(selector);
                    if (!element) return false;
                    
                    // Store initial position
                    if (!element.__stableCheck) {
                        const rect = element.getBoundingClientRect();
                        element.__stableCheck = {
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                            checkTime: Date.now()
                        };
                        return false;
                    }
                    
                    // Check if position is stable
                    const rect = element.getBoundingClientRect();
                    const check = element.__stableCheck;
                    
                    if (rect.top !== check.top || rect.left !== check.left ||
                        rect.width !== check.width || rect.height !== check.height) {
                        // Position changed, reset
                        check.top = rect.top;
                        check.left = rect.left;
                        check.width = rect.width;
                        check.height = rect.height;
                        check.checkTime = Date.now();
                        return false;
                    }
                    
                    // Position stable for 200ms
                    return (Date.now() - check.checkTime) > 200;
                }
            """, arg=selector, timeout=timeout)
            
            return True
            
        except Exception as e:
            logger.warning(f"Element stable wait timeout for {selector}: {e}")
            return False
    
    @staticmethod
    async def wait_for_content_change(page: Page, selector: str, timeout: int = 5000) -> bool:
        """
        Wait for content within a selector to change
        """
        try:
            # Get initial content
            initial_content = await page.evaluate("""
                (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent : null;
                }
            """, selector)
            
            if initial_content is None:
                logger.warning(f"Element {selector} not found for content change detection")
                return False
            
            # Wait for content to change
            await page.wait_for_function("""
                (args) => {
                    const [selector, initialContent] = args;
                    const element = document.querySelector(selector);
                    if (!element) return false;
                    return element.textContent !== initialContent;
                }
            """, arg=[selector, initial_content], timeout=timeout)
            
            return True
            
        except Exception as e:
            logger.warning(f"Content change wait timeout for {selector}: {e}")
            return False
    
    @staticmethod
    async def wait_for_container_count_change(page: Page, selector: str, timeout: int = 5000) -> int:
        """
        Wait for the number of elements matching a selector to change
        Returns the new count, or -1 if timeout
        """
        try:
            # Get initial count
            initial_count = await page.locator(selector).count()
            
            # Wait for count to change
            await page.wait_for_function("""
                (args) => {
                    const [selector, initialCount] = args;
                    const elements = document.querySelectorAll(selector);
                    return elements.length !== initialCount;
                }
            """, arg=[selector, initial_count], timeout=timeout)
            
            # Return new count
            return await page.locator(selector).count()
            
        except Exception as e:
            logger.warning(f"Container count wait timeout for {selector}: {e}")
            return -1
    
    @staticmethod
    async def wait_for_equipment_tab_ready(page: Page) -> bool:
        """
        Specific wait for Equipment tab to be ready
        """
        logger.info("⏳ Waiting for Equipment tab to be ready...")
        
        # Method 1: Wait for tab pane to be active
        tab_ready = await SmartWait.wait_for_element_stable(page, '.tab-pane.active')
        if tab_ready:
            logger.info("✅ Tab pane is active and stable")
        
        # Method 2: Wait for page to be idle
        page_idle = await SmartWait.wait_for_page_idle(page, timeout=3000)
        if page_idle:
            logger.info("✅ Page is idle")
        
        # Method 3: Wait for Dispenser toggle to be visible
        toggle_ready = await SmartWait.wait_for_element_stable(
            page, 
            'a:has-text("Dispenser"), button:has-text("Dispenser")'
        )
        if toggle_ready:
            logger.info("✅ Dispenser toggle is visible and stable")
        
        return tab_ready or toggle_ready
    
    @staticmethod
    async def wait_for_dispenser_expansion(page: Page) -> bool:
        """
        Wait for dispenser section to expand
        """
        logger.info("⏳ Waiting for dispenser expansion...")
        
        # Get initial container count
        initial_count = await page.locator('div.py-1\\.5').count()
        logger.info(f"   Initial container count: {initial_count}")
        
        # Wait for containers to increase
        new_count = await SmartWait.wait_for_container_count_change(
            page, 'div.py-1\\.5', timeout=3000
        )
        
        if new_count > initial_count:
            logger.info(f"✅ Containers expanded: {initial_count} → {new_count}")
            
            # Wait for content to stabilize
            await SmartWait.wait_for_page_idle(page, timeout=2000)
            
            return True
        else:
            logger.warning("⚠️ No container expansion detected")
            return False


# Export main class
__all__ = ['SmartWait']