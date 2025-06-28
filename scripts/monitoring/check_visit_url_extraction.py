#!/usr/bin/env python3
"""
Debug script to check visit URL extraction issue
"""
import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import WorkOrder
from sqlalchemy import text

def check_visit_urls():
    """Check visit URLs in the database"""
    db = SessionLocal()
    
    try:
        print("\n=== CHECKING VISIT URLs IN DATABASE ===\n")
        
        # Get all work orders
        work_orders = db.query(WorkOrder).all()
        
        print(f"Total work orders: {len(work_orders)}\n")
        
        # Track URL patterns
        visit_url_count = 0
        customer_url_count = 0
        mixed_up_count = 0
        
        for wo in work_orders:
            print(f"\nWork Order: {wo.external_id}")
            print(f"  Site: {wo.site_name}")
            print(f"  Visit URL: {wo.visit_url}")
            print(f"  Customer URL: {wo.customer_url if hasattr(wo, 'customer_url') else 'N/A'}")
            print(f"  Visit ID: {wo.visit_id}")
            print(f"  Visit Number: {wo.visit_number}")
            
            # Check if visit_url contains customer pattern
            if wo.visit_url:
                if '/customers/locations/' in wo.visit_url:
                    print("  ⚠️  WARNING: visit_url contains customer URL pattern!")
                    mixed_up_count += 1
                elif '/visits/' in wo.visit_url:
                    print("  ✅ visit_url correctly contains /visits/ pattern")
                    visit_url_count += 1
                else:
                    print("  ❓ visit_url has unexpected pattern")
            
            # Check scraped_data for visit info
            if wo.scraped_data:
                visit_info = wo.scraped_data.get('visit_info', {})
                if visit_info:
                    print(f"  Scraped visit info:")
                    print(f"    - URL: {visit_info.get('url')}")
                    print(f"    - Visit ID: {visit_info.get('visit_id')}")
                    print(f"    - Date: {visit_info.get('date')}")
            
            print("-" * 60)
        
        print(f"\n=== SUMMARY ===")
        print(f"Total work orders: {len(work_orders)}")
        print(f"Correct visit URLs (with /visits/): {visit_url_count}")
        print(f"Mixed up (customer URL in visit_url): {mixed_up_count}")
        print(f"Customer URLs that should be visit URLs: {customer_url_count}")
        
        # Check for specific problematic work order
        print("\n=== CHECKING SPECIFIC WORK ORDER ===")
        # Query for work order with visit_url containing customer pattern
        problematic = db.query(WorkOrder).filter(
            WorkOrder.visit_url.like('%/customers/locations/%')
        ).first()
        
        if problematic:
            print(f"\nFound problematic work order: {problematic.external_id}")
            print(f"  Visit URL: {problematic.visit_url}")
            print(f"  Customer URL: {problematic.customer_url if hasattr(problematic, 'customer_url') else 'N/A'}")
            print("\n  Full scraped_data:")
            if problematic.scraped_data:
                import json
                print(json.dumps(problematic.scraped_data, indent=2))
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_visit_urls()