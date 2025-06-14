#!/usr/bin/env python3
"""Check database directly for dispenser data"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Check for work orders with dispenser_scrape_date
    result = db.execute(text("""
        SELECT external_id, scraped_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%dispenser_scrape_date%'
        LIMIT 10
    """)).fetchall()
    
    print(f"Found {len(result)} work orders with dispenser_scrape_date")
    
    for row in result:
        data = json.loads(row.scraped_data)
        print(f"\n{row.external_id}:")
        print(f"  Scraped: {data.get('dispenser_scrape_date', 'N/A')}")
        print(f"  Dispensers: {len(data.get('dispensers', []))}")
        
    # Check dispensers table
    dispenser_count = db.execute(text("""
        SELECT COUNT(*) FROM dispensers
        WHERE dispenser_type != 'Unknown'
    """)).scalar()
    
    print(f"\nTotal non-placeholder dispensers in table: {dispenser_count}")
    
    # Check recent dispensers
    recent = db.execute(text("""
        SELECT d.dispenser_number, d.dispenser_type, wo.external_id
        FROM dispensers d
        JOIN work_orders wo ON d.work_order_id = wo.id
        WHERE d.dispenser_type != 'Unknown'
        ORDER BY d.created_at DESC
        LIMIT 5
    """)).fetchall()
    
    if recent:
        print("\nRecent dispensers:")
        for d in recent:
            print(f"  {d.external_id}: {d.dispenser_number} - {d.dispenser_type}")
            
finally:
    db.close()