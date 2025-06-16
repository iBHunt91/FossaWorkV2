#!/usr/bin/env python3
"""Test work order extraction to verify all fields are correctly extracted"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import asyncio
from app.services.workfossa_scraper import WorkFossaScraper
from app.database import SessionLocal
import json

async def test_extraction():
    """Test work order extraction"""
    
    print("=" * 80)
    print("WORK ORDER EXTRACTION TEST")
    print("=" * 80)
    
    db = SessionLocal()
    
    try:
        # Get user credentials
        from app.models.user_models import UserCredential
        
        # Using Bruce's user ID
        user_id = '7bea3bdb7e8e303eacaba442bd824004'
        
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No WorkFossa credentials found")
            return
        
        print(f"✅ Found credentials for user")
        
        # Create scraper instance
        scraper = WorkFossaScraper(
            username=cred.username,
            password=cred.password,
            headless=True  # Use headless mode for automated test
        )
        
        print("\n🔐 Logging in to WorkFossa...")
        login_success = await scraper.login()
        
        if not login_success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        print("\n📋 Scraping work orders (first 5)...")
        work_orders = await scraper.scrape_work_orders(max_items=5)
        
        print(f"\n✅ Found {len(work_orders)} work orders")
        
        if work_orders:
            print("\n📊 Analyzing first work order:")
            wo = work_orders[0]
            
            # Convert to dict for easier inspection
            wo_dict = wo.dict() if hasattr(wo, 'dict') else wo.__dict__
            
            print("\n🔍 Key Fields:")
            print(f"  - ID: {wo_dict.get('id', 'N/A')}")
            print(f"  - External ID: {wo_dict.get('external_id', 'N/A')}")
            print(f"  - Site Name: {wo_dict.get('site_name', 'N/A')}")
            print(f"  - Customer Name: {wo_dict.get('customer_name', 'N/A')}")
            print(f"  - Store Number: {wo_dict.get('store_number', 'N/A')}")
            
            print("\n📍 Address Components:")
            print(f"  - Full Address: {wo_dict.get('address', 'N/A')}")
            print(f"  - Street: {wo_dict.get('street', 'N/A')}")
            print(f"  - City/State: {wo_dict.get('city_state', 'N/A')}")
            print(f"  - County: {wo_dict.get('county', 'N/A')}")
            
            print("\n🔧 Service Information:")
            print(f"  - Service Code: {wo_dict.get('service_code', 'N/A')}")
            print(f"  - Service Name: {wo_dict.get('service_name', 'N/A')}")
            print(f"  - Service Items: {wo_dict.get('service_items', 'N/A')}")
            print(f"  - Service Type: {wo_dict.get('service_type', 'N/A')}")
            print(f"  - Service Quantity: {wo_dict.get('service_quantity', 'N/A')}")
            
            print("\n🗓 Dates:")
            print(f"  - Scheduled Date: {wo_dict.get('scheduled_date', 'N/A')}")
            print(f"  - Created Date: {wo_dict.get('created_date', 'N/A')}")
            print(f"  - Created By: {wo_dict.get('created_by', 'N/A')}")
            
            print("\n🔗 Visit Information:")
            print(f"  - Visit URL: {wo_dict.get('visit_url', 'N/A')}")
            print(f"  - Visit ID: {wo_dict.get('visit_id', 'N/A')}")
            print(f"  - Visit Number: {wo_dict.get('visit_number', 'N/A')}")
            
            print("\n📝 Instructions:")
            instructions = wo_dict.get('instructions', 'N/A')
            if instructions and instructions != 'N/A':
                print(f"  {instructions[:100]}..." if len(str(instructions)) > 100 else f"  {instructions}")
            else:
                print("  N/A")
            
            print("\n🔗 Customer URL:")
            print(f"  {wo_dict.get('customer_url', 'N/A')}")
            
            # Check for issues
            print("\n⚠️  Potential Issues:")
            issues_found = False
            
            # Check site name for missing characters
            if wo_dict.get('site_name') and '7-Eleven' in str(wo_dict.get('customer_name', '')):
                if not wo_dict.get('site_name').startswith('7-'):
                    print("  - Site name missing '7-' prefix for 7-Eleven")
                    issues_found = True
            
            # Check visit number
            if not wo_dict.get('visit_number'):
                print("  - Visit number not extracted")
                issues_found = True
            
            # Check scheduled date
            if not wo_dict.get('scheduled_date'):
                print("  - Scheduled date not extracted")
                issues_found = True
            
            # Check service items
            if not wo_dict.get('service_items'):
                print("  - Service items not extracted")
                issues_found = True
            
            # Check service name
            if not wo_dict.get('service_name'):
                print("  - Service name not extracted")
                issues_found = True
            
            if not issues_found:
                print("  ✅ No issues found!")
            
            # Save full data for debugging
            print("\n💾 Saving full extraction data to 'work_order_extraction_test.json'...")
            with open('work_order_extraction_test.json', 'w') as f:
                # Convert datetime objects to strings for JSON serialization
                def serialize(obj):
                    if hasattr(obj, 'isoformat'):
                        return obj.isoformat()
                    elif hasattr(obj, '__dict__'):
                        return obj.__dict__
                    return str(obj)
                
                json.dump([wo_dict for wo in work_orders], f, indent=2, default=serialize)
            print("✅ Data saved")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        if 'scraper' in locals():
            await scraper.close()
        print("\n✅ Test complete!")

if __name__ == "__main__":
    print("\n🚀 Starting Work Order Extraction Test")
    asyncio.run(test_extraction())