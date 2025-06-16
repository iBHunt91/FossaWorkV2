#!/usr/bin/env python3
"""
Fix single scrape issues:
1. Dispenser numbers showing as 1, 2, 3 instead of 1/2, 3/4, etc
2. Fuel grades showing custom field names and values
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from app.models.user_models import User
from sqlalchemy.orm.attributes import flag_modified
from app.data.fuel_grade_codes import decode_fuel_grade_string

def fix_issues():
    """Fix both issues in existing dispensers"""
    db = SessionLocal()
    
    try:
        print("🔧 Fixing Single Scrape Issues")
        print("=" * 70)
        
        # Get all dispensers
        dispensers = db.query(Dispenser).all()
        
        fixed_numbers = 0
        fixed_grades = 0
        
        for d in dispensers:
            if not d.form_data:
                continue
            
            changes_made = False
            
            # Issue 1: Fix dispenser numbers
            # If dispenser_number is just "1", "2", etc, try to extract proper number from title
            if d.dispenser_number in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']:
                title = d.form_data.get('title', '')
                if title:
                    # Try to extract from title
                    import re
                    match = re.search(r'Dispenser\s*#?(\d+(?:/\d+)?)', title, re.IGNORECASE)
                    if match and match.group(1) != d.dispenser_number:
                        old_num = d.dispenser_number
                        new_num = match.group(1)
                        d.dispenser_number = new_num
                        
                        # Update dispenser_numbers array
                        if '/' in new_num:
                            d.form_data['dispenser_numbers'] = new_num.split('/')
                        else:
                            d.form_data['dispenser_numbers'] = [new_num]
                        
                        print(f"\n✅ Fixed dispenser number: {old_num} → {new_num}")
                        fixed_numbers += 1
                        changes_made = True
            
            # Issue 2: Fix grades list
            grades_list = d.form_data.get('grades_list', [])
            custom_fields = d.form_data.get('custom_fields', {})
            
            # Check if grades_list contains non-fuel items
            needs_grade_fix = False
            if grades_list:
                for grade in grades_list:
                    if isinstance(grade, str):
                        grade_lower = grade.lower()
                        # Check for field names
                        if any(x in grade_lower for x in ['stand alone', 'nozzle', 'meter', 'number of', 'code', 'per side']):
                            needs_grade_fix = True
                            break
                        # Check if it's a transformed custom field key
                        # e.g., "Stand Alone Code" from "STAND_ALONE_CODE"
                        for key in custom_fields.keys():
                            transformed_key = key.replace('_', ' ').title()
                            if grade == transformed_key:
                                needs_grade_fix = True
                                break
            
            if needs_grade_fix:
                print(f"\n🔍 Dispenser {d.dispenser_number} needs grade fix")
                print(f"  Current grades_list: {grades_list}")
                
                # Extract proper fuel grades from GRADE field
                new_grades = []
                if custom_fields.get('GRADE'):
                    grade_value = custom_fields['GRADE']
                    decoded = decode_fuel_grade_string(grade_value)
                    if decoded:
                        new_grades = decoded
                        print(f"  Decoded from GRADE field: {decoded}")
                
                # Update grades_list
                d.form_data['grades_list'] = new_grades
                print(f"  ✅ Fixed grades_list: {new_grades}")
                fixed_grades += 1
                changes_made = True
            
            # If changes were made, mark as modified
            if changes_made:
                flag_modified(d, 'form_data')
        
        # Commit all changes
        if fixed_numbers > 0 or fixed_grades > 0:
            db.commit()
            print(f"\n✅ Summary:")
            print(f"  - Fixed {fixed_numbers} dispenser numbers")
            print(f"  - Fixed {fixed_grades} grades lists")
        else:
            print(f"\n✅ No issues found - all dispensers look good!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_issues()