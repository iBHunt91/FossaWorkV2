#!/usr/bin/env python3
"""
Test WorkFossa scraping showing the browser - matches how scheduler does it
"""

import asyncio
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import workfossa_scraper
from app.services.logging_service import get_logger
from app.database import SessionLocal
from app.models.user_models import UserCredential

logger = get_logger("test_workfossa_browser")

async def test_with_browser():
    """Test WorkFossa login and scraping with visible browser"""
    print("🧪 WorkFossa Browser Test")
    print("=" * 50)
    
    # Get credentials from database
    user_id = "7bea3bdb7e8e303eacaba442bd824004"  # Bruce Hunt's user ID
    
    db = SessionLocal()
    try:
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not user_credential:
            print("❌ No WorkFossa credentials found")
            return
            
        print(f"✅ Found credentials for user")
        
        # Get decrypted credentials
        username = user_credential.username
        password = user_credential.password
        
        # Check if decryption worked
        if username.startswith('Z0FBQ'):
            print(f"   ❌ Username decryption failed, got encrypted value: {username[:50]}...")
            return
        
        print(f"   Username: {username}")
        
        # Prepare credentials dict
        credentials = {
            'username': username,
            'password': password
        }
    finally:
        db.close()
    
    # Create automation service with visible browser
    print("\n🌐 Starting browser (visible mode)...")
    workfossa_automation = WorkFossaAutomationService(
        headless=False,  # Show browser
        user_settings={'browser_settings': {'headless': False}}
    )
    
    session_id = f"test_{datetime.now().timestamp()}"
    
    try:
        # Create session
        print("\n📋 Creating browser session...")
        await workfossa_automation.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        
        # Login
        print("\n🔐 Logging into WorkFossa...")
        print(f"   Using username: {credentials['username']}")
        
        login_success = await workfossa_automation.login_to_workfossa(session_id)
        
        if login_success:
            print("✅ Login successful!")
            
            # Get the page
            session_data = workfossa_automation.sessions.get(session_id)
            if session_data and 'page' in session_data:
                page = session_data['page']
                
                print("\n📋 Starting work order scraping...")
                
                # Add progress callback
                def progress_callback(progress):
                    if hasattr(progress, 'message'):
                        print(f"   {progress.message}")
                
                workfossa_scraper.add_progress_callback(progress_callback)
                
                # Scrape work orders
                work_orders = await workfossa_scraper.scrape_work_orders(
                    page=page,
                    limit=5
                )
                
                if work_orders:
                    print(f"\n✅ Found {len(work_orders)} work orders!")
                    for i, wo in enumerate(work_orders[:3], 1):
                        print(f"\nWork Order {i}:")
                        print(f"  Job ID: {wo.get('job_id', 'N/A')}")
                        print(f"  Store: {wo.get('store_number', 'N/A')}")
                        print(f"  Customer: {wo.get('customer_name', 'N/A')}")
                        print(f"  Service: {wo.get('service_name', 'N/A')}")
                else:
                    print("❌ No work orders found")
            else:
                print("❌ Could not get browser page from session")
        else:
            print("❌ Login failed!")
            print("Check the browser window to see what went wrong")
        
        # Keep browser open for observation
        print("\n⏸️  Browser will remain open for 10 seconds...")
        await asyncio.sleep(10)
        
    except Exception as e:
        print(f"\n💥 Error: {str(e)}")
        logger.exception("Test failed")
        print("\n⏸️  Browser will remain open for 10 seconds...")
        await asyncio.sleep(10)
    finally:
        # Close session
        print("\n🧹 Closing browser...")
        await workfossa_automation.close_session(session_id)
        print("✅ Test complete")

if __name__ == "__main__":
    asyncio.run(test_with_browser())