#!/usr/bin/env python3
"""
Quick summary of stored work order data
"""

import sqlite3
from collections import Counter

def summarize_data(db_path="fossawork_v2.db"):
    """Generate a concise summary of stored data"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        print("🎯 FOSSAWORK V2 DATA SUMMARY")
        print("=" * 50)
        
        # Work Orders Summary
        cursor.execute("SELECT COUNT(*) FROM work_orders")
        wo_count = cursor.fetchone()[0]
        print(f"📋 Total Work Orders: {wo_count}")
        
        # Brand breakdown
        cursor.execute("SELECT site_name FROM work_orders")
        sites = [row[0] for row in cursor.fetchall()]
        
        brands = []
        for site in sites:
            if "Wawa" in site:
                brands.append("Wawa")
            elif "7-Eleven" in site or "Eleven Store" in site:
                brands.append("7-Eleven")
            elif "Circle K" in site:
                brands.append("Circle K")
            elif "Shell" in site:
                brands.append("Shell")
            else:
                brands.append("Other")
        
        brand_counts = Counter(brands)
        print("\n🏪 Brands Found:")
        for brand, count in brand_counts.most_common():
            print(f"  {brand}: {count} locations")
        
        # Geographic breakdown
        cursor.execute("SELECT address FROM work_orders WHERE address IS NOT NULL")
        addresses = [row[0] for row in cursor.fetchall()]
        
        counties = []
        for addr in addresses:
            if "Hillsborough County" in addr:
                counties.append("Hillsborough")
            elif "Pinellas County" in addr:
                counties.append("Pinellas")
            elif "Pasco County" in addr:
                counties.append("Pasco")
            elif "Polk County" in addr:
                counties.append("Polk")
            elif "Manatee County" in addr:
                counties.append("Manatee")
            elif "Hernando County" in addr:
                counties.append("Hernando")
            elif "Highlands County" in addr:
                counties.append("Highlands")
            else:
                counties.append("Other")
        
        county_counts = Counter(counties)
        print("\n📍 Geographic Distribution:")
        for county, count in county_counts.most_common():
            print(f"  {county} County: {count} locations")
        
        # Recent activity
        cursor.execute("""
            SELECT COUNT(*) as count, DATE(created_at) as date 
            FROM work_orders 
            GROUP BY DATE(created_at) 
            ORDER BY date DESC 
            LIMIT 5
        """)
        recent_activity = cursor.fetchall()
        
        print("\n📅 Recent Scraping Activity:")
        for row in recent_activity:
            print(f"  {row['date']}: {row['count']} work orders")
        
        # Status breakdown
        cursor.execute("SELECT status, COUNT(*) FROM work_orders GROUP BY status")
        statuses = cursor.fetchall()
        
        print("\n⚡ Work Order Status:")
        for row in statuses:
            print(f"  {row[0]}: {row[1]} orders")
        
        # Dispensers
        cursor.execute("SELECT COUNT(*) FROM dispensers")
        disp_count = cursor.fetchone()[0]
        print(f"\n🔧 Total Dispensers: {disp_count}")
        
        # Users and credentials
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM user_credentials WHERE is_active = 1")
        cred_count = cursor.fetchone()[0]
        
        print(f"\n👥 Users: {user_count}")
        print(f"🔐 Active Credentials: {cred_count}")
        
        print("\n" + "=" * 50)
        print("[OK] DATA SUMMARY COMPLETE")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")

if __name__ == "__main__":
    summarize_data()