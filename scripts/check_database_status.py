#!/usr/bin/env python3
"""
Check database status and recent work orders
"""

import sqlite3
from datetime import datetime

# Connect to database
conn = sqlite3.connect('fossawork.db')
cursor = conn.cursor()

# First, check the table structure
cursor.execute("PRAGMA table_info(work_orders)")
columns = cursor.fetchall()
print("Work Orders Table Structure:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")
print()

# Get recent work orders - use actual column names
cursor.execute("""
    SELECT * FROM work_orders
    ORDER BY id DESC
    LIMIT 10
""")

print("Recent Work Orders:")
print("-" * 80)
rows = cursor.fetchall()
if rows:
    for row in rows:
        print(f"Row: {row}")
else:
    print("No work orders found")

# Count orders by user
cursor.execute("""
    SELECT user_id, COUNT(*) as count
    FROM work_orders
    GROUP BY user_id
""")

print("\nWork Orders by User:")
print("-" * 40)
for user_id, count in cursor.fetchall():
    print(f"  User {user_id}: {count} orders")

# Get total count
cursor.execute("SELECT COUNT(*) FROM work_orders")
total = cursor.fetchone()[0]
print(f"\nTotal Work Orders: {total}")

conn.close()