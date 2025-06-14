#!/usr/bin/env python3
"""Check dispensers for Bruce Hunt's work orders"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Get Bruce's work orders
    bruce_orders = db.execute(text("""
        SELECT id, scraped_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        LIMIT 5
    """)).fetchall()
    
    print(f"📊 Bruce Hunt's Work Orders (first 5):")
    
    for order in bruce_orders:
        print(f"\n🔍 Work Order: {order.id[:8]}...")
        
        # Check scraped data
        if order.scraped_data:
            data = json.loads(order.scraped_data)
            print(f"   Customer URL: {data.get('customer_url', 'None')}")
            print(f"   Dispensers scraped: {'dispensers_scraped_at' in data}")
            if 'dispensers' in data:
                print(f"   Dispensers in scraped_data: {len(data['dispensers'])}")
        
        # Check dispenser records
        dispenser_count = db.execute(text("""
            SELECT COUNT(*) FROM dispensers
            WHERE work_order_id = :wo_id
        """), {"wo_id": order.id}).scalar()
        
        print(f"   Dispensers in table: {dispenser_count}")
        
        if dispenser_count > 0:
            # Show dispenser details
            dispensers = db.execute(text("""
                SELECT dispenser_number, dispenser_type, fuel_grades
                FROM dispensers
                WHERE work_order_id = :wo_id
                ORDER BY dispenser_number
                LIMIT 3
            """), {"wo_id": order.id}).fetchall()
            
            for d in dispensers:
                grades = json.loads(d.fuel_grades) if d.fuel_grades else {}
                grade_list = list(grades.keys()) if grades else []
                print(f"      - Dispenser {d.dispenser_number}: {d.dispenser_type} ({', '.join(grade_list)})")
    
    # Check if any of Bruce's work orders have been scraped
    scraped_count = db.execute(text("""
        SELECT COUNT(*)
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%dispensers_scraped_at%'
    """)).scalar()
    
    print(f"\n📊 Summary for Bruce Hunt:")
    print(f"   Total work orders: 60")
    print(f"   Work orders with dispenser scraping attempted: {scraped_count}")
    
finally:
    db.close()