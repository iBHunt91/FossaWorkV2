#!/usr/bin/env python3
"""
Check if work orders now have customer URLs after fresh scrape
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.database import SessionLocal
from app.models import WorkOrder

def check_customer_urls():
    """Check customer URLs in freshly scraped work orders"""
    
    print("🔍 CHECKING CUSTOMER URLs AFTER FRESH SCRAPE")
    print("="*60)
    
    db = SessionLocal()
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    try:
        # Get all work orders
        work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
        print(f"Total work orders: {len(work_orders)}")
        
        # Check for customer URLs
        with_customer_url = 0
        without_customer_url = 0
        dispenser_services_with_urls = 0
        total_dispenser_services = 0
        
        dispenser_codes = ["2861", "2862", "3146", "3002"]
        
        for wo in work_orders:
            is_dispenser_service = wo.service_code in dispenser_codes
            if is_dispenser_service:
                total_dispenser_services += 1
            
            has_customer_url = False
            if wo.scraped_data and wo.scraped_data.get('customer_url'):
                customer_url = wo.scraped_data['customer_url']
                if customer_url and customer_url != "null" and customer_url.startswith('http'):
                    has_customer_url = True
                    with_customer_url += 1
                    if is_dispenser_service:
                        dispenser_services_with_urls += 1
            
            if not has_customer_url:
                without_customer_url += 1
        
        print(f"\n📊 RESULTS:")
        print(f"Work orders with customer URLs: {with_customer_url}")
        print(f"Work orders without customer URLs: {without_customer_url}")
        print(f"Dispenser services total: {total_dispenser_services}")
        print(f"Dispenser services with customer URLs: {dispenser_services_with_urls}")
        
        # Show some examples
        print(f"\n📝 EXAMPLES:")
        dispenser_wos = [wo for wo in work_orders if wo.service_code in dispenser_codes][:5]
        
        for wo in dispenser_wos:
            customer_url = None
            if wo.scraped_data:
                customer_url = wo.scraped_data.get('customer_url')
            
            print(f"\nWork Order: {wo.external_id}")
            print(f"  Site: {wo.site_name}")
            print(f"  Service: {wo.service_code}")
            print(f"  Customer URL: {customer_url if customer_url else '❌ None'}")
            
            if customer_url and customer_url.startswith('http'):
                print("  ✅ Has valid customer URL - dispenser scraping should work!")
            else:
                print("  ❌ No valid customer URL - dispenser scraping will fail")
        
        if dispenser_services_with_urls > 0:
            print(f"\n✅ SUCCESS! {dispenser_services_with_urls} dispenser services have customer URLs")
            print("Dispenser scraping should now work!")
        else:
            print(f"\n❌ PROBLEM: No dispenser services have customer URLs")
            print("The customer URL extraction fix may not be working")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_customer_urls()