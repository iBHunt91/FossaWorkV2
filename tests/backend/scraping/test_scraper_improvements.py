#!/usr/bin/env python3
"""Test dispenser scraper improvements"""

import sys
from pathlib import Path
# Add backend directory to path
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import asyncio
import re
from app.database import SessionLocal
from playwright.async_api import async_playwright
from sqlalchemy import text as sql_text

async def test_improvements():
    """Test the dispenser scraper improvements"""
    
    db = SessionLocal()
    
    try:
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
            
        print("🚀 Starting browser...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--disable-blink-features=AutomationControlled']
            )
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            )
            
            page = await context.new_page()
            
            # Login
            print("🔐 Logging in...")
            await page.goto('https://app.workfossa.com')
            await page.wait_for_timeout(2000)
            
            await page.fill('input[name="email"]', cred.username)
            await page.fill('input[name="password"]', cred.password)
            await page.click('text=Log In')
            await page.wait_for_timeout(7000)
            
            # Navigate
            print("🌐 Navigating to location...")
            await page.goto('https://app.workfossa.com/app/customers/locations/32951/', wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            # Click Equipment tab
            print("👆 Clicking Equipment tab...")
            await page.click('text=Equipment')
            await page.wait_for_timeout(2000)
            
            # Close modal if present
            try:
                await page.click('button:has-text("Cancel")', timeout=1000)
                await page.wait_for_timeout(1000)
            except:
                pass
            
            # Click Dispenser section
            print("👆 Clicking Dispenser section...")
            await page.click('text=Dispenser (8)')
            await page.wait_for_timeout(2000)
            
            # Extract first dispenser using the interactive test logic
            print("\n📋 Extracting first dispenser...")
            
            dispenser_containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
            print(f"Found {len(dispenser_containers)} dispenser containers")
            
            if dispenser_containers:
                container = dispenser_containers[0]
                
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
                
                # Extract additional fields
                stand_alone_code = ""
                sa_match = re.search(r'STAND ALONE CODE\s*(\d+)', container_text, re.IGNORECASE)
                if sa_match:
                    stand_alone_code = sa_match.group(1).strip()
                
                number_of_nozzles = ""
                nozzles_match = re.search(r'NUMBER OF NOZZLES.*?\s+(\d+)', container_text, re.IGNORECASE)
                if nozzles_match:
                    number_of_nozzles = nozzles_match.group(1).strip()
                
                meter_type = ""
                meter_match = re.search(r'METER TYPE\s*([^\n]+)', container_text, re.IGNORECASE)
                if meter_match:
                    meter_type = meter_match.group(1).strip()
                
                grades = ""
                grade_match = re.search(r'GRADE\s*([^\n]+?)(?=\s*STAND|$)', container_text, re.IGNORECASE)
                if grade_match:
                    grades = grade_match.group(1).strip()
                
                dispenser_number = ""
                num_match = re.match(r'^(\d+(?:/\d+)?)', dispenser_title)
                if num_match:
                    dispenser_number = num_match.group(1)
                
                print(f"\n✅ Dispenser found:")
                print(f"      Title: {dispenser_title}")
                print(f"      S/N: {serial}")
                print(f"      Make: {make}, Model: {model}")
                print(f"      Grades: {grades}")
                print(f"      Dispenser Number(s): {dispenser_number}")
                print(f"      Stand Alone Code: {stand_alone_code}")
                print(f"      Number of Nozzles: {number_of_nozzles}")
                print(f"      Meter Type: {meter_type}")
                
            await browser.close()
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_improvements())