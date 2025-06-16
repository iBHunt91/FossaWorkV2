#!/usr/bin/env python3
"""
Fix single scrape grades issue
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from app.models.user_models import User
from sqlalchemy.orm.attributes import flag_modified

def fix_grades():
    """Fix grades in existing dispensers"""
    db = SessionLocal()
    
    try:
        print("🔧 Fixing Single Scrape Grades")
        print("=" * 70)
        
        # Get all dispensers
        dispensers = db.query(Dispenser).all()
        
        fixed_count = 0
        
        for d in dispensers:
            if not d.form_data:
                continue
                
            grades_list = d.form_data.get('grades_list', [])
            custom_fields = d.form_data.get('custom_fields', {})
            
            # Check if grades_list contains field names or non-fuel items
            needs_fix = False
            if grades_list:
                for grade in grades_list:
                    if isinstance(grade, str):
                        grade_lower = grade.lower()
                        # Check for field names
                        if any(x in grade_lower for x in ['stand alone', 'nozzle', 'meter', 'number of', 'code']):
                            needs_fix = True
                            break
                        # Check if it's a custom field key
                        if grade in custom_fields:
                            needs_fix = True
                            break
            
            if needs_fix:
                print(f"\n🔍 Dispenser {d.dispenser_number} (WO: {d.work_order_id[:8]}...)")
                print(f"  Current grades_list: {grades_list}")
                
                # Try to extract proper fuel grades
                new_grades = []
                
                # Check if we have a GRADE field with codes
                if custom_fields.get('GRADE'):
                    grade_value = custom_fields['GRADE']
                    print(f"  Found GRADE field: {grade_value}")
                    
                    try:
                        from app.data.fuel_grade_codes import decode_fuel_grade_string
                        decoded = decode_fuel_grade_string(grade_value)
                        if decoded:
                            new_grades = decoded
                            print(f"  Decoded to: {decoded}")
                    except:
                        print(f"  Could not decode")
                
                # If we found proper grades, update
                if new_grades:
                    d.form_data['grades_list'] = new_grades
                    flag_modified(d, 'form_data')
                    fixed_count += 1
                    print(f"  ✅ Fixed! New grades_list: {new_grades}")
                else:
                    # Clear the bad grades_list
                    d.form_data['grades_list'] = []
                    flag_modified(d, 'form_data')
                    fixed_count += 1
                    print(f"  ✅ Cleared bad grades_list")
        
        if fixed_count > 0:
            db.commit()
            print(f"\n✅ Fixed {fixed_count} dispensers")
        else:
            print(f"\n✅ No dispensers needed fixing")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_grades()