#!/usr/bin/env python3
"""
Analyze fuel_grades differences between batch and single dispenser scraping.
This script will help identify why fuel_grades might appear different.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
import json
from datetime import datetime


def analyze_fuel_grades():
    """Analyze fuel grades data from different scraping methods"""
    db = SessionLocal()
    
    try:
        print("=== FUEL GRADES ANALYSIS ===\n")
        
        # Get all work orders with dispensers
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"])
        ).all()
        
        print(f"Total work orders with dispenser service codes: {len(work_orders)}")
        
        # Analyze fuel grades structure
        fuel_grade_structures = {
            "empty": 0,
            "dict_with_name": 0,
            "dict_with_octane": 0,
            "string_values": 0,
            "other": 0
        }
        
        sample_fuel_grades = []
        
        for wo in work_orders:
            dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
            
            for d in dispensers:
                if not d.fuel_grades:
                    fuel_grade_structures["empty"] += 1
                elif isinstance(d.fuel_grades, dict):
                    # Check the structure of the fuel grades
                    sample_added = False
                    for key, value in d.fuel_grades.items():
                        if isinstance(value, dict):
                            if 'name' in value and not sample_added:
                                fuel_grade_structures["dict_with_name"] += 1
                                if len(sample_fuel_grades) < 5:
                                    sample_fuel_grades.append({
                                        "work_order": wo.external_id,
                                        "dispenser": d.dispenser_number,
                                        "type": "dict_with_name",
                                        "data": d.fuel_grades,
                                        "scraped_at": wo.scraped_data.get("dispensers_scraped_at") if wo.scraped_data else None
                                    })
                                sample_added = True
                                break
                            elif 'octane' in value and not sample_added:
                                fuel_grade_structures["dict_with_octane"] += 1
                                if len(sample_fuel_grades) < 5:
                                    sample_fuel_grades.append({
                                        "work_order": wo.external_id,
                                        "dispenser": d.dispenser_number,
                                        "type": "dict_with_octane",
                                        "data": d.fuel_grades,
                                        "scraped_at": wo.scraped_data.get("dispensers_scraped_at") if wo.scraped_data else None
                                    })
                                sample_added = True
                                break
                        elif isinstance(value, str) and not sample_added:
                            fuel_grade_structures["string_values"] += 1
                            if len(sample_fuel_grades) < 5:
                                sample_fuel_grades.append({
                                    "work_order": wo.external_id,
                                    "dispenser": d.dispenser_number,
                                    "type": "string_values",
                                    "data": d.fuel_grades,
                                    "scraped_at": wo.scraped_data.get("dispensers_scraped_at") if wo.scraped_data else None
                                })
                            sample_added = True
                            break
                    
                    if not sample_added:
                        fuel_grade_structures["other"] += 1
                else:
                    fuel_grade_structures["other"] += 1
        
        # Print results
        print("\nFuel Grade Structure Analysis:")
        print(f"  Empty: {fuel_grade_structures['empty']}")
        print(f"  Dict with 'name' field: {fuel_grade_structures['dict_with_name']}")
        print(f"  Dict with 'octane' field: {fuel_grade_structures['dict_with_octane']}")
        print(f"  String values: {fuel_grade_structures['string_values']}")
        print(f"  Other: {fuel_grade_structures['other']}")
        
        print("\n\nSample Fuel Grades Data:")
        for i, sample in enumerate(sample_fuel_grades):
            print(f"\n{i+1}. Work Order: {sample['work_order']} - Dispenser {sample['dispenser']}")
            print(f"   Type: {sample['type']}")
            print(f"   Scraped at: {sample['scraped_at']}")
            print(f"   Data: {json.dumps(sample['data'], indent=4)}")
        
        # Check for hardcoded octane values
        print("\n\n=== HARDCODED OCTANE CHECK ===")
        hardcoded_count = 0
        scraped_count = 0
        
        for wo in work_orders[:10]:  # Check first 10
            dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
            
            for d in dispensers:
                if d.fuel_grades and isinstance(d.fuel_grades, dict):
                    has_octane = any('octane' in str(v) for v in d.fuel_grades.values())
                    if has_octane:
                        hardcoded_count += 1
                        print(f"\nHardcoded octane found in {wo.external_id} - Dispenser {d.dispenser_number}:")
                        print(f"  Fuel grades: {d.fuel_grades}")
                        
                        # Check scraped data
                        if wo.scraped_data and 'dispensers' in wo.scraped_data:
                            for sd in wo.scraped_data['dispensers']:
                                if str(sd.get('dispenser_number')) == str(d.dispenser_number):
                                    print(f"  Scraped fuel grades: {sd.get('fuel_grades')}")
                                    print(f"  Scraped grades list: {sd.get('grades_list')}")
                                    scraped_count += 1
                                    break
        
        print(f"\n\nTotal with hardcoded octane: {hardcoded_count}")
        print(f"Total with scraped data available: {scraped_count}")
        
        # Check form_data grades_list
        print("\n\n=== GRADES LIST CHECK ===")
        with_grades_list = 0
        without_grades_list = 0
        
        for wo in work_orders[:20]:  # Check first 20
            dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
            
            for d in dispensers:
                if d.form_data and isinstance(d.form_data, dict):
                    if 'grades_list' in d.form_data and d.form_data['grades_list']:
                        with_grades_list += 1
                        if with_grades_list <= 3:  # Show first 3
                            print(f"\n{wo.external_id} - Dispenser {d.dispenser_number}:")
                            print(f"  Grades list: {d.form_data['grades_list']}")
                            print(f"  Fuel grades dict: {d.fuel_grades}")
                    else:
                        without_grades_list += 1
                else:
                    without_grades_list += 1
        
        print(f"\n\nDispensers with grades_list: {with_grades_list}")
        print(f"Dispensers without grades_list: {without_grades_list}")
        
    finally:
        db.close()


if __name__ == "__main__":
    analyze_fuel_grades()