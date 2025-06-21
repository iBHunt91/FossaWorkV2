#!/usr/bin/env python3
"""Check dispenser details in database"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Get count
    dispenser_count = db.execute(text("SELECT COUNT(*) FROM dispensers")).scalar()
    print(f"📊 Total dispensers in database: {dispenser_count}")
    
    # Get column names
    columns = db.execute(text("PRAGMA table_info(dispensers)")).fetchall()
    print(f"\n📋 Dispenser table columns:")
    col_names = []
    for col in columns:
        print(f"   - {col[1]} ({col[2]})")
        col_names.append(col[1])
    
    # Show sample data
    if dispenser_count > 0:
        print(f"\n📦 Sample dispensers:")
        dispensers = db.execute(text("""
            SELECT * FROM dispensers LIMIT 5
        """)).fetchall()
        
        for d in dispensers:
            print(f"\n   Dispenser ID: {d[0][:8]}...")
            for i, col_name in enumerate(col_names):
                if col_name not in ['id', 'created_at', 'updated_at']:
                    value = d[i]
                    if isinstance(value, str) and len(value) > 50:
                        value = value[:50] + "..."
                    print(f"     {col_name}: {value}")
    
    # Check work orders with dispensers
    wo_with_dispensers = db.execute(text("""
        SELECT DISTINCT work_order_id 
        FROM dispensers
    """)).fetchall()
    
    print(f"\n📊 Work orders with dispensers: {len(wo_with_dispensers)}")
    
    # Count dispensers per work order
    dispenser_counts = db.execute(text("""
        SELECT work_order_id, COUNT(*) as count
        FROM dispensers
        GROUP BY work_order_id
        ORDER BY count DESC
        LIMIT 10
    """)).fetchall()
    
    print(f"\n📈 Dispensers per work order (top 10):")
    for wo_id, count in dispenser_counts:
        print(f"   {wo_id[:8]}...: {count} dispensers")
        
finally:
    db.close()