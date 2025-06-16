#!/usr/bin/env python3
"""
Fix the grades extraction issue
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import Dispenser, WorkOrder
from sqlalchemy.orm.attributes import flag_modified
from app.data.fuel_grade_codes import decode_fuel_grade_string

def fix_grades():
    """Fix the grades extraction issue"""
    db = SessionLocal()
    
    try:
        print("🔧 Fixing Grades Extraction Issue")
        print("=" * 70)
        
        # Get all dispensers
        dispensers = db.query(Dispenser).all()
        
        fixed_count = 0
        
        for d in dispensers:
            if not d.form_data:
                continue
            
            grades_list = d.form_data.get('grades_list', [])
            if not grades_list:
                continue
            
            # Check if it has the bug
            has_bug = False
            bug_items = []
            
            for grade in grades_list:
                if isinstance(grade, str):
                    # Check for field labels
                    if any(x in grade.lower() for x in ['stand alone', 'nozzle', 'meter', 'number of', 'code']):
                        has_bug = True
                        bug_items.append(f"Field label: '{grade}'")
                    # Check for single digit codes that should be part of a larger code
                    elif grade.isdigit() and len(grade) == 4:
                        # This might be OK if it's a standalone code
                        pass
            
            if has_bug:
                print(f"\n🐛 Found buggy dispenser: {d.dispenser_number}")
                print(f"  Current grades_list: {grades_list}")
                print(f"  Bug items: {bug_items}")
                
                # Extract proper fuel grades from custom_fields
                new_grades = []
                if d.form_data.get('custom_fields', {}).get('GRADE'):
                    grade_value = d.form_data['custom_fields']['GRADE']
                    # Decode the fuel grade codes
                    decoded = decode_fuel_grade_string(grade_value)
                    if decoded:
                        new_grades = decoded
                        print(f"  ✅ Decoded from GRADE field: {decoded}")
                
                # Update the grades_list
                d.form_data['grades_list'] = new_grades
                flag_modified(d, 'form_data')
                fixed_count += 1
                
                # Also update in scraped_data if present
                work_order = db.query(WorkOrder).filter(WorkOrder.id == d.work_order_id).first()
                if work_order and work_order.scraped_data and 'dispensers' in work_order.scraped_data:
                    for scraped_disp in work_order.scraped_data['dispensers']:
                        if str(scraped_disp.get('dispenser_number')) == str(d.dispenser_number):
                            scraped_disp['grades_list'] = new_grades
                            flag_modified(work_order, 'scraped_data')
                            print(f"  ✅ Also updated in work order scraped_data")
                            break
        
        if fixed_count > 0:
            db.commit()
            print(f"\n✅ Fixed {fixed_count} dispensers")
        else:
            print("\n✅ No dispensers needed fixing")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_grades()