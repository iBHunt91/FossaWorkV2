#!/usr/bin/env python3
"""
Debug what the API returns for dispensers
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import requests
from app.database import SessionLocal
from app.models import WorkOrder, User

def debug_api():
    """Debug API response"""
    
    print("🔍 Debugging Dispenser API Response")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get a work order and user
    work_order = db.query(WorkOrder).filter(
        WorkOrder.id == "31b14e5f-d29e-4513-8d9d-ed5baa3576f3"
    ).first()
    
    if not work_order:
        print("❌ Work order not found")
        db.close()
        return
    
    user = db.query(User).filter(User.id == work_order.user_id).first()
    
    print(f"Work Order: {work_order.external_id}")
    print(f"User: {user.email}")
    
    # Make API request
    url = f"http://localhost:8000/api/v1/work-orders/{work_order.id}"
    params = {"user_id": user.id}
    
    # You would need auth headers here
    print(f"\nAPI URL: {url}")
    print(f"Params: {params}")
    
    # Instead, let's simulate what the API returns
    from app.routes.work_orders import get_scraped_dispenser_details
    from app.models import Dispenser
    
    dispensers = db.query(Dispenser).filter(
        Dispenser.work_order_id == work_order.id
    ).all()
    
    print(f"\n📋 API would return {len(dispensers)} dispensers:")
    
    for d in dispensers[:2]:  # First 2
        api_data = {
            "id": d.id,
            "dispenser_number": d.dispenser_number,
            "dispenser_type": d.dispenser_type,
            "fuel_grades": d.fuel_grades,
            "status": d.status,
            "progress_percentage": d.progress_percentage,
            "automation_completed": d.automation_completed,
            **get_scraped_dispenser_details(work_order, d.dispenser_number)
        }
        
        print(f"\n{d.dispenser_number}:")
        print(json.dumps(api_data, indent=2, default=str))
    
    db.close()

if __name__ == "__main__":
    debug_api()