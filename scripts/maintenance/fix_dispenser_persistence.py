#!/usr/bin/env python3
"""Fix dispenser scraping persistence issue"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.database import SessionLocal
from app.models import WorkOrder
import json

def test_json_update():
    """Test if JSON fields are being updated properly"""
    db = SessionLocal()
    
    try:
        # Find a work order
        work_order = db.query(WorkOrder).filter(
            WorkOrder.user_id == "7bea3bdb7e8e303eacaba442bd824004"
        ).first()
        
        if not work_order:
            print("No work orders found")
            return
            
        print(f"Testing JSON update for work order: {work_order.id[:8]}...")
        
        # Get current scraped_data
        if work_order.scraped_data is None:
            work_order.scraped_data = {}
            
        print(f"Current scraped_data keys: {list(work_order.scraped_data.keys())}")
        
        # Test update without flag_modified
        print("\n1. Testing update WITHOUT flag_modified...")
        work_order.scraped_data["test_field"] = "test_value_1"
        db.commit()
        
        # Refresh and check
        db.refresh(work_order)
        if work_order.scraped_data.get("test_field") == "test_value_1":
            print("   ✅ Update worked without flag_modified")
        else:
            print("   ❌ Update FAILED without flag_modified")
            
        # Test update WITH flag_modified
        print("\n2. Testing update WITH flag_modified...")
        work_order.scraped_data["test_field"] = "test_value_2"
        flag_modified(work_order, "scraped_data")
        db.commit()
        
        # Refresh and check
        db.refresh(work_order)
        if work_order.scraped_data.get("test_field") == "test_value_2":
            print("   ✅ Update worked with flag_modified")
        else:
            print("   ❌ Update FAILED with flag_modified")
            
        # Clean up test field
        if "test_field" in work_order.scraped_data:
            del work_order.scraped_data["test_field"]
            flag_modified(work_order, "scraped_data")
            db.commit()
            
        print("\n✅ Test complete - flag_modified is required for JSON updates in SQLite")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_json_update()