#!/usr/bin/env python3
"""
Check if work orders have customer URLs in the database
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.database import SessionLocal
from app.models import WorkOrder

def check_customer_urls():
    """Check customer URL status in database"""
    
    print("🔍 CHECKING CUSTOMER URL STATUS")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get all work orders
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"])
        ).all()
        
        print(f"📊 Found {len(work_orders)} dispenser work orders")
        print()
        
        with_customer_url = 0
        without_customer_url = 0
        
        for wo in work_orders[:10]:  # Check first 10
            print(f"🔍 Work Order: {wo.external_id}")
            print(f"   Site: {wo.site_name}")
            
            # Check customer_url attribute
            customer_url = None
            if hasattr(wo, 'customer_url') and wo.customer_url:
                customer_url = wo.customer_url
                print(f"   ✅ customer_url: {customer_url}")
            elif wo.scraped_data and wo.scraped_data.get('customer_url'):
                customer_url = wo.scraped_data.get('customer_url')
                print(f"   ✅ scraped_data.customer_url: {customer_url}")
            else:
                print(f"   ❌ No customer URL found")
                print(f"   📋 Has scraped_data: {wo.scraped_data is not None}")
                if wo.scraped_data:
                    print(f"   📋 Scraped data keys: {list(wo.scraped_data.keys())}")
            
            if customer_url:
                with_customer_url += 1
            else:
                without_customer_url += 1
            
            print()
        
        print("📊 SUMMARY:")
        print(f"   ✅ With customer URL: {with_customer_url}")
        print(f"   ❌ Without customer URL: {without_customer_url}")
        
        if without_customer_url > 0:
            print("\n💡 SOLUTION: Run the customer URL extraction script")
            print("   python3 fix_customer_urls_from_html.py")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_customer_urls()