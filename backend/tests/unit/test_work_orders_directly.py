#!/usr/bin/env python3
"""
Test work orders query directly
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.database import SessionLocal
from app.core_models import WorkOrder, Dispenser
from app.models import User
from sqlalchemy.orm import Session
import traceback

def test_work_orders():
    """Test work orders query directly"""
    print("🧪 Testing Work Orders Query")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # First check if we have the user
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        # Test the user query
        print("\n1️⃣ Testing User query...")
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                print(f"✅ User found: {user.email}")
                print(f"   Is active: {getattr(user, 'is_active', True)}")
            else:
                print("❌ User not found")
        except Exception as e:
            print(f"❌ User query error: {e}")
            traceback.print_exc()
        
        # Test work orders query
        print("\n2️⃣ Testing WorkOrder query...")
        try:
            work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
            print(f"✅ Found {len(work_orders)} work orders")
            
            if work_orders:
                wo = work_orders[0]
                print(f"   First work order: {wo.external_id}")
                print(f"   Site: {wo.site_name}")
                
                # Test dispenser query
                print("\n3️⃣ Testing Dispenser query...")
                dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
                print(f"✅ Found {len(dispensers)} dispensers")
                
                if dispensers:
                    d = dispensers[0]
                    print(f"   First dispenser: {d.dispenser_number}")
                    print(f"   Make: {d.make}")
                    print(f"   Model: {d.model}")
                
        except Exception as e:
            print(f"❌ Work order query error: {e}")
            traceback.print_exc()
        
        # Test the exact query from the route
        print("\n4️⃣ Testing exact route logic...")
        try:
            # This mimics what the route does
            from app.routes.work_orders import get_scraped_dispenser_details
            
            work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
            
            for wo in work_orders[:1]:  # Just test first one
                dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
                
                for d in dispensers[:1]:  # Just test first dispenser
                    details = get_scraped_dispenser_details(wo, d.dispenser_number)
                    print(f"✅ Scraped details retrieved: {bool(details)}")
                    if details:
                        print(f"   Title: {details.get('title')}")
                        
        except Exception as e:
            print(f"❌ Route logic error: {e}")
            traceback.print_exc()
            
    except Exception as e:
        print(f"\n❌ General error: {e}")
        traceback.print_exc()
    finally:
        db.close()
    
    print("\n💡 If you see errors above, that's likely causing the 500 error")

if __name__ == "__main__":
    test_work_orders()