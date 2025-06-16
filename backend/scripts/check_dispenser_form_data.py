#!/usr/bin/env python3
"""
Check what's actually stored in the dispenser form_data field
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.core_models import Dispenser, WorkOrder
# Import User model to fix relationship issue
from app.models.user_models import User

def check_form_data():
    """Check dispenser form_data in database"""
    db = SessionLocal()
    
    try:
        print("🔍 Checking Dispenser form_data in Database")
        print("=" * 70)
        
        # Get all dispensers
        dispensers = db.query(Dispenser).all()
        print(f"\nTotal dispensers: {len(dispensers)}")
        
        if not dispensers:
            print("No dispensers found in database")
            return
        
        # Check each dispenser
        for i, disp in enumerate(dispensers[:5]):  # Check first 5
            print(f"\n📊 Dispenser {i+1}:")
            print(f"  ID: {disp.id}")
            print(f"  Number: {disp.dispenser_number}")
            print(f"  Type: {disp.dispenser_type}")
            print(f"  Make: {disp.make}")
            print(f"  Model: {disp.model}")
            
            # Check fuel_grades
            print(f"\n  fuel_grades field:")
            if disp.fuel_grades:
                print(f"    Type: {type(disp.fuel_grades)}")
                print(f"    Content: {json.dumps(disp.fuel_grades, indent=6)[:300]}...")
            else:
                print(f"    Empty/None")
            
            # Check form_data
            print(f"\n  form_data field:")
            if disp.form_data:
                print(f"    Type: {type(disp.form_data)}")
                print(f"    Keys: {list(disp.form_data.keys()) if isinstance(disp.form_data, dict) else 'Not a dict'}")
                
                if isinstance(disp.form_data, dict):
                    # Check grades_list specifically
                    grades_list = disp.form_data.get('grades_list', [])
                    print(f"    grades_list: {grades_list}")
                    
                    # Check if it contains numeric codes
                    if grades_list:
                        has_codes = any(g for g in grades_list if isinstance(g, str) and g.isdigit() and len(g) == 4)
                        print(f"    Contains numeric codes: {'Yes ❌' if has_codes else 'No ✅'}")
                    
                    # Show full form_data
                    print(f"    Full content: {json.dumps(disp.form_data, indent=6)}")
            else:
                print(f"    Empty/None")
        
        # Check a work order's dispensers through relationship
        print("\n\n🔍 Checking through Work Order relationship:")
        work_order = db.query(WorkOrder).filter(WorkOrder.dispensers.any()).first()
        if work_order:
            print(f"\nWork Order: {work_order.external_id}")
            print(f"Dispensers: {len(work_order.dispensers)}")
            
            if work_order.dispensers:
                disp = work_order.dispensers[0]
                print(f"\nFirst dispenser via relationship:")
                print(f"  form_data type: {type(disp.form_data)}")
                if disp.form_data:
                    print(f"  grades_list from form_data: {disp.form_data.get('grades_list', 'Not found')}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_form_data()