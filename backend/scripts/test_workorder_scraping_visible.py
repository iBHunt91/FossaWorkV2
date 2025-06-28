#!/usr/bin/env python3
"""
Test work order scraping with visible browser using the credential manager
"""

import asyncio
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import workfossa_scraper
from app.services.credential_manager import credential_manager
from app.services.logging_service import get_logger

logger = get_logger("test_workorder_visible")

async def test_scraping_with_browser():
    """Test work order scraping with visible browser"""
    print("🧪 WorkFossa Work Order Scraping Test")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Get credentials from credential manager
    print("📋 Getting credentials from credential manager...")
    workfossa_creds = credential_manager.retrieve_credentials(user_id)
    
    if not workfossa_creds:
        print("❌ No WorkFossa credentials found in credential manager")
        return
    
    print(f"✅ Found credentials for user")
    print(f"   Username: {workfossa_creds.username}")
    
    # Convert to dict format expected by automation service
    credentials = {
        'username': workfossa_creds.username,
        'password': workfossa_creds.password
    }
    
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
                print("   Navigating to work orders page...")
                
                # Add progress callback
                def progress_callback(progress):
                    if hasattr(progress, 'message'):
                        print(f"   {progress.message}")
                
                workfossa_scraper.add_progress_callback(progress_callback)
                
                # Wait a moment to show the dashboard
                await asyncio.sleep(2)
                
                # Scrape work orders
                work_orders = await workfossa_scraper.scrape_work_orders(
                    session_id=session_id,
                    page=page
                )
                
                if work_orders:
                    print(f"\n✅ Successfully scraped {len(work_orders)} work orders!")
                    
                    # Display work order details
                    for i, wo in enumerate(work_orders[:5], 1):
                        print(f"\n═══ Work Order {i} ═══")
                        print(f"  Job ID: W-{wo.id}")
                        print(f"  Store: {wo.store_number or 'N/A'}")
                        print(f"  Customer: {wo.customer_name or 'N/A'}")
                        print(f"  Address: {wo.address or 'N/A'}")
                        print(f"  Service: {wo.service_name or 'N/A'} ({wo.service_code or 'N/A'})")
                        print(f"  Items: {', '.join(wo.service_items) if wo.service_items else 'N/A'}")
                        print(f"  Scheduled: {wo.scheduled_date.strftime('%Y-%m-%d') if wo.scheduled_date else 'N/A'}")
                        print(f"  Visit URL: {wo.visit_url or 'N/A'}")
                else:
                    print("❌ No work orders found")
            else:
                print("❌ Could not get browser page from session")
        else:
            print("❌ Login failed!")
            print("Check the browser window to see what went wrong")
        
        # Keep browser open for observation
        print("\n⏸️  Browser will remain open for 15 seconds to observe results...")
        await asyncio.sleep(15)
        
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
    # Set browser visible environment variable
    os.environ['BROWSER_VISIBLE'] = 'true'
    
    asyncio.run(test_scraping_with_browser())