#!/usr/bin/env python3
"""
Find dispenser information for a specific store
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import json
from datetime import datetime

def find_store_dispensers(store_number):
    """Find all dispensers for a specific store number"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fossawork.db")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Find work orders for this store
    print(f"🔍 Searching for Store #{store_number}")
    print("=" * 80)
    
    # Search in site_name field for the store number
    cursor.execute("""
        SELECT id, external_id, site_name, address, service_code, service_description, 
               scheduled_date, visit_url, customer_url, created_at
        FROM work_orders 
        WHERE site_name LIKE ? OR site_name LIKE ?
        ORDER BY scheduled_date DESC
    """, (f'%#{store_number}%', f'%{store_number}%'))
    
    work_orders = cursor.fetchall()
    
    if not work_orders:
        print(f"❌ No work orders found for Store #{store_number}")
        return
    
    print(f"✅ Found {len(work_orders)} work order(s) for Store #{store_number}\n")
    
    for wo_index, wo in enumerate(work_orders, 1):
        wo_id, external_id, site_name, address, service_code, service_desc, scheduled, visit_url, customer_url, created = wo
        
        print(f"📋 Work Order {wo_index}: {external_id}")
        print(f"   Site: {site_name}")
        print(f"   Address: {address}")
        print(f"   Service: {service_code} - {service_desc}")
        print(f"   Scheduled: {scheduled}")
        print(f"   Visit URL: {visit_url}")
        print(f"   Customer URL: {customer_url}")
        print(f"   Created: {created}")
        
        # Get dispensers for this work order
        cursor.execute("""
            SELECT dispenser_number, dispenser_type, fuel_grades, 
                   make, model, serial_number, meter_type, number_of_nozzles,
                   status, automation_completed, created_at
            FROM dispensers 
            WHERE work_order_id = ?
            ORDER BY dispenser_number
        """, (wo_id,))
        
        dispensers = cursor.fetchall()
        
        if dispensers:
            print(f"\n   🔧 Dispensers ({len(dispensers)} total):")
            for disp in dispensers:
                disp_num, disp_type, fuel_grades_json, make, model, serial, meter, nozzles, status, automated, created = disp
                
                print(f"\n   Dispenser #{disp_num}")
                print(f"      Type: {disp_type or 'N/A'}")
                print(f"      Make: {make or 'N/A'}")
                print(f"      Model: {model or 'N/A'}")
                print(f"      Serial: {serial or 'N/A'}")
                print(f"      Meter Type: {meter or 'N/A'}")
                print(f"      Nozzles: {nozzles or 'N/A'}")
                print(f"      Status: {status or 'Not started'}")
                print(f"      Automated: {'Yes' if automated else 'No'}")
                
                if fuel_grades_json:
                    try:
                        fuel_grades = json.loads(fuel_grades_json)
                        print(f"      Fuel Grades:")
                        if isinstance(fuel_grades, dict):
                            for grade, info in fuel_grades.items():
                                if isinstance(info, dict) and 'octane' in info:
                                    print(f"         - {grade.title()}: {info['octane']} octane")
                                else:
                                    print(f"         - {grade}")
                        elif isinstance(fuel_grades, list):
                            for grade in fuel_grades:
                                print(f"         - {grade}")
                    except:
                        print(f"      Fuel Grades: {fuel_grades_json}")
        else:
            print(f"   ❌ No dispensers found for this work order")
        
        print("\n" + "-" * 80 + "\n")
    
    conn.close()

if __name__ == "__main__":
    store_num = sys.argv[1] if len(sys.argv) > 1 else "5127"
    find_store_dispensers(store_num)