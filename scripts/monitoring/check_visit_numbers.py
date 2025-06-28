#!/usr/bin/env python3
"""
Check which work orders have visit_number populated.
"""

import sqlite3
import os

# Path to the database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'fossawork_v2.db')

def check_visit_numbers():
    """Check visit number status across all work orders"""
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM work_orders")
        total_count = cursor.fetchone()[0]
        print(f"📊 Total work orders: {total_count}")
        
        # Count work orders with visit_number
        cursor.execute("SELECT COUNT(*) FROM work_orders WHERE visit_number IS NOT NULL")
        with_visit_number = cursor.fetchone()[0]
        
        # Count work orders with visit_id
        cursor.execute("SELECT COUNT(*) FROM work_orders WHERE visit_id IS NOT NULL")
        with_visit_id = cursor.fetchone()[0]
        
        # Count work orders with visit_url containing /visits/
        cursor.execute("SELECT COUNT(*) FROM work_orders WHERE visit_url LIKE '%/visits/%'")
        with_proper_visit_url = cursor.fetchone()[0]
        
        print(f"\n📈 Visit Number Statistics:")
        print(f"   With visit_number: {with_visit_number}/{total_count} ({with_visit_number/total_count*100:.1f}%)")
        print(f"   With visit_id: {with_visit_id}/{total_count} ({with_visit_id/total_count*100:.1f}%)")
        print(f"   With proper visit_url: {with_proper_visit_url}/{total_count} ({with_proper_visit_url/total_count*100:.1f}%)")
        
        # Show sample of work orders without visit_number
        print("\n🔍 Sample work orders WITHOUT visit_number:")
        cursor.execute("""
            SELECT external_id, site_name, visit_url, visit_id, visit_number
            FROM work_orders 
            WHERE visit_number IS NULL
            LIMIT 10
        """)
        
        rows = cursor.fetchall()
        for row in rows:
            print(f"   WO {row['external_id']} - {row['site_name'][:30]}...")
            print(f"      visit_url: {row['visit_url']}")
            print(f"      visit_id: {row['visit_id']}")
            print(f"      visit_number: {row['visit_number']}")
            print()
        
        # Check if we can extract visit numbers from existing URLs
        print("🔧 Checking if visit numbers can be extracted from existing URLs:")
        cursor.execute("""
            SELECT external_id, visit_url
            FROM work_orders 
            WHERE visit_number IS NULL 
            AND visit_url LIKE '%/visits/%'
            LIMIT 5
        """)
        
        fixable = cursor.fetchall()
        if fixable:
            print(f"   Found {len(fixable)} work orders with extractable visit numbers")
            for row in fixable:
                import re
                match = re.search(r'/visits/(\d+)', row['visit_url'])
                if match:
                    print(f"   WO {row['external_id']}: Can extract visit_number {match.group(1)} from {row['visit_url']}")
        else:
            print("   No work orders found with extractable visit numbers")
            
    finally:
        conn.close()

if __name__ == "__main__":
    check_visit_numbers()