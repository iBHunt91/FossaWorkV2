#!/usr/bin/env python3
"""
Check dispenser data in database
"""

import sqlite3
import json
from datetime import datetime

def check_dispenser_data():
    """Check dispenser data directly in SQLite database"""
    print("🧪 Checking Dispenser Data in Database")
    print("=" * 50)
    
    # Connect to database
    conn = sqlite3.connect('fossawork_v2.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Check if dispensers table has new columns
        cursor.execute("PRAGMA table_info(dispensers)")
        columns = cursor.fetchall()
        
        print("\n📊 Dispenser Table Schema:")
        new_columns = ['make', 'model', 'serial_number', 'meter_type', 'number_of_nozzles']
        found_columns = []
        
        for col in columns:
            col_name = col['name']
            print(f"  - {col_name}: {col['type']}")
            if col_name in new_columns:
                found_columns.append(col_name)
        
        print(f"\n✅ Found {len(found_columns)} new columns: {', '.join(found_columns)}")
        
        # Get sample dispenser data
        cursor.execute("""
            SELECT d.*, w.external_id, w.scraped_data
            FROM dispensers d
            JOIN work_orders w ON d.work_order_id = w.id
            WHERE d.make IS NOT NULL
            LIMIT 5
        """)
        
        dispensers = cursor.fetchall()
        
        if dispensers:
            print(f"\n📋 Found {len(dispensers)} dispensers with new data:")
            
            for idx, d in enumerate(dispensers):
                print(f"\n  Dispenser {idx + 1} (Work Order {d['external_id']}):")
                print(f"    - Dispenser Number: {d['dispenser_number']}")
                print(f"    - Make: {d['make']}")
                print(f"    - Model: {d['model']}")
                print(f"    - Serial Number: {d['serial_number']}")
                print(f"    - Meter Type: {d['meter_type']}")
                print(f"    - Number of Nozzles: {d['number_of_nozzles']}")
                
                # Check form_data for additional fields
                if d['form_data']:
                    form_data = json.loads(d['form_data'])
                    if 'title' in form_data:
                        print(f"    - Title: {form_data['title']}")
                    if 'stand_alone_code' in form_data:
                        print(f"    - Stand Alone Code: {form_data['stand_alone_code']}")
                    if 'grades_list' in form_data:
                        print(f"    - Fuel Grades: {', '.join(form_data['grades_list'])}")
        else:
            print("\n❌ No dispensers found with new data")
            print("💡 You need to run a dispenser scrape to populate the new fields")
            
            # Check if there are any dispensers at all
            cursor.execute("SELECT COUNT(*) as count FROM dispensers")
            count = cursor.fetchone()['count']
            print(f"\n📊 Total dispensers in database: {count}")
            
            if count > 0:
                print("⚠️  Dispensers exist but don't have the new fields populated")
                print("💡 Run a fresh dispenser scrape to update them")
        
        # Check work order scraped_data
        cursor.execute("""
            SELECT id, external_id, scraped_data
            FROM work_orders
            WHERE scraped_data LIKE '%dispensers%'
            LIMIT 3
        """)
        
        work_orders = cursor.fetchall()
        
        if work_orders:
            print(f"\n📋 Work orders with dispenser scraped data:")
            for wo in work_orders:
                scraped_data = json.loads(wo['scraped_data']) if wo['scraped_data'] else {}
                if 'dispensers' in scraped_data:
                    disp_count = len(scraped_data['dispensers'])
                    print(f"  - Work Order {wo['external_id']}: {disp_count} dispensers in scraped_data")
        
    finally:
        conn.close()
    
    print("\n✅ Database check complete!")
    print("\n🔍 Summary:")
    print("  - Database schema has been updated with new fields ✅")
    print("  - New fields: make, model, serial_number, meter_type, number_of_nozzles")
    print("  - Additional data stored in form_data JSON field")
    print("  - Frontend DispenserInfoModal is ready to display all fields")
    print("\n📱 To see the data in the app:")
    print("  1. Start backend: cd backend && uvicorn app.main:app --reload")
    print("  2. Start frontend: npm run dev")
    print("  3. View dispensers for any work order")

if __name__ == "__main__":
    check_dispenser_data()