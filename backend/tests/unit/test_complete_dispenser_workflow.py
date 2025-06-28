#!/usr/bin/env python3
"""
Test the complete dispenser scraping workflow with improved clicking
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager_deprecated import credential_manager
from app.services.content_based_wait import ContentBasedWait
from app.services.dispenser_scraper import DispenserScraper
from app.models.dispenser import DispenserData


async def test_complete_workflow():
    """Test the complete dispenser scraping workflow"""
    print("🧪 Testing Complete Dispenser Workflow")
    print("=" * 50)
    
    # Get credentials
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds:
        print("❌ No credentials found")
        return
    
    credentials = {
        "username": creds.username,
        "password": creds.password
    }
    
    # Create services
    automation = WorkFossaAutomationService(headless=False)
    scraper = DispenserScraper()
    
    try:
        # Create session and login
        session_id = "test_complete_workflow"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Test scraping dispensers
        print("\n🔍 Testing dispenser scraping...")
        
        # Test URLs with different dispenser counts
        test_locations = [
            ("32951", "Wawa #5267", 8),  # Known to have 8 dispensers
            # Add more test locations as needed
        ]
        
        for location_id, location_name, expected_count in test_locations:
            print(f"\n📍 Testing location: {location_name} (ID: {location_id})")
            print(f"   Expected dispensers: {expected_count}")
            
            # Scrape dispensers using the service
            result = await scraper.scrape_dispensers(
                page=page,
                customer_url=f"https://app.workfossa.com/app/customers/locations/{location_id}/",
                store_number="5267"  # For this test
            )
            
            # Check if it's a list (success) or error dict
            if isinstance(result, list):
                print(f"✅ Successfully scraped {len(result)} dispensers")
                
                # Display sample data
                if result:
                    print("\n📊 Sample dispenser data:")
                    for i, dispenser in enumerate(result[:3]):  # First 3
                        print(f"\n   Dispenser {i+1}:")
                        print(f"     Grade: {dispenser.get('grade', 'N/A')}")
                        print(f"     Make: {dispenser.get('make', 'N/A')}")
                        print(f"     Model: {dispenser.get('model', 'N/A')}")
                        print(f"     Serial: {dispenser.get('serial_number', 'N/A')}")
                    
                    if len(result) > 3:
                        print(f"\n   ... and {len(result) - 3} more dispensers")
                
                # Verify count
                if len(result) == expected_count:
                    print(f"\n✅ Count matches expected: {expected_count}")
                else:
                    print(f"\n⚠️ Count mismatch: got {len(result)}, expected {expected_count}")
            else:
                # Error result
                print(f"❌ Scraping failed: {result}")
        
        # Test the individual methods
        print("\n\n🧪 Testing individual scraper methods...")
        
        # Navigate to test page
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        await page.goto(customer_url, wait_until="domcontentloaded")
        
        # Test Equipment tab navigation
        print("\n1️⃣ Testing Equipment tab navigation...")
        nav_success = await scraper._navigate_to_equipment_tab(page)
        print(f"   Result: {'✅ Success' if nav_success else '❌ Failed'}")
        
        # Test dispenser click
        print("\n2️⃣ Testing dispenser section click...")
        click_success = await scraper._click_dispenser_section(page)
        print(f"   Result: {'✅ Success' if click_success else '❌ Failed'}")
        
        # Wait for content to stabilize
        await asyncio.sleep(1)
        
        # Test container detection
        print("\n3️⃣ Testing container detection...")
        containers_visible = await page.evaluate("""
            () => {
                const containers = document.querySelectorAll('.py-1\\\\.5');
                return containers.length;
            }
        """)
        print(f"   Found {containers_visible} containers")
        
        # Test data extraction
        print("\n4️⃣ Testing data extraction...")
        if containers_visible > 0:
            # Use the scraper's extraction method
            dispensers = await scraper._extract_dispensers_v2(page)
            print(f"   Extracted {len(dispensers)} dispensers")
            
            if dispensers:
                sample = dispensers[0]
                print("\n   Sample extracted data:")
                print(f"     {sample}")
        
        print("\n📸 Taking final screenshot...")
        await page.screenshot(path="test_complete_workflow.png")
        print("   Screenshot saved as test_complete_workflow.png")
        
        print("\n⏸️  Browser remains open for inspection...")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("\n✅ Done")


if __name__ == "__main__":
    asyncio.run(test_complete_workflow())