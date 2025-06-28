#!/usr/bin/env python3
"""Debug work order scraping test - visible browser, detailed logging"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from playwright.async_api import async_playwright
from app.database import SessionLocal
from datetime import datetime
import re

async def extract_work_order_info(row):
    """Extract work order information from WorkFossa div structure"""
    try:
        # Get the full text content first for debugging
        full_text = await row.inner_text()
        if not full_text or full_text.strip() == "":
            print("   ❌ Empty element, skipping...")
            return None
            
        print(f"   🔍 Row text preview: {full_text[:100].strip()}...")
        
        # Initialize fields
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
        
        # Extract Job ID (W-xxxxx format)
        work_id_links = await row.query_selector_all("a")
        for link in work_id_links:
            link_text = await link.inner_text()
            if link_text and link_text.strip().startswith("W-"):
                job_id = link_text.strip().replace("W-", "")
                print(f"   📝 Found Job ID: W-{job_id}")
                break
        
        # Extract Service Name (from Reason field)
        if "Reason:" in full_text:
            reason_match = re.search(r'Reason:\s*([^\n]+)', full_text)
            if reason_match:
                service_name = reason_match.group(1).strip()
        
        # Extract Customer Name
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
        
        # Extract service codes
        service_matches = re.findall(r'\((\d{4})\)', full_text)
        if service_matches:
            service_code = service_matches[0]
        
        # Extract items
        item_matches = re.findall(r'(\d+)\s*x\s*([^(]+)', full_text)
        for match in item_matches:
            quantity, item_name = match
            service_items.append(f"{quantity} x {item_name.strip()}")
        
        # Extract dates and creator
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
            
            # Extract visit number from URL
            visit_id_match = re.search(r'/visits/(\d+)', visit_url)
            if visit_id_match:
                visit_number = visit_id_match.group(1)
        
        print(f"   ✅ Extracted - ID: {job_id}, Customer: {customer_name}, Store: {store_number}")
        
        return {
            'job_id': job_id,
            'store_number': store_number,
            'customer_name': customer_name,
            'service_code': service_code,
            'service_name': service_name,
            'service_items': service_items,
            'created_date': created_date,
            'created_by': created_by,
            'scheduled_date': scheduled_date,
            'visit_url': visit_url,
            'visit_number': visit_number,
            'customer_url': customer_url,
            'raw_text': full_text.strip()
        }
    except Exception as e:
        print(f"   ❌ Error extracting work order: {e}")
        import traceback
        traceback.print_exc()
        return None

async def debug_scraping():
    """Test work order scraping with visible browser and detailed logging"""
    
    print("="*80)
    print("WORK ORDER SCRAPING DEBUG TEST")
    print("="*80)
    print("Testing with visible browser and detailed logging...")
    print("This will automatically proceed through each step with pauses.\n")
    
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
        
        print(f"✅ Found credentials for user")
        print("\n🚀 Launching browser (visible mode)...")
        
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,  # Visible browser
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 900},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        print("✅ Browser launched successfully")
        
        # Enable console logging
        page.on("console", lambda msg: print(f"   🌐 Browser console: {msg.text}"))
        page.on("pageerror", lambda error: print(f"   ❌ Page error: {error}"))
        
        # Login
        print("\n🔐 Navigating to WorkFossa login page...")
        print("   URL: https://app.workfossa.com")
        
        try:
            response = await page.goto('https://app.workfossa.com', wait_until='networkidle', timeout=30000)
            print(f"   Response status: {response.status if response else 'No response'}")
            await page.wait_for_timeout(2000)
            print("✅ On login page")
        except Exception as e:
            print(f"❌ Failed to load login page: {e}")
            # Take screenshot
            await page.screenshot(path="login_error.png")
            print("   📸 Screenshot saved: login_error.png")
            raise
        
        print("\n📝 Filling login credentials...")
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        print("✅ Credentials filled")
        
        print("\n🔑 Clicking login button...")
        await page.click('text=Log In')
        print("⏳ Waiting for login to complete...")
        
        # Wait for navigation or dashboard to appear
        try:
            await page.wait_for_url("**/app/**", timeout=15000)
            print("✅ Login successful - dashboard loaded")
        except:
            print("⚠️  Login may have timed out, checking current URL...")
            current_url = page.url
            print(f"   Current URL: {current_url}")
            if "/app/" in current_url:
                print("✅ Login successful (already on app page)")
            else:
                print("❌ Login failed - not on app page")
                await page.screenshot(path="login_failed.png")
                print("   📸 Screenshot saved: login_failed.png")
                raise Exception("Login failed")
        
        await page.wait_for_timeout(2000)
        
        # Navigate to work orders
        print(f"\n🌐 Navigating to work orders page...")
        print(f"   URL: https://app.workfossa.com/app/work/list")
        
        try:
            response = await page.goto("https://app.workfossa.com/app/work/list", wait_until="domcontentloaded", timeout=30000)
            print(f"   Response status: {response.status if response else 'No response'}")
        except Exception as e:
            print(f"❌ Failed to navigate to work orders: {e}")
            await page.screenshot(path="work_orders_nav_error.png")
            print("   📸 Screenshot saved: work_orders_nav_error.png")
            raise
        
        # Wait for table content to appear
        print("   Waiting for table content to load...")
        try:
            await page.wait_for_selector("tbody tr, table tr, .work-list-item", timeout=10000)
            print("   ✅ Content detected")
        except:
            print("   ⚠️  Content selector timeout, taking screenshot...")
            await page.screenshot(path="no_content.png")
            print("   📸 Screenshot saved: no_content.png")
        
        await page.wait_for_timeout(2000)
        print("✅ On work orders page")
        
        # Try to change page size
        print("\n🔧 Attempting to change page size to 100...")
        
        try:
            # Try WorkFossa custom dropdown first  
            custom_dropdown = await page.query_selector("div.ks-select-selection:has-text('Show 25')")
            if custom_dropdown:
                print("   Found custom dropdown, clicking...")
                await custom_dropdown.click()
                await page.wait_for_timeout(1000)
                
                # Try to find and click 100 option
                option_100 = await page.query_selector("li:has-text('Show 100'), div:has-text('Show 100')")
                if option_100:
                    await option_100.click()
                    print("   ✅ Changed page size to 100")
                    await page.wait_for_load_state("networkidle")
                    await page.wait_for_timeout(3000)
                else:
                    print("   ❌ Could not find 100 option")
            else:
                print("   ⚠️  No page size dropdown found")
        except Exception as e:
            print(f"   ⚠️  Could not change page size: {e}")
        
        # Save HTML and screenshot
        print("\n💾 Saving page HTML and screenshot for debugging...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        html_filename = f"work_orders_debug_{timestamp}.html"
        html_content = await page.content()
        with open(html_filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"   ✅ HTML saved to: {html_filename}")
        
        screenshot_filename = f"work_orders_debug_{timestamp}.png"
        await page.screenshot(path=screenshot_filename, full_page=True)
        print(f"   📸 Screenshot saved to: {screenshot_filename}")
        
        # Extract work orders
        print("\n📋 Looking for work orders...")
        
        # Try multiple selectors
        selectors_to_try = [
            "div.work-list-item",
            ".work-list-item",
            "tbody tr",
            "table tr:has(td)",
            "tr:has(td input[type='checkbox'])",
            "[data-id]",
            "[data-work-order-id]"
        ]
        
        rows = []
        for selector in selectors_to_try:
            elements = await page.query_selector_all(selector)
            print(f"   Selector '{selector}': found {len(elements)} elements")
            
            if elements and len(elements) > 0:
                # Check if elements contain work order data
                for element in elements[:3]:  # Check first 3
                    text = await element.text_content()
                    if text and 'W-' in text:
                        rows = elements
                        print(f"   ✅ Using selector '{selector}' - found {len(rows)} work order rows")
                        break
                if rows:
                    break
        
        if len(rows) > 0:
            print(f"\n   Total work order rows found: {len(rows)}")
            print("   Processing first work order:")
            
            work_order = await extract_work_order_info(rows[0])
            if work_order:
                print(f"\n   ✅ Successfully extracted work order:")
                print(f"      Job ID: '{work_order['job_id']}'")
                print(f"      Customer: '{work_order['customer_name']}'")
                print(f"      Store: '{work_order['store_number']}'")
                print(f"      Service Code: '{work_order['service_code']}'")
                print(f"      Service Name: '{work_order['service_name']}'")
                if work_order['service_items']:
                    print(f"      Service Items: {', '.join(work_order['service_items'])}")
                
                # Show success
                print("\n✅ SCRAPING IS WORKING!")
                print("   Work orders are being found and extracted successfully.")
            else:
                print("   ❌ Could not extract work order data from first row")
                print("   This might be why scraping is failing.")
        else:
            print("\n   ❌ NO WORK ORDERS FOUND!")
            print("   This is likely why scraping is showing failures.")
            print("\n   Possible reasons:")
            print("   1. Page structure has changed")
            print("   2. Selectors need updating")
            print("   3. Data is loading dynamically and needs more wait time")
            print("   4. User doesn't have access to work orders")
        
        print("\n📊 Test Summary:")
        print(f"   - Login: {'✅ Success' if '/app/' in page.url else '❌ Failed'}")
        print(f"   - Navigation to work orders: ✅ Success")
        print(f"   - Work orders found: {'✅ Yes' if rows else '❌ No'}")
        print(f"   - Data extraction: {'✅ Working' if rows and work_order else '❌ Failed'}")
        
        # Keep browser open for 10 seconds to observe
        print("\n⏳ Keeping browser open for 10 seconds...")
        await page.wait_for_timeout(10000)
        
    except Exception as e:
        print(f"\n❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
        
        # Try to take final screenshot
        try:
            if page:
                await page.screenshot(path="error_final.png")
                print("\n📸 Final screenshot saved: error_final.png")
        except:
            pass
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()
        db.close()
        print("\n👋 Test completed")

if __name__ == "__main__":
    print("\n🚀 Starting Work Order Scraping Debug Test")
    print("   Browser will be visible for debugging")
    print("   Watch for any errors or issues...\n")
    
    asyncio.run(debug_scraping())