#!/usr/bin/env python3
"""
Test the dispenser scraper with content-based detection
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
from app.services.dispenser_scraper import DispenserScraper


async def test_content_based_scraper():
    """Test the updated scraper with content-based detection"""
    print("🧪 Testing Content-Based Dispenser Scraper")
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
    
    print(f"✅ Using credentials for: {credentials['username']}")
    
    # Create services
    print("\n🌐 Creating browser session (visible mode)...")
    automation = WorkFossaAutomationService(headless=False)
    scraper = DispenserScraper()
    
    try:
        # Create session and login
        session_id = "test_content_scraper"
        await automation.create_session(session_id, user_id, credentials)
        
        print("🔐 Logging in to WorkFossa...")
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Test URL
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        
        print("\n🔍 Testing content-based dispenser scraping...")
        print(f"   Customer URL: {customer_url}")
        
        print("\n📊 Watch the browser to see:")
        print("   1. Navigation to customer page")
        print("   2. Wait for Equipment tab (content-based)")
        print("   3. Click Equipment tab")
        print("   4. Wait for Dispenser toggle (content-based)")
        print("   5. Close modal if present")
        print("   6. Check if content already visible")
        print("   7. Click Dispenser toggle if needed")
        print("   8. Wait for dispenser content (content-based)")
        print("   9. Extract dispenser data")
        
        # Run the scraper
        dispensers, raw_html = await scraper.scrape_dispensers_for_work_order(
            page,
            work_order_id="test_110497",
            visit_url=customer_url,
            max_retries=0  # No retries for testing
        )
        
        print(f"\n📊 Results:")
        print(f"   Found {len(dispensers)} dispensers")
        
        if dispensers:
            print("\n📋 Dispenser Details:")
            for i, dispenser in enumerate(dispensers, 1):
                print(f"\n   Dispenser {i}:")
                print(f"   - Title: {dispenser.title}")
                print(f"   - S/N: {dispenser.serial_number}")
                print(f"   - Make: {dispenser.make}")
                print(f"   - Model: {dispenser.model}")
                print(f"   - Number: {dispenser.dispenser_number}")
                if dispenser.grades_list:
                    print(f"   - Grades: {', '.join(dispenser.grades_list)}")
        else:
            print("\n❌ No dispensers found")
            
            # Try to understand why
            print("\n🔍 Debugging - Checking page state...")
            
            # Check if Equipment tab is visible
            equipment_visible = await page.is_visible('text="Equipment"')
            print(f"   Equipment tab visible: {equipment_visible}")
            
            # Check for Dispenser toggle
            dispenser_toggle = await page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('*');
                    for (const el of elements) {
                        const text = el.textContent ? el.textContent.trim() : '';
                        if (text.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                            return text;
                        }
                    }
                    return null;
                }
            """)
            print(f"   Dispenser toggle found: {dispenser_toggle}")
            
            # Check for containers
            container_count = await page.locator('div.py-1\\.5').count()
            print(f"   Container count: {container_count}")
            
            # Check for dispenser content
            has_content = await page.evaluate("""
                () => {
                    const containers = document.querySelectorAll('div.py-1\\\\.5');
                    for (const container of containers) {
                        const text = container.textContent || '';
                        if (text.includes('S/N:') || text.includes('MAKE:')) {
                            return true;
                        }
                    }
                    return false;
                }
            """)
            print(f"   Has dispenser content: {has_content}")
        
        print("\n✅ Test complete!")
        
        # Keep browser open for inspection
        print("\n⏸️  Browser will remain open for 10 seconds...")
        await asyncio.sleep(10)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n🧹 Cleaning up...")
        await automation.cleanup_session(session_id)
        print("✅ Done")


if __name__ == "__main__":
    asyncio.run(test_content_based_scraper())