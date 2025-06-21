#!/usr/bin/env python3
"""
Check work order data directly from database using raw SQL.
"""

import sys
import os
import sqlite3
import json

# Path to the database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'fossawork_v2.db')

def check_work_order(work_order_id: str):
    """Check a specific work order's data using raw SQL"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Query for the work order
        cursor.execute("""
            SELECT * FROM work_orders 
            WHERE id = ? OR external_id = ?
            LIMIT 1
        """, (work_order_id, work_order_id))
        
        row = cursor.fetchone()
        
        if not row:
            print(f"❌ Work order {work_order_id} not found")
            return
        
        print(f"📋 Work Order Data (Raw from Database)")
        print("=" * 60)
        
        # Convert row to dict and print all fields
        work_order = dict(row)
        
        # Key fields to highlight
        key_fields = [
            'id', 'external_id', 'site_name', 'address', 'store_number',
            'service_code', 'service_name', 'service_items',
            'visit_id', 'visit_number', 'visit_url', 'customer_url',
            'scheduled_date', 'created_date', 'created_by'
        ]
        
        for field in key_fields:
            if field in work_order:
                value = work_order[field]
                # Try to parse JSON fields
                if field == 'service_items' and isinstance(value, str) and value.startswith('['):
                    try:
                        value = json.loads(value)
                    except:
                        pass
                print(f"{field}: {value}")
        
        print("\n📍 URL Analysis:")
        visit_url = work_order.get('visit_url', '')
        customer_url = work_order.get('customer_url', '')
        
        if visit_url:
            print(f"Visit URL: {visit_url}")
            if '/customers/locations/' in visit_url:
                print("  ⚠️  WARNING: visit_url contains customer pattern!")
            if '/visits/' in visit_url:
                print("  ✅ Contains /visits/ pattern")
                # Try to extract visit number
                import re
                match = re.search(r'/visits/(\d+)', visit_url)
                if match:
                    print(f"  📍 Extracted visit number: {match.group(1)}")
        else:
            print("Visit URL: Not set")
        
        if customer_url:
            print(f"Customer URL: {customer_url}")
            if '/visits/' in customer_url:
                print("  ⚠️  WARNING: customer_url contains visit pattern!")
        
        print("\n📊 Visit Number Status:")
        if work_order.get('visit_number'):
            print(f"✅ Visit Number is set: {work_order['visit_number']}")
        else:
            print("❌ Visit Number is NULL")
            if work_order.get('visit_id'):
                print(f"   But Visit ID exists: {work_order['visit_id']}")
            
        # Check other work orders for comparison
        print("\n📈 Sample of other work orders:")
        cursor.execute("""
            SELECT external_id, visit_url, visit_number, customer_url
            FROM work_orders 
            WHERE visit_url IS NOT NULL OR visit_number IS NOT NULL
            LIMIT 5
        """)
        
        samples = cursor.fetchall()
        if samples:
            for sample in samples:
                print(f"  WO {sample['external_id']}: visit_number={sample['visit_number']}, "
                      f"visit_url={sample['visit_url'][:50] if sample['visit_url'] else 'None'}...")
        else:
            print("  No work orders found with visit data")
            
    finally:
        conn.close()

if __name__ == "__main__":
    # Check the work order from the screenshot
    print("Checking Work Order 129651 from screenshot...")
    check_work_order("129651")
    
    # Check another if provided
    if len(sys.argv) > 1:
        print("\n" + "=" * 80 + "\n")
        check_work_order(sys.argv[1])