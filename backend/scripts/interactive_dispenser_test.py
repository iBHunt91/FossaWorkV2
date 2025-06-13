#!/usr/bin/env python3
"""Interactive dispenser scraping test with pauses"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import re
from playwright.async_api import async_playwright
from app.database import SessionLocal
from sqlalchemy import text as sql_text
import json

# Import the fuel grades ordering function
try:
    from app.data.fuel_grades import get_ordered_fuel_grades
except ImportError:
    # Fallback if not available
    def get_ordered_fuel_grades(grades):
        return grades

async def wait_for_user():
    """Wait for user to press Enter"""
    print("\n⏸️  Press Enter to continue...")
    await asyncio.get_event_loop().run_in_executor(None, input)

async def interactive_test():
    """Test dispenser scraping with pauses at each step"""
    
    db = SessionLocal()
    playwright = None
    browser = None
    
    try:
        # Get work order 110296
        work_order = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id = '110296'
        """)).fetchone()
        
        if not work_order:
            print("❌ Work order 110296 not found")
            return
            
        data = json.loads(work_order.scraped_data) if work_order.scraped_data else {}
        customer_url = data.get('customer_url', 'https://app.workfossa.com/app/customers/locations/32951/')
        
        print("=" * 60)
        print("INTERACTIVE DISPENSER SCRAPING TEST")
        print("=" * 60)
        print(f"Work Order: {work_order.external_id} - {work_order.site_name}")
        print(f"Customer URL: {customer_url}")
        
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
            
        print("\n🚀 Step 1: Launching browser (visible mode)...")
        await wait_for_user()
        
        # Launch browser in visible mode
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,  # Visible browser
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        print("✅ Browser launched")
        
        print("\n🔐 Step 2: Navigating to WorkFossa login page...")
        await wait_for_user()
        
        await page.goto('https://app.workfossa.com')
        await page.wait_for_timeout(2000)
        print("✅ On login page")
        
        print("\n📝 Step 3: Filling login credentials...")
        await wait_for_user()
        
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        print("✅ Credentials filled")
        
        print("\n🔑 Step 4: Looking for login button...")
        await wait_for_user()
        
        # Try different selectors for the login button
        login_selectors = [
            'button[type="submit"]',
            'button:has-text("Login")',
            'button:has-text("Sign In")',
            'input[type="submit"]',
            '.btn-primary',
            'button.btn'
        ]
        
        login_clicked = False
        for selector in login_selectors:
            try:
                if await page.locator(selector).is_visible():
                    print(f"   Found login button with selector: {selector}")
                    await page.click(selector, timeout=5000)
                    login_clicked = True
                    break
            except:
                pass
        
        if not login_clicked:
            print("   ❌ Could not find login button automatically")
            print("   ⏸️  Please manually click the login button...")
            await wait_for_user()
        
        print("⏳ Waiting for login to complete...")
        
        try:
            await page.wait_for_url('**/app/**', timeout=10000)
            print("✅ Login successful")
        except:
            print("⚠️  Login might have failed or taken longer than expected")
        
        print("\n🌐 Step 5: Navigating to customer location page...")
        print(f"   URL: {customer_url}")
        await wait_for_user()
        
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        print("✅ On customer page")
        
        print("\n🔍 Step 6: Looking for Equipment tab...")
        print("   Let me check what tabs are visible...")
        await wait_for_user()
        
        # Try multiple selectors
        equipment_selectors = [
            'text="Equipment"',
            'a:has-text("Equipment")',
            'button:has-text("Equipment")',
            '[href*="equipment"]',
            'li:has-text("Equipment")',
            '.nav-link:has-text("Equipment")',
            '.tab:has-text("Equipment")'
        ]
        
        equipment_found = False
        for selector in equipment_selectors:
            try:
                element = await page.locator(selector).first.element_handle(timeout=1000)
                if element:
                    print(f"   ✅ Found Equipment tab with selector: {selector}")
                    equipment_found = True
                    break
            except:
                pass
        
        if not equipment_found:
            print("   ❌ Could not find Equipment tab with standard selectors")
            print("\n   Let me check all clickable elements with 'Equipment' text...")
            
            # Get all elements with Equipment text
            equipment_elements = await page.locator('*:has-text("Equipment")').all()
            print(f"   Found {len(equipment_elements)} elements with 'Equipment' text")
            
            for i, elem in enumerate(equipment_elements):
                try:
                    tag = await elem.evaluate('el => el.tagName')
                    text = await elem.inner_text()
                    print(f"   {i+1}. <{tag}> - {text.strip()}")
                except:
                    pass
        
        print("\n👆 Step 7: Clicking Equipment tab...")
        await wait_for_user()
        
        if equipment_found:
            try:
                await page.click(selector, timeout=5000)
                await page.wait_for_timeout(2000)
                print("✅ Clicked Equipment tab")
            except Exception as e:
                print(f"❌ Failed to click Equipment tab: {e}")
        else:
            print("⚠️  Please manually click the Equipment tab in the browser")
            await wait_for_user()
        
        print("\n🔍 Step 8: Looking for Dispenser section...")
        await wait_for_user()
        
        # Check if dispenser section is visible
        dispenser_selectors = [
            'text="Dispenser"',
            'text="Dispensers"',
            'button:has-text("Dispenser")',
            'h3:has-text("Dispenser")',
            '.accordion:has-text("Dispenser")',
            '[data-toggle]:has-text("Dispenser")'
        ]
        
        dispenser_found = False
        for selector in dispenser_selectors:
            try:
                element = await page.locator(selector).first.element_handle(timeout=1000)
                if element:
                    print(f"   ✅ Found Dispenser section with selector: {selector}")
                    dispenser_found = True
                    
                    # Check if it's expanded
                    is_visible = await page.locator('.dispenser-content, .dispenser-details, [id*="dispenser"]').first.is_visible()
                    if is_visible:
                        print("   ✅ Dispenser section is already expanded")
                    else:
                        print("   ℹ️  Dispenser section found but collapsed")
                    break
            except:
                pass
        
        if not dispenser_found:
            print("   ❌ Could not find Dispenser section")
        
        print("\n👆 Step 9: Expanding Dispenser section (if needed)...")
        await wait_for_user()
        
        if dispenser_found and not is_visible:
            try:
                await page.click(selector)
                await page.wait_for_timeout(2000)
                print("✅ Clicked to expand Dispenser section")
            except:
                print("❌ Failed to expand Dispenser section")
        
        print("\n📋 Step 10: Extracting dispenser information...")
        await wait_for_user()
        
        # Look for dispenser containers using the correct selector
        dispenser_containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        print(f"   Found {len(dispenser_containers)} dispenser containers")
        
        # Extract dispenser data
        dispensers = []
        for container in dispenser_containers:
            try:
                # Check if this is a dispenser container (has the equipment info)
                if await container.locator('.px-2').count() > 0:
                    # Extract the main title (e.g., "1/2 - Regular, Plus, Diesel...")
                    # Look for the flex.align-start > div structure
                    title_elem = container.locator('.px-2 .flex.align-start > div').first
                    if await title_elem.count() > 0:
                        title_text = await title_elem.inner_text()
                        title_lines = title_text.strip().split('\n')
                        if title_lines:
                            dispenser_title = title_lines[0].strip()
                            
                            # Extract S/N
                            serial = ""
                            sn_elem = container.locator('.muted.text-tiny').first
                            if await sn_elem.count() > 0:
                                sn_text = await sn_elem.inner_text()
                                if 'S/N:' in sn_text:
                                    serial = sn_text.replace('S/N:', '').strip()
                            
                            # Extract Make from title (it's at the end)
                            make = ""
                            model = ""
                            
                            # Common manufacturers
                            manufacturers = ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett']
                            for mfr in manufacturers:
                                if mfr in dispenser_title:
                                    make = mfr
                                    break
                            
                            # Get full text to extract Make/Model fields
                            container_text = await container.inner_text()
                            
                            # Extract Make if not found in title
                            if not make:
                                make_match = re.search(r'(?:MAKE|Make):\s*([A-Za-z0-9\s]+?)(?=\n|(?:MODEL|Model):|$)', container_text, re.IGNORECASE)
                                if make_match:
                                    make = make_match.group(1).strip()
                            
                            # Extract Model
                            model_match = re.search(r'(?:MODEL|Model):\s*([A-Za-z0-9\s]+?)(?=\n|(?:GRADE|Grade)|$)', container_text, re.IGNORECASE)
                            if model_match:
                                model = model_match.group(1).strip()
                            
                            # Extract additional fields
                            stand_alone_code = ""
                            number_of_nozzles = ""
                            meter_type = ""
                            
                            # Extract Stand Alone Code
                            sa_match = re.search(r'STAND ALONE CODE\s*(\d+)', container_text, re.IGNORECASE)
                            if sa_match:
                                stand_alone_code = sa_match.group(1).strip()
                            
                            # Extract Number of Nozzles
                            nozzles_match = re.search(r'NUMBER OF NOZZLES.*?\s+(\d+)', container_text, re.IGNORECASE)
                            if nozzles_match:
                                number_of_nozzles = nozzles_match.group(1).strip()
                            
                            # Extract Meter Type
                            meter_match = re.search(r'METER TYPE\s*([^\n]+)', container_text, re.IGNORECASE)
                            if meter_match:
                                meter_type = meter_match.group(1).strip()
                            
                            # Extract grades
                            grades = ""
                            grades_list = []
                            grade_match = re.search(r'GRADE\s*([^\n]+?)(?=\s*STAND|$)', container_text, re.IGNORECASE)
                            if grade_match:
                                grades = grade_match.group(1).strip()
                                # Split grades and clean them up
                                grades_list = [g.strip() for g in grades.split(',')]
                                # Order the grades according to fuel_grades.py
                                grades_list = get_ordered_fuel_grades(grades_list)
                            
                            # Extract dispenser number from title
                            dispenser_number = ""
                            num_match = re.match(r'^(\d+(?:/\d+)?)', dispenser_title)
                            if num_match:
                                dispenser_number = num_match.group(1)
                            
                            dispenser_data = {
                                'title': dispenser_title,
                                'serial_number': serial,
                                'make': make,
                                'model': model,
                                'grades': grades,
                                'grades_list': grades_list,
                                'dispenser_number': dispenser_number,
                                'stand_alone_code': stand_alone_code,
                                'number_of_nozzles': number_of_nozzles,
                                'meter_type': meter_type
                            }
                            
                            dispensers.append(dispenser_data)
                            print(f"\n   ✅ Dispenser found:")
                            print(f"      Title: {dispenser_title}")
                            print(f"      S/N: {serial}")
                            print(f"      Make: {make}")
                            print(f"      Model: {model}")
                            print(f"      Grades: {', '.join(grades_list) if grades_list else grades}")
                            print(f"      Dispenser Number(s): {dispenser_number}")
                            print(f"      Stand Alone Code: {stand_alone_code}")
                            print(f"      Number of Nozzles: {number_of_nozzles}")
                            print(f"      Meter Type: {meter_type}")
            except Exception as e:
                print(f"   Error extracting dispenser: {e}")
                continue
        
        print(f"\n✅ Test complete. Found {len(dispensers)} dispensers")
        
        print("\n⏸️  Browser will remain open. Press Enter to close...")
        await wait_for_user()
        
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
        print("\n👋 Test ended")

if __name__ == "__main__":
    print("Starting interactive test...")
    asyncio.run(interactive_test())