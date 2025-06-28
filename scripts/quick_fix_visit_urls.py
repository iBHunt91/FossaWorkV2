#!/usr/bin/env python3
"""
Quick fix for work order 129651 - manually update the visit URL and number.
Based on the data from the interactive test.
"""

import sqlite3
import os

# Path to the database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'fossawork_v2.db')

def fix_work_order_129651():
    """Manually fix work order 129651 with correct data from test"""
    
    # Data from the interactive test
    correct_data = {
        'external_id': '129651',
        'site_name': '7-Eleven Stores, Inc',  # Fix the site name
        'visit_url': 'https://app.workfossa.com/app/work/129651/visits/131650/',
        'visit_number': '131650',
        'visit_id': '131650',
        'service_name': 'AccuMeasure',
        'service_items': '["1 x 7-11 Calibration Services", "6 x All Dispensers"]'
    }
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # First, check current state
        print("📋 Current state of work order 129651:")
        cursor.execute("""
            SELECT external_id, site_name, visit_url, visit_number, service_name
            FROM work_orders 
            WHERE external_id = '129651'
        """)
        
        row = cursor.fetchone()
        if row:
            print(f"   External ID: {row[0]}")
            print(f"   Site Name: {row[1]}")
            print(f"   Visit URL: {row[2]}")
            print(f"   Visit Number: {row[3]}")
            print(f"   Service Name: {row[4]}")
        else:
            print("❌ Work order not found!")
            return
        
        # Update with correct data
        print("\n🔧 Applying fix...")
        cursor.execute("""
            UPDATE work_orders 
            SET site_name = ?,
                visit_url = ?,
                visit_number = ?,
                visit_id = ?,
                service_name = ?,
                service_items = ?
            WHERE external_id = ?
        """, (
            correct_data['site_name'],
            correct_data['visit_url'],
            correct_data['visit_number'],
            correct_data['visit_id'],
            correct_data['service_name'],
            correct_data['service_items'],
            correct_data['external_id']
        ))
        
        conn.commit()
        print(f"✅ Updated {cursor.rowcount} row(s)")
        
        # Verify the fix
        print("\n📋 After fix:")
        cursor.execute("""
            SELECT external_id, site_name, visit_url, visit_number, service_name, service_items
            FROM work_orders 
            WHERE external_id = '129651'
        """)
        
        row = cursor.fetchone()
        if row:
            print(f"   External ID: {row[0]}")
            print(f"   Site Name: {row[1]}")
            print(f"   Visit URL: {row[2]}")
            print(f"   Visit Number: {row[3]}")
            print(f"   Service Name: {row[4]}")
            print(f"   Service Items: {row[5]}")
            
            # Check other work orders that might need fixing
            print("\n🔍 Checking other work orders that might need fixing...")
            cursor.execute("""
                SELECT COUNT(*) FROM work_orders 
                WHERE visit_url NOT LIKE '%/visits/%' 
                AND visit_url IS NOT NULL
            """)
            count = cursor.fetchone()[0]
            if count > 0:
                print(f"⚠️  Found {count} other work orders with incomplete visit URLs")
                print("   These would need to be re-scraped with the fixed extraction logic")
        
    finally:
        conn.close()
    
    print("\n✅ Fix applied! The Debug Modal should now show:")
    print("   - Site Name: 7-Eleven Stores, Inc")
    print("   - Visit Number: 131650")
    print("   - Visit URL: https://app.workfossa.com/app/work/129651/visits/131650/")
    print("   - Service Items properly formatted")

if __name__ == "__main__":
    fix_work_order_129651()