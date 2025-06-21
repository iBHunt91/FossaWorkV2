#!/usr/bin/env python3
"""
Test to reproduce the exact 500 error
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

# First, let's test if the imports work
try:
    from app.routes.work_orders import get_work_orders
    print("✅ Import successful")
except Exception as e:
    print(f"❌ Import error: {e}")
    import traceback
    traceback.print_exc()

# Test the URL generator
try:
    from app.services.url_generator import WorkFossaURLGenerator
    url_gen = WorkFossaURLGenerator()
    print("✅ URL generator import successful")
except Exception as e:
    print(f"❌ URL generator error: {e}")
    import traceback
    traceback.print_exc()

# Now let's check the actual database query
from app.database import SessionLocal
from app.core_models import WorkOrder, Dispenser
from app.models import User

db = SessionLocal()
try:
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Get the user
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        print(f"\n✅ User found: {user.email}")
        print(f"   Has is_admin: {hasattr(user, 'is_admin')}")
        if hasattr(user, 'is_admin'):
            print(f"   is_admin value: {user.is_admin}")
    
    # Test the query that the route uses
    print("\n🔍 Testing work order query...")
    work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
    print(f"✅ Found {len(work_orders)} work orders")
    
    # Test getting dispensers for first work order
    if work_orders:
        wo = work_orders[0]
        dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
        print(f"✅ Found {len(dispensers)} dispensers for first work order")
        
        # Test URL generation
        if not wo.visit_url:
            print("\n🔧 Testing URL generation for work order without visit_url...")
            try:
                from app.services.url_generator import WorkFossaURLGenerator
                url_generator = WorkFossaURLGenerator()
                
                wo_data_for_url = {
                    "basic_info": {
                        "id": wo.id,
                        "external_id": wo.external_id,
                        "store_info": getattr(wo, 'store_info', wo.site_name)
                    },
                    "location": {
                        "site_name": wo.site_name
                    },
                    "scheduling": {
                        "status": wo.status
                    }
                }
                
                visit_url = url_generator.generate_visit_url(wo_data_for_url)
                print(f"✅ Generated URL: {visit_url}")
            except Exception as e:
                print(f"❌ URL generation error: {e}")
                import traceback
                traceback.print_exc()
                
except Exception as e:
    print(f"\n❌ Database error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

print("\n💡 If you see errors above, those are likely causing the 500 error")