#!/usr/bin/env python3
"""
Test to capture and analyze dispenser HTML content
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


async def test_dispenser_extraction():
    """Test dispenser extraction to see actual HTML content"""
    print("🧪 Testing Dispenser Extraction Details")
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
    
    try:
        # Create session
        session_id = "test_extraction"
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
        
        # Navigate to customer page
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        print(f"\n📍 Navigating to: {customer_url}")
        await page.goto(customer_url, wait_until="networkidle")
        
        # Click Equipment tab
        print("🔍 Clicking Equipment tab...")
        await page.click('button:has-text("Equipment")')
        await page.wait_for_timeout(1000)
        
        # Click Dispenser toggle
        print("🔍 Clicking Dispenser toggle...")
        await page.click('a[title*="equipment"]:has-text("Dispenser")')
        await page.wait_for_timeout(1000)
        
        # Extract HTML content of dispensers
        print("\n📋 Extracting dispenser HTML content...")
        
        # Get all dispenser containers
        dispenser_containers = await page.locator('div.py-1\\.5, div.py-1\\.5.bg-gray-50').all()
        
        print(f"\n📊 Found {len(dispenser_containers)} containers")
        
        # Analyze first few dispensers
        for i, container in enumerate(dispenser_containers[:3]):  # First 3 only
            text = await container.text_content()
            if not text or 'S/N' not in text:
                continue
                
            print(f"\n{'='*60}")
            print(f"DISPENSER CONTAINER {i+1}:")
            print(f"{'='*60}")
            
            # Print full text
            print("FULL TEXT:")
            print(text)
            print("-"*60)
            
            # Try to extract the title line
            lines = text.strip().split('\n')
            if lines:
                print(f"TITLE LINE: '{lines[0]}'")
            
            # Look for specific patterns
            import re
            
            # Pattern for dispenser number
            disp_num_match = re.search(r'^(\d+(?:/\d+)?)\s*-', text)
            if disp_num_match:
                print(f"DISPENSER NUMBER: '{disp_num_match.group(1)}'")
            
            # Pattern for fuel types
            fuel_match = re.search(r'-\s*([^-]+?)\s*-\s*(\w+)', lines[0] if lines else text)
            if fuel_match:
                print(f"FUEL TYPES: '{fuel_match.group(1).strip()}'")
                print(f"MANUFACTURER: '{fuel_match.group(2).strip()}'")
        
        print("\n⏸️ Browser will remain open for 15 seconds...")
        await asyncio.sleep(15)
        
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
    asyncio.run(test_dispenser_extraction())