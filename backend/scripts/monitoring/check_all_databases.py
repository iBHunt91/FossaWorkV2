#!/usr/bin/env python3
"""
Check all database files to find the one with correct schema
"""

import sqlite3
import os

print("🔍 Checking all database files")
print("=" * 50)

db_files = [
    "fossawork.db",
    "fossawork_v2.db",
    "scripts/fossawork_v2.db",
    "data/fossawork_v2.db",
    "../fossawork_v2.db",
    "../scripts/fossawork_v2.db"
]

for db_path in db_files:
    if os.path.exists(db_path):
        abs_path = os.path.abspath(db_path)
        print(f"\n📊 Database: {abs_path}")
        print(f"   Size: {os.path.getsize(db_path):,} bytes")
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check if dispensers table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dispensers';")
            if cursor.fetchone():
                # Check for new columns
                cursor.execute("PRAGMA table_info(dispensers);")
                columns = [col[1] for col in cursor.fetchall()]
                
                new_cols = ['make', 'model', 'serial_number', 'meter_type', 'number_of_nozzles']
                has_new_cols = all(col in columns for col in new_cols)
                
                print(f"   ✅ Has dispensers table")
                print(f"   {'✅' if has_new_cols else '❌'} Has new columns: {has_new_cols}")
                
                # Count records
                cursor.execute("SELECT COUNT(*) FROM dispensers;")
                count = cursor.fetchone()[0]
                print(f"   📊 Dispenser records: {count}")
            else:
                print(f"   ❌ No dispensers table")
                
            conn.close()
        except Exception as e:
            print(f"   ❌ Error: {e}")

print("\n💡 Solution:")
print("1. The backend .env file points to: fossawork.db")
print("2. But the migration was run on: fossawork_v2.db")
print("3. We need to either:")
print("   a) Update .env to use fossawork_v2.db")
print("   b) Run the migration on fossawork.db")