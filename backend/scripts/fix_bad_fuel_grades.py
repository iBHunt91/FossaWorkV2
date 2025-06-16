#!/usr/bin/env python3
"""
Fix any bad fuel_grades data in the database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import Dispenser
from sqlalchemy.orm.attributes import flag_modified

def fix_bad_fuel_grades():
    """Fix any dispensers with bad fuel_grades data"""
    
    print("🔍 Checking for bad fuel_grades data")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get all dispensers
    dispensers = db.query(Dispenser).all()
    
    fixed_count = 0
    
    for d in dispensers:
        if not d.fuel_grades:
            continue
            
        needs_fix = False
        new_fuel_grades = {}
        
        # Check for bad data
        for key, value in d.fuel_grades.items():
            key_lower = key.lower()
            
            # Skip bad keys
            if ('api' in key_lower or 'error' in key_lower or 'type' in key_lower or 
                'work order' in key_lower or 'description' in key_lower):
                needs_fix = True
                print(f"❌ Found bad key in dispenser {d.dispenser_number}: {key}")
                continue
            
            # Check for description format (from old JS bug)
            if key == 'description' and isinstance(value, str):
                # Parse fuel grades from description
                grades = [g.strip() for g in value.split(',')]
                for grade in grades:
                    grade_key = grade.lower().replace(' ', '_').replace('-', '_')
                    new_fuel_grades[grade_key] = {'name': grade}
                needs_fix = True
                print(f"🔧 Converting description format for dispenser {d.dispenser_number}")
                continue
            
            # Keep good data
            new_fuel_grades[key] = value
        
        if needs_fix:
            print(f"  Old fuel_grades: {d.fuel_grades}")
            print(f"  New fuel_grades: {new_fuel_grades}")
            
            # Update the dispenser
            d.fuel_grades = new_fuel_grades
            flag_modified(d, "fuel_grades")
            fixed_count += 1
    
    if fixed_count > 0:
        print(f"\n✅ Fixed {fixed_count} dispensers")
        db.commit()
        print("💾 Changes saved to database")
    else:
        print("\n✅ No bad fuel_grades data found")
    
    db.close()

if __name__ == "__main__":
    fix_bad_fuel_grades()