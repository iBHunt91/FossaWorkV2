#!/usr/bin/env python3
"""Check work order fields in database"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user_models import User  # Import User first
from app.core_models import WorkOrder
from sqlalchemy import desc
import json

def check_work_order_fields():
    """Check if work orders have new fields populated"""
    
    print("=" * 80)
    print("CHECKING WORK ORDER FIELDS IN DATABASE")
    print("=" * 80)
    
    db = SessionLocal()
    
    try:
        # Get latest 5 work orders
        work_orders = db.query(WorkOrder).order_by(desc(WorkOrder.created_at)).limit(5).all()
        
        if not work_orders:
            print("❌ No work orders found in database")
            return
        
        print(f"✅ Found {len(work_orders)} recent work orders\n")
        
        for i, wo in enumerate(work_orders, 1):
            print(f"{i}. Work Order W-{wo.external_id}")
            print(f"   Site: {wo.site_name}")
            print(f"   Store #: {wo.store_number}")
            print(f"   Address: {wo.address}")
            
            # Check new fields
            print(f"   --- New Fields Status ---")
            print(f"   Service Name: {'✅' if wo.service_name else '❌'} {wo.service_name or 'Not populated'}")
            print(f"   Service Items: {'✅' if wo.service_items else '❌'} {wo.service_items or 'Not populated'}")
            print(f"   Street: {'✅' if wo.street else '❌'} {wo.street or 'Not populated'}")
            print(f"   City/State: {'✅' if wo.city_state else '❌'} {wo.city_state or 'Not populated'}")
            print(f"   County: {'✅' if wo.county else '❌'} {wo.county or 'Not populated'}")
            print(f"   Created Date: {'✅' if wo.created_date else '❌'} {wo.created_date or 'Not populated'}")
            print(f"   Created By: {'✅' if wo.created_by else '❌'} {wo.created_by or 'Not populated'}")
            print(f"   Customer URL: {'✅' if wo.customer_url else '❌'} {wo.customer_url or 'Not populated'}")
            
            # Check scraped data
            if wo.scraped_data:
                print(f"   Scraped Data: ✅ {len(json.dumps(wo.scraped_data))} characters")
            else:
                print(f"   Scraped Data: ❌ Not populated")
            
            print()
        
        # Summary
        print("\n📊 Field Population Summary:")
        total_fields = 0
        populated_fields = 0
        
        field_names = ['service_name', 'service_items', 'street', 'city_state', 
                      'county', 'created_date', 'created_by', 'customer_url']
        
        for field in field_names:
            total = 0
            populated = 0
            for wo in work_orders:
                total += 1
                if getattr(wo, field):
                    populated += 1
            
            percentage = (populated / total * 100) if total > 0 else 0
            print(f"   {field}: {populated}/{total} ({percentage:.0f}%)")
            total_fields += total
            populated_fields += populated
        
        overall_percentage = (populated_fields / total_fields * 100) if total_fields > 0 else 0
        print(f"\n   Overall: {populated_fields}/{total_fields} ({overall_percentage:.0f}%)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Starting Work Order Field Check")
    check_work_order_fields()