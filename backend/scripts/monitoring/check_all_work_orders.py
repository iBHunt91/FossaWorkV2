#!/usr/bin/env python3
"""Check all work orders across all users"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.core_models import WorkOrder
from app.models.user_models import User
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Get all users
    users = db.query(User).all()
    print(f"Total users: {len(users)}")
    for user in users:
        print(f"\nUser: {user.username} (ID: {user.id})")
        
        # Get work orders for this user
        work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user.id).all()
        print(f"  Work orders: {len(work_orders)}")
        
        if work_orders:
            # Check dispenser scraping status
            with_dispensers = 0
            without_dispensers = 0
            
            for wo in work_orders:
                if wo.scraped_data:
                    data = json.loads(wo.scraped_data)
                    if 'dispensers' in data and data['dispensers']:
                        with_dispensers += 1
                    else:
                        without_dispensers += 1
            
            print(f"    With dispensers: {with_dispensers}")
            print(f"    Without dispensers: {without_dispensers}")
    
    # Check for orphaned work orders
    all_work_orders = db.query(WorkOrder).all()
    user_ids = {user.id for user in users}
    orphaned = [wo for wo in all_work_orders if wo.user_id not in user_ids]
    
    if orphaned:
        print(f"\n⚠️  Found {len(orphaned)} orphaned work orders (no matching user)")
        
finally:
    db.close()