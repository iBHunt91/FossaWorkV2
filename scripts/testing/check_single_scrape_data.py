#!/usr/bin/env python3
"""
Check what data is stored after single job dispenser scraping
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from app.models.user_models import User

def check_single_scrape_data():
    """Check stored data from single job scraping"""
    db = SessionLocal()
    
    try:
        print("🔍 Checking Single Job Scrape Data")
        print("=" * 70)
        
        # Find most recent work order with dispensers
        work_order = db.query(WorkOrder).filter(
            WorkOrder.dispensers.any()
        ).order_by(WorkOrder.updated_at.desc()).first()
        
        if not work_order:
            print("No work orders with dispensers found")
            return
        
        print(f"\nWork Order: {work_order.external_id}")
        print(f"Site: {work_order.site_name}")
        print(f"Updated: {work_order.updated_at}")
        print(f"Dispensers: {len(work_order.dispensers)}")
        
        # Check first few dispensers
        for i, d in enumerate(work_order.dispensers[:3]):
            print(f"\n{'='*50}")
            print(f"Dispenser {i+1}: {d.dispenser_number}")
            print(f"  Type: {d.dispenser_type}")
            print(f"  Make: {d.make}")
            print(f"  Model: {d.model}")
            
            # Check form_data
            print(f"\n  form_data:")
            if d.form_data:
                for key, value in d.form_data.items():
                    print(f"    {key}: {value}")
            else:
                print("    No form_data")
            
            # Check fuel_grades
            print(f"\n  fuel_grades:")
            if d.fuel_grades:
                print(f"    Type: {type(d.fuel_grades)}")
                print(f"    Content: {json.dumps(d.fuel_grades, indent=6)}")
            else:
                print("    No fuel_grades")
            
            # Check what grades_list contains
            if d.form_data and 'grades_list' in d.form_data:
                grades_list = d.form_data['grades_list']
                print(f"\n  grades_list contains {len(grades_list)} items:")
                for grade in grades_list:
                    print(f"    - {grade}")
                    
                # Check if it contains non-fuel items
                non_fuel_items = [g for g in grades_list if any(
                    keyword in g.lower() for keyword in ['stand alone', 'nozzle', 'meter', 'code']
                )]
                
                if non_fuel_items:
                    print(f"\n  ❌ WARNING: grades_list contains non-fuel items:")
                    for item in non_fuel_items:
                        print(f"    - {item}")
                else:
                    print(f"\n  ✅ grades_list contains only fuel grades")
            
            # Check custom_fields
            if d.form_data and 'custom_fields' in d.form_data:
                print(f"\n  custom_fields:")
                for key, value in d.form_data['custom_fields'].items():
                    print(f"    {key}: {value}")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_single_scrape_data()