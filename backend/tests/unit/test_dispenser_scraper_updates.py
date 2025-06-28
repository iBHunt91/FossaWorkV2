#!/usr/bin/env python3
"""
Test the updated dispenser scraper with network idle waits
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.dispenser_scraper import DispenserScraper
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager_deprecated import credential_manager


async def test_updated_scraper():
    """Test the dispenser scraper with the network idle updates"""
    print("🧪 Testing Updated Dispenser Scraper")
    print("=" * 50)
    
    # Get credentials - Bruce's user ID
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds:
        print("❌ No credentials found")
        return
    
    credentials = {
        "username": creds.username,
        "password": creds.password
    }
    
    print(f"✅ Using credentials for: {credentials['username']}")
    
    # Create services
    automation = WorkFossaAutomationService(headless=False)  # Visible for debugging
    scraper = DispenserScraper()
    
    try:
        # Create session
        session_id = "test_scraper_updates"
        print("\n🌐 Creating browser session (visible mode)...")
        
        await automation.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        
        # Login
        print("🔐 Logging in to WorkFossa...")
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            print("❌ No page found in session")
            return
        
        page = session_data['page']
        
        # Test customer URL - use the one that worked in the interactive test
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        
        print(f"\n🔍 Testing dispenser scraping...")
        print(f"   Customer URL: {customer_url}")
        print("\n📊 Watch the browser to see:")
        print("   1. Navigation to customer page")
        print("   2. Wait for network idle")
        print("   3. Click Equipment tab")
        print("   4. Wait for network idle")
        print("   5. Click Dispenser toggle")
        print("   6. Wait for network idle")
        print("   7. Extract dispenser data")
        
        # Scrape dispensers
        start_time = asyncio.get_event_loop().time()
        dispensers, raw_html = await scraper.scrape_dispensers_for_work_order(
            page=page,
            work_order_id="test_110497",
            visit_url=customer_url
        )
        elapsed = asyncio.get_event_loop().time() - start_time
        
        print(f"\n⏱️ Scraping took {elapsed:.2f} seconds")
        print(f"📊 Results: Found {len(dispensers)} dispensers")
        
        if dispensers:
            print("\n📋 Dispenser Details:")
            for i, disp in enumerate(dispensers):
                print(f"\n  Dispenser {i+1}:")
                print(f"    - Dispenser Number: {disp.dispenser_number}")
                print(f"    - Title: {disp.title}")
                print(f"    - Make: {disp.make}")
                print(f"    - Model: {disp.model}")
                print(f"    - Serial: {disp.serial_number}")
                print(f"    - Meter Type: {disp.meter_type}")
                print(f"    - Number of Nozzles: {disp.number_of_nozzles}")
                print(f"    - Fuel Grades: {disp.grades_list}")
                print(f"    - Stand Alone Code: {disp.stand_alone_code}")
            
            print("\n✅ SUCCESS: Scraper is working with network idle waits!")
        else:
            print("\n❌ No dispensers found")
            
            # Save HTML for debugging
            if raw_html:
                html_file = "debug_scraper_update.html"
                with open(html_file, "w") as f:
                    f.write(raw_html)
                print(f"📄 Saved debug HTML to: {html_file}")
        
        # Test multiple work orders to check for reload issues
        print("\n🔄 Testing multiple work orders in sequence...")
        test_urls = [
            "https://app.workfossa.com/app/customers/locations/32951/",
            # Add more valid customer URLs here if needed
        ]
        
        for idx, url in enumerate(test_urls):
            print(f"\n📍 Test {idx+1}: {url}")
            try:
                dispensers, _ = await scraper.scrape_dispensers_for_work_order(
                    page=page,
                    work_order_id=f"test_{idx}",
                    visit_url=url
                )
                print(f"   ✅ Found {len(dispensers)} dispensers")
            except Exception as e:
                print(f"   ❌ Error: {e}")
        
        print("\n⏸️ Browser will remain open for 10 seconds...")
        await asyncio.sleep(10)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        print("\n🧹 Cleaning up...")
        await automation.cleanup_session(session_id)
        print("✅ Done")


if __name__ == "__main__":
    asyncio.run(test_updated_scraper())