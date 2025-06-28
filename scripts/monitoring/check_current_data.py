#!/usr/bin/env python3
"""
Check current data in database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

def check_data():
    """Check current dispenser data"""
    
    print("🔍 Checking Current Dispenser Data")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get the work order
    work_order = db.query(WorkOrder).filter(WorkOrder.external_id == "129651").first()
    
    if not work_order:
        print("❌ Work order not found")
        return
    
    print(f"Work Order: {work_order.external_id} ({work_order.site_name})")
    print(f"ID: {work_order.id}")
    
    # Get dispensers
    dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == work_order.id).all()
    
    print(f"\n📋 Found {len(dispensers)} dispensers")
    
    # Check for any issues
    for i, d in enumerate(dispensers):
        print(f"\n🔧 Dispenser {i+1}:")
        print(f"  Number: {d.dispenser_number}")
        print(f"  Type: {d.dispenser_type}")
        print(f"  Fuel Grades: {json.dumps(d.fuel_grades, indent=4)}")
        
        # Check for API error text
        if d.fuel_grades:
            for key, value in d.fuel_grades.items():
                if 'api' in key.lower() or 'type' in key.lower():
                    print(f"  ⚠️ WARNING: Found suspicious key: {key}")
        
        # Check scraped data
        if work_order.scraped_data and 'dispensers' in work_order.scraped_data:
            scraped_dispensers = work_order.scraped_data['dispensers']
            for sd in scraped_dispensers:
                if sd.get('dispenser_number') == d.dispenser_number:
                    print(f"  Scraped fuel_grades: {sd.get('fuel_grades')}")
                    break
    
    db.close()

if __name__ == "__main__":
    check_data()