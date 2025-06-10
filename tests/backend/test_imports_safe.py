#!/usr/bin/env python3
"""
Test imports to diagnose startup issues - Windows Safe Version
"""
import sys
print(f"Python version: {sys.version}")

try:
    print("Testing app imports...")
    
    print("1. Testing database import...")
    from app.database import get_db
    print("   OK Database import successful")
    
    print("2. Testing models import...")
    from app.models import User, WorkOrder, Dispenser
    print("   OK Models import successful")
    
    print("3. Testing user_schemas import...")
    from app.models.user_schemas import UserCreate
    print("   OK User schemas import successful")
    
    print("4. Testing routes import...")
    from app.routes import users, work_orders, automation
    print("   OK Routes import successful")
    
    print("5. Testing logging service import...")
    from app.services.logging_service import get_logger
    print("   OK Logging service import successful")
    
    print("6. Testing main app import...")
    from app.main import app
    print("   OK Main app import successful")
    
    print("")
    print("SUCCESS All imports successful!")
    
except ImportError as e:
    print(f"   ERROR Import error: {e}")
    print(f"   Module: {getattr(e, 'name', 'unknown')}")
    sys.exit(1)
except Exception as e:
    print(f"   ERROR Other error: {e}")
    sys.exit(1)