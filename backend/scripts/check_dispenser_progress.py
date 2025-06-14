#!/usr/bin/env python3
"""Check dispenser scraping progress"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.core_models import WorkOrder
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Count work orders with dispenser data
    orders = db.execute(text("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN scraped_data LIKE '%dispensers_scraped_at%' THEN 1 ELSE 0 END) as scraped,
               SUM(CASE WHEN scraped_data LIKE '%"dispensers":%' AND scraped_data LIKE '%dispensers_scraped_at%' THEN 1 ELSE 0 END) as with_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
    """)).fetchone()
    
    print(f"📊 Dispenser Scraping Progress:")
    print(f"   Total work orders: {orders.total}")
    print(f"   Scraping attempted: {orders.scraped}")
    print(f"   With dispenser data: {orders.with_data}")
    print(f"   Progress: {(orders.scraped/orders.total*100):.1f}%" if orders.total > 0 else "0%")
    
    # Show recent successes
    recent_success = db.execute(text("""
        SELECT id, scraped_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%dispensers_scraped_at%'
        AND scraped_data LIKE '%"dispensers":%'
        ORDER BY id
        LIMIT 5
    """)).fetchall()
    
    if recent_success:
        print(f"\n✅ Recent successful scrapes:")
        for order in recent_success:
            data = json.loads(order.scraped_data)
            dispensers = data.get('dispensers', [])
            print(f"   - Work Order {order.id[:8]}...: {len(dispensers)} dispensers")
            for d in dispensers[:2]:
                print(f"     • {d.get('title', 'Unknown')} ({d.get('make', 'Unknown')})")
            
finally:
    db.close()