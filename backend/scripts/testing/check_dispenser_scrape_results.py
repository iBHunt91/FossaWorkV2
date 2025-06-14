#!/usr/bin/env python3
"""Check actual dispenser scraping results in the database"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
from app.database import SessionLocal
from app.core_models import WorkOrder
from sqlalchemy import text

def check_results():
    """Check dispenser scraping results"""
    
    db = SessionLocal()
    try:
        # Get all work orders with scraped data
        orders = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE scraped_data IS NOT NULL
            ORDER BY id
        """)).fetchall()
        
        print(f"Total work orders: {len(orders)}")
        
        # Check each order
        with_dispensers = 0
        without_dispensers = 0
        dispenser_counts = {}
        
        for order in orders:
            data = json.loads(order.scraped_data) if order.scraped_data else {}
            
            # Check for dispensers field
            if 'dispensers' in data and data['dispensers']:
                with_dispensers += 1
                num_dispensers = len(data['dispensers'])
                dispenser_counts[num_dispensers] = dispenser_counts.get(num_dispensers, 0) + 1
                
                # Show first few
                if with_dispensers <= 3:
                    print(f"\n✅ Work Order {order.id[:8]}... has {num_dispensers} dispensers:")
                    for d in data['dispensers'][:2]:  # Show first 2 dispensers
                        print(f"   - {d.get('title', 'Unknown')} ({d.get('make', 'Unknown')} {d.get('model', 'Unknown')})")
                    if num_dispensers > 2:
                        print(f"   ... and {num_dispensers - 2} more")
            else:
                without_dispensers += 1
                if without_dispensers <= 3:
                    print(f"\n❌ Work Order {order.id[:8]}... has no dispensers")
                    if 'dispensers_scraped_at' in data:
                        print(f"   Note: Has dispensers_scraped_at timestamp but no dispenser data")
        
        print(f"\n📊 SUMMARY:")
        print(f"   Work orders with dispensers: {with_dispensers}")
        print(f"   Work orders without dispensers: {without_dispensers}")
        
        if dispenser_counts:
            print(f"\n📈 Dispenser count distribution:")
            for count, num_orders in sorted(dispenser_counts.items()):
                print(f"   {count} dispensers: {num_orders} work orders")
                
    finally:
        db.close()

if __name__ == "__main__":
    check_results()