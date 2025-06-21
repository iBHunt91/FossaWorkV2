#!/usr/bin/env python3
"""
Fix for batch dispenser scraping data storage issue.

The issue: Batch dispenser scraping is not storing all the scraped fields
to the database, while single work order scraping is.

This script shows the difference and provides the fix.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
import json


def show_dispenser_differences():
    """Show the differences between dispensers scraped via batch vs single"""
    db = SessionLocal()
    
    try:
        # Find a work order with dispensers
        work_orders = db.query(WorkOrder).filter(WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"])).all()
        
        print("=== DISPENSER DATA COMPARISON ===\n")
        
        for wo in work_orders[:5]:  # Check first 5
            dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
            
            if dispensers:
                print(f"\nWork Order: {wo.external_id} - {wo.site_name}")
                print(f"Number of dispensers: {len(dispensers)}")
                
                for d in dispensers[:2]:  # Show first 2 dispensers
                    print(f"\n  Dispenser #{d.dispenser_number}:")
                    print(f"    Type: {d.dispenser_type}")
                    print(f"    Fuel Grades: {d.fuel_grades}")
                    
                    # Check for additional fields (these are missing in batch scraping)
                    print(f"    Make: {d.make}")
                    print(f"    Model: {d.model}")
                    print(f"    Serial Number: {d.serial_number}")
                    print(f"    Meter Type: {d.meter_type}")
                    print(f"    Number of Nozzles: {d.number_of_nozzles}")
                    print(f"    Form Data: {d.form_data}")
                    
                    # Check if scraped_data has the full info
                    if wo.scraped_data and 'dispensers' in wo.scraped_data:
                        scraped_dispensers = wo.scraped_data['dispensers']
                        # Find matching dispenser in scraped data
                        for sd in scraped_dispensers:
                            if str(sd.get('dispenser_number')) == str(d.dispenser_number):
                                print(f"    \n    === SCRAPED DATA (not saved in batch) ===")
                                print(f"    Title: {sd.get('title')}")
                                print(f"    Make (scraped): {sd.get('make')}")
                                print(f"    Model (scraped): {sd.get('model')}")
                                print(f"    Serial (scraped): {sd.get('serial_number')}")
                                print(f"    Grades List: {sd.get('grades_list')}")
                                break
        
    finally:
        db.close()


def show_the_fix():
    """Show what the fixed batch scraping code should look like"""
    print("\n\n=== THE FIX ===\n")
    print("In the batch dispenser scraping function (perform_batch_dispenser_scrape),")
    print("replace the dispenser creation code (lines 1385-1395) with:\n")
    
    fix_code = '''
                        dispenser = Dispenser(
                            id=str(uuid.uuid4()),
                            work_order_id=work_order.id,
                            dispenser_number=disp.get("dispenser_number", str(i + 1)),
                            dispenser_type=disp.get("dispenser_type") or disp.get("make", "Unknown"),
                            fuel_grades=disp.get("fuel_grades", {}),
                            status="pending",
                            progress_percentage=0.0,
                            automation_completed=False,
                            # ADD THESE FIELDS (same as single work order scraping):
                            make=disp.get("make"),
                            model=disp.get("model"),
                            serial_number=disp.get("serial_number"),
                            meter_type=disp.get("meter_type"),
                            number_of_nozzles=disp.get("number_of_nozzles"),
                            form_data={
                                "stand_alone_code": disp.get("stand_alone_code"),
                                "grades_list": disp.get("grades_list", []),
                                "title": disp.get("title"),
                                "dispenser_numbers": disp.get("dispenser_numbers", []),
                                "custom_fields": disp.get("custom_fields", {})
                            }
                        )
    '''
    print(fix_code)
    
    print("\nThis ensures batch scraping saves ALL the same fields as single work order scraping.")


if __name__ == "__main__":
    print("Analyzing dispenser data storage differences...\n")
    show_dispenser_differences()
    show_the_fix()