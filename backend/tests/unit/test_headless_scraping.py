#!/usr/bin/env python3
"""
Test script to verify dispenser scraping works in headless mode
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import json
from app.database import SessionLocal
from app.models import WorkOrder

async def test_headless_scraping():
    """Test that dispenser scraping runs in headless mode"""
    
    print("🧪 Testing Headless Dispenser Scraping")
    print("=" * 80)
    
    # Ensure we're in headless mode
    os.environ['BROWSER_VISIBLE'] = 'false'
    
    # Get a work order with customer URL
    db = SessionLocal()
    work_order = db.query(WorkOrder).filter(
        WorkOrder.customer_url.isnot(None)
    ).first()
    
    if not work_order:
        print("❌ No work orders with customer URL found")
        db.close()
        return
    
    print(f"✅ Found work order: {work_order.external_id}")
    print(f"📍 Customer URL: {work_order.customer_url}")
    
    # Import services after setting environment
    from app.services.workfossa_automation import workfossa_automation, WorkFossaCredentials
    from app.services.dispenser_scraper import dispenser_scraper
    
    # Check if browser is configured for headless
    print(f"\n🔍 Browser Configuration:")
    print(f"   Headless Mode: {workfossa_automation.headless}")
    print(f"   BROWSER_VISIBLE env: {os.environ.get('BROWSER_VISIBLE', 'not set')}")
    
    try:
        # Test credentials (will fail but we're just checking browser launch)
        creds = WorkFossaCredentials(
            email="test@example.com",
            password="test",
            user_id="test_user"
        )
        
        print("\n🚀 Creating automation session...")
        session_id = await workfossa_automation.create_automation_session("test_user", creds)
        print(f"✅ Session created: {session_id}")
        
        # Check if browser launched visibly
        print("\n🖥️ If you see a browser window, headless mode is NOT working!")
        print("⏳ Waiting 3 seconds to check for visible browser...")
        await asyncio.sleep(3)
        
        # Close the session
        await workfossa_automation.close_session(session_id)
        print("✅ Session closed")
        
        # Cleanup
        await workfossa_automation.cleanup()
        print("\n✅ Test complete - if no browser window appeared, headless mode is working!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_headless_scraping())