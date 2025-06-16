#!/usr/bin/env python3
"""
Debug what data the frontend should display
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

def debug_display():
    """Debug display data"""
    
    print("🔍 Debugging Dispenser Display Data")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get dispensers
    dispensers = db.query(Dispenser).filter(
        Dispenser.work_order_id == "31b14e5f-d29e-4513-8d9d-ed5baa3576f3"
    ).all()
    
    print(f"📋 Found {len(dispensers)} dispensers\n")
    
    # Show what the modal should display
    for d in dispensers:
        print(f"Dispenser {d.dispenser_number}:")
        print(f"  Make/Model: {d.make} {d.model}")
        print(f"  Serial: {d.serial_number}")
        print(f"  Stand Alone Code: {d.form_data.get('stand_alone_code') if d.form_data else 'N/A'}")
        print(f"  Meter Type: {d.meter_type}")
        print(f"  Nozzles: {d.number_of_nozzles}")
        
        # Fuel grades
        print("  Fuel Grades:")
        if d.fuel_grades:
            for grade, info in d.fuel_grades.items():
                grade_name = info.get('name', grade.capitalize())
                print(f"    - {grade_name}")
        
        print()
    
    db.close()

if __name__ == "__main__":
    debug_display()