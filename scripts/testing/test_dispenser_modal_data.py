#!/usr/bin/env python3
"""
Test what data the dispenser modal would receive
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.core_models import Dispenser, WorkOrder
from app.models.user_models import User

def test_modal_data():
    """Test what data would be sent to the dispenser modal"""
    db = SessionLocal()
    
    try:
        print("🔍 Testing Dispenser Modal Data")
        print("=" * 70)
        
        # Get a work order with dispensers
        work_order = db.query(WorkOrder).filter(WorkOrder.dispensers.any()).first()
        
        if not work_order:
            print("No work orders with dispensers found")
            return
        
        print(f"\nWork Order: {work_order.external_id}")
        print(f"Dispensers: {len(work_order.dispensers)}")
        
        # Simulate what the API would return
        print("\n📊 API Response Simulation:")
        
        for i, d in enumerate(work_order.dispensers[:2]):  # Check first 2
            print(f"\nDispenser {i+1}:")
            
            # Direct model fields
            print(f"  Model fields:")
            print(f"    dispenser_number: {d.dispenser_number}")
            print(f"    dispenser_type: {d.dispenser_type}")
            print(f"    make: {d.make}")
            print(f"    model: {d.model}")
            
            # form_data access
            print(f"\n  form_data access:")
            print(f"    form_data type: {type(d.form_data)}")
            print(f"    form_data is None: {d.form_data is None}")
            
            if d.form_data:
                print(f"    form_data keys: {list(d.form_data.keys())}")
                print(f"    grades_list: {d.form_data.get('grades_list', [])}")
                print(f"    title: {d.form_data.get('title', 'N/A')}")
            
            # What the API would send
            api_response = {
                "id": d.id,
                "dispenser_number": d.dispenser_number,
                "dispenser_type": d.dispenser_type,
                "fuel_grades": d.fuel_grades,
                "make": d.make,
                "model": d.model,
                "serial_number": d.serial_number,
                "grades_list": d.form_data.get('grades_list', []) if d.form_data else [],
                "fuel_grades_list": d.form_data.get('grades_list', []) if d.form_data else [],
                "title": d.form_data.get('title') if d.form_data else None,
            }
            
            print(f"\n  API would send:")
            print(f"    grades_list: {api_response['grades_list']}")
            print(f"    fuel_grades_list: {api_response['fuel_grades_list']}")
            
            # What the modal would use
            frontend_grades = api_response.get('fuel_grades_list') or api_response.get('grades_list') or []
            print(f"\n  Frontend would use: {frontend_grades}")
            
            # Check for codes
            has_codes = any(g for g in frontend_grades if g.isdigit() and len(g) == 4)
            print(f"  Contains numeric codes: {'Yes ❌' if has_codes else 'No ✅'}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_modal_data()