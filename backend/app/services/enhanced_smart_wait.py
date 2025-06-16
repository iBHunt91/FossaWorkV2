#!/usr/bin/env python3
"""
Enhanced smart wait utilities for reliable page loading detection
"""

import asyncio
import logging
from typing import Optional, Dict, Any, Callable
from playwright.async_api import Page

logger = logging.getLogger(__name__)


class EnhancedSmartWait:
    """Enhanced intelligent wait conditions for web automation"""
    
    @staticmethod
    async def wait_for_page_stable(
        page: Page, 
        stability_timeout: int = 300,  # ms with no DOM changes
        max_wait: int = 5000  # max total wait time
    ) -> bool:
        """
        Wait for page to be stable (no DOM mutations for specified time)
        
        Args:
            page: Playwright page object
            stability_timeout: Milliseconds without DOM changes to consider stable
            max_wait: Maximum total wait time in milliseconds
            
        Returns:
            True if page stabilized, False if timeout
        """
        try:
            # Inject stability monitor
            await page.evaluate(f"""
                () => {{
                    if (!window.__stabilityMonitor) {{
                        window.__stabilityMonitor = {{
                            isStable: false,
                            lastMutation: Date.now(),
                            startTime: Date.now(),
                            mutationCount: 0
                        }};
                        
                        let stabilityTimer;
                        
                        const observer = new MutationObserver((mutations) => {{
                            window.__stabilityMonitor.isStable = false;
                            window.__stabilityMonitor.lastMutation = Date.now();
                            window.__stabilityMonitor.mutationCount++;
                            
                            clearTimeout(stabilityTimer);
                            
                            stabilityTimer = setTimeout(() => {{
                                window.__stabilityMonitor.isStable = true;
                            }}, {stability_timeout});
                        }});
                        
                        observer.observe(document.body, {{
                            childList: true,
                            subtree: true,
                            attributes: true,
                            attributeFilter: ['class', 'style', 'hidden']
                        }});
                        
                        // Initial timer
                        stabilityTimer = setTimeout(() => {{
                            window.__stabilityMonitor.isStable = true;
                        }}, {stability_timeout});
                    }}
                }}
            """)
            
            # Wait for stability
            stable = await page.wait_for_function(
                f"""
                () => {{
                    const monitor = window.__stabilityMonitor;
                    if (!monitor) return true;
                    
                    const elapsed = Date.now() - monitor.startTime;
                    
                    // Stable if no mutations for required time OR max wait exceeded
                    return monitor.isStable || elapsed > {max_wait};
                }}
                """,
                timeout=max_wait + 1000
            )
            
            # Get final stats
            stats = await page.evaluate("() => window.__stabilityMonitor")
            if stats:
                logger.debug(f"Page stability achieved - Mutations: {stats.get('mutationCount', 0)}")
            
            return True
            
        except Exception as e:
            logger.warning(f"Page stability wait failed: {e}")
            return False
    
    @staticmethod
    async def wait_for_container_expansion(
        page: Page,
        container_selector: str,
        timeout: int = 5000
    ) -> int:
        """
        Wait for container count to increase (useful for expandable sections)
        
        Args:
            page: Playwright page object
            container_selector: CSS selector for containers to count
            timeout: Maximum wait time in milliseconds
            
        Returns:
            New container count, or -1 if timeout
        """
        try:
            # Get initial count
            initial_count = await page.locator(container_selector).count()
            logger.debug(f"Initial container count: {initial_count}")
            
            # Wait for count to increase
            await page.wait_for_function(
                f"""
                (selector) => {{
                    const elements = document.querySelectorAll(selector);
                    return elements.length > {initial_count};
                }}
                """,
                arg=container_selector,
                timeout=timeout
            )
            
            # Get new count
            new_count = await page.locator(container_selector).count()
            logger.debug(f"Container count increased: {initial_count} → {new_count}")
            
            return new_count
            
        except Exception as e:
            logger.warning(f"Container expansion wait timeout: {e}")
            return -1
    
    @staticmethod
    async def wait_for_element_ready(
        page: Page,
        selector: str,
        checks: Dict[str, Any] = None,
        timeout: int = 5000
    ) -> bool:
        """
        Wait for an element to be fully ready with custom checks
        
        Args:
            page: Playwright page object
            selector: CSS selector for the element
            checks: Dictionary of checks to perform:
                - visible: Element should be visible
                - stable: Element position should be stable
                - clickable: Element should be clickable
                - text_content: Element should contain specific text
            timeout: Maximum wait time in milliseconds
            
        Returns:
            True if element is ready, False if timeout
        """
        if checks is None:
            checks = {'visible': True, 'stable': True}
        
        try:
            # Wait for element to exist
            element = await page.wait_for_selector(selector, timeout=timeout)
            if not element:
                return False
            
            # Check visibility
            if checks.get('visible'):
                await element.wait_for_element_state('visible', timeout=timeout)
            
            # Check stability
            if checks.get('stable'):
                await page.evaluate(f"""
                    (selector) => {{
                        const element = document.querySelector(selector);
                        if (!element) return;
                        
                        const rect = element.getBoundingClientRect();
                        element.__initialPosition = {{
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                            time: Date.now()
                        }};
                    }}
                """, selector)
                
                await asyncio.sleep(0.2)  # Wait 200ms
                
                is_stable = await page.evaluate(f"""
                    (selector) => {{
                        const element = document.querySelector(selector);
                        if (!element || !element.__initialPosition) return false;
                        
                        const rect = element.getBoundingClientRect();
                        const initial = element.__initialPosition;
                        
                        return rect.top === initial.top &&
                               rect.left === initial.left &&
                               rect.width === initial.width &&
                               rect.height === initial.height;
                    }}
                """, selector)
                
                if not is_stable:
                    logger.warning(f"Element {selector} is not stable")
                    return False
            
            # Check clickability
            if checks.get('clickable'):
                is_clickable = await page.evaluate(f"""
                    (selector) => {{
                        const element = document.querySelector(selector);
                        if (!element) return false;
                        
                        const rect = element.getBoundingClientRect();
                        const style = window.getComputedStyle(element);
                        
                        return rect.width > 0 &&
                               rect.height > 0 &&
                               style.visibility !== 'hidden' &&
                               style.display !== 'none' &&
                               !element.disabled;
                    }}
                """, selector)
                
                if not is_clickable:
                    logger.warning(f"Element {selector} is not clickable")
                    return False
            
            # Check text content
            if 'text_content' in checks:
                text = await element.text_content()
                if checks['text_content'] not in (text or ''):
                    logger.warning(f"Element {selector} doesn't contain required text")
                    return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Element ready check failed for {selector}: {e}")
            return False
    
    @staticmethod
    async def wait_for_network_idle_custom(
        page: Page,
        idle_time: int = 500,  # ms with no network activity
        timeout: int = 10000
    ) -> bool:
        """
        Custom network idle detection with configurable idle time
        
        Args:
            page: Playwright page object
            idle_time: Milliseconds without network activity to consider idle
            timeout: Maximum wait time in milliseconds
            
        Returns:
            True if network became idle, False if timeout
        """
        try:
            # Inject network monitor
            await page.evaluate(f"""
                () => {{
                    if (!window.__networkMonitor) {{
                        window.__networkMonitor = {{
                            activeRequests: 0,
                            lastActivity: Date.now(),
                            isIdle: false
                        }};
                        
                        // Monitor fetch
                        const originalFetch = window.fetch;
                        window.fetch = function(...args) {{
                            window.__networkMonitor.activeRequests++;
                            window.__networkMonitor.lastActivity = Date.now();
                            window.__networkMonitor.isIdle = false;
                            
                            return originalFetch.apply(this, args).finally(() => {{
                                window.__networkMonitor.activeRequests--;
                                window.__networkMonitor.lastActivity = Date.now();
                                
                                if (window.__networkMonitor.activeRequests === 0) {{
                                    setTimeout(() => {{
                                        if (window.__networkMonitor.activeRequests === 0) {{
                                            window.__networkMonitor.isIdle = true;
                                        }}
                                    }}, {idle_time});
                                }}
                            }});
                        }};
                        
                        // Monitor XHR
                        const XHR = XMLHttpRequest.prototype;
                        const originalOpen = XHR.open;
                        const originalSend = XHR.send;
                        
                        XHR.open = function() {{
                            this.__requestStarted = false;
                            return originalOpen.apply(this, arguments);
                        }};
                        
                        XHR.send = function() {{
                            if (!this.__requestStarted) {{
                                this.__requestStarted = true;
                                window.__networkMonitor.activeRequests++;
                                window.__networkMonitor.lastActivity = Date.now();
                                window.__networkMonitor.isIdle = false;
                                
                                this.addEventListener('loadend', () => {{
                                    window.__networkMonitor.activeRequests--;
                                    window.__networkMonitor.lastActivity = Date.now();
                                    
                                    if (window.__networkMonitor.activeRequests === 0) {{
                                        setTimeout(() => {{
                                            if (window.__networkMonitor.activeRequests === 0) {{
                                                window.__networkMonitor.isIdle = true;
                                            }}
                                        }}, {idle_time});
                                    }}
                                }});
                            }}
                            
                            return originalSend.apply(this, arguments);
                        }};
                        
                        // Initial check
                        setTimeout(() => {{
                            if (window.__networkMonitor.activeRequests === 0) {{
                                window.__networkMonitor.isIdle = true;
                            }}
                        }}, {idle_time});
                    }}
                }}
            """)
            
            # Wait for network idle
            await page.wait_for_function(
                """
                () => {
                    const monitor = window.__networkMonitor;
                    return monitor && monitor.isIdle;
                }
                """,
                timeout=timeout
            )
            
            return True
            
        except Exception as e:
            logger.warning(f"Network idle wait failed: {e}")
            return False
    
    @staticmethod
    async def wait_for_dispenser_ready(page: Page) -> bool:
        """
        Specialized wait for dispenser content to be ready
        Combines multiple strategies for maximum reliability
        """
        logger.info("⏳ Waiting for dispenser content to be ready...")
        
        try:
            # Step 1: Wait for Equipment tab to be stable
            equipment_ready = await EnhancedSmartWait.wait_for_element_ready(
                page,
                'text="Equipment"',
                checks={'visible': True, 'clickable': True}
            )
            
            if not equipment_ready:
                logger.warning("Equipment tab not ready")
                return False
            
            # Step 2: Wait for page stability after Equipment click
            await EnhancedSmartWait.wait_for_page_stable(page, stability_timeout=500)
            
            # Step 3: Check if Dispenser toggle is present and ready
            dispenser_toggle_ready = await EnhancedSmartWait.wait_for_element_ready(
                page,
                'a:has-text("Dispenser"), button:has-text("Dispenser")',
                checks={'visible': True, 'stable': True}
            )
            
            if not dispenser_toggle_ready:
                logger.warning("Dispenser toggle not ready")
                return False
            
            # Step 4: Get initial container count
            initial_count = await page.locator('div.py-1\\.5').count()
            logger.debug(f"Initial dispenser container count: {initial_count}")
            
            # If containers already present, content might be expanded
            if initial_count > 0:
                # Check if containers have actual dispenser content
                has_content = await page.evaluate("""
                    () => {
                        const containers = document.querySelectorAll('div.py-1\\.5');
                        for (const container of containers) {
                            const text = container.textContent || '';
                            if (text.includes('S/N:') || text.includes('MAKE:') || 
                                text.includes('MODEL:') || text.includes('Gilbarco')) {
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                if has_content:
                    logger.info("✅ Dispenser content already visible and ready")
                    return True
            
            # Step 5: Click dispenser toggle if needed
            logger.info("Clicking Dispenser toggle to expand...")
            
            # Inject click handler to prevent reload
            await page.evaluate("""
                () => {
                    const links = document.querySelectorAll('a');
                    links.forEach(link => {
                        if (link.textContent && link.textContent.includes('Dispenser')) {
                            link.addEventListener('click', (e) => {
                                if (link.href && link.href.includes('#')) {
                                    e.preventDefault();
                                    const targetId = link.href.split('#')[1];
                                    const target = document.getElementById(targetId);
                                    if (target) {
                                        target.style.display = 'block';
                                        target.classList.remove('collapse');
                                        target.classList.add('show');
                                    }
                                }
                            }, true);
                        }
                    });
                }
            """)
            
            await page.click('a:has-text("Dispenser"), button:has-text("Dispenser")')
            
            # Step 6: Wait for container expansion
            new_count = await EnhancedSmartWait.wait_for_container_expansion(
                page,
                'div.py-1\\.5',
                timeout=3000
            )
            
            if new_count > initial_count:
                logger.info(f"✅ Dispenser section expanded: {initial_count} → {new_count} containers")
                
                # Final stability wait
                await EnhancedSmartWait.wait_for_page_stable(page, stability_timeout=300)
                
                return True
            else:
                logger.warning("❌ Dispenser section did not expand")
                return False
                
        except Exception as e:
            logger.error(f"Error waiting for dispenser ready: {e}")
            return False
    
    @staticmethod
    async def wait_for_content_contains(
        page: Page,
        text: str,
        selector: Optional[str] = None,
        timeout: int = 5000
    ) -> bool:
        """
        Wait for specific text content to appear
        
        Args:
            page: Playwright page object
            text: Text to search for
            selector: Optional CSS selector to search within
            timeout: Maximum wait time in milliseconds
            
        Returns:
            True if text found, False if timeout
        """
        try:
            await page.wait_for_function(
                f"""
                (args) => {{
                    const [searchText, searchSelector] = args;
                    const element = searchSelector ? 
                        document.querySelector(searchSelector) : 
                        document.body;
                    
                    return element && element.textContent.includes(searchText);
                }}
                """,
                arg=[text, selector],
                timeout=timeout
            )
            
            return True
            
        except Exception:
            return False


# Export main class
__all__ = ['EnhancedSmartWait']