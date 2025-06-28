#!/usr/bin/env python3
"""
Verify database connection and schema
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

print("🔍 Verifying Database Connection")
print("=" * 80)
print(f"DATABASE_URL: {DATABASE_URL}")

# Create engine
engine = create_engine(DATABASE_URL)

# Test connection
with engine.connect() as conn:
    # Check table existence
    result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='dispensers'"))
    if result.fetchone():
        print("✅ Dispensers table exists")
        
        # Check columns
        result = conn.execute(text("PRAGMA table_info(dispensers)"))
        columns = result.fetchall()
        print("\n📊 Dispenser columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Check if new columns exist
        col_names = [col[1] for col in columns]
        new_cols = ['make', 'model', 'serial_number', 'meter_type', 'number_of_nozzles']
        
        print("\n✅ New column status:")
        for col in new_cols:
            if col in col_names:
                print(f"  ✅ {col}: EXISTS")
            else:
                print(f"  ❌ {col}: MISSING")
                
        # Test query
        try:
            result = conn.execute(text("SELECT id, make, model FROM dispensers LIMIT 1"))
            row = result.fetchone()
            if row:
                print(f"\n✅ Test query successful: {row}")
            else:
                print("\n⚠️  No dispensers found in database")
        except Exception as e:
            print(f"\n❌ Test query failed: {e}")
    else:
        print("❌ Dispensers table does not exist!")

print("\n" + "=" * 80)
print("✅ Verification complete")