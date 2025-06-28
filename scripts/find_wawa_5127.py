#!/usr/bin/env python3
"""
Find Wawa Store #5127 or Visit 136664
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fossawork.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("🔍 Searching for Wawa Store #5127 / Visit 136664")
print("=" * 80)

# Search by various patterns
searches = [
    ("site_name LIKE '%5127%'", "by store number in site name"),
    ("site_name LIKE '%Wawa%' AND address LIKE '%2604 South%'", "by Wawa and address"),
    ("external_id = '136664'", "by visit ID"),
    ("visit_url LIKE '%136664%'", "by visit URL"),
    ("address LIKE '%Tampa%33619%'", "by Tampa address")
]

found = False
for query, desc in searches:
    cursor.execute(f"""
        SELECT id, external_id, site_name, address, service_code, 
               visit_url, customer_url, scheduled_date
        FROM work_orders 
        WHERE {query}
        LIMIT 5
    """)
    
    results = cursor.fetchall()
    if results:
        print(f"\n✅ Found {len(results)} result(s) {desc}:")
        for row in results:
            wo_id, ext_id, site, addr, service, visit, customer, scheduled = row
            print(f"\n   Work Order: {ext_id}")
            print(f"   Site: {site}")
            print(f"   Address: {addr}")
            print(f"   Service: {service}")
            print(f"   Scheduled: {scheduled}")
            print(f"   Visit URL: {visit}")
            print(f"   Customer URL: {customer}")
            
            # Check for dispensers
            cursor.execute("SELECT COUNT(*) FROM dispensers WHERE work_order_id = ?", (wo_id,))
            disp_count = cursor.fetchone()[0]
            print(f"   Dispensers: {disp_count}")
            
            found = True

if not found:
    print("\n❌ Work order not found in database")
    print("\n💡 This work order may need to be scraped from WorkFossa first")
    print("   You can use the 'Get New Work Orders' button in the app")

conn.close()