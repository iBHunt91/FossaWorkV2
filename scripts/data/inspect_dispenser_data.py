#!/usr/bin/env python3
"""Inspect actual dispenser data"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import json
from app.database import SessionLocal
from sqlalchemy import text as sql_text

def inspect_data():
    """Inspect dispenser data in detail"""
    
    db = SessionLocal()
    
    try:
        # Get a work order with dispensers
        sample = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id = '110497'
        """)).fetchone()
        
        if sample:
            print("=" * 60)
            print(f"Work Order: {sample.external_id} - {sample.site_name}")
            print("=" * 60)
            
            data = json.loads(sample.scraped_data) if sample.scraped_data else {}
            
            # Pretty print the dispensers data
            dispensers = data.get('dispensers', [])
            print(f"\nDispensers ({len(dispensers)}):")
            print(json.dumps(dispensers, indent=2))
            
            # Check structure
            if dispensers:
                print("\nFirst Dispenser Structure:")
                for key, value in dispensers[0].items():
                    print(f"  {key}: {type(value).__name__} = {value}")
                    
        # Also check 110296
        wo_296 = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id = '110296'
        """)).fetchone()
        
        if wo_296:
            print("\n" + "=" * 60)
            print(f"Work Order: {wo_296.external_id} - {wo_296.site_name}")
            print("=" * 60)
            
            data = json.loads(wo_296.scraped_data) if wo_296.scraped_data else {}
            
            # Check if it has customer_url
            print(f"\nCustomer URL: {data.get('customer_url', 'NOT FOUND')}")
            print(f"Has dispensers field: {'dispensers' in data}")
            if 'dispensers' in data:
                print(f"Dispensers: {data['dispensers']}")
                
    finally:
        db.close()

if __name__ == "__main__":
    inspect_data()