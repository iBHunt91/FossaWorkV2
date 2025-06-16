#!/usr/bin/env python3
"""
Check dispenser HTML to see actual content structure
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
from app.services.credential_manager import credential_manager


async def check_dispenser_html():
    """Check dispenser HTML content"""
    print("🧪 Checking Dispenser HTML Content")
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
        session_id = "test_html"
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
        
        # Test customer URL
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        
        print(f"\n🔍 Scraping dispensers from: {customer_url}")
        
        # Scrape dispensers and get raw HTML
        dispensers, raw_html = await scraper.scrape_dispensers_for_work_order(
            page=page,
            work_order_id="test_html",
            visit_url=customer_url
        )
        
        print(f"\n📊 Found {len(dispensers)} dispensers")
        
        # Save HTML for analysis
        html_file = "dispenser_content.html"
        with open(html_file, "w") as f:
            f.write(raw_html)
        print(f"📄 Saved HTML to: {html_file}")
        
        # Look for specific patterns in the HTML
        import re
        
        print("\n🔍 Looking for dispenser patterns in HTML...")
        
        # Find all potential dispenser titles
        title_pattern = re.findall(r'(\d+(?:/\d+)?)\s*-\s*([^<\n]+)', raw_html)
        if title_pattern:
            print("\n📋 Found dispenser title patterns:")
            for num, rest in title_pattern[:5]:  # Show first 5
                print(f"  - Dispenser {num}: {rest[:50]}...")
        
        # Print first dispenser details
        if dispensers:
            print("\n📊 First dispenser details:")
            d = dispensers[0]
            print(f"  - Dispenser ID: {d.dispenser_id}")
            print(f"  - Title: {d.title}")
            print(f"  - Number: {d.dispenser_number}")
            print(f"  - Numbers Array: {d.dispenser_numbers}")
            print(f"  - Make: {d.make}")
            print(f"  - Model: {d.model}")
            print(f"  - Serial: {d.serial_number}")
            print(f"  - Meter Type: {d.meter_type}")
            print(f"  - Nozzles: {d.number_of_nozzles}")
            print(f"  - Fuel Grades: {d.grades_list}")
            
            if d.custom_fields and 'raw_text' in d.custom_fields:
                print(f"\n  RAW TEXT (first 200 chars):")
                print(f"  {d.custom_fields['raw_text'][:200]}...")
        
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
    asyncio.run(check_dispenser_html())