#!/usr/bin/env python3
"""Non-interactive test for work order extraction"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from playwright.async_api import async_playwright
from app.database import SessionLocal
from datetime import datetime
import json
import re

async def extract_work_order_info(row):
    """Extract work order information from WorkFossa div structure"""
    try:
        import re
        
        # Get the full text content first for debugging
        full_text = await row.inner_text()
        if not full_text or full_text.strip() == "":
            return None
            
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
                break
        
        # Extract Service Name (from Reason field)
        if "Reason:" in full_text:
            reason_match = re.search(r'Reason:\s*([^\n]+)', full_text)
            if reason_match:
                service_name = reason_match.group(1).strip()
        
        # Extract Customer Name - first customer link
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
            
            # Try to extract date from visit section
            parent = await visit_link.evaluate_handle("el => el.parentElement")
            if parent:
                parent_text = await parent.inner_text()
                date_match = re.search(r'(\d{2}/\d{2}/\d{4})', parent_text)
                if date_match:
                    scheduled_date = date_match.group(1)
        
        # Extract Instructions
        if "Calibrate" in full_text:
            instructions_match = re.search(r'(Calibrate[^.]+\.(?:[^.]+\.)*)', full_text)
            if instructions_match:
                instructions = instructions_match.group(1).strip()
                instructions = instructions.replace(", more...", "")
        
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
            'customer_url': customer_url,
            'instructions': instructions,
            'raw_text': full_text.strip()
        }
    except Exception as e:
        print(f"❌ Error extracting work order: {e}")
        import traceback
        traceback.print_exc()
        return None

async def test_extraction():
    """Test work order extraction without interaction"""
    
    print("=" * 80)
    print("NON-INTERACTIVE WORK ORDER EXTRACTION TEST")
    print("=" * 80)
    
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
            return
        
        print(f"✅ Found credentials for user")
        
        print("\n🚀 Launching browser (headless mode)...")
        
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,  # Headless for non-interactive
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 900},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        print("✅ Browser launched successfully")
        
        # Login
        print("\n🔐 Navigating to WorkFossa...")
        await page.goto('https://app.workfossa.com')
        await page.wait_for_timeout(2000)
        
        print("📝 Filling login credentials...")
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        
        print("🔑 Logging in...")
        await page.click('text=Log In')
        await page.wait_for_timeout(7000)
        print("✅ Login successful")
        
        # Navigate to work orders
        print(f"\n🌐 Navigating to work orders page...")
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="domcontentloaded")
        
        # Wait for content
        try:
            await page.wait_for_selector("tbody tr, table tr, div.work-list-item", timeout=5000)
        except:
            pass
        
        await page.wait_for_timeout(3000)
        print("✅ On work orders page")
        
        # Try to change page size
        print("\n🔧 Attempting to change page size to 100...")
        try:
            custom_dropdown = await page.query_selector("div.ks-select-selection:has-text('Show 25')")
            if custom_dropdown:
                await custom_dropdown.click()
                await page.wait_for_timeout(1000)
                
                option_100 = await page.query_selector("li:has-text('Show 100')")
                if option_100:
                    await option_100.click()
                    print("✅ Changed page size to 100")
                    await page.wait_for_load_state("networkidle")
                    await page.wait_for_timeout(3000)
        except:
            print("⚠️ Could not change page size")
        
        # Extract work orders
        print("\n📋 Extracting work orders...")
        
        # Try multiple selectors
        selectors = [
            "div.work-list-item",
            ".work-list-item",
            "tbody tr",
            "table tr:has(td)"
        ]
        
        rows = []
        for selector in selectors:
            elements = await page.query_selector_all(selector)
            if elements and len(elements) > 0:
                # For work-list-item, use directly
                if "work-list-item" in selector:
                    rows = elements
                    print(f"✅ Found {len(rows)} work orders using '{selector}'")
                    break
                else:
                    # Filter valid rows
                    for element in elements:
                        text_content = await element.text_content()
                        if text_content and 'W-' in text_content and len(text_content.strip()) > 10:
                            rows.append(element)
                    if rows:
                        print(f"✅ Found {len(rows)} work orders using '{selector}'")
                        break
        
        if len(rows) > 0:
            print(f"\n🔍 Testing extraction on first 3 work orders:")
            
            for i in range(min(3, len(rows))):
                print(f"\n{'='*60}")
                print(f"Work Order {i+1}:")
                work_order = await extract_work_order_info(rows[i])
                
                if work_order:
                    print(f"✅ Successfully extracted data:")
                    print(f"   Job ID: {work_order['job_id']}")
                    print(f"   Customer: {work_order['customer_name']}")
                    print(f"   Store #: {work_order['store_number']}")
                    print(f"   Address: {work_order['address']}")
                    print(f"   -- Address Components --")
                    print(f"   Street: {work_order['street']}")
                    print(f"   City/State: {work_order['city_state']}")
                    print(f"   County: {work_order['county']}")
                    print(f"   -- Service Info --")
                    print(f"   Service Code: {work_order['service_code']}")
                    print(f"   Service Name: {work_order['service_name']}")
                    print(f"   Service Items: {', '.join(work_order['service_items'])}")
                    print(f"   -- Creation Info --")
                    print(f"   Created By: {work_order['created_by']}")
                    print(f"   Created Date: {work_order['created_date']}")
                    print(f"   Scheduled Date: {work_order['scheduled_date']}")
                    print(f"   -- URLs --")
                    print(f"   Customer URL: {work_order['customer_url']}")
                    print(f"   Visit URL: {work_order['visit_url']}")
                    if work_order['instructions']:
                        print(f"   Instructions: {work_order['instructions'][:100]}...")
                else:
                    print("❌ Failed to extract work order data")
        else:
            print("❌ No work orders found")
        
        print("\n✅ Test complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()
        db.close()

if __name__ == "__main__":
    print("\n🚀 Starting Non-Interactive Work Order Extraction Test")
    asyncio.run(test_extraction())