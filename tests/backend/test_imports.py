#!/usr/bin/env python3
"""
Test imports to diagnose startup issues
"""
import sys
print(f"Python version: {sys.version}")
print(f"Python path: {sys.path}")

try:
    print("Testing app imports...")
    
    print("1. Testing database import...")
    from app.database import get_db
    print("   ✅ Database import successful")
    
    print("2. Testing models import...")
    from app.models import User, WorkOrder, Dispenser
    print("   ✅ Models import successful")
    
    print("3. Testing user_schemas import...")
    from app.models.user_schemas import UserCreate
    print("   ✅ User schemas import successful")
    
    print("4. Testing routes import...")
    from app.routes import users, work_orders, automation
    print("   ✅ Routes import successful")
    
    print("5. Testing logging service import...")
    from app.services.logging_service import get_logger
    print("   ✅ Logging service import successful")
    
    print("6. Testing main app import...")
    from app.main import app
    print("   ✅ Main app import successful")
    
    print("\n🎉 All imports successful!")
    
except ImportError as e:
    print(f"   ❌ Import error: {e}")
    print(f"   Module: {e.name if hasattr(e, 'name') else 'unknown'}")
    sys.exit(1)
except Exception as e:
    print(f"   ❌ Other error: {e}")
    sys.exit(1)