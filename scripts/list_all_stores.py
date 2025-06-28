#!/usr/bin/env python3
"""
List all stores in the database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import re

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fossawork.db")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("🏪 All Stores in Database")
print("=" * 80)

# Get all unique site names
cursor.execute("""
    SELECT DISTINCT site_name, COUNT(*) as wo_count
    FROM work_orders 
    WHERE site_name IS NOT NULL
    GROUP BY site_name
    ORDER BY site_name
""")

stores = cursor.fetchall()
print(f"Total unique stores: {len(stores)}\n")

# Extract store numbers and group
store_numbers = []
for site_name, count in stores:
    # Try to extract store number
    match = re.search(r'#(\d+)', site_name)
    if match:
        store_num = match.group(1)
        store_numbers.append((store_num, site_name, count))

# Sort by store number
store_numbers.sort(key=lambda x: int(x[0]))

# Print stores with numbers
print("Stores with numbers:")
for store_num, site_name, count in store_numbers[:20]:  # First 20
    print(f"  Store #{store_num}: {site_name} ({count} work orders)")

if len(store_numbers) > 20:
    print(f"  ... and {len(store_numbers) - 20} more stores")

# Check for store 5127 specifically
print(f"\n🔍 Searching for stores containing '5127':")
cursor.execute("""
    SELECT site_name, external_id, scheduled_date
    FROM work_orders 
    WHERE site_name LIKE '%5127%' OR address LIKE '%5127%'
    ORDER BY scheduled_date DESC
    LIMIT 10
""")

results = cursor.fetchall()
if results:
    for site, wo_id, scheduled in results:
        print(f"  {site} - {wo_id} - Scheduled: {scheduled}")
else:
    print("  No matches found")

# Let's also check the latest work orders
print(f"\n📋 Latest 10 work orders:")
cursor.execute("""
    SELECT site_name, external_id, scheduled_date, service_code
    FROM work_orders 
    ORDER BY created_at DESC
    LIMIT 10
""")

for site, wo_id, scheduled, service in cursor.fetchall():
    print(f"  {site} - {wo_id} - {service} - Scheduled: {scheduled}")

conn.close()