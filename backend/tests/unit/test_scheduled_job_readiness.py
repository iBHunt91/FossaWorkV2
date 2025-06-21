#!/usr/bin/env python3
"""
Test if the scheduled job will run successfully
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.credential_manager import credential_manager
from app.services.browser_automation import browser_automation
from app.services.workfossa_scraper import workfossa_scraper
from app.services.logging_service import get_logger
from app.database import SessionLocal
from app.core_models import WorkOrder

logger = get_logger("test.readiness")

async def test_scheduled_job_readiness():
    print("🔍 Testing Scheduled Job Readiness")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    all_good = True
    
    # Test 1: Credential Access
    print("\n1. Testing credential access...")
    try:
        # Check the actual method name
        if hasattr(credential_manager, 'get_workfossa_credentials'):
            credentials = await credential_manager.get_workfossa_credentials(user_id)
        else:
            credentials = await credential_manager.get_credentials(user_id, "workfossa")
        if credentials and 'username' in credentials and 'password' in credentials:
            print("✅ Credentials retrieved successfully")
            print(f"   Username: {credentials['username']}")
            print(f"   Password: {'*' * len(credentials['password'])}")
        else:
            print("❌ Credentials incomplete")
            all_good = False
    except Exception as e:
        print(f"❌ Failed to get credentials: {e}")
        all_good = False
    
    # Test 2: Browser Automation
    print("\n2. Testing browser automation...")
    try:
        if not browser_automation.browser:
            await browser_automation.initialize()
        print("✅ Browser initialized")
        
        # Create test session
        test_session = f"test_{int(datetime.utcnow().timestamp())}"
        session_created = await browser_automation.create_session(test_session)
        
        if session_created:
            print(f"✅ Test session created: {test_session}")
            await browser_automation.close_session(test_session)
            print("✅ Test session closed")
        else:
            print("❌ Failed to create browser session")
            all_good = False
            
    except Exception as e:
        print(f"❌ Browser automation error: {e}")
        all_good = False
    
    # Test 3: Database Connection
    print("\n3. Testing database connection...")
    try:
        db = SessionLocal()
        # Try a simple query
        count = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).count()
        print(f"✅ Database connected - found {count} existing work orders")
        db.close()
    except Exception as e:
        print(f"❌ Database error: {e}")
        all_good = False
    
    # Test 4: WorkFossa Scraper
    print("\n4. Testing WorkFossa scraper initialization...")
    try:
        # Just test that the scraper can be accessed
        if hasattr(workfossa_scraper, 'scrape_work_orders'):
            print("✅ WorkFossa scraper available")
        else:
            print("❌ WorkFossa scraper missing scrape_work_orders method")
            all_good = False
    except Exception as e:
        print(f"❌ Scraper error: {e}")
        all_good = False
    
    # Test 5: Check the actual job function
    print("\n5. Testing job execution function...")
    try:
        from app.services.scheduler_service import execute_work_order_scraping
        print("✅ Job execution function imported successfully")
        
        # Check if it's callable
        if callable(execute_work_order_scraping):
            print("✅ Job function is callable")
        else:
            print("❌ Job function is not callable")
            all_good = False
            
    except Exception as e:
        print(f"❌ Failed to import job function: {e}")
        all_good = False
    
    # Summary
    print("\n" + "=" * 50)
    if all_good:
        print("✅ ALL TESTS PASSED - Job should run successfully!")
        print("\nThe scheduled scrape at 9:30 AM should work correctly.")
    else:
        print("❌ SOME TESTS FAILED - Job may encounter errors")
        print("\nPlease fix the issues above before the scheduled run.")
    
    # Cleanup
    if hasattr(browser_automation, 'browser') and browser_automation.browser:
        if hasattr(browser_automation, 'cleanup'):
            await browser_automation.cleanup()
        elif hasattr(browser_automation, 'close_browser'):
            await browser_automation.close_browser()

if __name__ == "__main__":
    asyncio.run(test_scheduled_job_readiness())