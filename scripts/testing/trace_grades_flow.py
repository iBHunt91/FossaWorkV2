#!/usr/bin/env python3
"""
Trace how grades flow through the system
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from app.models.user_models import User

def trace_grades():
    """Trace grades through the system"""
    db = SessionLocal()
    
    try:
        print("🔍 Tracing Grades Flow")
        print("=" * 70)
        
        # Find a work order with dispensers
        work_order = db.query(WorkOrder).filter(
            WorkOrder.dispensers.any()
        ).first()
        
        if not work_order:
            print("No work orders with dispensers")
            return
        
        print(f"\nWork Order: {work_order.external_id}")
        
        # Check scraped_data
        if work_order.scraped_data and 'dispensers' in work_order.scraped_data:
            scraped_dispensers = work_order.scraped_data['dispensers']
            if scraped_dispensers:
                print(f"\n1️⃣ SCRAPED_DATA dispensers[0]:")
                sd = scraped_dispensers[0]
                print(f"  grades_list: {sd.get('grades_list', 'NOT FOUND')}")
                print(f"  custom_fields: {sd.get('custom_fields', 'NOT FOUND')}")
        
        # Check first dispenser in DB
        if work_order.dispensers:
            d = work_order.dispensers[0]
            print(f"\n2️⃣ DATABASE Dispenser:")
            print(f"  dispenser_number: {d.dispenser_number}")
            print(f"  fuel_grades: {d.fuel_grades}")
            
            if d.form_data:
                print(f"\n3️⃣ FORM_DATA:")
                print(f"  grades_list: {d.form_data.get('grades_list', 'NOT FOUND')}")
                print(f"  custom_fields: {d.form_data.get('custom_fields', 'NOT FOUND')}")
                
                # Check if custom_fields VALUES are in grades_list
                if 'grades_list' in d.form_data and 'custom_fields' in d.form_data:
                    grades = d.form_data['grades_list']
                    custom_values = list(d.form_data['custom_fields'].values())
                    custom_keys = list(d.form_data['custom_fields'].keys())
                    
                    print(f"\n⚠️  ANALYSIS:")
                    print(f"  Custom field VALUES: {custom_values}")
                    print(f"  Custom field KEYS: {custom_keys}")
                    print(f"  Grades list: {grades}")
                    
                    # Check if custom VALUES are in grades
                    values_in_grades = [v for v in custom_values if v in grades]
                    if values_in_grades:
                        print(f"\n❌ ERROR: Custom field VALUES found in grades_list: {values_in_grades}")
                    
                    # Check if custom KEYS are in grades  
                    keys_in_grades = [k for k in custom_keys if k in grades]
                    if keys_in_grades:
                        print(f"\n❌ ERROR: Custom field KEYS found in grades_list: {keys_in_grades}")
                        
            # Now simulate API response
            from app.routes.work_orders import convert_fuel_grades_to_list
            
            api_grades_list = d.form_data.get('grades_list', []) if d.form_data else []
            api_fuel_grades_list = api_grades_list or convert_fuel_grades_to_list(d.fuel_grades)
            
            print(f"\n4️⃣ API RESPONSE would be:")
            print(f"  grades_list: {api_grades_list}")
            print(f"  fuel_grades_list: {api_fuel_grades_list}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    trace_grades()