#!/usr/bin/env python3
"""
Check for dispensers that are missing the additional fields
(which would indicate they were scraped with batch before the fix)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
import json


def check_missing_fields():
    """Check for dispensers missing additional fields"""
    db = SessionLocal()
    
    try:
        print("=== CHECKING FOR DISPENSERS WITH MISSING FIELDS ===\n")
        
        # Get all dispensers
        all_dispensers = db.query(Dispenser).all()
        print(f"Total dispensers in database: {len(all_dispensers)}")
        
        # Count dispensers with/without fields
        missing_fields_count = 0
        has_all_fields_count = 0
        missing_form_data_count = 0
        
        missing_examples = []
        
        for d in all_dispensers:
            # Check if dispenser is missing the additional fields
            missing_fields = []
            
            if d.make is None:
                missing_fields.append("make")
            if d.model is None:
                missing_fields.append("model")
            if d.serial_number is None:
                missing_fields.append("serial_number")
            if d.meter_type is None:
                missing_fields.append("meter_type")
            if d.number_of_nozzles is None:
                missing_fields.append("number_of_nozzles")
            if d.form_data is None or not d.form_data:
                missing_form_data_count += 1
                missing_fields.append("form_data")
            
            if missing_fields:
                missing_fields_count += 1
                
                # Get work order info
                wo = db.query(WorkOrder).filter(WorkOrder.id == d.work_order_id).first()
                
                # Add to examples if we haven't collected too many
                if len(missing_examples) < 5 and wo:
                    missing_examples.append({
                        "work_order": wo.external_id,
                        "site": wo.site_name,
                        "dispenser": d.dispenser_number,
                        "missing_fields": missing_fields,
                        "fuel_grades": d.fuel_grades,
                        "scraped_at": wo.scraped_data.get("dispensers_scraped_at") if wo.scraped_data else None
                    })
            else:
                has_all_fields_count += 1
        
        print(f"\nDispensers with all fields: {has_all_fields_count}")
        print(f"Dispensers missing fields: {missing_fields_count}")
        print(f"Dispensers missing form_data: {missing_form_data_count}")
        
        if missing_examples:
            print("\n\nExamples of dispensers with missing fields:")
            for i, example in enumerate(missing_examples):
                print(f"\n{i+1}. Work Order: {example['work_order']} - {example['site']}")
                print(f"   Dispenser: {example['dispenser']}")
                print(f"   Missing fields: {', '.join(example['missing_fields'])}")
                print(f"   Fuel grades: {example['fuel_grades']}")
                print(f"   Scraped at: {example['scraped_at']}")
        
        # Check scraped_data to see if info is there but not saved
        print("\n\n=== CHECKING IF DATA EXISTS IN SCRAPED_DATA ===")
        
        fixable_count = 0
        for d in all_dispensers[:50]:  # Check first 50
            if d.make is None or d.form_data is None:
                # Get work order
                wo = db.query(WorkOrder).filter(WorkOrder.id == d.work_order_id).first()
                if wo and wo.scraped_data and 'dispensers' in wo.scraped_data:
                    # Find matching dispenser in scraped data
                    for sd in wo.scraped_data['dispensers']:
                        if str(sd.get('dispenser_number')) == str(d.dispenser_number):
                            if sd.get('make') or sd.get('serial_number'):
                                fixable_count += 1
                                if fixable_count <= 3:
                                    print(f"\nFixable: {wo.external_id} - Dispenser {d.dispenser_number}")
                                    print(f"  Database has: make={d.make}, serial={d.serial_number}")
                                    print(f"  Scraped data has: make={sd.get('make')}, serial={sd.get('serial_number')}")
                            break
        
        print(f"\n\nTotal fixable dispensers (data exists in scraped_data): {fixable_count}")
        
    finally:
        db.close()


if __name__ == "__main__":
    check_missing_fields()