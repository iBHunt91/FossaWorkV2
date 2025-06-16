#!/usr/bin/env python3
"""
Fix dispenser fuel grades format to match expected structure
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from sqlalchemy.orm.attributes import flag_modified

def fix_fuel_grades():
    """Fix fuel grades format"""
    
    print("🔧 Fixing Dispenser Fuel Grades Format")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get all dispensers
    dispensers = db.query(Dispenser).all()
    
    fixed_count = 0
    
    for disp in dispensers:
        needs_fix = False
        
        # Check if fuel_grades has weird format
        if disp.fuel_grades:
            for key, value in disp.fuel_grades.items():
                # Check if the key contains underscores (like "Regular_plus_premium")
                if '_' in key and key.lower() != 'ethanol_free':
                    needs_fix = True
                    break
        
        if needs_fix:
            print(f"\nFixing dispenser {disp.dispenser_number}:")
            print(f"  Old fuel_grades: {disp.fuel_grades}")
            
            # Extract grades from the key or from grades_list
            new_fuel_grades = {}
            
            # First try to get from form_data grades_list
            if disp.form_data and 'grades_list' in disp.form_data:
                grades_list = disp.form_data['grades_list']
                for grade in grades_list:
                    grade_key = grade.lower().replace(' ', '_')
                    new_fuel_grades[grade_key] = {'name': grade}
            else:
                # Otherwise parse from the weird key
                for key in disp.fuel_grades.keys():
                    if '_' in key:
                        # Split by underscore and create individual grades
                        parts = key.split('_')
                        for part in parts:
                            if part.lower() in ['regular', 'plus', 'premium', 'diesel']:
                                new_fuel_grades[part.lower()] = {'name': part.capitalize()}
            
            disp.fuel_grades = new_fuel_grades
            flag_modified(disp, "fuel_grades")
            
            print(f"  New fuel_grades: {disp.fuel_grades}")
            fixed_count += 1
    
    if fixed_count > 0:
        db.commit()
        print(f"\n✅ Fixed {fixed_count} dispensers")
    else:
        print("\n✅ No dispensers needed fixing")
    
    db.close()

if __name__ == "__main__":
    fix_fuel_grades()