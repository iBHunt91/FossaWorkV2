#!/usr/bin/env python3
"""Interactive work order scraping test with pauses - Step by step"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from playwright.async_api import async_playwright
from app.database import SessionLocal
from sqlalchemy import text as sql_text
from datetime import datetime

async def wait_for_user():
    """Wait for user to press Enter"""
    print("\n⏸️  Press Enter to continue...")
    await asyncio.get_event_loop().run_in_executor(None, input)

async def extract_work_order_info(row):
    """Extract work order information from WorkFossa div structure"""
    try:
        # Import re at the top
        import re
        
        # Debug: Check element class
        element_class = await row.get_attribute("class")
        print(f"   🔍 Element class: {element_class}")
        
        # Get the full text content first for debugging
        full_text = await row.inner_text()
        if not full_text or full_text.strip() == "":
            print("   ❌ Empty element, skipping...")
            return None
            
        print(f"   🔍 Row text preview: {full_text[:100].strip()}...")
        
        # Extract based on the actual HTML structure
        job_id = ""
        service_name = ""
        address = ""
        street = ""
        city_state = ""
        county = ""
        created_date = ""
        created_by = ""
        scheduled_date = ""
        visit_url = None
        visit_number = None
        customer_url = None
        store_number = ""
        customer_name = ""
        service_code = ""
        service_items = []
        instructions = ""
        
        # Extract Job ID (W-xxxxx format) - look for link with W- text
        work_id_links = await row.query_selector_all("a")
        for link in work_id_links:
            link_text = await link.inner_text()
            if link_text and link_text.strip().startswith("W-"):
                job_id = link_text.strip().replace("W-", "")
                print(f"   📝 Found Job ID: W-{job_id}")
                break
        
        # Extract Service Name (from Reason field)
        # Look for text containing "Reason:"
        if "Reason:" in full_text:
            reason_match = re.search(r'Reason:\s*([^\n]+)', full_text)
            if reason_match:
                service_name = reason_match.group(1).strip()
        
        # Extract Customer Name (7-Eleven Stores, Inc) - first customer link
        customer_links = await row.query_selector_all("a[href*='/app/customers/']")
        for link in customer_links:
            href = await link.get_attribute("href")
            if href and "/locations/" not in href:
                customer_name = await link.inner_text()
                customer_name = customer_name.strip()
                break
        
        # Extract Store Number and Customer URL
        store_links = await row.query_selector_all("a[href*='/customers/locations/']")
        if store_links:
            store_link = store_links[0]
            store_number = await store_link.inner_text()
            store_number = store_number.strip()
            customer_url = await store_link.get_attribute("href")
            if customer_url and not customer_url.startswith("http"):
                customer_url = f"https://app.workfossa.com{customer_url}"
        
        # Extract Address and County - look for the address info section
        address_info = await row.query_selector("div.address-info")
        if address_info:
            address_divs = await address_info.query_selector_all("div")
            address_parts = []
            for div in address_divs:
                text = await div.inner_text()
                if text and text.strip():
                    if "County" in text:
                        county = text.strip()
                    else:
                        address_parts.append(text.strip())
            
            # Separate address components
            if len(address_parts) >= 2:
                street = address_parts[0]  # Street address
                city_state = address_parts[1]  # City, State ZIP
                # Full address for compatibility
                address = f"{street} {city_state}"
            elif address_parts:
                address = " ".join(address_parts)
        
        # Extract service items and codes
        # Look for service codes in parentheses
        service_matches = re.findall(r'\((\d{4})\)', full_text)
        if service_matches:
            service_code = service_matches[0]  # Get first service code
            
        # Extract items (e.g., "6 x All Dispensers")
        item_matches = re.findall(r'(\d+)\s*x\s*([^(]+)', full_text)
        for match in item_matches:
            quantity, item_name = match
            service_items.append(f"{quantity} x {item_name.strip()}")
        
        # Extract Created Date and Created By
        creator_match = re.search(r'(\w+\s+\w+)\s*•\s*(\d{2}/\d{2}/\d{4})', full_text)
        if creator_match:
            created_by = creator_match.group(1)
            created_date = creator_match.group(2)
        
        # Extract Visit info
        visit_links = await row.query_selector_all("a[href*='/visits/']")
        if visit_links:
            visit_link = visit_links[0]
            visit_url = await visit_link.get_attribute("href")
            if visit_url and not visit_url.startswith("http"):
                visit_url = f"https://app.workfossa.com{visit_url}"
            
            # Extract visit number from URL (e.g., "131650" from /visits/131650/)
            visit_id_match = re.search(r'/visits/(\d+)', visit_url)
            if visit_id_match:
                visit_number = visit_id_match.group(1)
            
            # Try to extract date from visit section
            parent = await visit_link.evaluate_handle("el => el.parentElement")
            if parent:
                parent_text = await parent.inner_text()
                date_match = re.search(r'(\d{2}/\d{2}/\d{4})', parent_text)
                if date_match:
                    scheduled_date = date_match.group(1)
        
        # Extract Instructions - look for text after "more..." or at the end
        # Instructions often come after calibration details
        if "Calibrate" in full_text:
            instructions_match = re.search(r'(Calibrate[^.]+\.(?:[^.]+\.)*)', full_text)
            if instructions_match:
                instructions = instructions_match.group(1).strip()
                # Clean up "more..." if present
                instructions = instructions.replace(", more...", "")
        
        print(f"   📝 Extracted - ID: {job_id}, Customer: {customer_name}, Store: {store_number}")
        
        return {
            'job_id': job_id,
            'store_number': store_number,
            'customer_name': customer_name,
            'address': address,
            'street': street,
            'city_state': city_state,
            'county': county,
            'service_code': service_code,
            'service_name': service_name,
            'service_items': service_items,
            'created_date': created_date,
            'created_by': created_by,
            'scheduled_date': scheduled_date,
            'visit_url': visit_url,
            'visit_number': visit_number,
            'customer_url': customer_url,
            'instructions': instructions,
            'raw_text': full_text.strip()  # Include full raw text for debugging
        }
    except Exception as e:
        print(f"   ❌ Error extracting work order: {e}")
        import traceback
        traceback.print_exc()
        return None

async def interactive_test():
    """Test work order scraping with pauses at each step"""
    
    print("="*80)
    print("INTERACTIVE WORK ORDER SCRAPING TEST")
    print("="*80)
    print("This test will walk through the work order scraping process step by step.")
    print("The browser will be visible and you can observe each action.")
    
    db = SessionLocal()
    browser = None
    playwright = None
    
    try:
        # Get user credentials
        from app.models.user_models import UserCredential
        
        # Using Bruce's user ID
        user_id = '7bea3bdb7e8e303eacaba442bd824004'
        
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No WorkFossa credentials found")
            print("   Please ensure credentials are set up in the system")
            return
        
        print(f"\n✅ Found credentials for user")
        
        print("\n🚀 Step 1: Launching browser (visible mode)...")
        print("   The browser window will open in non-headless mode")
        await wait_for_user()
        
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 900},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        print("✅ Browser launched successfully")
        
        # Login
        print("\n🔐 Step 2: Navigating to WorkFossa login page...")
        print("   URL: https://app.workfossa.com")
        await wait_for_user()
        
        await page.goto('https://app.workfossa.com')
        await page.wait_for_timeout(2000)
        print("✅ On login page")
        
        print("\n📝 Step 3: Filling login credentials...")
        print("   Username and password will be entered automatically")
        await wait_for_user()
        
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        print("✅ Credentials filled")
        
        print("\n🔑 Step 4: Clicking login button...")
        print("   Waiting for authentication to complete...")
        await wait_for_user()
        
        await page.click('text=Log In')
        print("⏳ Waiting for login to complete...")
        await page.wait_for_timeout(7000)
        print("✅ Login successful - dashboard loaded")
        
        # Navigate to work orders
        print(f"\n🌐 Step 5: Navigating to work orders page...")
        print(f"   URL: https://app.workfossa.com/app/work/list")
        await wait_for_user()
        
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="domcontentloaded")
        
        # Wait for table content to appear (like the working scraper)
        print("   Waiting for table content to load...")
        try:
            await page.wait_for_selector("tbody tr, table tr", timeout=5000)
            print("   ✅ Table content detected")
        except:
            print("   ⚠️  Table selector timeout, continuing...")
        
        await page.wait_for_timeout(1000)
        print("✅ On work orders page")
        
        # Try to change page size
        print("\n🔧 Step 6: Attempting to change page size to 100...")
        print("   This will show more work orders at once")
        await wait_for_user()
        
        try:
            # Try WorkFossa custom dropdown first  
            custom_dropdown = await page.query_selector("div.ks-select-selection:has-text('Show 25')")
            if custom_dropdown:
                print("   Found custom dropdown, clicking...")
                await custom_dropdown.click()
                await page.wait_for_timeout(1000)
                
                # Try multiple selectors for the 100 option
                option_selectors = [
                    "li:has-text('Show 100')",
                    "div:has-text('Show 100')", 
                    "*[role='option']:has-text('100')",
                    ".ks-select-dropdown-menu-item:has-text('100')",
                    "li.ks-select-item:has-text('100')"
                ]
                
                option_found = False
                for opt_selector in option_selectors:
                    option_100 = await page.query_selector(opt_selector)
                    if option_100:
                        await option_100.click()
                        print(f"   ✅ Changed page size to 100 using: {opt_selector}")
                        
                        # Critical: Wait for network to settle like the working scraper
                        print("   ⏳ Waiting for page to reload...")
                        await page.wait_for_load_state("networkidle")
                        
                        # Critical: Stabilization wait for content to populate
                        print("   ⏳ Waiting for content to populate...")
                        await page.wait_for_timeout(3000)
                        
                        option_found = True
                        break
                
                if not option_found:
                    print("   ❌ Could not find 100 option in dropdown")
                    # Take screenshot for debugging
                    await page.screenshot(path="dropdown_debug.png")
                    print("   📸 Screenshot saved: dropdown_debug.png")
            else:
                # Try standard select dropdown
                select = await page.query_selector("select[name='per_page'], select:has(option[value='100'])")
                if select:
                    await select.select_option("100")
                    print("   ✅ Changed page size to 100")
                    
                    # Critical: Wait for network to settle
                    print("   ⏳ Waiting for page to reload...")
                    await page.wait_for_load_state("networkidle")
                    
                    # Critical: Stabilization wait
                    print("   ⏳ Waiting for content to populate...")
                    await page.wait_for_timeout(3000)
                else:
                    print("   ⚠️  No page size dropdown found, continuing with default")
        except Exception as e:
            print(f"   ⚠️  Could not change page size: {e}")
        
        # Save HTML for debugging
        print("\n💾 Step 7: Saving page HTML for debugging...")
        print("   This will help us see the actual page structure")
        await wait_for_user()
        
        # Create unique filename with timestamp
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        html_filename = f"work_orders_page_{timestamp}.html"
        
        # Get the full HTML content
        html_content = await page.content()
        
        # Save to file
        with open(html_filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"   ✅ HTML saved to: {html_filename}")
        print(f"   📁 Full path: {Path.cwd() / html_filename}")
        
        # Also save a screenshot
        screenshot_filename = f"work_orders_page_{timestamp}.png"
        await page.screenshot(path=screenshot_filename, full_page=True)
        print(f"   📸 Screenshot saved to: {screenshot_filename}")
        
        # Extract work orders
        print("\n📋 Step 8: Extracting ONE work order to examine data fields...")
        print("   Looking for work order table rows using multiple selectors...")
        await wait_for_user()
        
        # Wait for content to load
        await page.wait_for_timeout(2000)
        
        # Try multiple selectors like the working scraper
        selectors_to_try = [
            "div.work-list-item",  # Primary selector - WorkFossa uses divs with this class
            ".work-list-item",  # Alternative without div
            "tbody tr",  # Table body rows - fallback
            "table tr:has(td)",  # All table rows with data cells
            "tr:has(td input[type='checkbox'])",  # Rows with checkboxes
            "tr.work-order-row",
            ".row, .list-item, .card",
            "[data-id], [data-work-order-id]",
            ".work-order, .job, .visit"
        ]
        
        rows = []
        for selector in selectors_to_try:
            elements = await page.query_selector_all(selector)
            print(f"   Selector '{selector}': found {len(elements)} elements")
            
            if elements and len(elements) > 0:
                # For work-list-item selector, use it directly if found
                if "work-list-item" in selector and len(elements) > 0:
                    rows = elements
                    print(f"   ✅ Using selector '{selector}' - found {len(rows)} work order rows")
                    break
                    
                # Filter out header rows or empty rows
                valid_elements = []
                for element in elements:
                    text_content = await element.text_content()
                    if text_content and len(text_content.strip()) > 10:
                        # Check if it's not a header row
                        lower_text = text_content.lower()
                        is_header = any(header in lower_text for header in [
                            'job id', 'service', 'location', 'address', 'created', 'scheduled',
                            'id', 'name', 'date', 'status', 'actions'
                        ])
                        # Also check if it contains a work order ID
                        has_work_order = 'W-' in text_content
                        if not is_header and has_work_order:
                            valid_elements.append(element)
                
                if valid_elements:
                    rows = valid_elements
                    print(f"   ✅ Using selector '{selector}' - found {len(rows)} valid rows")
                    break
        
        print(f"   Total valid work order rows: {len(rows)}")
        
        if len(rows) > 0:
            # Additional wait to ensure content is fully loaded
            print("   Waiting for content to fully load...")
            await page.wait_for_timeout(2000)
            
            print("\n   Processing first work order only:")
            work_order = await extract_work_order_info(rows[0])
            if work_order:
                print(f"\n   ✅ Work Order Data Fields:")
                print(f"      Job ID: '{work_order['job_id']}'")
                print(f"      Store Number: '{work_order['store_number']}'")
                print(f"      Customer Name: '{work_order['customer_name']}'")
                print(f"      Address (Full): '{work_order['address']}'")
                print(f"      Street: '{work_order['street']}'")
                print(f"      City/State: '{work_order['city_state']}'")
                print(f"      County: '{work_order['county']}'")
                print(f"      Service Code: '{work_order['service_code']}'")
                print(f"      Service Name: '{work_order['service_name']}'")
                if work_order['service_items']:
                    print(f"      Service Items: {', '.join(work_order['service_items'])}")
                print(f"      Created Date: '{work_order['created_date']}'")
                print(f"      Created By: '{work_order['created_by']}'")
                print(f"      Scheduled Date: '{work_order['scheduled_date']}'")
                if work_order['visit_url']:
                    print(f"      Visit URL: {work_order['visit_url']}")
                if work_order.get('visit_number'):
                    print(f"      Visit Number: {work_order['visit_number']}")
                if work_order['customer_url']:
                    print(f"      Customer URL: {work_order['customer_url']}")
                if work_order['instructions']:
                    print(f"      Instructions: '{work_order['instructions']}'")
                print(f"\n   📄 Full raw text content:")
                print("   " + "-" * 60)
                # Split by lines and indent each line
                for line in work_order['raw_text'].split('\n'):
                    if line.strip():
                        print(f"      {line}")
                print("   " + "-" * 60)
                
                # Note about customer URL
                print("\n   ℹ️  Note: Customer URL was already extracted from the work order page")
                print("      No need to visit the visit page for this information")
            else:
                print("   ❌ Could not extract work order data")
        else:
            print("   ❌ No work orders found on page")
        
        print("\n✅ Test complete!")
        print("\n⏸️  Browser will remain open. Press Enter to close...")
        await wait_for_user()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        print("\n⏸️  Press Enter to close browser...")
        await wait_for_user()
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()
        db.close()
        print("\n👋 Test ended")

if __name__ == "__main__":
    print("\n🚀 Starting Interactive Work Order Scraping Test")
    print("   This test requires WorkFossa credentials to be configured")
    print("   Make sure you're ready to observe the browser actions")
    
    asyncio.run(interactive_test())