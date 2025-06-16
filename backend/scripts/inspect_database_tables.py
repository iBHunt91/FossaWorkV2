#!/usr/bin/env python3
"""
Inspect database table structure
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("🔍 Database Inspection Tool")
print("=" * 50)

# Find the database file
db_paths = [
    "./fossawork_v2.db",
    "../fossawork_v2.db",
    "fossawork_v2.db",
    os.path.join(os.path.dirname(__file__), "..", "fossawork_v2.db")
]

db_file = None
for path in db_paths:
    if os.path.exists(path):
        db_file = os.path.abspath(path)
        break

if not db_file:
    print("❌ Could not find fossawork_v2.db file!")
    print("Searched in:")
    for path in db_paths:
        print(f"  - {os.path.abspath(path)}")
    sys.exit(1)

print(f"✅ Found database: {db_file}")
print(f"   Size: {os.path.getsize(db_file):,} bytes")

# Connect to database
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = cursor.fetchall()
print(f"\n📊 Tables in database: {len(tables)}")
for table in tables:
    print(f"  - {table[0]}")

# Check dispensers table structure
print("\n🔍 Dispensers table structure:")
cursor.execute("PRAGMA table_info(dispensers);")
columns = cursor.fetchall()

print(f"   Total columns: {len(columns)}")
print("\n   Columns:")
for col in columns:
    cid, name, type_, notnull, default, pk = col
    print(f"   - {name:<20} {type_:<15} {'NOT NULL' if notnull else 'NULL':<8} {'PK' if pk else ''}")

# Check specifically for the new columns
new_columns = ['make', 'model', 'serial_number', 'meter_type', 'number_of_nozzles']
missing_columns = []
for col_name in new_columns:
    if not any(col[1] == col_name for col in columns):
        missing_columns.append(col_name)

if missing_columns:
    print(f"\n⚠️  Missing columns: {', '.join(missing_columns)}")
else:
    print("\n✅ All new columns are present!")

# Show some sample data
print("\n📋 Sample dispenser data:")
cursor.execute("SELECT id, dispenser_number, fuel_grades FROM dispensers LIMIT 3;")
for row in cursor.fetchall():
    print(f"   ID: {row[0]}, Num: {row[1]}, Grades: {row[2]}")

conn.close()

print("\n💡 Next steps:")
if missing_columns:
    print("1. The migration didn't run properly")
    print("2. Run: python3 scripts/run_migration.py")
    print("3. Or manually recreate the database")
else:
    print("1. Database has all columns")
    print("2. Check if the backend is using the right database file")
    print("3. Try restarting the backend")