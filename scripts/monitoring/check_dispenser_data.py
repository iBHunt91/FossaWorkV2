#!/usr/bin/env python3
"""
Check what dispenser data looks like in the database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

def check_dispenser_data():
    """Check dispenser data structure"""
    
    print("🔍 Checking Dispenser Data Structure")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get a work order with dispensers
    work_order = db.query(WorkOrder).filter(
        WorkOrder.id == "31b14e5f-d29e-4513-8d9d-ed5baa3576f3"  # 7-Eleven from screenshot
    ).first()
    
    if not work_order:
        print("❌ Work order not found")
        db.close()
        return
    
    print(f"✅ Found work order: {work_order.external_id} - {work_order.site_name}")
    
    # Get dispensers
    dispensers = db.query(Dispenser).filter(
        Dispenser.work_order_id == work_order.id
    ).all()
    
    print(f"\n📋 Found {len(dispensers)} dispensers")
    
    for i, disp in enumerate(dispensers):
        print(f"\n{'='*60}")
        print(f"Dispenser {i+1}:")
        print(f"  ID: {disp.id}")
        print(f"  Number: {disp.dispenser_number}")
        print(f"  Type: {disp.dispenser_type}")
        print(f"  Make: {disp.make}")
        print(f"  Model: {disp.model}")
        print(f"  Serial: {disp.serial_number}")
        
        print(f"\n  Fuel Grades Type: {type(disp.fuel_grades)}")
        print(f"  Fuel Grades Raw: {disp.fuel_grades}")
        
        if isinstance(disp.fuel_grades, dict):
            print("\n  Fuel Grades Parsed:")
            for grade, info in disp.fuel_grades.items():
                print(f"    {grade}: {info}")
        
        if hasattr(disp, 'form_data') and disp.form_data:
            print(f"\n  Form Data: {json.dumps(disp.form_data, indent=2)}")
    
    # Check scraped_data
    if work_order.scraped_data and 'dispensers' in work_order.scraped_data:
        print(f"\n\n📝 Scraped Data Dispensers:")
        print(json.dumps(work_order.scraped_data['dispensers'][:2], indent=2))  # First 2
    
    db.close()

if __name__ == "__main__":
    check_dispenser_data()