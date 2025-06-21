#!/usr/bin/env python3
"""
Simple script to check if visit_number field has been added to WorkOrderData class.
This runs without browser automation to just verify the code changes.
"""

import sys
import os
import inspect

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from app.services.workfossa_scraper import WorkOrderData
    
    print("🔍 Checking WorkOrderData class for visit_number field...")
    print("=" * 60)
    
    # Check if visit_number field exists in the class
    if hasattr(WorkOrderData, '__annotations__'):
        annotations = WorkOrderData.__annotations__
        print("📋 Available fields in WorkOrderData:")
        for field_name, field_type in annotations.items():
            if 'visit' in field_name.lower():
                print(f"  ✅ {field_name}: {field_type}")
            else:
                print(f"     {field_name}: {field_type}")
        
        if 'visit_number' in annotations:
            print(f"\n✅ SUCCESS: visit_number field found with type: {annotations['visit_number']}")
        else:
            print(f"\n❌ FAIL: visit_number field not found in WorkOrderData class")
            sys.exit(1)
    else:
        print("❌ Could not find annotations in WorkOrderData class")
        sys.exit(1)
    
    # Check WorkOrderData constructor
    print("\n🔧 Checking WorkOrderData constructor...")
    source = inspect.getsource(WorkOrderData)
    if 'visit_number' in source:
        print("✅ visit_number found in WorkOrderData source code")
    else:
        print("❌ visit_number not found in WorkOrderData source code")
        sys.exit(1)
    
    print("\n🎉 All checks passed! The visit_number field has been successfully added.")
    
except Exception as e:
    print(f"❌ Error checking WorkOrderData: {e}")
    sys.exit(1)