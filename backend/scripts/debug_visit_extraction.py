#!/usr/bin/env python3
"""
Debug script to test visit URL extraction from WorkFossa
"""
import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.credential_manager import CredentialManager

async def debug_visit_extraction():
    """Debug visit URL extraction from a single work order"""
    # Get credentials
    credential_manager = CredentialManager()
    user_id = "test_user"  # Replace with actual user ID
    
    # Try to get credentials
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds or not creds.username or not creds.password:
        print("❌ No WorkFossa credentials found. Please configure credentials first.")
        return
    
    credentials = {
        "username": creds.username,
        "password": creds.password
    }
    
    print(f"✅ Found credentials for user: {credentials['username']}")
    
    # Create automation service
    automation = WorkFossaAutomationService()
    scraper = WorkFossaScraper(automation)
    
    session_id = f"debug_visit_{datetime.now().timestamp()}"
    
    try:
        print("\n🚀 Creating browser session...")
        await automation.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        
        print("🔐 Logging in to WorkFossa...")
        login_success = await automation.login_to_workfossa(session_id)
        if not login_success:
            print("❌ Failed to login to WorkFossa")
            return
        
        print("✅ Successfully logged in")
        
        # Get the page
        session_data = automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            print("❌ No page found in session")
            return
        
        page = session_data['page']
        
        print("\n📄 Navigating to work orders page...")
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        
        print("🔍 Looking for work order rows...")
        
        # Get the first work order row
        rows = await page.query_selector_all("tbody tr")
        if not rows:
            print("❌ No work order rows found")
            return
        
        print(f"✅ Found {len(rows)} work order rows")
        
        # Debug the first row
        first_row = rows[0]
        
        # Get all cells
        cells = await first_row.query_selector_all("td")
        print(f"\n📊 Row has {len(cells)} cells")
        
        # Check visits cell (typically cell 4)
        if len(cells) >= 5:
            visits_cell = cells[4]
            visits_text = await visits_cell.text_content()
            print(f"\n📅 Visits cell text: {visits_text}")
            
            # Get all links in visits cell
            visit_links = await visits_cell.query_selector_all("a")
            print(f"\n🔗 Found {len(visit_links)} links in visits cell")
            
            for i, link in enumerate(visit_links):
                href = await link.get_attribute("href")
                text = await link.text_content()
                print(f"\nLink {i+1}:")
                print(f"  Text: {text}")
                print(f"  Href: {href}")
                
                if href and '/visits/' in href:
                    print(f"  ✅ This is a visit URL!")
                elif href and '/customers/locations/' in href:
                    print(f"  ⚠️  This is a customer URL!")
                else:
                    print(f"  ❓ Unknown URL type")
        
        # Also check customer cell (cell 2) for comparison
        if len(cells) >= 3:
            customer_cell = cells[2]
            customer_text = await customer_cell.text_content()
            print(f"\n👤 Customer cell text: {customer_text}")
            
            # Get all links in customer cell
            customer_links = await customer_cell.query_selector_all("a")
            print(f"\n🔗 Found {len(customer_links)} links in customer cell")
            
            for i, link in enumerate(customer_links):
                href = await link.get_attribute("href")
                text = await link.text_content()
                print(f"\nLink {i+1}:")
                print(f"  Text: {text}")
                print(f"  Href: {href}")
        
        # Take a screenshot for visual debugging
        screenshot_path = "debug_work_order_row.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"\n📸 Screenshot saved: {screenshot_path}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n🧹 Cleaning up...")
        await automation.cleanup_session(session_id)

if __name__ == "__main__":
    asyncio.run(debug_visit_extraction())