#!/usr/bin/env python3
"""Take screenshot of a failed work order"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.database import SessionLocal
from app.services.browser_automation import BrowserAutomationService
from app.services.workfossa_automation import WorkFossaAutomationService
from sqlalchemy import text
import json
from datetime import datetime

async def screenshot_failed_order():
    """Take screenshot of a work order that failed dispenser scraping"""
    
    db = SessionLocal()
    browser_service = None
    automation = None
    
    try:
        # Get a failed work order with customer URL
        failed_order = db.execute(text("""
            SELECT id, external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id = '110296'
        """)).fetchone()
        
        if not failed_order:
            print("Failed order not found")
            return
            
        data = json.loads(failed_order.scraped_data) if failed_order.scraped_data else {}
        customer_url = data.get('customer_url')
        
        if not customer_url:
            print(f"No customer URL for {failed_order.external_id}")
            return
            
        print(f"🔍 Checking failed work order: {failed_order.external_id} - {failed_order.site_name}")
        print(f"   Customer URL: {customer_url}")
        
        # Initialize services
        browser_service = BrowserAutomationService()
        automation = WorkFossaAutomationService(browser_service)
        
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No WorkFossa credentials found")
            return
            
        # Create session and login
        print("🔐 Creating session and logging in...")
        session_id = "screenshot_session"
        await automation.create_session(
            session_id=session_id,
            user_id='7bea3bdb7e8e303eacaba442bd824004',
            credentials={
                'username': cred.username,
                'password': cred.password
            }
        )
        
        login_success = await automation.login_to_workfossa(session_id)
        if not login_success:
            print("❌ Login failed")
            return
            
        # Get page
        session_data = automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            print("❌ No page available")
            return
        page = session_data['page']
            
        # Navigate to customer URL
        print(f"🌐 Navigating to customer page...")
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Take initial screenshot
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"failed_order_{failed_order.external_id}_{timestamp}.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"📸 Screenshot saved: {screenshot_path}")
        
        # Try to find Equipment tab
        print("\n🔍 Looking for Equipment tab...")
        equipment_found = False
        
        # Check various selectors
        selectors = [
            'text="Equipment"',
            'a:has-text("Equipment")',
            'button:has-text("Equipment")',
            '[href*="equipment"]',
            'li:has-text("Equipment")'
        ]
        
        for selector in selectors:
            try:
                element = await page.locator(selector).first.element_handle(timeout=1000)
                if element:
                    print(f"   ✅ Found with selector: {selector}")
                    equipment_found = True
                    # Click it
                    await page.click(selector, timeout=5000)
                    await page.wait_for_timeout(2000)
                    
                    # Take screenshot after clicking
                    screenshot_path2 = f"failed_order_{failed_order.external_id}_equipment_{timestamp}.png"
                    await page.screenshot(path=screenshot_path2, full_page=True)
                    print(f"   📸 Equipment tab screenshot: {screenshot_path2}")
                    break
            except:
                pass
                
        if not equipment_found:
            print("   ❌ Equipment tab not found with any selector")
            
            # Check page content
            content = await page.content()
            if "equipment" in content.lower():
                print("   ℹ️  The word 'equipment' appears in the page")
            else:
                print("   ⚠️  The word 'equipment' does NOT appear in the page")
                
            if "this location was deleted" in content.lower():
                print("   ⚠️  Location appears to be DELETED")
            elif "not found" in content.lower():
                print("   ⚠️  Page shows NOT FOUND error")
                
        # Get visible text
        visible_text = await page.evaluate("document.body.innerText")
        print(f"\n📄 Page content preview:")
        print(visible_text[:500] + "..." if len(visible_text) > 500 else visible_text)
        
        print(f"\n✅ Screenshots saved in current directory")
        print(f"   Main: {screenshot_path}")
        if equipment_found:
            print(f"   Equipment: {screenshot_path2}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if automation and 'session_id' in locals():
            await automation.cleanup_session(session_id)
        db.close()

if __name__ == "__main__":
    asyncio.run(screenshot_failed_order())