#!/usr/bin/env python3
"""
Content-based wait utilities that monitor for specific HTML elements and content
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List, Tuple
from playwright.async_api import Page

logger = logging.getLogger(__name__)


class ContentBasedWait:
    """Wait utilities that focus on specific content rather than generic page states"""
    
    @staticmethod
    async def wait_for_equipment_tab(page: Page, timeout: int = 10000) -> bool:
        """
        Wait for Equipment tab to be present and clickable
        
        Returns:
            True if Equipment tab found and ready, False if timeout
        """
        try:
            logger.debug("Waiting for Equipment tab...")
            
            # Wait for any element with exact text "Equipment"
            await page.wait_for_function(
                """
                () => {
                    const elements = document.querySelectorAll('a, button, [role="tab"], .nav-link, .tab');
                    for (const el of elements) {
                        const text = el.textContent ? el.textContent.trim() : '';
                        if (text === 'Equipment') {
                            // Check if it's visible and clickable
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            
                            if (rect.width > 0 && rect.height > 0 && 
                                style.visibility !== 'hidden' && 
                                style.display !== 'none' &&
                                !el.disabled) {
                                return true;
                            }
                        }
                    }
                    return false;
                }
                """,
                timeout=timeout
            )
            
            logger.info("✅ Equipment tab is ready")
            return True
            
        except Exception as e:
            logger.warning(f"Equipment tab not found within {timeout}ms: {e}")
            return False
    
    @staticmethod
    async def wait_for_loader_to_disappear(page: Page, timeout: int = 10000) -> bool:
        """
        Wait for the loader line to disappear (display: none)
        
        Returns:
            True if loader disappeared, False if timeout
        """
        try:
            logger.debug("Waiting for loader to disappear...")
            
            # First check if loader exists
            loader_exists = await page.evaluate("""
                () => {
                    const loader = document.querySelector('.loader-line');
                    return loader !== null;
                }
            """)
            
            if not loader_exists:
                logger.debug("No loader found, proceeding...")
                return True
            
            # Wait for loader to have display: none
            await page.wait_for_function(
                """
                () => {
                    const loader = document.querySelector('.loader-line');
                    if (!loader) return true; // If loader doesn't exist, we're good
                    
                    // Check both inline style and computed style
                    const inlineDisplay = loader.style.display;
                    const computedDisplay = window.getComputedStyle(loader).display;
                    
                    return inlineDisplay === 'none' || computedDisplay === 'none';
                }
                """,
                timeout=timeout
            )
            
            logger.info("✅ Loader has disappeared")
            return True
            
        except Exception as e:
            logger.warning(f"Loader did not disappear within {timeout}ms: {e}")
            return False
    
    @staticmethod
    async def wait_for_dispenser_toggle(page: Page, timeout: int = 10000) -> Optional[str]:
        """
        Wait for Dispenser toggle (with count) to appear
        
        Returns:
            The dispenser toggle text (e.g., "Dispenser (8)") or None if timeout
        """
        try:
            logger.debug("Waiting for Dispenser toggle...")
            
            # Wait for element matching "Dispenser (X)" pattern
            result = await page.wait_for_function(
                """
                () => {
                    const elements = document.querySelectorAll('*');
                    for (const el of elements) {
                        const text = el.textContent ? el.textContent.trim() : '';
                        // Match "Dispenser (number)" pattern
                        if (text.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                            // Store the text for retrieval
                            window.__dispenserToggleText = text;
                            return true;
                        }
                    }
                    return false;
                }
                """,
                timeout=timeout
            )
            
            # Get the toggle text
            toggle_text = await page.evaluate("() => window.__dispenserToggleText")
            logger.info(f"✅ Found Dispenser toggle: {toggle_text}")
            return toggle_text
            
        except Exception as e:
            logger.warning(f"Dispenser toggle not found within {timeout}ms: {e}")
            return None
    
    @staticmethod
    async def wait_for_dispenser_content(
        page: Page, 
        timeout: int = 10000,
        min_containers: int = 1
    ) -> Tuple[bool, int]:
        """
        Wait for actual dispenser content to be visible
        
        Args:
            page: Playwright page object
            timeout: Maximum wait time in milliseconds
            min_containers: Minimum number of containers expected
            
        Returns:
            Tuple of (success, container_count)
        """
        try:
            logger.debug(f"Waiting for dispenser content (min {min_containers} containers)...")
            
            # Wait for containers with actual dispenser data
            await page.wait_for_function(
                f"""
                () => {{
                    const containers = document.querySelectorAll('div.py-1\\\\.5');
                    let validContainers = 0;
                    
                    for (const container of containers) {{
                        const text = container.textContent || '';
                        // Check for dispenser-specific content
                        if (text.includes('S/N:') || text.includes('Serial') ||
                            text.includes('MAKE:') || text.includes('Make:') ||
                            text.includes('MODEL:') || text.includes('Model:') ||
                            text.includes('Gilbarco') || text.includes('Wayne') ||
                            text.includes('GRADE') || text.includes('Grade')) {{
                            validContainers++;
                        }}
                    }}
                    
                    return validContainers >= {min_containers};
                }}
                """,
                timeout=timeout
            )
            
            # Get actual count
            container_count = await page.evaluate("""
                () => {
                    const containers = document.querySelectorAll('div.py-1\\\\.5');
                    let validContainers = 0;
                    
                    for (const container of containers) {
                        const text = container.textContent || '';
                        if (text.includes('S/N:') || text.includes('MAKE:') || 
                            text.includes('MODEL:') || text.includes('Gilbarco') || 
                            text.includes('Wayne')) {
                            validContainers++;
                        }
                    }
                    
                    return validContainers;
                }
            """)
            
            logger.info(f"✅ Found {container_count} dispenser containers with content")
            return True, container_count
            
        except Exception as e:
            logger.warning(f"Dispenser content not found within {timeout}ms: {e}")
            return False, 0
    
    @staticmethod
    async def click_dispenser_toggle_safely(page: Page) -> bool:
        """
        Find and click the dispenser toggle, handling the specific WorkFossa structure
        
        Returns:
            True if clicked successfully, False otherwise
        """
        try:
            logger.debug("Attempting to click Dispenser toggle safely...")
            
            # Based on the HTML structure, the dispenser toggle follows this pattern:
            # <a href="#" title="Show equipment" class="ml-1">
            #   <span class="bold">Dispenser</span> (X)
            #   <svg>chevron icon</svg>
            # </a>
            
            clicked = await page.evaluate("""
                () => {
                    console.log('Looking for Dispenser toggle to click...');
                    
                    // Find all links that might be equipment toggles
                    const links = document.querySelectorAll('a[href="#"]');
                    let dispenserLink = null;
                    
                    for (const link of links) {
                        // Check if this link has the dispenser text pattern
                        const boldSpan = link.querySelector('span.bold');
                        if (boldSpan && boldSpan.textContent.trim().toLowerCase() === 'dispenser') {
                            // Verify it has the count pattern after the span
                            const fullText = link.textContent.trim();
                            if (fullText.match(/Dispenser\\s*\\(\\d+\\)/i)) {
                                console.log('Found Dispenser link:', link);
                                dispenserLink = link;
                                break;
                            }
                        }
                    }
                    
                    if (!dispenserLink) {
                        // Fallback: look for any element with exact "Dispenser (X)" text
                        const allLinks = document.querySelectorAll('a');
                        for (const link of allLinks) {
                            const text = link.textContent ? link.textContent.trim() : '';
                            if (text.match(/^Dispenser\\s*\\(\\d+\\)/i)) {
                                console.log('Found Dispenser link via text search:', link);
                                dispenserLink = link;
                                break;
                            }
                        }
                    }
                    
                    if (dispenserLink) {
                        // Check the current state by looking at the chevron icon
                        const chevron = dispenserLink.querySelector('svg');
                        const isCollapsed = chevron && chevron.classList.contains('rotate-180');
                        console.log('Dispenser is currently:', isCollapsed ? 'collapsed' : 'expanded');
                        
                        // Find the content area that should expand
                        // It should be a sibling of the parent div.group-heading
                        const groupHeading = dispenserLink.closest('.group-heading');
                        let contentArea = null;
                        
                        if (groupHeading) {
                            // The content should be the next sibling after group-heading
                            let nextElement = groupHeading.nextElementSibling;
                            
                            // Skip any comment nodes
                            while (nextElement && nextElement.nodeType === 8) {
                                nextElement = nextElement.nextSibling;
                            }
                            
                            if (nextElement && nextElement.nodeType === 1) {
                                contentArea = nextElement;
                                console.log('Found potential content area:', contentArea);
                            }
                        }
                        
                        // Click the link
                        try {
                            // Prevent default behavior
                            dispenserLink.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }, { once: true });
                            
                            // Trigger the click
                            dispenserLink.click();
                            console.log('Clicked Dispenser link');
                            
                            // If we found a content area and it's hidden, show it manually
                            if (contentArea && (contentArea.style.display === 'none' || 
                                contentArea.classList.contains('collapse') ||
                                contentArea.classList.contains('collapsed'))) {
                                console.log('Manually expanding content area');
                                contentArea.style.display = 'block';
                                contentArea.classList.remove('collapse', 'collapsed');
                                contentArea.classList.add('show', 'expanded');
                                
                                // Update the chevron to show expanded state
                                if (chevron) {
                                    chevron.classList.remove('rotate-180');
                                }
                            }
                            
                            // Dispatch custom event for any JavaScript handlers
                            const event = new Event('toggle', { bubbles: true });
                            dispenserLink.dispatchEvent(event);
                            
                            return true;
                        } catch (err) {
                            console.error('Error clicking link:', err);
                            
                            // Try alternative click methods
                            const mouseEvent = new MouseEvent('click', {
                                view: window,
                                bubbles: true,
                                cancelable: true
                            });
                            dispenserLink.dispatchEvent(mouseEvent);
                            console.log('Dispatched mouse event as fallback');
                            
                            return true;
                        }
                    }
                    
                    console.log('Dispenser toggle not found');
                    return false;
                }
            """)
            
            if clicked:
                logger.info("✅ Clicked Dispenser toggle")
                
                # Wait a moment for any animations
                await asyncio.sleep(0.5)
                
                # Verify the content expanded by checking for dispenser containers
                expanded = await page.evaluate("""
                    () => {
                        // Check if we now have visible equipment items
                        const containers = document.querySelectorAll('.py-1\\\\.5, .equipment-item, [class*="equipment"]');
                        let visibleCount = 0;
                        
                        for (const container of containers) {
                            const text = container.textContent || '';
                            if ((text.includes('S/N:') || text.includes('Serial') ||
                                 text.includes('MAKE:') || text.includes('Model')) &&
                                container.offsetHeight > 0) {
                                visibleCount++;
                            }
                        }
                        
                        return visibleCount > 0;
                    }
                """)
                
                if expanded:
                    logger.info("✅ Dispenser content is now visible")
                else:
                    logger.warning("⚠️ Clicked toggle but content not visible yet")
                
                return True
            else:
                logger.warning("Could not find Dispenser toggle to click")
                return False
                
        except Exception as e:
            logger.error(f"Error clicking Dispenser toggle: {e}")
            return False
    
    @staticmethod
    async def wait_for_modal_and_close(page: Page, timeout: int = 3000) -> bool:
        """
        Wait for modal with Cancel button and close it
        
        Returns:
            True if modal was found and closed, False otherwise
        """
        try:
            # Wait for Cancel button to appear
            cancel_button = await page.wait_for_selector(
                'button:has-text("Cancel")',
                timeout=timeout,
                state='visible'
            )
            
            if cancel_button:
                logger.info("📋 Modal detected, closing...")
                await cancel_button.click()
                
                # Wait for modal to disappear
                await page.wait_for_selector(
                    'button:has-text("Cancel")',
                    state='hidden',
                    timeout=2000
                )
                
                logger.info("✅ Modal closed")
                return True
                
        except Exception:
            # No modal found, which is fine
            pass
        
        return False
    
    @staticmethod
    async def extract_dispenser_count_from_toggle(page: Page) -> int:
        """
        Extract the expected dispenser count from the toggle text
        
        Returns:
            The count from "Dispenser (X)" or 0 if not found
        """
        try:
            count = await page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('*');
                    
                    for (const el of elements) {
                        const text = el.textContent ? el.textContent.trim() : '';
                        const match = text.match(/^Dispenser\\s*\\((\\d+)\\)$/);
                        
                        if (match) {
                            return parseInt(match[1]);
                        }
                    }
                    
                    return 0;
                }
            """)
            
            return count
            
        except Exception:
            return 0
    
    @staticmethod
    async def wait_for_complete_dispenser_load(page: Page) -> Dict[str, Any]:
        """
        Complete workflow for waiting for dispenser content to load
        
        Returns:
            Dict with status and details of each step
        """
        results = {
            'equipment_tab': False,
            'dispenser_toggle': None,
            'modal_closed': False,
            'toggle_clicked': False,
            'content_loaded': False,
            'container_count': 0,
            'expected_count': 0
        }
        
        try:
            # Step 1: Wait for Equipment tab
            if await ContentBasedWait.wait_for_equipment_tab(page):
                results['equipment_tab'] = True
                
                # Step 2: Click Equipment tab
                await page.click('text="Equipment"')
                
                # Step 2.5: Wait for loader to disappear
                await ContentBasedWait.wait_for_loader_to_disappear(page)
                
                # Step 3: Wait for Dispenser toggle
                toggle_text = await ContentBasedWait.wait_for_dispenser_toggle(page)
                if toggle_text:
                    results['dispenser_toggle'] = toggle_text
                    
                    # Extract expected count
                    results['expected_count'] = await ContentBasedWait.extract_dispenser_count_from_toggle(page)
                    
                    # Step 4: Close modal if present
                    results['modal_closed'] = await ContentBasedWait.wait_for_modal_and_close(page)
                    
                    # Step 5: Check if content already visible
                    initial_success, initial_count = await ContentBasedWait.wait_for_dispenser_content(
                        page, timeout=1000, min_containers=1
                    )
                    
                    if initial_success and initial_count > 0:
                        results['content_loaded'] = True
                        results['container_count'] = initial_count
                        logger.info("Dispenser content already visible")
                    else:
                        # Step 6: Click toggle to expand
                        if await ContentBasedWait.click_dispenser_toggle_safely(page):
                            results['toggle_clicked'] = True
                            
                            # Step 7: Wait for content to appear
                            success, count = await ContentBasedWait.wait_for_dispenser_content(
                                page, timeout=5000, min_containers=1
                            )
                            
                            results['content_loaded'] = success
                            results['container_count'] = count
            
        except Exception as e:
            logger.error(f"Error in complete dispenser load: {e}")
        
        return results


# Export main class
__all__ = ['ContentBasedWait']