#!/usr/bin/env python3
"""
Test re-scraping a single work order to verify visit URL extraction fix
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.api import app
from app.database import get_db
from app.models import WorkOrder
from sqlalchemy.orm import Session
import json

def check_existing_work_order():
    """Check a work order that has the wrong visit URL"""
    print("🔍 Checking existing work order with wrong visit URL")
    print("=" * 80)
    
    db: Session = next(get_db())
    
    # Find a work order with /work/ URL instead of /visits/
    work_order = db.query(WorkOrder).filter(
        WorkOrder.visit_url.like('%/work/%'),
        ~WorkOrder.visit_url.like('%/visits/%')
    ).first()
    
    if not work_order:
        print("❌ No work orders found with incorrect visit URLs")
        return None
    
    print(f"\nFound work order with incorrect visit URL:")
    print(f"ID: {work_order.id}")
    print(f"Site: {work_order.site_name}")
    print(f"Service Code: {work_order.service_code}")
    print(f"Current Visit URL: {work_order.visit_url}")
    print(f"Visit Number: {work_order.visit_number}")
    
    # Extract work order number from the ID
    import re
    wo_match = re.search(r'(\d+)', work_order.visit_url)
    if wo_match:
        wo_number = wo_match.group(1)
        print(f"Work Order Number: W-{wo_number}")
        print(f"\nExpected visit URL format: https://app.workfossa.com/app/work/{wo_number}/visits/XXXXX/")
    
    db.close()
    return work_order.id

async def main():
    """Main test function"""
    # Check existing work order
    work_order_id = check_existing_work_order()
    
    if not work_order_id:
        return
    
    print("\n" + "=" * 80)
    print("RECOMMENDATION:")
    print("=" * 80)
    print("\nTo test the fix:")
    print("1. Run the dispenser scraper to re-scrape work orders")
    print("2. Check if the visit URLs now contain /visits/ pattern")
    print("3. Verify visit_number is populated")
    print("\nCommand to re-scrape:")
    print("python3 -m app.services.dispenser_scraper")

if __name__ == "__main__":
    asyncio.run(main())