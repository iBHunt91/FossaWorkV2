#!/usr/bin/env python3
"""
Test customer URL extraction during live scraping with detailed logging
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
import logging

# Set up very detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Enable specific logger for customer URL extraction
logger = logging.getLogger("app.services.workfossa_scraper")
logger.setLevel(logging.DEBUG)

async def test_live_extraction():
    """Test customer URL extraction with live scraping"""
    
    print("🧪 TESTING LIVE CUSTOMER URL EXTRACTION")
    print("="*60)
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        print("No credentials found!")
        return
    
    user_id = creds['user_id']
    
    try:
        # Initialize services
        browser_service = BrowserAutomationService()
        automation_service = WorkFossaAutomationService(browser_service)
        scraper = WorkFossaScraper(automation_service)
        
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        session_id = str(uuid.uuid4())
        
        # Create session
        print("🌐 Creating session...")
        created_session_id = await automation_service.create_session(session_id, user_id, credentials)
        
        # Login
        print("🔐 Logging in...")
        login_success = await automation_service.login_to_workfossa(session_id)
        
        if not login_success:
            print("❌ Login failed")
            return
        
        print("✅ Logged in successfully")
        
        # Navigate to work orders and extract just one row
        print("📋 Testing extraction on one work order...")
        
        # Get the page from the session
        session = automation_service.sessions.get(session_id)
        if not session:
            print("❌ No session found")
            return
            
        page = session['page']
        
        # Navigate to work orders
        await page.goto("https://app.workfossa.com/work/visits", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        # Get first work order row
        rows = await page.query_selector_all('tbody tr')
        if not rows:
            print("❌ No work order rows found")
            return
        
        print(f"Found {len(rows)} work order rows")
        
        # Test extraction on first row
        first_row = rows[0]
        
        # Extract site info (which includes customer URL)
        print("\n🔍 Testing site info extraction...")
        site_info = await scraper._extract_site_info(first_row, 0)
        
        print(f"Site info result: {site_info}")
        
        if site_info.get('customer_url'):
            print(f"✅ SUCCESS! Customer URL extracted: {site_info['customer_url']}")
        else:
            print("❌ No customer URL extracted")
            
            # Debug: test the customer URL extraction directly
            print("\n🔧 Debugging customer URL extraction...")
            cells = await first_row.query_selector_all("td")
            if len(cells) >= 3:
                customer_cell = cells[2]
                customer_url = await scraper._extract_customer_url(customer_cell)
                print(f"Direct extraction result: {customer_url}")
                
                # Check the HTML content
                html_content = await customer_cell.inner_html()
                print(f"Customer cell HTML (first 500 chars): {html_content[:500]}...")
                
                if 'customers/locations/' in html_content:
                    print("✅ Customer URL pattern found in HTML")
                else:
                    print("❌ Customer URL pattern NOT found in HTML")
        
        # Test the full work order extraction
        print("\n📊 Testing full work order extraction...")
        work_order = await scraper._extract_work_order(first_row, 0, page.url)
        
        if work_order:
            print(f"Work order extracted:")
            print(f"  External ID: {work_order.external_id}")
            print(f"  Site name: {work_order.site_name}")
            print(f"  Customer URL: {work_order.customer_url}")
            
            if work_order.customer_url:
                print("✅ Customer URL successfully extracted in work order!")
            else:
                print("❌ Customer URL missing from work order")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        if hasattr(automation_service, 'browser') and automation_service.browser:
            await automation_service.browser.close()

if __name__ == "__main__":
    asyncio.run(test_live_extraction())