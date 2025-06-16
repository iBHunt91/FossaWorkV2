#!/usr/bin/env python3
"""Test dispenser data persistence directly"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models import WorkOrder
from sqlalchemy.orm.attributes import flag_modified
import json
from datetime import datetime

def test_direct_update():
    """Test updating dispenser data directly"""
    db = SessionLocal()
    
    try:
        # Get a work order
        work_order = db.query(WorkOrder).filter(
            WorkOrder.user_id == "7bea3bdb7e8e303eacaba442bd824004"
        ).first()
        
        if not work_order:
            print("No work orders found")
            return
            
        print(f"Testing dispenser update for work order: {work_order.id[:8]}...")
        print(f"External ID: {work_order.external_id}")
        
        # Check current scraped_data
        if work_order.scraped_data:
            print(f"Current scraped_data keys: {list(work_order.scraped_data.keys())}")
            if "dispensers" in work_order.scraped_data:
                print(f"  Current dispensers: {len(work_order.scraped_data['dispensers'])}")
            if "dispensers_scraped_at" in work_order.scraped_data:
                print(f"  Last scraped: {work_order.scraped_data['dispensers_scraped_at']}")
        else:
            work_order.scraped_data = {}
            
        # Add test dispenser data
        test_dispensers = [
            {
                "dispenser_number": "1",
                "dispenser_type": "Wayne 300",
                "fuel_grades": {"regular": {"octane": 87}, "plus": {"octane": 89}, "premium": {"octane": 91}}
            },
            {
                "dispenser_number": "2",
                "dispenser_type": "Gilbarco Encore 500",
                "fuel_grades": {"regular": {"octane": 87}, "plus": {"octane": 89}, "premium": {"octane": 91}}
            }
        ]
        
        print("\nAdding test dispenser data...")
        work_order.scraped_data["dispensers"] = test_dispensers
        work_order.scraped_data["dispenser_count"] = len(test_dispensers)
        work_order.scraped_data["dispensers_scraped_at"] = datetime.now().isoformat()
        work_order.scraped_data["test_update"] = True
        
        # Mark as modified
        flag_modified(work_order, "scraped_data")
        
        # Commit
        db.commit()
        print("✅ Committed changes")
        
        # Refresh and verify
        db.refresh(work_order)
        if work_order.scraped_data.get("test_update") == True:
            print("✅ Test update successful!")
            print(f"   Dispensers saved: {len(work_order.scraped_data.get('dispensers', []))}")
            print(f"   Scraped at: {work_order.scraped_data.get('dispensers_scraped_at')}")
        else:
            print("❌ Test update failed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_direct_update()