#!/usr/bin/env python3
"""
Fix the grades_list contamination issue by finding and fixing the source
"""
import sys
import os
import json
import re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from sqlalchemy.orm.attributes import flag_modified
from app.data.fuel_grade_codes import decode_fuel_grade_string

def fix_contamination():
    """Fix the contamination in grades_list"""
    db = SessionLocal()
    
    try:
        print("🔧 Fixing Grades List Contamination")
        print("=" * 70)
        
        # Get all dispensers
        dispensers = db.query(Dispenser).all()
        
        fixed_count = 0
        contamination_patterns = {}
        
        for d in dispensers:
            if not d.form_data or not d.form_data.get('grades_list'):
                continue
            
            grades_list = d.form_data['grades_list']
            original_grades = grades_list[:]
            
            # Check for contamination
            contaminated = False
            contaminated_items = []
            
            for grade in grades_list:
                if not isinstance(grade, str):
                    continue
                
                # Check for field labels (transformed)
                if any(x in grade.lower() for x in ['stand alone', 'code', 'nozzle', 'meter', 'number of', 'per side']):
                    contaminated = True
                    contaminated_items.append(grade)
                    # Track pattern
                    pattern_key = "Field Label"
                    contamination_patterns[pattern_key] = contamination_patterns.get(pattern_key, 0) + 1
                
                # Check for non-fuel values
                elif grade.lower() in ['hd meter', 'mechanical', 'electronic', 'standard', 'yes', 'no']:
                    contaminated = True
                    contaminated_items.append(grade)
                    # Track pattern
                    pattern_key = "Field Value"
                    contamination_patterns[pattern_key] = contamination_patterns.get(pattern_key, 0) + 1
            
            if contaminated:
                print(f"\n🐛 Dispenser {d.dispenser_number} (Work Order: {d.work_order_id[:8]}...)")
                print(f"   Current grades_list: {grades_list}")
                print(f"   Contaminated items: {contaminated_items}")
                
                # Fix it by extracting from GRADE field
                new_grades = []
                if d.form_data.get('custom_fields', {}).get('GRADE'):
                    grade_value = d.form_data['custom_fields']['GRADE']
                    print(f"   GRADE field value: '{grade_value}'")
                    
                    # Decode fuel grade codes
                    decoded = decode_fuel_grade_string(grade_value)
                    if decoded:
                        new_grades = decoded
                        print(f"   ✅ Decoded to: {decoded}")
                else:
                    print("   ❌ No GRADE field found in custom_fields")
                    
                    # Try to extract valid fuel grades from the contaminated list
                    valid_grades = []
                    for grade in grades_list:
                        if isinstance(grade, str):
                            # Check if it's a 4-digit code
                            if grade.isdigit() and len(grade) == 4:
                                # Try to decode single code
                                decoded_single = decode_fuel_grade_string(grade)
                                if decoded_single:
                                    valid_grades.extend(decoded_single)
                            # Check if it's a known fuel grade name
                            elif any(fuel in grade.lower() for fuel in ['regular', 'plus', 'premium', 'diesel', 'super', 'ethanol']):
                                valid_grades.append(grade)
                    
                    if valid_grades:
                        new_grades = valid_grades
                        print(f"   ✅ Extracted valid grades: {valid_grades}")
                
                # Update the grades_list
                d.form_data['grades_list'] = new_grades
                flag_modified(d, 'form_data')
                fixed_count += 1
                print(f"   ✅ Fixed! New grades_list: {new_grades}")
                
                # Also update in work order scraped_data
                work_order = db.query(WorkOrder).filter(WorkOrder.id == d.work_order_id).first()
                if work_order and work_order.scraped_data and 'dispensers' in work_order.scraped_data:
                    for scraped_disp in work_order.scraped_data['dispensers']:
                        if str(scraped_disp.get('dispenser_number')) == str(d.dispenser_number):
                            scraped_disp['grades_list'] = new_grades
                            flag_modified(work_order, 'scraped_data')
                            print(f"   ✅ Also updated in work order scraped_data")
                            break
        
        if fixed_count > 0:
            db.commit()
            print(f"\n✅ Fixed {fixed_count} dispensers")
            
            print(f"\n📊 Contamination patterns found:")
            for pattern, count in sorted(contamination_patterns.items(), key=lambda x: x[1], reverse=True):
                print(f"   - {pattern}: {count} occurrences")
        else:
            print("\n✅ No contaminated dispensers found")
        
        # Now find the source of contamination
        print("\n" + "="*70)
        print("🔍 ANALYZING CONTAMINATION SOURCE")
        print("="*70)
        
        # Check if contamination exists in scraped_data
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.scraped_data.isnot(None)
        ).all()
        
        scraped_contamination = 0
        for wo in work_orders:
            if 'dispensers' in wo.scraped_data:
                for disp in wo.scraped_data['dispensers']:
                    grades = disp.get('grades_list', [])
                    for grade in grades:
                        if isinstance(grade, str) and any(x in grade.lower() for x in ['stand alone', 'code', 'nozzle', 'meter']):
                            scraped_contamination += 1
                            break
        
        print(f"\nContamination in scraped_data: {scraped_contamination} work orders")
        
        if scraped_contamination > 0:
            print("\n💡 CONCLUSION: The contamination is happening during scraping!")
            print("   The JavaScript extraction code is putting non-fuel items into grades_list")
            print("\n🎯 LIKELY CAUSE:")
            print("   The _extract_dispensers_simple method at line 1274 sets:")
            print("   grades_list=fuel_types")
            print("\n   But fuel_types might be getting populated with ALL text from Grade field")
            print("   instead of just fuel grade names.")
            print("\n🔧 FIX NEEDED:")
            print("   Check the regex pattern at line 1220 that extracts Grade field content")
            print("   It might be including too much text in the extraction")
        else:
            print("\n✅ No contamination found in scraped_data")
            print("   The contamination happens after scraping")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_contamination()