#!/usr/bin/env python3
"""Check if any dispenser data exists in the database"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Check dispensers table
    dispenser_count = db.execute(text("SELECT COUNT(*) FROM dispensers")).scalar()
    print(f"📊 Dispenser Table Status:")
    print(f"   Total dispensers in database: {dispenser_count}")
    
    if dispenser_count > 0:
        # Show some examples
        dispensers = db.execute(text("""
            SELECT id, work_order_id, title, make, model, serial_number
            FROM dispensers
            LIMIT 5
        """)).fetchall()
        print(f"\n   Sample dispensers:")
        for d in dispensers:
            print(f"   - {d.title} (WO: {d.work_order_id[:8]}...)")
            print(f"     Make/Model: {d.make} {d.model}")
            print(f"     Serial: {d.serial_number}")
    
    # Check work orders with scraped_data containing dispensers
    wo_with_dispensers = db.execute(text("""
        SELECT COUNT(*) as count
        FROM work_orders
        WHERE scraped_data LIKE '%"dispensers":%'
        AND scraped_data NOT LIKE '%"dispensers":[]%'
    """)).scalar()
    
    print(f"\n📋 Work Order Scraped Data:")
    print(f"   Work orders with dispenser data in scraped_data: {wo_with_dispensers}")
    
    # Check for any dispenser scraping attempts
    attempted = db.execute(text("""
        SELECT COUNT(*) as count
        FROM work_orders
        WHERE scraped_data LIKE '%dispensers_scraped_at%'
    """)).scalar()
    
    print(f"   Work orders with scraping attempts: {attempted}")
    
    # Show a work order with scraped data
    sample_wo = db.execute(text("""
        SELECT id, scraped_data
        FROM work_orders
        WHERE scraped_data IS NOT NULL
        LIMIT 1
    """)).fetchone()
    
    if sample_wo:
        data = json.loads(sample_wo.scraped_data)
        print(f"\n📄 Sample work order scraped_data keys:")
        print(f"   Work Order: {sample_wo.id[:8]}...")
        print(f"   Keys: {list(data.keys())}")
        if 'dispensers' in data:
            print(f"   Dispensers field: {data['dispensers']}")
        
finally:
    db.close()