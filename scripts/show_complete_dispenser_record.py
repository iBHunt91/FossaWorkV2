#!/usr/bin/env python3
"""Show complete details of a dispenser record from the database"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL
import json

def show_complete_dispenser():
    """Display all fields and data for a dispenser record"""
    
    print("=" * 80)
    print("COMPLETE DISPENSER RECORD FROM DATABASE")
    print("=" * 80)
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Get first dispenser with all data
        dispenser = conn.execute(text("""
            SELECT d.*, wo.external_id, wo.site_name, wo.store_number, wo.address
            FROM dispensers d
            JOIN work_orders wo ON d.work_order_id = wo.id
            LIMIT 1
        """)).fetchone()
        
        if not dispenser:
            print("No dispensers found in database!")
            return
        
        # Display basic dispenser fields
        print("\n📋 BASIC DISPENSER INFORMATION:")
        print(f"   ID: {dispenser.id}")
        print(f"   Work Order ID: {dispenser.work_order_id}")
        print(f"   Work Order External ID: W-{dispenser.external_id}")
        print(f"   Site Name: {dispenser.site_name}")
        print(f"   Store Number: {dispenser.store_number}")
        print(f"   Address: {dispenser.address}")
        
        print("\n🔧 DISPENSER DETAILS:")
        print(f"   Dispenser Number: {dispenser.dispenser_number}")
        print(f"   Dispenser Type: {dispenser.dispenser_type}")
        print(f"   Status: {dispenser.status}")
        print(f"   Progress Percentage: {dispenser.progress_percentage}%")
        print(f"   Automation Completed: {dispenser.automation_completed}")
        print(f"   Created At: {dispenser.created_at}")
        print(f"   Updated At: {dispenser.updated_at}")
        
        # Display fuel grades
        print("\n⛽ FUEL GRADES:")
        if dispenser.fuel_grades:
            fuel_grades = json.loads(dispenser.fuel_grades) if isinstance(dispenser.fuel_grades, str) else dispenser.fuel_grades
            for grade, info in fuel_grades.items():
                if isinstance(info, dict):
                    print(f"   - {grade.title()}:")
                    for key, value in info.items():
                        print(f"     • {key}: {value}")
                else:
                    print(f"   - {grade}: {info}")
        else:
            print("   No fuel grades data")
        
        # Display form data
        print("\n📝 FORM DATA:")
        if dispenser.form_data:
            form_data = json.loads(dispenser.form_data) if isinstance(dispenser.form_data, str) else dispenser.form_data
            if form_data:
                for key, value in form_data.items():
                    print(f"   - {key}: {value}")
            else:
                print("   Empty form data")
        else:
            print("   No form data")
        
        # Display testing requirements
        print("\n🧪 TESTING REQUIREMENTS:")
        if dispenser.testing_requirements:
            test_req = json.loads(dispenser.testing_requirements) if isinstance(dispenser.testing_requirements, str) else dispenser.testing_requirements
            if test_req:
                for key, value in test_req.items():
                    print(f"   - {key}: {value}")
            else:
                print("   No testing requirements")
        else:
            print("   No testing requirements")
        
        # Now get the scraped_data from work order to show the original scraped structure
        scraped_data_result = conn.execute(text("""
            SELECT scraped_data
            FROM work_orders
            WHERE id = :wo_id
        """), {"wo_id": dispenser.work_order_id}).fetchone()
        
        if scraped_data_result and scraped_data_result.scraped_data:
            scraped = json.loads(scraped_data_result.scraped_data)
            if 'dispensers' in scraped and scraped['dispensers']:
                # Find matching dispenser in scraped data
                matching_dispenser = None
                for disp in scraped['dispensers']:
                    if disp.get('dispenser_number') == dispenser.dispenser_number:
                        matching_dispenser = disp
                        break
                
                if matching_dispenser:
                    print("\n📊 ORIGINAL SCRAPED DATA FOR THIS DISPENSER:")
                    for key, value in matching_dispenser.items():
                        if isinstance(value, (dict, list)):
                            print(f"   - {key}: {json.dumps(value, indent=6)}")
                        else:
                            print(f"   - {key}: {value}")
        
        print("\n" + "=" * 80)
        print("END OF DISPENSER RECORD")
        print("=" * 80)

if __name__ == "__main__":
    show_complete_dispenser()