#!/usr/bin/env python3
"""Check the latest dispenser scraping results"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json
from datetime import datetime, timedelta

db = SessionLocal()
try:
    # Check work orders with recent scraping
    recent_scraped = db.execute(text("""
        SELECT COUNT(*), MAX(scraped_data)
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%dispenser_scrape_date%'
    """)).fetchone()
    
    print(f"📊 Recent Dispenser Scraping Results:")
    print(f"   Work orders with dispenser scraping: {recent_scraped[0]}")
    
    # Get work orders scraped in last hour
    one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
    
    recent_orders = db.execute(text("""
        SELECT id, external_id, scraped_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 10
    """)).fetchall()
    
    print(f"\n🔍 Checking last 10 updated work orders:")
    scraped_count = 0
    
    for order in recent_orders:
        data = json.loads(order.scraped_data) if order.scraped_data else {}
        if "dispenser_scrape_date" in data:
            scrape_date = data.get("dispenser_scrape_date", "")
            if scrape_date > one_hour_ago:
                scraped_count += 1
                dispensers = data.get("dispensers", [])
                print(f"\n   ✅ {order.external_id}: {len(dispensers)} dispensers")
                print(f"      Scraped: {scrape_date}")
                for i, d in enumerate(dispensers[:2]):
                    print(f"      - Dispenser {i+1}: {d.get('dispenser_number', '?')} - {d.get('dispenser_type', 'Unknown')}")
    
    print(f"\n📈 Summary: {scraped_count} work orders scraped in the last hour")
    
    # Check dispensers table
    dispenser_count = db.execute(text("""
        SELECT COUNT(DISTINCT work_order_id)
        FROM dispensers
        WHERE work_order_id IN (
            SELECT id FROM work_orders 
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        )
        AND dispenser_type != 'Unknown'
    """)).scalar()
    
    print(f"   Work orders with real dispensers in table: {dispenser_count}")
    
finally:
    db.close()