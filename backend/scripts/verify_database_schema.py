#!/usr/bin/env python3
"""Verify database schema has all new work order fields"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text, inspect
from app.database import DATABASE_URL

def verify_schema():
    """Check if all new columns exist in work_orders table"""
    
    print("=" * 80)
    print("VERIFYING DATABASE SCHEMA")
    print("=" * 80)
    
    engine = create_engine(DATABASE_URL)
    
    # Expected new columns
    expected_columns = [
        'service_name',
        'service_items',
        'street',
        'city_state',
        'county',
        'created_date',
        'created_by',
        'customer_url'
    ]
    
    # Check if work_orders table exists
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if 'work_orders' not in tables:
        print("❌ work_orders table not found!")
        return False
    
    print("✅ work_orders table exists")
    
    # Get columns
    columns = inspector.get_columns('work_orders')
    column_names = [col['name'] for col in columns]
    
    print(f"\n📋 Checking for new columns:")
    all_present = True
    
    for col in expected_columns:
        if col in column_names:
            # Find column info
            col_info = next((c for c in columns if c['name'] == col), None)
            col_type = str(col_info['type']) if col_info else 'Unknown'
            print(f"   ✅ {col:<20} - Type: {col_type}")
        else:
            print(f"   ❌ {col:<20} - MISSING!")
            all_present = False
    
    # Also show all columns for reference
    print(f"\n📊 All columns in work_orders table ({len(columns)} total):")
    for col in columns:
        print(f"   - {col['name']:<25} Type: {col['type']}")
    
    return all_present

if __name__ == "__main__":
    print("\n🚀 Starting Database Schema Verification")
    success = verify_schema()
    print(f"\n{'✅ Schema verification PASSED' if success else '❌ Schema verification FAILED'}")