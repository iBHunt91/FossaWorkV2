#!/usr/bin/env python3
"""Simple screenshot of failed work order"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from playwright.async_api import async_playwright
from app.database import SessionLocal
from sqlalchemy import text
import json
from datetime import datetime

async def screenshot_failed():
    """Take screenshot of failed work order using playwright directly"""
    
    db = SessionLocal()
    playwright = None
    browser = None
    
    try:
        # Get failed order
        failed_order = db.execute(text("""
            SELECT external_id, site_name, scraped_data
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
        
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
            
        # Launch browser
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,  # Show browser for debugging
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        page = await context.new_page()
        
        # Login to WorkFossa
        print("🔐 Logging in...")
        await page.goto('https://app.workfossa.com/login')
        await page.wait_for_timeout(2000)
        
        # Fill login form
        await page.fill('input[name="email"]', cred.username)
        await page.fill('input[name="password"]', cred.password)
        await page.click('button[type="submit"]')
        
        # Wait for navigation
        await page.wait_for_url('**/app/**', timeout=10000)
        print("✅ Logged in successfully")
        
        # Navigate to customer page
        print(f"🌐 Navigating to customer page...")
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Take screenshot
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"failed_order_{failed_order.external_id}_{timestamp}.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"📸 Screenshot saved: {screenshot_path}")
        
        # Check page content
        content = await page.content()
        visible_text = await page.inner_text('body')
        
        print("\n📄 Page analysis:")
        if "this location was deleted" in content.lower():
            print("   ⚠️  LOCATION IS DELETED")
        elif "not found" in content.lower():
            print("   ⚠️  Page shows NOT FOUND")
        elif "equipment" in content.lower():
            print("   ✅ Page contains 'equipment' text")
        else:
            print("   ❌ No 'equipment' text found")
            
        # Show first 500 chars of visible text
        print(f"\n📝 Visible text preview:")
        print(visible_text[:500] + "..." if len(visible_text) > 500 else visible_text)
        
        # Wait for user to see browser
        print("\n⏸️  Browser will remain open for 10 seconds...")
        await page.wait_for_timeout(10000)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()
        db.close()

if __name__ == "__main__":
    asyncio.run(screenshot_failed())