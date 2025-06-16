#!/usr/bin/env python3
"""
Debug extraction for a single work order to see what's being found.
"""

import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from playwright.async_api import async_playwright
from app.database import SessionLocal
from app.core_models import UserCredential

async def debug_work_order_extraction():
    """Debug extraction for work order 129651"""
    
    db = SessionLocal()
    playwright = None
    browser = None
    
    try:
        # Get credentials
        user_id = '7bea3bdb7e8e303eacaba442bd824004'  # Bruce's user ID
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No credentials found")
            return
        
        print("✅ Found credentials")
        
        # Launch browser
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Login
        print("🔐 Logging in...")
        await page.goto('https://app.workfossa.com')
        await page.wait_for_timeout(2000)
        
        await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', cred.username)
        await page.fill('input[type="password"], input[name="password"], input[placeholder*="password" i]', cred.password)
        await page.click('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In")')
        await page.wait_for_timeout(3000)
        
        print("✅ Logged in")
        
        # Go to work orders page
        await page.goto('https://app.workfossa.com/app/work/list')
        await page.wait_for_timeout(3000)
        
        # Try to find work order 129651
        print("\n🔍 Looking for work order W-129651...")
        
        # Try to change page size
        try:
            await page.click('div.ks-select-selection:has-text("Show")')
            await page.wait_for_timeout(1000)
            await page.click('li:has-text("Show 100")')
            await page.wait_for_timeout(3000)
            print("✅ Changed page size to 100")
        except:
            print("⚠️  Could not change page size")
        
        # Look for the work order
        work_order_link = await page.query_selector('a:has-text("W-129651")')
        if work_order_link:
            print("✅ Found work order W-129651")
            
            # Get the parent row
            row = await work_order_link.evaluate_handle("el => el.closest('.work-list-item') || el.closest('tr')")
            
            # Get all text content
            full_text = await row.inner_text()
            print("\n📄 Full row text:")
            print("-" * 60)
            print(full_text)
            print("-" * 60)
            
            # Look for all links in the row
            print("\n🔗 All links found in the row:")
            links = await row.query_selector_all("a")
            for i, link in enumerate(links):
                href = await link.get_attribute("href")
                text = await link.inner_text()
                print(f"  Link {i+1}: {text.strip()[:30]}... -> {href}")
            
            # Specifically look for visit links
            print("\n🎯 Looking for visit links (containing /visits/):")
            visit_links = await row.query_selector_all("a[href*='/visits/']")
            if visit_links:
                for link in visit_links:
                    href = await link.get_attribute("href")
                    text = await link.inner_text()
                    print(f"  ✅ Found visit link: {text} -> {href}")
            else:
                print("  ❌ No links containing /visits/ found")
                
                # Check if there's a visits section
                print("\n📍 Looking for visit information in text:")
                if "NEXT VISIT" in full_text:
                    print("  ✅ Found 'NEXT VISIT' text")
                    # Extract the section around NEXT VISIT
                    lines = full_text.split('\n')
                    for i, line in enumerate(lines):
                        if "NEXT VISIT" in line:
                            print(f"  Context: {lines[i-1:i+3]}")
                
            # Look for customer links
            print("\n🏢 Customer links found:")
            customer_links = await row.query_selector_all("a[href*='/customers/locations/']")
            for link in customer_links:
                href = await link.get_attribute("href")
                text = await link.inner_text()
                print(f"  Customer link: {text} -> {href}")
                
        else:
            print("❌ Could not find work order W-129651")
            
        print("\n⏸️  Browser will remain open for 30 seconds for inspection...")
        await page.wait_for_timeout(30000)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()

if __name__ == "__main__":
    asyncio.run(debug_work_order_extraction())