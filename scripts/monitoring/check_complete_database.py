#!/usr/bin/env python3
"""Comprehensive database check for work orders and dispensers"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text, inspect
from app.database import DATABASE_URL
import json

def check_database():
    """Check work orders and dispensers in database"""
    
    print("=" * 80)
    print("COMPREHENSIVE DATABASE CHECK")
    print("=" * 80)
    
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        # 1. WORK ORDERS CHECK
        print("\n📋 WORK ORDERS TABLE:")
        
        # Count total work orders
        wo_count = conn.execute(text("SELECT COUNT(*) FROM work_orders")).scalar()
        print(f"   Total work orders: {wo_count}")
        
        # Check for NULL values in new fields
        null_checks = [
            'service_name', 'service_items', 'street', 'city_state',
            'county', 'created_date', 'created_by', 'customer_url'
        ]
        
        print("\n   Checking for NULL values in new fields:")
        for field in null_checks:
            null_count = conn.execute(text(f"SELECT COUNT(*) FROM work_orders WHERE {field} IS NULL")).scalar()
            populated = wo_count - null_count if wo_count > 0 else 0
            percentage = (populated / wo_count * 100) if wo_count > 0 else 0
            print(f"   - {field:<20}: {populated}/{wo_count} populated ({percentage:.0f}%)")
        
        # Sample work order data
        print("\n   Sample work order (first one with all fields):")
        sample_wo = conn.execute(text("""
            SELECT external_id, site_name, store_number, service_name, 
                   street, city_state, county, created_by, customer_url
            FROM work_orders 
            WHERE service_name IS NOT NULL 
            LIMIT 1
        """)).fetchone()
        
        if sample_wo:
            print(f"   - ID: W-{sample_wo.external_id}")
            print(f"   - Site: {sample_wo.site_name}")
            print(f"   - Store: {sample_wo.store_number}")
            print(f"   - Service: {sample_wo.service_name}")
            print(f"   - Address: {sample_wo.street}, {sample_wo.city_state}")
            print(f"   - County: {sample_wo.county}")
            print(f"   - Created By: {sample_wo.created_by}")
            print(f"   - Customer URL: {sample_wo.customer_url}")
        
        # 2. DISPENSERS TABLE CHECK
        print("\n\n🔧 DISPENSERS TABLE:")
        
        # Get dispenser table columns
        disp_columns = inspector.get_columns('dispensers')
        print(f"   Columns in dispensers table:")
        for col in disp_columns:
            print(f"   - {col['name']:<25} Type: {col['type']}")
        
        # Count dispensers
        disp_count = conn.execute(text("SELECT COUNT(*) FROM dispensers")).scalar()
        print(f"\n   Total dispensers: {disp_count}")
        
        # Check dispenser data
        if disp_count > 0:
            # Get unique work orders with dispensers
            wo_with_disp = conn.execute(text("""
                SELECT COUNT(DISTINCT work_order_id) FROM dispensers
            """)).scalar()
            print(f"   Work orders with dispensers: {wo_with_disp}")
            
            # Sample dispenser data
            print("\n   Sample dispensers (first 5):")
            dispensers = conn.execute(text("""
                SELECT d.id, d.work_order_id, d.dispenser_number, d.dispenser_type,
                       d.fuel_grades, d.status, wo.external_id, wo.site_name, wo.store_number
                FROM dispensers d
                JOIN work_orders wo ON d.work_order_id = wo.id
                LIMIT 5
            """)).fetchall()
            
            for d in dispensers:
                print(f"   - Dispenser #{d.dispenser_number} at {d.site_name} Store {d.store_number} (W-{d.external_id})")
                print(f"     Type: {d.dispenser_type or 'Not specified'}")
                print(f"     Status: {d.status or 'Unknown'}")
                if d.fuel_grades:
                    grades = json.loads(d.fuel_grades) if isinstance(d.fuel_grades, str) else d.fuel_grades
                    grade_info = []
                    for grade, info in grades.items():
                        if isinstance(info, dict) and 'octane' in info:
                            grade_info.append(f"{grade.title()}({info['octane']})")
                    if grade_info:
                        print(f"     Fuel Grades: {', '.join(grade_info)}")
                print()
        
        # 3. CHECK SCRAPED DATA IN WORK ORDERS
        print("\n📊 SCRAPED DATA CHECK:")
        
        # Count work orders with scraped_data
        wo_with_scraped = conn.execute(text("""
            SELECT COUNT(*) FROM work_orders 
            WHERE scraped_data IS NOT NULL 
            AND scraped_data != '{}'
        """)).scalar()
        print(f"   Work orders with scraped_data: {wo_with_scraped}/{wo_count}")
        
        # Check for dispenser data in scraped_data
        wo_with_disp_data = conn.execute(text("""
            SELECT COUNT(*) FROM work_orders 
            WHERE scraped_data LIKE '%"dispensers":%' 
            AND scraped_data NOT LIKE '%"dispensers":[]%'
        """)).scalar()
        print(f"   Work orders with dispensers in scraped_data: {wo_with_disp_data}")
        
        # Sample scraped data structure
        sample_scraped = conn.execute(text("""
            SELECT scraped_data 
            FROM work_orders 
            WHERE scraped_data LIKE '%"dispensers":%' 
            AND scraped_data NOT LIKE '%"dispensers":[]%'
            LIMIT 1
        """)).fetchone()
        
        if sample_scraped and sample_scraped.scraped_data:
            data = json.loads(sample_scraped.scraped_data)
            if 'dispensers' in data and data['dispensers']:
                print(f"\n   Sample dispenser structure from scraped_data:")
                print(f"   Number of dispensers: {len(data['dispensers'])}")
                print(f"   First dispenser keys: {list(data['dispensers'][0].keys())}")
        
        print("\n" + "=" * 80)
        print("DATABASE CHECK COMPLETE")
        print("=" * 80)

if __name__ == "__main__":
    check_database()