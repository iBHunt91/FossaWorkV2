#!/usr/bin/env python3
"""
Optimize Dispenser Scraping Implementation
=========================================

This script provides the optimized code changes for the dispenser scraping process.
These changes can reduce scraping time from ~40 seconds to ~8 seconds per work order.
"""

OPTIMIZATIONS = {
    "1_navigation_optimization": {
        "file": "app/services/workfossa_scraper.py",
        "line": "~2530",
        "current": '''
            # Navigate to customer location page
            logger.info(f"🔄 [DISPENSER] Navigating to customer location page: {customer_url}")
            try:
                await page.goto(customer_url, wait_until="networkidle", timeout=30000)
                logger.info(f"✅ [DISPENSER] Successfully navigated to customer location page")
            except Exception as e:
                logger.error(f"❌ [DISPENSER] Failed to navigate to customer URL: {e}")
                raise Exception(f"Failed to navigate to customer URL: {e}")
            
            # Wait for page to stabilize
            logger.info(f"⏱️ [DISPENSER] Waiting for page to stabilize...")
            await page.wait_for_timeout(3000)
''',
        "optimized": '''
            # Navigate to customer location page
            logger.info(f"🔄 [DISPENSER] Navigating to customer location page: {customer_url}")
            try:
                await page.goto(customer_url, wait_until="domcontentloaded", timeout=15000)
                logger.info(f"✅ [DISPENSER] Page loaded, waiting for content...")
                
                # Smart wait for page content instead of fixed timeout
                try:
                    # Wait for any indication that the page has loaded
                    await page.wait_for_selector(
                        ".equipment-tab, [data-tab='equipment'], a:has-text('Equipment'), .tab-content",
                        timeout=5000,
                        state="visible"
                    )
                    logger.info(f"✅ [DISPENSER] Page content detected")
                except:
                    # Minimal fallback wait if selectors not found
                    logger.info(f"⏱️ [DISPENSER] Using minimal fallback wait")
                    await page.wait_for_timeout(500)
                    
            except Exception as e:
                logger.error(f"❌ [DISPENSER] Failed to navigate to customer URL: {e}")
                raise Exception(f"Failed to navigate to customer URL: {e}")
'''
    },
    
    "2_equipment_tab_optimization": {
        "file": "app/services/workfossa_scraper.py", 
        "line": "~2020-2022",
        "current": '''
            # Wait for Equipment tab content to load
            logger.info(f"⏱️ [CUSTOMER_PAGE] Waiting for Equipment tab content to load...")
            await page.wait_for_timeout(3000)
''',
        "optimized": '''
            # Smart wait for Equipment tab content to load
            logger.info(f"⏱️ [CUSTOMER_PAGE] Waiting for Equipment tab content to load...")
            try:
                # Wait for equipment content indicators
                await page.wait_for_selector(
                    ".equipment-content, .equipment-list, [data-equipment], .dispenser-section",
                    timeout=2000,
                    state="visible"
                )
                logger.info(f"✅ [CUSTOMER_PAGE] Equipment content loaded")
            except:
                # Reduced fallback wait
                logger.info(f"⏱️ [CUSTOMER_PAGE] Using reduced fallback wait")
                await page.wait_for_timeout(1000)
'''
    },
    
    "3_dispenser_section_optimization": {
        "file": "app/services/workfossa_scraper.py",
        "line": "~2041-2043", 
        "current": '''
                # Wait for Dispenser section to expand
                logger.info(f"⏱️ [CUSTOMER_PAGE] Waiting for Dispenser section to expand...")
                await page.wait_for_timeout(3000)
''',
        "optimized": '''
                # Smart wait for Dispenser section to expand
                logger.info(f"⏱️ [CUSTOMER_PAGE] Waiting for Dispenser section to expand...")
                try:
                    # Wait for dispenser elements to appear
                    await page.wait_for_selector(
                        ".dispenser-item, [data-dispenser], .equipment-item:has-text('Dispenser'), tr:has-text('Dispenser')",
                        timeout=2000,
                        state="visible"
                    )
                    logger.info(f"✅ [CUSTOMER_PAGE] Dispenser content visible")
                except:
                    # Reduced fallback wait
                    logger.info(f"⏱️ [CUSTOMER_PAGE] Using reduced fallback wait")
                    await page.wait_for_timeout(1000)
'''
    },
    
    "4_between_work_orders_optimization": {
        "file": "app/services/workfossa_scraper.py",
        "line": "~288-289",
        "current": '''
                    logger.info(f"⏱️ [DEBUG] Sleeping for {self.config['delay_between_pages']}ms before next work order")
                    await asyncio.sleep(self.config['delay_between_pages'] / 1000)
''',
        "optimized": '''
                    # Only delay if we're staying on the same page (rate limiting)
                    # Skip delay when navigating to different customer pages
                    if not work_order.get('customer_url'):
                        logger.info(f"⏱️ [DEBUG] Rate limiting: sleeping for {self.config['delay_between_pages']}ms")
                        await asyncio.sleep(self.config['delay_between_pages'] / 1000)
                    else:
                        logger.info(f"✅ [DEBUG] Skipping delay - navigating to new page")
'''
    },
    
    "5_add_smart_wait_helper": {
        "file": "app/services/workfossa_scraper.py",
        "location": "Add after class definition, before scraping methods",
        "code": '''
    async def _smart_wait_for_content(self, page, selectors, timeout=5000, fallback_wait=500):
        """Smart wait for content with fallback
        
        Args:
            page: The page object
            selectors: List of CSS selectors to wait for
            timeout: Maximum time to wait for selectors
            fallback_wait: Fallback wait time if selectors not found
        """
        try:
            # Join selectors with comma for "any of" behavior
            combined_selector = ", ".join(selectors)
            await page.wait_for_selector(
                combined_selector,
                timeout=timeout,
                state="visible"
            )
            return True
        except:
            # Use minimal fallback wait if selectors not found
            if fallback_wait > 0:
                await page.wait_for_timeout(fallback_wait)
            return False
'''
    },
    
    "6_optional_screenshots": {
        "file": "app/services/workfossa_scraper.py",
        "description": "Make screenshots optional via configuration",
        "code": '''
            # Add to config
            'enable_debug_screenshots': False,  # Disable in production
            
            # Wrap screenshot code
            if self.config.get('enable_debug_screenshots', False):
                try:
                    screenshot_path = f"dispenser_scrape_{work_order_id}_{session_id}.png"
                    await page.screenshot(path=screenshot_path)
                    logger.info(f"📸 [DISPENSER] Screenshot saved: {screenshot_path}")
                except Exception as e:
                    logger.warning(f"⚠️ [DISPENSER] Could not take screenshot: {e}")
'''
    }
}

