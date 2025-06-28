#!/usr/bin/env python3
"""Simple test to check current work order addresses"""

import sys
import os
sys.path.append('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')

import sqlite3

def check_addresses():
    """Check addresses in the database"""
    
    conn = sqlite3.connect('fossawork_v2.db')
    cursor = conn.cursor()
    
    print("Checking work order addresses...")
    print("=" * 80)
    
    # Get work orders with "Meter" in the address
    cursor.execute("""
        SELECT external_id, site_name, address 
        FROM work_orders 
        WHERE address LIKE '%Meter%'
        ORDER BY external_id
        LIMIT 10
    """)
    
    results = cursor.fetchall()
    
    if results:
        print(f"\nFound {len(results)} work orders with 'Meter' in address:")
        for external_id, site_name, address in results:
            print(f"\nWork Order: {external_id}")
            print(f"Site: {site_name}")
            print(f"Address: {address}")
            print(f"  ⚠️  Contains 'Meter' - needs fixing!")
    else:
        print("✅ No work orders found with 'Meter' in address!")
    
    # Also check some regular addresses
    print("\n" + "=" * 80)
    print("\nChecking all addresses (first 5):")
    
    cursor.execute("""
        SELECT external_id, site_name, address 
        FROM work_orders 
        ORDER BY external_id
        LIMIT 5
    """)
    
    for external_id, site_name, address in cursor.fetchall():
        print(f"\nWork Order: {external_id}")
        print(f"Site: {site_name}")
        print(f"Address: {address}")
    
    conn.close()

if __name__ == "__main__":
    check_addresses()