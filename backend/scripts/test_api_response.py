#!/usr/bin/env python3
"""
Test API response for work orders
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from app.routes.work_orders import get_scraped_dispenser_details, convert_fuel_grades_to_list

def test_api_response():
    """Test what the API would return"""
    
    print("🔍 Testing API Response")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get a work order with dispensers
    work_order = db.query(WorkOrder).filter(WorkOrder.id == "31b14e5f-d29e-4513-8d9d-ed5baa3576f3").first()
    
    if not work_order:
        print("❌ Work order not found")
        return
    
    print(f"Work Order: {work_order.external_id} ({work_order.site_name})")
    
    # Get dispensers
    dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == work_order.id).all()
    
    print(f"\n📋 Found {len(dispensers)} dispensers")
    
    # Simulate API response
    for i, d in enumerate(dispensers):
        print(f"\n🔧 Dispenser {i+1}:")
        print(f"  Number: {d.dispenser_number}")
        print(f"  Type: {d.dispenser_type}")
        print(f"  Fuel Grades (raw): {d.fuel_grades}")
        
        # Convert fuel grades
        fuel_grades_list = convert_fuel_grades_to_list(d.fuel_grades)
        print(f"  Fuel Grades List: {fuel_grades_list}")
        
        # Get scraped details
        scraped_details = get_scraped_dispenser_details(work_order, d.dispenser_number)
        print(f"  Scraped Details: {json.dumps(scraped_details, indent=4)}")
        
        # Full API response for this dispenser
        api_response = {
            "id": d.id,
            "dispenser_number": d.dispenser_number,
            "dispenser_type": d.dispenser_type,
            "fuel_grades": d.fuel_grades,
            "status": d.status,
            "progress_percentage": d.progress_percentage,
            "automation_completed": d.automation_completed,
            **scraped_details,
            "fuel_grades_list": fuel_grades_list
        }
        
        print(f"\n  Full API Response:")
        print(json.dumps(api_response, indent=4))
        
        if i >= 1:  # Just show first 2
            break
    
    db.close()

if __name__ == "__main__":
    test_api_response()