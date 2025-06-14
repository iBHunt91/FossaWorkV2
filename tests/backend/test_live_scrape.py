#!/usr/bin/env python3
"""Test live scraping to verify the Meter fix"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomation
from app.services.credential_manager import CredentialManager
from app.database import get_db
from sqlalchemy.orm import Session
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_scraping():
    """Test the scraping with the new address parsing"""
    
    print("Testing WorkFossa scraping with address parsing fix...")
    print("=" * 80)
    
    # Get database session
    db = next(get_db())
    
    try:
        # Get a test user's credentials
        cred_manager = CredentialManager()
        # Try to get demo user credentials
        user_id = "demo"  # or use a specific user ID
        
        credentials = cred_manager.get_credentials(user_id, "workfossa")
        if not credentials:
            print("❌ No WorkFossa credentials found for testing")
            print("Please ensure credentials are set up first")
            return
        
        print(f"✅ Found credentials for user: {user_id}")
        
        # Initialize browser automation
        browser_automation = BrowserAutomation()
        await browser_automation.initialize()
        
        # Initialize scraper
        scraper = WorkFossaScraper(browser_automation)
        
        # Create a session ID for this test
        session_id = f"test_scrape_{user_id}"
        
        print("\n🔄 Starting scrape (this may take a few minutes)...")
        
        # Perform the scrape - limiting to just a few work orders for testing
        work_orders = await scraper.scrape_work_orders(
            session_id=session_id,
            user_id=user_id,
            page_size=10  # Just scrape 10 work orders for testing
        )
        
        print(f"\n✅ Scraped {len(work_orders)} work orders")
        
        # Check the addresses
        print("\n📍 Checking addresses for 'Meter' issue:")
        print("-" * 60)
        
        meter_count = 0
        for wo in work_orders[:5]:  # Check first 5
            print(f"\nWork Order: {wo.external_id}")
            print(f"Site: {wo.site_name}")
            print(f"Address: {wo.address}")
            
            if "Meter" in wo.address:
                print("  ⚠️  Still contains 'Meter' - fix not working!")
                meter_count += 1
            else:
                print("  ✅ Clean address - no 'Meter' found!")
        
        print("\n" + "=" * 80)
        print(f"Summary: {meter_count} out of {min(5, len(work_orders))} addresses still contain 'Meter'")
        
        if meter_count > 0:
            print("\n⚠️  The fix is not working properly. Need to investigate further.")
        else:
            print("\n✅ The fix appears to be working! No 'Meter' found in addresses.")
        
    except Exception as e:
        print(f"\n❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        if 'browser_automation' in locals():
            await browser_automation.close()
        db.close()

if __name__ == "__main__":
    asyncio.run(test_scraping())