#!/usr/bin/env python3
"""Interactive dispenser scraping test with pauses - Version 2"""

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

async def extract_dispenser_info(container_text, dispenser_title):
    """Extract dispenser information from container text"""
    # Extract Make from title
    make = ""
    manufacturers = ['Gilbarco', 'Wayne', 'Dresser', 'Tokheim', 'Bennett']
    for mfr in manufacturers:
        if mfr in dispenser_title:
            make = mfr
            break
    
    # Extract Make if not found in title
    if not make:
        make_match = re.search(r'(?:MAKE|Make):\s*([A-Za-z0-9\s]+?)(?=\n|(?:MODEL|Model):|$)', container_text, re.IGNORECASE)
        if make_match:
            make = make_match.group(1).strip()
    
    # Extract Model
    model = ""
    model_match = re.search(r'(?:MODEL|Model):\s*([A-Za-z0-9\s]+?)(?=\n|(?:GRADE|Grade)|$)', container_text, re.IGNORECASE)
    if model_match:
        model = model_match.group(1).strip()
    
    # Extract Stand Alone Code
    stand_alone_code = ""
    sa_match = re.search(r'STAND ALONE CODE\s*(\d+)', container_text, re.IGNORECASE)
    if sa_match:
        stand_alone_code = sa_match.group(1).strip()
    
    # Extract Number of Nozzles
    number_of_nozzles = ""
    nozzles_match = re.search(r'NUMBER OF NOZZLES.*?\s+(\d+)', container_text, re.IGNORECASE)
    if nozzles_match:
        number_of_nozzles = nozzles_match.group(1).strip()
    
    # Extract Meter Type
    meter_type = ""
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
    
    return {
        'make': make,
        'model': model,
        'stand_alone_code': stand_alone_code,
        'number_of_nozzles': number_of_nozzles,
        'meter_type': meter_type,
        'grades': grades,
        'grades_list': grades_list,
        'dispenser_number': dispenser_number
    }

async def interactive_test():
    """Test dispenser scraping with pauses at each step"""
    
    print("Starting interactive test...")
    
    db = SessionLocal()
    browser = None
    playwright = None
    
    try:
        # Get work order details
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
        
        print("="*60)
        print("INTERACTIVE DISPENSER SCRAPING TEST")
        print("="*60)
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
        
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        print("✅ Browser launched")
        
        # Login
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
        
        print("\n🔑 Step 4: Clicking login button...")
        await wait_for_user()
        
        await page.click('text=Log In')
        print("⏳ Waiting for login to complete...")
        await page.wait_for_timeout(7000)
        print("✅ Login successful")
        
        # Navigate to customer page
        print(f"\n🌐 Step 5: Navigating to customer location page...")
        print(f"   URL: {customer_url}")
        await wait_for_user()
        
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        print("✅ On customer page")
        
        # Click Equipment tab
        print("\n🔍 Step 6: Looking for Equipment tab...")
        await wait_for_user()
        
        await page.click('text=Equipment')
        await page.wait_for_timeout(2000)
        print("✅ Clicked Equipment tab")
        
        # Close modal if present
        try:
            await page.click('button:has-text("Cancel")', timeout=1000)
            await page.wait_for_timeout(1000)
            print("   ✅ Closed modal")
        except:
            pass
        
        # Click Dispenser section
        print("\n👆 Step 7: Clicking Dispenser section...")
        await wait_for_user()
        
        await page.click('text=/Dispenser \\(\\d+\\)/')
        await page.wait_for_timeout(2000)
        print("✅ Clicked Dispenser section")
        
        # Extract dispensers
        print("\n📋 Step 8: Extracting dispenser information...")
        await wait_for_user()
        
        dispenser_containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        print(f"   Found {len(dispenser_containers)} dispenser containers")
        
        dispensers = []
        for container in dispenser_containers:
            try:
                # Check if this is a dispenser container
                if await container.locator('.px-2').count() > 0:
                    # Extract title
                    title_elem = container.locator('.px-2 .flex.align-start > div').first
                    dispenser_title = ""
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
                    
                    # Get full text
                    container_text = await container.inner_text()
                    
                    # Extract all fields
                    info = await extract_dispenser_info(container_text, dispenser_title)
                    
                    dispenser_data = {
                        'title': dispenser_title,
                        'serial_number': serial,
                        **info
                    }
                    
                    dispensers.append(dispenser_data)
                    print(f"\n   ✅ Dispenser found:")
                    print(f"      Title: {dispenser_title}")
                    print(f"      S/N: {serial}")
                    print(f"      Make: {info['make']}")
                    print(f"      Model: {info['model']}")
                    print(f"      Grades: {', '.join(info['grades_list']) if info['grades_list'] else info['grades']}")
                    print(f"      Dispenser Number(s): {info['dispenser_number']}")
                    print(f"      Stand Alone Code: {info['stand_alone_code']}")
                    print(f"      Number of Nozzles: {info['number_of_nozzles']}")
                    print(f"      Meter Type: {info['meter_type']}")
            except Exception as e:
                print(f"   Error extracting dispenser: {e}")
                import traceback
                traceback.print_exc()
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
    asyncio.run(interactive_test())