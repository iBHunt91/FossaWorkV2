#!/usr/bin/env python3
"""
Add new columns to the fossawork.db database
"""

import sqlite3
import os
import sys

print("🔧 Migration Script for fossawork.db")
print("=" * 50)

# Path to the actual database being used
db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fossawork.db")

if not os.path.exists(db_path):
    print(f"❌ Database not found: {db_path}")
    sys.exit(1)

print(f"✅ Found database: {db_path}")
print(f"   Size: {os.path.getsize(db_path):,} bytes")

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check current schema
print("\n📊 Current dispensers table schema:")
cursor.execute("PRAGMA table_info(dispensers);")
current_columns = {col[1]: col for col in cursor.fetchall()}
print(f"   Columns: {', '.join(current_columns.keys())}")

# Define new columns to add
new_columns = [
    ("make", "VARCHAR(100)"),
    ("model", "VARCHAR(100)"),
    ("serial_number", "VARCHAR(100)"),
    ("meter_type", "VARCHAR(100)"),
    ("number_of_nozzles", "VARCHAR(20)")
]

# Add missing columns
added_columns = []
for col_name, col_type in new_columns:
    if col_name not in current_columns:
        try:
            cursor.execute(f"ALTER TABLE dispensers ADD COLUMN {col_name} {col_type}")
            added_columns.append(col_name)
            print(f"✅ Added column: {col_name}")
        except sqlite3.OperationalError as e:
            print(f"⚠️  Could not add {col_name}: {e}")
    else:
        print(f"✔️  Column already exists: {col_name}")

# Commit changes
if added_columns:
    conn.commit()
    print(f"\n✅ Migration complete! Added {len(added_columns)} columns")
else:
    print("\n✅ All columns already exist!")

# Verify the changes
print("\n📊 Updated dispensers table schema:")
cursor.execute("PRAGMA table_info(dispensers);")
for col in cursor.fetchall():
    print(f"   - {col[1]:<20} {col[2]}")

# Show record count
cursor.execute("SELECT COUNT(*) FROM dispensers")
count = cursor.fetchone()[0]
print(f"\n📊 Total dispenser records: {count}")

conn.close()

print("\n✅ Migration successful! Restart the backend to use the updated schema.")