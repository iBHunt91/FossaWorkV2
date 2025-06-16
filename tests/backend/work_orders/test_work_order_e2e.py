#!/usr/bin/env python3
"""End-to-end test for work order scraping and storage"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.database import SessionLocal
from app.models.user_models import User, UserCredential
from app.core_models import WorkOrder
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService
from sqlalchemy import desc
import json
from datetime import datetime

async def test_e2e():
    """Test complete work order scraping flow"""
    
    print("=" * 80)
    print("END-TO-END WORK ORDER TEST")
    print("=" * 80)
    
    db = SessionLocal()
    
    try:
        # Get user
        user_id = '7bea3bdb7e8e303eacaba442bd824004'
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print("❌ User not found")
            return
        
        print(f"✅ Found user: {user.username}")
        
        # Get credentials
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No WorkFossa credentials found")
            return
        
        print("✅ Found WorkFossa credentials")
        
        # Get work orders before scraping
        before_count = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).count()
        print(f"\n📊 Work orders before scraping: {before_count}")
        
        # Initialize services
        print("\n🚀 Initializing scraping services...")
        browser_automation = BrowserAutomationService()
        scraper = WorkFossaScraper(browser_automation)
        
        # Create session
        session_id = f"test_{datetime.now().timestamp()}"
        print(f"📋 Session ID: {session_id}")
        
        # Login to WorkFossa
        print("\n🔐 Logging in to WorkFossa...")
        from app.services.workfossa_automation import WorkFossaAutomationService
        workfossa_automation = WorkFossaAutomationService()
        
        await workfossa_automation.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials={
                'username': cred.username,
                'password': cred.password
            }
        )
        
        # Login
        login_success = await workfossa_automation.login()
        if not login_success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Scrape work orders (limit to 3 for testing)
        print("\n🔍 Scraping work orders...")
        work_orders = await scraper.scrape_work_orders(
            session_id=session_id,
            page=workfossa_automation.sessions[session_id]['page']
        )
        
        print(f"✅ Scraped {len(work_orders)} work orders")
        
        # Save first 3 work orders
        print("\n💾 Saving work orders to database...")
        saved_count = 0
        
        for wo_data in work_orders[:3]:
            # Check if exists
            existing = db.query(WorkOrder).filter(
                WorkOrder.user_id == user_id,
                WorkOrder.external_id == wo_data.external_id
            ).first()
            
            if existing:
                # Update existing
                print(f"   Updating W-{wo_data.external_id}")
                existing.service_name = wo_data.service_name
                existing.service_items = wo_data.service_items
                existing.street = wo_data.street
                existing.city_state = wo_data.city_state
                existing.county = wo_data.county
                existing.created_date = wo_data.created_date
                existing.created_by = wo_data.created_by
                existing.customer_url = wo_data.customer_url
                existing.updated_at = datetime.now()
            else:
                # Create new
                print(f"   Creating W-{wo_data.external_id}")
                work_order = WorkOrder(
                    user_id=user_id,
                    external_id=wo_data.external_id,
                    site_name=wo_data.site_name,
                    address=wo_data.address,
                    scheduled_date=wo_data.scheduled_date,
                    status=wo_data.status,
                    store_number=wo_data.store_number,
                    service_code=wo_data.service_code,
                    service_description=wo_data.service_description,
                    visit_id=wo_data.visit_id,
                    visit_url=wo_data.visit_url,
                    instructions=wo_data.instructions,
                    # New fields
                    service_name=wo_data.service_name,
                    service_items=wo_data.service_items,
                    street=wo_data.street,
                    city_state=wo_data.city_state,
                    county=wo_data.county,
                    created_date=wo_data.created_date,
                    created_by=wo_data.created_by,
                    customer_url=wo_data.customer_url,
                    scraped_data={
                        "raw_html": wo_data.raw_html,
                        "address_components": wo_data.address_components,
                        "service_info": {
                            "type": wo_data.service_type,
                            "quantity": wo_data.service_quantity
                        }
                    }
                )
                db.add(work_order)
            
            saved_count += 1
        
        db.commit()
        print(f"✅ Saved {saved_count} work orders")
        
        # Verify saved data
        print("\n📋 Verifying saved data...")
        latest_wo = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).order_by(desc(WorkOrder.updated_at)).first()
        
        if latest_wo:
            print(f"\n✅ Latest work order in database:")
            print(f"   Job ID: W-{latest_wo.external_id}")
            print(f"   Site: {latest_wo.site_name}")
            print(f"   Store #: {latest_wo.store_number}")
            print(f"   Address: {latest_wo.address}")
            print(f"   --- New Fields ---")
            print(f"   Service Name: {'✅' if latest_wo.service_name else '❌'} {latest_wo.service_name}")
            print(f"   Service Items: {'✅' if latest_wo.service_items else '❌'} {latest_wo.service_items}")
            print(f"   Street: {'✅' if latest_wo.street else '❌'} {latest_wo.street}")
            print(f"   City/State: {'✅' if latest_wo.city_state else '❌'} {latest_wo.city_state}")
            print(f"   County: {'✅' if latest_wo.county else '❌'} {latest_wo.county}")
            print(f"   Created Date: {'✅' if latest_wo.created_date else '❌'} {latest_wo.created_date}")
            print(f"   Created By: {'✅' if latest_wo.created_by else '❌'} {latest_wo.created_by}")
            print(f"   Customer URL: {'✅' if latest_wo.customer_url else '❌'} {latest_wo.customer_url}")
        
        # Cleanup
        print("\n🧹 Cleaning up session...")
        await workfossa_automation.cleanup_session(session_id)
        
        print("\n✅ End-to-end test complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Starting End-to-End Work Order Test")
    asyncio.run(test_e2e())