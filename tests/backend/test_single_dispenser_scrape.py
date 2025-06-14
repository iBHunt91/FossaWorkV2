#!/usr/bin/env python3
"""
Test single dispenser scraping to diagnose the actual error
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.database import SessionLocal
from app.models import WorkOrder

async def test_single_dispenser():
    """Test single dispenser scraping to see the exact error"""
    
    print("🔍 TESTING SINGLE DISPENSER SCRAPING")
    print("=" * 50)
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    
    # Get work order with customer URL
    db = SessionLocal()
    try:
        wo = db.query(WorkOrder).filter(
            WorkOrder.external_id == "#38437",
            WorkOrder.user_id == user_id
        ).first()
        
        if not wo:
            print("❌ Work order #38437 not found")
            return
        
        customer_url = wo.scraped_data.get('customer_url') if wo.scraped_data else None
        
        print(f"🎯 Work Order: {wo.external_id}")
        print(f"📍 Customer URL: {customer_url}")
        
        if not customer_url:
            print("❌ No customer URL!")
            return
        
        # Test exactly like the batch scraper does it
        print("\n🔧 Testing exact batch scraper logic...")
        
        try:
            # Initialize services exactly like batch scraper
            from app.services.workfossa_automation import WorkFossaAutomationService
            from app.services.workfossa_scraper import workfossa_scraper
            
            # Create session exactly like batch scraper  
            session_id = f"test_dispenser_{user_id}_{uuid.uuid4().hex[:8]}"
            workfossa_automation = WorkFossaAutomationService()
            
            print(f"🔧 Creating session: {session_id}")
            
            credentials = {
                "username": creds['username'],
                "password": creds['password']
            }
            
            # Create automation session
            print("🔧 Creating automation session...")
            await workfossa_automation.create_session(
                session_id=session_id,
                user_id=user_id,
                credentials=credentials
            )
            
            # Login
            print("🔧 Logging in...")
            login_success = await workfossa_automation.login_to_workfossa(session_id)
            if not login_success:
                print("❌ Login failed!")
                return
            
            print("✅ Login successful")
            
            # Get the page from session
            session_data = workfossa_automation.sessions.get(session_id)
            if not session_data or 'page' not in session_data:
                print("❌ No page found in session")
                return
            
            print("✅ Page found in session")
            
            # Now try dispenser scraping exactly like batch scraper
            print(f"\n🔧 Calling workfossa_scraper.scrape_dispenser_details...")
            print(f"   Session ID: {session_id}")
            print(f"   Work Order ID: {wo.id}")
            print(f"   Customer URL: {customer_url}")
            
            dispensers = await workfossa_scraper.scrape_dispenser_details(
                session_id=session_id,
                work_order_id=wo.id,
                customer_url=customer_url
            )
            
            print(f"\n📊 RESULTS:")
            if dispensers:
                print(f"✅ Found {len(dispensers)} dispensers!")
                for i, dispenser in enumerate(dispensers, 1):
                    print(f"  {i}. {dispenser.get('dispenser_number', 'N/A')} - {dispenser.get('serial_number', 'N/A')}")
            else:
                print("❌ No dispensers found")
            
        except Exception as e:
            print(f"❌ Error during scraping: {e}")
            import traceback
            traceback.print_exc()
            
        finally:
            # Cleanup
            if 'workfossa_automation' in locals() and hasattr(workfossa_automation, 'browser') and workfossa_automation.browser:
                await workfossa_automation.browser.close()
    
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_single_dispenser())