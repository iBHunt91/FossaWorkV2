#!/usr/bin/env python3
"""Check the results of dispenser scraping"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Check work orders with dispensers_scraped_at
    scraped_count = db.execute(text("""
        SELECT COUNT(*)
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%dispensers_scraped_at%'
    """)).scalar()
    
    print(f"📊 Dispenser Scraping Results:")
    print(f"   Work orders with scraping timestamp: {scraped_count}/60")
    
    # Check successful scrapes
    successful = db.execute(text("""
        SELECT COUNT(*)
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%"dispenser_scrape_success": true%'
    """)).scalar()
    
    failed = db.execute(text("""
        SELECT COUNT(*)
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%"dispenser_scrape_success": false%'
    """)).scalar()
    
    print(f"   Successful scrapes: {successful}")
    print(f"   Failed scrapes: {failed}")
    
    # Show some successful examples
    print(f"\n✅ Successfully scraped dispensers:")
    success_examples = db.execute(text("""
        SELECT id, scraped_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%"dispenser_scrape_success": true%'
        AND scraped_data LIKE '%"dispensers":%'
        LIMIT 3
    """)).fetchall()
    
    for order in success_examples:
        data = json.loads(order.scraped_data)
        dispensers = data.get('dispensers', [])
        print(f"\n   Work Order {order.id[:8]}... ({data.get('site_name', 'Unknown')})")
        print(f"   Found {len(dispensers)} dispensers:")
        for d in dispensers[:3]:
            print(f"      - {d.get('title', 'Unknown')} ({d.get('make', 'Unknown')} {d.get('model', 'Unknown')})")
            print(f"        Serial: {d.get('serial_number', 'N/A')}")
    
    # Show failed examples
    print(f"\n❌ Failed scrapes:")
    failed_examples = db.execute(text("""
        SELECT id, scraped_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%"dispenser_scrape_success": false%'
        LIMIT 5
    """)).fetchall()
    
    for order in failed_examples:
        data = json.loads(order.scraped_data)
        error = data.get('dispenser_scrape_error', 'Unknown error')
        print(f"   Work Order {order.id[:8]}...: {error}")
        
finally:
    db.close()