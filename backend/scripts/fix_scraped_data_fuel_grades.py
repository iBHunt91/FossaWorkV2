#!/usr/bin/env python3
"""
Fix fuel grades in scraped_data to remove octane values
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import WorkOrder
from sqlalchemy.orm.attributes import flag_modified

def fix_scraped_data():
    """Fix fuel grades in scraped_data"""
    
    print("🔧 Fixing Scraped Data Fuel Grades")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get all work orders with scraped_data
    work_orders = db.query(WorkOrder).filter(
        WorkOrder.scraped_data.isnot(None)
    ).all()
    
    fixed_count = 0
    
    for wo in work_orders:
        if 'dispensers' in wo.scraped_data:
            needs_fix = False
            
            # Check if any dispenser has octane values
            for disp in wo.scraped_data['dispensers']:
                if 'fuel_grades' in disp:
                    for grade, info in disp['fuel_grades'].items():
                        if isinstance(info, dict) and 'octane' in info:
                            needs_fix = True
                            break
                if needs_fix:
                    break
            
            if needs_fix:
                print(f"\nFixing work order {wo.external_id}:")
                
                # Fix each dispenser
                for disp in wo.scraped_data['dispensers']:
                    if 'fuel_grades' in disp:
                        new_fuel_grades = {}
                        
                        # Use grades_list if available
                        if 'grades_list' in disp:
                            for grade in disp['grades_list']:
                                grade_key = grade.lower().replace(' ', '_')
                                new_fuel_grades[grade_key] = {'name': grade}
                        else:
                            # Otherwise convert from old format
                            for grade_key, grade_info in disp['fuel_grades'].items():
                                new_fuel_grades[grade_key] = {'name': grade_key.capitalize()}
                        
                        disp['fuel_grades'] = new_fuel_grades
                        print(f"  Fixed dispenser {disp.get('dispenser_number')}: {new_fuel_grades}")
                
                # Mark as modified
                flag_modified(wo, "scraped_data")
                fixed_count += 1
    
    if fixed_count > 0:
        db.commit()
        print(f"\n✅ Fixed {fixed_count} work orders")
    else:
        print("\n✅ No work orders needed fixing")
    
    db.close()

if __name__ == "__main__":
    fix_scraped_data()