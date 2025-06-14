#!/usr/bin/env python3
"""Check the test work order we updated"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models import WorkOrder
import json

db = SessionLocal()
try:
    # Get the work order we tested
    work_order = db.query(WorkOrder).filter(
        WorkOrder.external_id == "129651"
    ).first()
    
    if work_order:
        print(f"Work Order {work_order.external_id}:")
        print(f"  ID: {work_order.id[:8]}...")
        print(f"  Updated: {work_order.updated_at}")
        
        if work_order.scraped_data:
            data = work_order.scraped_data
            print(f"\n  Scraped data keys: {list(data.keys())}")
            
            if "test_update" in data:
                print(f"  ✅ Test update field found: {data['test_update']}")
            
            if "dispensers" in data:
                print(f"  ✅ Dispensers found: {len(data['dispensers'])}")
                for d in data['dispensers']:
                    print(f"     - {d.get('dispenser_number')}: {d.get('dispenser_type')}")
            
            if "dispensers_scraped_at" in data:
                print(f"  ✅ Scraped at: {data['dispensers_scraped_at']}")
    else:
        print("Work order 129651 not found")
        
finally:
    db.close()