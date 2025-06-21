#!/usr/bin/env python3
"""
Test the work order scraping process step-by-step to identify failures
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).parent.parent))

# Set environment
os.environ['SECRET_KEY'] = "Am7t7lXtMeZQJ48uYGgh2L0Uy7OzBnvEfGaqoXKPzcw"

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.credential_manager import CredentialManager
from app.database import SessionLocal
from app.models.scraping_models import ScrapingHistory

async def test_scraping_for_user(user_id: str):
    """Test scraping for a specific user"""
    print(f"\n{'='*80}")
    print(f"Testing scraping for user: {user_id}")
    print(f"{'='*80}")
    
    db = SessionLocal()
    scraper = None
    
    try:
        # Step 1: Check credentials
        print("\n1. Checking credentials...")
        cred_manager = CredentialManager()
        has_creds = await cred_manager.has_credentials(user_id)
        
        if not has_creds:
            print("❌ No credentials found!")
            return
        
        creds = await cred_manager.get_credentials(user_id)
        print(f"✅ Found credentials for user: {creds.get('username', 'Unknown')}")
        
        # Step 2: Initialize scraper
        print("\n2. Initializing scraper...")
        scraper = WorkFossaScraper(
            username=creds['username'],
            password=creds['password'],
            headless=True,
            user_id=user_id
        )
        await scraper.initialize()
        print("✅ Scraper initialized")
        
        # Step 3: Test login
        print("\n3. Testing login...")
        login_success = await scraper.login()
        
        if not login_success:
            print("❌ Login failed!")
            return
        print("✅ Login successful")
        
        # Step 4: Navigate to work orders page
        print("\n4. Navigating to work orders page...")
        await scraper.page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
        await asyncio.sleep(2)
        print("✅ On work orders page")
        
        # Step 5: Check page size dropdown
        print("\n5. Checking page size dropdown...")
        dropdown_selector = 'div.ks-select-selection:has-text("Show")'
        dropdown = await scraper.page.query_selector(dropdown_selector)
        
        if dropdown:
            print("✅ Found page size dropdown")
            current_text = await dropdown.text_content()
            print(f"   Current setting: {current_text}")
        else:
            print("⚠️  Page size dropdown not found")
        
        # Step 6: Get work orders
        print("\n6. Getting work orders...")
        orders = await scraper.scrape_work_orders()
        print(f"✅ Found {len(orders)} work orders")
        
        if orders:
            print("\n   Sample work order:")
            order = orders[0]
            print(f"   - Job ID: {order.get('job_id')}")
            print(f"   - Store: {order.get('store_number')}")
            print(f"   - Customer: {order.get('customer_name')}")
            print(f"   - Service: {order.get('service_name')}")
        
        # Step 7: Check dispenser scraping (if applicable)
        if orders and any(o.get('customer_url') for o in orders):
            print("\n7. Testing dispenser scraping...")
            test_order = next((o for o in orders if o.get('customer_url')), None)
            
            if test_order:
                print(f"   Testing with order: {test_order['job_id']}")
                dispensers = await scraper.scrape_dispensers_for_location(test_order['customer_url'])
                print(f"✅ Found {len(dispensers)} dispensers")
        
        # Create success history record
        history = ScrapingHistory(
            user_id=user_id,
            scraping_type="work_orders",
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            success=True,
            items_processed=len(orders),
            error_message=None
        )
        db.add(history)
        db.commit()
        
        print("\n✅ SCRAPING TEST SUCCESSFUL!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {str(e)}")
        
        # Create failure history record
        history = ScrapingHistory(
            user_id=user_id,
            scraping_type="work_orders",
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            success=False,
            items_processed=0,
            error_message=str(e)
        )
        db.add(history)
        db.commit()
        
    finally:
        if scraper and scraper.page:
            await scraper.close()
        db.close()

async def main():
    """Test both users"""
    
    # Test the user with database errors
    await test_scraping_for_user("7bea3bdb7e8e303eacaba442bd824004")
    
    # Test the user with login failures
    await test_scraping_for_user("80bb76f1de123a479e6391a8ee70a7bb")

if __name__ == "__main__":
    asyncio.run(main())