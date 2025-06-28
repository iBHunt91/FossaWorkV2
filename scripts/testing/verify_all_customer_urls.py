#!/usr/bin/env python3
"""Verify all work orders have customer URLs"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
from app.database import SessionLocal
from sqlalchemy import text

def verify_urls():
    """Check every work order for customer URLs"""
    
    db = SessionLocal()
    try:
        # Get all work orders
        orders = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE scraped_data IS NOT NULL
            ORDER BY id
        """)).fetchall()
        
        print(f"Total work orders: {len(orders)}")
        
        # Check each order
        with_url = []
        without_url = []
        
        for order in orders:
            data = json.loads(order.scraped_data) if order.scraped_data else {}
            customer_url = data.get('customer_url')
            
            if customer_url:
                with_url.append((order.id, customer_url, data.get('site_name'), data.get('site_number')))
            else:
                without_url.append((order.id, data.get('site_name'), data.get('site_number')))
                # Print the raw data for orders without URLs
                print(f"\n❌ Work Order {order.id[:8]}... has NO customer URL")
                print(f"   Site: {data.get('site_name')} #{data.get('site_number')}")
                print(f"   Raw scraped_data keys: {list(data.keys())}")
                if 'site_info' in data:
                    print(f"   Site info: {data['site_info']}")
        
        print(f"\n📊 SUMMARY:")
        print(f"   Work orders WITH customer URL: {len(with_url)}")
        print(f"   Work orders WITHOUT customer URL: {len(without_url)}")
        
        if without_url:
            print(f"\n❌ Work orders missing customer URLs:")
            for wo_id, site_name, site_num in without_url:
                print(f"   - {wo_id[:8]}... : {site_name} #{site_num}")
                
    finally:
        db.close()

if __name__ == "__main__":
    verify_urls()