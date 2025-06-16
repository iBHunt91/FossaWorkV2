#!/usr/bin/env python3
"""
Check the current state of a specific work order in the database.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.database import SessionLocal
from app.core_models import WorkOrder

def check_work_order(work_order_id: str):
    """Check a specific work order's data"""
    db = SessionLocal()
    
    try:
        # Find the work order
        work_order = db.query(WorkOrder).filter(
            (WorkOrder.id == work_order_id) | 
            (WorkOrder.external_id == work_order_id)
        ).first()
        
        if not work_order:
            print(f"❌ Work order {work_order_id} not found")
            return
        
        print(f"📋 Work Order Data for ID: {work_order.id}")
        print("=" * 60)
        print(f"External ID (Work Number): {work_order.external_id}")
        print(f"Site Name: {work_order.site_name}")
        print(f"Address: {work_order.address}")
        print(f"Store Number: {work_order.store_number}")
        print(f"Service Code: {work_order.service_code}")
        print(f"Service Name: {work_order.service_name}")
        print(f"Service Items: {work_order.service_items}")
        print(f"Visit ID: {work_order.visit_id}")
        print(f"Visit Number: {work_order.visit_number}")
        print(f"Visit URL: {work_order.visit_url}")
        print(f"Customer URL: {work_order.customer_url}")
        print(f"Scheduled Date: {work_order.scheduled_date}")
        print(f"Created Date: {work_order.created_date}")
        print(f"Created By: {work_order.created_by}")
        print(f"Instructions: {work_order.instructions}")
        
        # Check if visit_url contains customer URL pattern
        if work_order.visit_url and '/customers/locations/' in work_order.visit_url:
            print("\n⚠️  WARNING: visit_url contains a customer URL pattern!")
            print("   This should be fixed by re-scraping the work order.")
        
        # Check if customer_url contains visit pattern
        if work_order.customer_url and '/visits/' in work_order.customer_url:
            print("\n⚠️  WARNING: customer_url contains a visit URL pattern!")
            print("   URLs may be swapped.")
            
    finally:
        db.close()

if __name__ == "__main__":
    # Check the work order from the screenshot
    check_work_order("129651")
    
    # Also check by internal ID if provided
    if len(sys.argv) > 1:
        print("\n" + "=" * 60 + "\n")
        check_work_order(sys.argv[1])