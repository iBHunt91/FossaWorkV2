#!/usr/bin/env python3
"""
Test the dispenser scraping fixes - specifically the selector update
"""

import asyncio
import sys
import os

# Add parent directory to path to allow imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.dispenser_scraper import DispenserScraper
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager import credential_manager

async def test_dispenser_scraping():
    """Test dispenser scraping with the fixes"""
    print("🚀 Testing dispenser scraping fixes...")
    print("=" * 60)
    
    # Get credentials
    credentials = credential_manager.get_credentials("bruce")
    if not credentials:
        print("❌ No credentials found")
        return
        
    print(f"✅ Using credentials for: {credentials['username']}")
    
    # Create services
    automation = WorkFossaAutomationService()
    scraper = DispenserScraper()
    
    try:
        # Create session
        session_id = "test_dispenser_fixes"
        print("\n🔐 Creating session and logging in...")
        
        await automation.create_session(
            session_id=session_id,
            user_id="bruce",
            credentials=credentials
        )
        
        # Login
        is_logged_in = await automation.login_to_workfossa(session_id)
        if not is_logged_in:
            print("❌ Failed to login")
            return
        
        print("✅ Logged in successfully")
        
        # Get page reference
        session_data = automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            print("❌ No page found in session")
            return
            
        page = session_data['page']
            
        # Test URLs from our work orders
        test_cases = [
            {
                'work_order_id': '110497',
                'customer_url': 'https://app.workfossa.com/app/customers/locations/f0e63fe1-de0d-4b35-9287-82a079c88b42/',
                'expected_dispensers': 4  # Based on interactive test
            }
        ]
        
        # Test each case
        for test in test_cases:
            print(f"\n📋 Testing work order {test['work_order_id']}...")
            print(f"   Customer URL: {test['customer_url']}")
            
            try:
                # Scrape dispensers with retry
                dispensers, html = await scraper.scrape_dispensers_for_work_order(
                    page,
                    test['work_order_id'],
                    test['customer_url'],  # Use customer URL for dispenser scraping
                    max_retries=2
                )
                
                print(f"\n✅ Found {len(dispensers)} dispensers")
                
                if dispensers:
                    for i, d in enumerate(dispensers):
                        print(f"\n  Dispenser {i+1}:")
                        print(f"    - Number: {d.dispenser_number}")
                        print(f"    - Title: {d.title}")
                        print(f"    - Make: {d.make}")
                        print(f"    - Model: {d.model}")
                        print(f"    - Serial: {d.serial_number}")
                        print(f"    - Fuel Grades: {d.grades_list}")
                else:
                    print("  ❌ No dispensers found")
                    # Save HTML for debugging
                    if html:
                        with open(f"debug_dispenser_{test['work_order_id']}.html", "w") as f:
                            f.write(html)
                        print(f"  📄 Saved debug HTML to debug_dispenser_{test['work_order_id']}.html")
                
                # Check if we got the expected number
                if len(dispensers) == test['expected_dispensers']:
                    print(f"\n✅ SUCCESS: Got expected number of dispensers ({test['expected_dispensers']})!")
                else:
                    print(f"\n⚠️ WARNING: Expected {test['expected_dispensers']} dispensers, got {len(dispensers)}")
                
            except Exception as e:
                print(f"\n❌ Error testing work order {test['work_order_id']}: {e}")
                import traceback
                traceback.print_exc()
            
            # Wait between tests
            await asyncio.sleep(2)
        
        print("\n✅ Testing completed!")
        
        # Keep browser open for manual inspection
        print("\n⏸️ Press Enter to close browser...")
        input()
        
    finally:
        # Cleanup
        print("\n🧹 Cleaning up...")
        await automation.cleanup_session(session_id)
        print("✅ Done")

if __name__ == "__main__":
    asyncio.run(test_dispenser_scraping())