#!/usr/bin/env python3
"""Display all current work order addresses"""

import sqlite3

def show_all_addresses():
    """Display all work order addresses from the database"""
    
    # Connect to the database
    conn = sqlite3.connect('fossawork_v2.db')
    cursor = conn.cursor()
    
    print("📊 ALL CURRENT WORK ORDER ADDRESSES")
    print("=" * 100)
    
    # Get all work orders with their addresses
    cursor.execute("""
        SELECT external_id, site_name, address 
        FROM work_orders 
        ORDER BY site_name, external_id
    """)
    
    results = cursor.fetchall()
    
    if not results:
        print("No work orders found in database.")
        return
    
    print(f"\nTotal Work Orders: {len(results)}")
    print("-" * 100)
    
    # Group by site for better organization
    current_site = None
    site_count = 0
    
    for external_id, site_name, address in results:
        # Clean up site name for display
        clean_site = site_name.strip().replace('\n', ' ').replace('  ', ' ')
        
        # Print site header when it changes
        if clean_site != current_site:
            if current_site is not None:
                print()  # Add space between different sites
            current_site = clean_site
            site_count += 1
            print(f"\n🏢 {clean_site}")
            print("-" * 80)
        
        # Print work order and address
        print(f"  📍 {external_id}: {address}")
        
        # Flag addresses that still have "Meter" in them
        if "Meter" in address:
            print(f"     ⚠️  Contains 'Meter' - needs re-scraping with fix")
    
    print("\n" + "=" * 100)
    
    # Summary statistics
    meter_count = sum(1 for _, _, addr in results if "Meter" in addr)
    
    print(f"\n📈 SUMMARY:")
    print(f"  • Total Work Orders: {len(results)}")
    print(f"  • Unique Sites: {site_count}")
    print(f"  • Addresses with 'Meter': {meter_count}")
    print(f"  • Clean Addresses: {len(results) - meter_count}")
    
    if meter_count > 0:
        print(f"\n⚠️  {meter_count} addresses still contain 'Meter' and need to be re-scraped with the fix applied.")
    else:
        print(f"\n✅ All addresses are clean!")
    
    conn.close()

if __name__ == "__main__":
    show_all_addresses()