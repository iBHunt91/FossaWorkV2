#!/usr/bin/env python3
"""Check the structure of scraped dispenser data"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models import WorkOrder
import json

db = SessionLocal()
try:
    # Get a work order with dispenser data
    work_order = db.query(WorkOrder).filter(
        WorkOrder.external_id == "110469"  # This one has 6 dispensers
    ).first()
    
    if work_order and work_order.scraped_data:
        data = work_order.scraped_data
        if "dispensers" in data:
            print(f"Work Order {work_order.external_id} dispenser data structure:")
            print(f"Number of dispensers: {len(data['dispensers'])}")
            print("\nFirst dispenser structure:")
            if data['dispensers']:
                disp = data['dispensers'][0]
                print(json.dumps(disp, indent=2))
                print(f"\nKeys in dispenser data: {list(disp.keys())}")
                
    # Also check what's in the dispensers table
    from sqlalchemy import text
    dispensers = db.execute(text("""
        SELECT d.dispenser_number, d.dispenser_type, d.fuel_grades
        FROM dispensers d
        JOIN work_orders wo ON d.work_order_id = wo.id
        WHERE wo.external_id = '110469'
    """)).fetchall()
    
    print(f"\n\nDispensers in table for 110469:")
    for d in dispensers:
        print(f"  Number: {d.dispenser_number}, Type: {d.dispenser_type}")
        
finally:
    db.close()