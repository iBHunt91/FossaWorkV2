#!/usr/bin/env python3
"""Simple test to verify dispenser scraping is working"""

import sys
from pathlib import Path
# Add backend directory to path
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import json
from app.database import SessionLocal
from sqlalchemy import text as sql_text

def check_dispenser_data():
    db = SessionLocal()
    try:
        # Check work orders with dispensers
        result = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND scraped_data IS NOT NULL
            AND scraped_data LIKE '%dispensers%'
            ORDER BY created_at DESC
            LIMIT 5
        """)).fetchall()
        
        print("Work Orders with Dispenser Data:")
        print("=" * 60)
        
        for wo in result:
            data = json.loads(wo.scraped_data) if wo.scraped_data else {}
            dispensers = data.get('dispensers', [])
            
            print(f"\nWork Order: {wo.external_id} - {wo.site_name}")
            print(f"Dispensers: {len(dispensers)}")
            
            if dispensers:
                for i, d in enumerate(dispensers[:3]):  # Show first 3
                    print(f"  {i+1}. {d.get('title', 'Unknown')}")
                    print(f"     S/N: {d.get('serial_number', 'N/A')}")
                    print(f"     Make: {d.get('make', 'N/A')}")
                    print(f"     Model: {d.get('model', 'N/A')}")
                
                if len(dispensers) > 3:
                    print(f"  ... and {len(dispensers) - 3} more")
        
        # Check work orders without dispensers
        print("\n" + "=" * 60)
        print("Work Orders WITHOUT Dispenser Data:")
        
        result = db.execute(sql_text("""
            SELECT COUNT(*) as count
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND (scraped_data IS NULL OR scraped_data NOT LIKE '%dispensers%')
        """)).fetchone()
        
        print(f"Total: {result.count} work orders need dispenser scraping")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_dispenser_data()