def print_implementation_guide():
    """Print a step-by-step implementation guide"""
    print("DISPENSER SCRAPING OPTIMIZATION IMPLEMENTATION GUIDE")
    print("==================================================\n")
    
    print("ESTIMATED TIME SAVINGS: 32 seconds per work order (81% improvement)")
    print("For 40 work orders: From 26 minutes to 5 minutes\n")
    
    print("STEP-BY-STEP IMPLEMENTATION:")
    print("---------------------------\n")
    
    for i, (key, optimization) in enumerate(OPTIMIZATIONS.items(), 1):
        if "current" in optimization and "optimized" in optimization:
            print(f"{i}. {key.replace('_', ' ').title()}")
            print(f"   File: {optimization['file']}")
            print(f"   Line: {optimization['line']}")
            print(f"   Change: Replace 'networkidle' with 'domcontentloaded' and fixed waits with smart waits")
            print()
        elif "code" in optimization:
            print(f"{i}. {key.replace('_', ' ').title()}")
            if "file" in optimization:
                print(f"   File: {optimization['file']}")
            if "location" in optimization:
                print(f"   Location: {optimization['location']}")
            if "description" in optimization:
                print(f"   Description: {optimization['description']}")
            print()
    
    print("\nTESTING RECOMMENDATIONS:")
    print("-----------------------")
    print("1. Test with a single work order first")
    print("2. Verify Equipment tab and Dispenser section still load correctly")
    print("3. Check that all dispenser data is still captured")
    print("4. Run a batch of 5-10 work orders to verify stability")
    print("5. Monitor for any timeout errors with the new shorter waits")
    
    print("\nROLLBACK PLAN:")
    print("--------------")
    print("If issues occur, you can:")
    print("1. Increase the smart wait timeouts (e.g., from 2000ms to 3000ms)")
    print("2. Increase fallback waits (e.g., from 500ms to 1000ms)")
    print("3. Revert to 'networkidle' for specific problematic pages")
    print("4. Keep the original code commented for easy rollback")

def generate_patch_file():
    """Generate a patch file with all the optimizations"""
    patch_content = """--- a/app/services/workfossa_scraper.py
+++ b/app/services/workfossa_scraper.py
@@ -2527,13 +2527,24 @@ class WorkFossaScraper:
             # Navigate to customer location page
             logger.info(f"🔄 [DISPENSER] Navigating to customer location page: {customer_url}")
             try:
-                await page.goto(customer_url, wait_until="networkidle", timeout=30000)
-                logger.info(f"✅ [DISPENSER] Successfully navigated to customer location page")
+                await page.goto(customer_url, wait_until="domcontentloaded", timeout=15000)
+                logger.info(f"✅ [DISPENSER] Page loaded, waiting for content...")
+                
+                # Smart wait for page content instead of fixed timeout
+                try:
+                    # Wait for any indication that the page has loaded
+                    await page.wait_for_selector(
+                        ".equipment-tab, [data-tab='equipment'], a:has-text('Equipment'), .tab-content",
+                        timeout=5000,
+                        state="visible"
+                    )
+                    logger.info(f"✅ [DISPENSER] Page content detected")
+                except:
+                    # Minimal fallback wait if selectors not found
+                    logger.info(f"⏱️ [DISPENSER] Using minimal fallback wait")
+                    await page.wait_for_timeout(500)
+                    
             except Exception as e:
                 logger.error(f"❌ [DISPENSER] Failed to navigate to customer URL: {e}")
-                raise Exception(f"Failed to navigate to customer URL: {e}")
-            
-            # Wait for page to stabilize
-            logger.info(f"⏱️ [DISPENSER] Waiting for page to stabilize...")
-            await page.wait_for_timeout(3000)
+                raise Exception(f"Failed to navigate to customer URL: {e}")
"""
    
    with open("dispenser_optimization.patch", "w") as f:
        f.write(patch_content)
    
    print("\nPatch file generated: dispenser_optimization.patch")
    print("Apply with: git apply dispenser_optimization.patch")

if __name__ == "__main__":
    print_implementation_guide()
    # Optionally generate patch file
    # generate_patch_file()