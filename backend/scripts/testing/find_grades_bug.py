#!/usr/bin/env python3
"""
Find where the grades_list bug is happening
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import Dispenser
from app.models.user_models import User
import json

def find_bug():
    """Find the grades_list bug"""
    db = SessionLocal()
    
    try:
        print("🔍 Finding Grades List Bug")
        print("=" * 70)
        
        # Get a dispenser with the issue
        dispensers = db.query(Dispenser).all()
        
        for d in dispensers:
            if not d.form_data or 'grades_list' not in d.form_data:
                continue
            
            grades_list = d.form_data['grades_list']
            
            # Check if it has the bug pattern
            has_bug = False
            if grades_list:
                for grade in grades_list:
                    if isinstance(grade, str) and any(x in grade.lower() for x in ['stand alone', 'nozzle', 'meter']):
                        has_bug = True
                        break
            
            if has_bug:
                print(f"\n🐛 Found dispenser with bug: {d.dispenser_number}")
                print(f"grades_list: {grades_list}")
                
                # Check what's in custom_fields
                if 'custom_fields' in d.form_data:
                    print(f"\ncustom_fields:")
                    for key, value in d.form_data['custom_fields'].items():
                        print(f"  {key}: {value}")
                        
                        # Check if key (transformed) is in grades_list
                        transformed_key = key.replace('_', ' ').title()
                        if transformed_key in grades_list:
                            print(f"    ❌ Transformed key '{transformed_key}' found in grades_list!")
                        
                        # Check if value is in grades_list
                        if str(value) in grades_list:
                            print(f"    ❌ Value '{value}' found in grades_list!")
                
                # Check if GRADE value was split
                if 'custom_fields' in d.form_data and 'GRADE' in d.form_data['custom_fields']:
                    grade_value = d.form_data['custom_fields']['GRADE']
                    if ' ' in str(grade_value):
                        codes = grade_value.split()
                        print(f"\nGRADE value: '{grade_value}' would split to: {codes}")
                        for code in codes:
                            if code in grades_list:
                                print(f"  ❌ Individual code '{code}' found in grades_list!")
                
                print("\n💡 Pattern Found:")
                print("The grades_list contains:")
                print("1. Transformed field NAMES (STAND_ALONE_CODE -> 'Stand Alone Code')")
                print("2. Individual fuel grade codes from split GRADE value")
                print("3. Some field VALUES like 'HD Meter'")
                
                return d
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    find_bug()