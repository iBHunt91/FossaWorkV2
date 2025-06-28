#!/usr/bin/env python3
"""
Comprehensive fix for grades_list issue
"""
import sys
import os
import json
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import Dispenser, WorkOrder
from sqlalchemy.orm.attributes import flag_modified
from app.data.fuel_grade_codes import decode_fuel_grade_string

async def fix_all_grades():
    """Fix all grades issues comprehensively"""
    db = SessionLocal()
    
    try:
        print("🔧 Comprehensive Grades Fix")
        print("=" * 70)
        
        # Get all dispensers
        dispensers = db.query(Dispenser).all()
        
        fixed_count = 0
        patterns_found = set()
        
        for d in dispensers:
            if not d.form_data:
                continue
            
            grades_list = d.form_data.get('grades_list', [])
            if not grades_list:
                continue
            
            # Analyze what's in grades_list
            has_field_labels = False
            has_numeric_codes = False
            has_non_fuel_values = False
            
            field_labels = []
            numeric_codes = []
            non_fuel_values = []
            
            for grade in grades_list:
                if isinstance(grade, str):
                    grade_lower = grade.lower()
                    
                    # Check for field labels
                    if any(x in grade_lower for x in ['stand alone', 'nozzle', 'meter', 'number of', 'per side']):
                        has_field_labels = True
                        field_labels.append(grade)
                        patterns_found.add(f"Field label: {grade}")
                    
                    # Check for 4-digit numeric codes
                    elif grade.isdigit() and len(grade) == 4:
                        has_numeric_codes = True
                        numeric_codes.append(grade)
                    
                    # Check for non-fuel values
                    elif grade_lower in ['hd meter', 'mechanical', 'electronic', 'standard']:
                        has_non_fuel_values = True
                        non_fuel_values.append(grade)
                        patterns_found.add(f"Non-fuel value: {grade}")
            
            # If we found issues, fix them
            if has_field_labels or has_non_fuel_values:
                print(f"\n🐛 Dispenser {d.dispenser_number} has issues:")
                print(f"  Current grades_list: {grades_list}")
                
                if field_labels:
                    print(f"  ❌ Field labels found: {field_labels}")
                if non_fuel_values:
                    print(f"  ❌ Non-fuel values found: {non_fuel_values}")
                if numeric_codes:
                    print(f"  ⚠️  Numeric codes found: {numeric_codes}")
                
                # Extract proper fuel grades
                new_grades = []
                
                # Method 1: Decode from GRADE field
                if d.form_data.get('custom_fields', {}).get('GRADE'):
                    grade_value = d.form_data['custom_fields']['GRADE']
                    decoded = decode_fuel_grade_string(grade_value)
                    if decoded:
                        new_grades = decoded
                        print(f"  ✅ Decoded from GRADE field: {decoded}")
                
                # Method 2: If we have numeric codes, decode them
                elif numeric_codes:
                    all_codes = ' '.join(numeric_codes)
                    decoded = decode_fuel_grade_string(all_codes)
                    if decoded:
                        new_grades = decoded
                        print(f"  ✅ Decoded from numeric codes: {decoded}")
                
                # Update the grades_list
                d.form_data['grades_list'] = new_grades
                flag_modified(d, 'form_data')
                fixed_count += 1
                print(f"  ✅ Fixed! New grades_list: {new_grades}")
                
                # Also update in work order scraped_data
                work_order = db.query(WorkOrder).filter(WorkOrder.id == d.work_order_id).first()
                if work_order and work_order.scraped_data and 'dispensers' in work_order.scraped_data:
                    for scraped_disp in work_order.scraped_data['dispensers']:
                        if str(scraped_disp.get('dispenser_number')) == str(d.dispenser_number):
                            scraped_disp['grades_list'] = new_grades
                            flag_modified(work_order, 'scraped_data')
                            break
        
        if fixed_count > 0:
            db.commit()
            print(f"\n✅ Fixed {fixed_count} dispensers")
            
            print(f"\n📊 Patterns found:")
            for pattern in sorted(patterns_found):
                print(f"  - {pattern}")
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
    asyncio.run(fix_all_grades())