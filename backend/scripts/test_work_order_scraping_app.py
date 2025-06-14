#!/usr/bin/env python3
"""Test work order scraping in the application with new fields"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.services.workfossa_scraper import WorkFossaScraper
from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.core_models import WorkOrder
from sqlalchemy import desc
import json

async def test_work_order_scraping():
    """Test work order scraping and verify new fields are saved"""
    
    print("=" * 80)
    print("TESTING WORK ORDER SCRAPING WITH NEW FIELDS")
    print("=" * 80)
    
    db = SessionLocal()
    
    try:
        # Get Bruce's user ID
        user_id = '7bea3bdb7e8e303eacaba442bd824004'
        
        # Get credentials
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No WorkFossa credentials found")
            return
        
        print(f"✅ Found credentials for user")
        
        # Initialize scraper
        scraper = WorkFossaScraper(db)
        
        # Scrape work orders (limit to 5 for testing)
        print("\n🔍 Scraping work orders...")
        work_orders = await scraper.scrape_work_orders(
            user_id=user_id,
            username=cred.username,
            password=cred.password,
            limit=5  # Just get 5 for testing
        )
        
        print(f"\n✅ Scraped {len(work_orders)} work orders")
        
        # Check the latest work order in the database
        latest_wo = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).order_by(desc(WorkOrder.created_at)).first()
        
        if latest_wo:
            print("\n📋 Latest Work Order in Database:")
            print(f"   Job ID: {latest_wo.external_id}")
            print(f"   Site Name: {latest_wo.site_name}")
            print(f"   Store Number: {latest_wo.store_number}")
            print(f"   Address: {latest_wo.address}")
            print(f"   --- New Fields ---")
            print(f"   Service Name: {latest_wo.service_name}")
            print(f"   Service Items: {latest_wo.service_items}")
            print(f"   Street: {latest_wo.street}")
            print(f"   City/State: {latest_wo.city_state}")
            print(f"   County: {latest_wo.county}")
            print(f"   Created Date: {latest_wo.created_date}")
            print(f"   Created By: {latest_wo.created_by}")
            print(f"   Customer URL: {latest_wo.customer_url}")
            
            # Show full scraped data if available
            if latest_wo.scraped_data:
                print("\n📄 Full Scraped Data:")
                print(json.dumps(latest_wo.scraped_data, indent=2))
        
        # Show summary of all scraped work orders
        print("\n📊 Summary of All Scraped Work Orders:")
        all_work_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).order_by(desc(WorkOrder.created_at)).limit(5).all()
        
        for i, wo in enumerate(all_work_orders, 1):
            print(f"\n   {i}. W-{wo.external_id} - {wo.site_name}")
            print(f"      Service: {wo.service_name} ({wo.service_code})")
            if wo.service_items:
                items = wo.service_items if isinstance(wo.service_items, list) else json.loads(wo.service_items)
                print(f"      Items: {', '.join(items)}")
            print(f"      Address: {wo.street}, {wo.city_state}")
            if wo.county:
                print(f"      County: {wo.county}")
            if wo.created_by:
                print(f"      Created: {wo.created_date} by {wo.created_by}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print("\n✅ Test complete!")

if __name__ == "__main__":
    print("\n🚀 Starting Work Order Scraping Test")
    print("   This will test the application's scraping with new fields")
    asyncio.run(test_work_order_scraping())