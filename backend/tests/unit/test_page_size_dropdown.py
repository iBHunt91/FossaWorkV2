#!/usr/bin/env python3
"""
Test the page size dropdown issue in scheduled jobs
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.browser_automation import browser_automation
from app.database import SessionLocal
from app.models import UserCredential
import base64

async def test_page_size_dropdown():
    print("🔍 Testing Page Size Dropdown Issue")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    session_id = f"test_dropdown_{int(datetime.utcnow().timestamp())}"
    
    # Get credentials
    print("\n1. Getting credentials...")
    db = SessionLocal()
    try:
        creds = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa",
            UserCredential.is_active == True
        ).first()
        
        if not creds:
            print("❌ No credentials found")
            return
            
        # Use the simple decrypt function
        def simple_decrypt(encrypted_password: str) -> str:
            """Simple base64 decoding"""
            try:
                return base64.b64decode(encrypted_password.encode()).decode()
            except:
                return ""
        
        credentials = {
            'username': simple_decrypt(creds.encrypted_username),
            'password': simple_decrypt(creds.encrypted_password)
        }
        print("✅ Credentials retrieved")
    finally:
        db.close()
    
    try:
        # Initialize browser
        print("\n2. Initializing browser...")
        if not browser_automation.browser:
            await browser_automation.initialize()
        print("✅ Browser initialized")
        
        # Create session
        print("\n3. Creating browser session...")
        session_created = await browser_automation.create_session(session_id)
        if not session_created:
            print("❌ Failed to create session")
            return
        print(f"✅ Session created: {session_id}")
        
        # Login
        print("\n4. Logging in to WorkFossa...")
        login_success = await browser_automation.navigate_to_workfossa(session_id, credentials)
        if not login_success:
            print("❌ Login failed")
            return
        print("✅ Login successful")
        
        # Get page
        page = browser_automation.pages.get(session_id)
        if not page:
            print("❌ No page found in session")
            return
            
        # Navigate to work orders
        print("\n5. Navigating to work orders page...")
        work_orders_url = "https://app.workfossa.com/app/work/list?work_visit_completion=none%7C%7CNo%20visits%20completed%7C%7CWork%20Visits%20Completed&order_direction=asc"
        await page.goto(work_orders_url, wait_until="domcontentloaded", timeout=15000)
        print("✅ Navigated to work orders page")
        
        # Wait for page to stabilize
        print("\n6. Waiting for page to stabilize...")
        await page.wait_for_timeout(3000)
        
        # Take screenshot before attempting dropdown
        await page.screenshot(path="before_dropdown_attempt.png")
        print("📸 Screenshot saved: before_dropdown_attempt.png")
        
        # Try different methods to find the dropdown
        print("\n7. Testing different methods to find page size dropdown...")
        
        # Method 1: Original selector
        print("\n   Method 1: Looking for div.ks-select-selection...")
        dropdown1 = await page.query_selector("div.ks-select-selection:has-text('Show 25')")
        if dropdown1:
            print("   ✅ Found with method 1!")
            # Try to get more info
            text = await dropdown1.text_content()
            print(f"   Text content: {text}")
            # Try clicking
            await dropdown1.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="dropdown_clicked_method1.png")
            print("   📸 Screenshot after click: dropdown_clicked_method1.png")
        else:
            print("   ❌ Not found with method 1")
        
        # Method 2: Look for any element with "Show 25"
        print("\n   Method 2: Looking for any element with 'Show 25'...")
        elements = await page.query_selector_all("*:has-text('Show 25')")
        print(f"   Found {len(elements)} elements with 'Show 25'")
        for i, elem in enumerate(elements):
            tag = await elem.evaluate("el => el.tagName")
            classes = await elem.get_attribute("class") or ""
            print(f"   Element {i+1}: <{tag}> class='{classes}'")
        
        # Method 3: Look for select elements
        print("\n   Method 3: Looking for <select> elements...")
        selects = await page.query_selector_all("select")
        print(f"   Found {len(selects)} select elements")
        for i, select in enumerate(selects):
            options = await select.query_selector_all("option")
            option_values = []
            for opt in options:
                value = await opt.text_content()
                option_values.append(value)
            print(f"   Select {i+1}: {option_values}")
            
        # Method 4: Wait longer and try again
        print("\n   Method 4: Waiting longer for dynamic content...")
        await page.wait_for_timeout(5000)
        
        # Try network idle
        print("   Waiting for network idle...")
        await page.wait_for_load_state("networkidle")
        
        dropdown4 = await page.query_selector("div.ks-select-selection:has-text('Show 25')")
        if dropdown4:
            print("   ✅ Found after waiting for network idle!")
        else:
            print("   ❌ Still not found after network idle")
            
        # Method 5: Look for pagination area
        print("\n   Method 5: Looking in pagination area...")
        pagination = await page.query_selector(".pagination, .page-controls, .table-footer")
        if pagination:
            print("   ✅ Found pagination area")
            # Look for dropdown in this area
            dropdown_in_pagination = await pagination.query_selector("div.ks-select-selection, select")
            if dropdown_in_pagination:
                print("   ✅ Found dropdown in pagination area!")
            else:
                print("   ❌ No dropdown found in pagination area")
        else:
            print("   ❌ No pagination area found")
            
        # Final screenshot
        await page.screenshot(path="final_page_state.png")
        print("\n📸 Final screenshot: final_page_state.png")
        
        # Get page content for analysis
        print("\n8. Saving page HTML for analysis...")
        content = await page.content()
        with open("work_orders_page.html", "w", encoding="utf-8") as f:
            f.write(content)
        print("📄 Page HTML saved: work_orders_page.html")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        if session_id and hasattr(browser_automation, 'close_session'):
            await browser_automation.close_session(session_id)
            print("\n✅ Session closed")

if __name__ == "__main__":
    asyncio.run(test_page_size_dropdown())