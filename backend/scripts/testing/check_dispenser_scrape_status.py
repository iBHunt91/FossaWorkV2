#!/usr/bin/env python3
"""Check the actual status of dispenser scraping attempts"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
from app.database import SessionLocal
from sqlalchemy import text
from datetime import datetime

def check_status():
    """Check dispenser scraping status for all work orders"""
    
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
        
        # Categorize by scraping status
        scraped_with_data = []
        scraped_no_data = []
        not_scraped = []
        
        for order in orders:
            data = json.loads(order.scraped_data) if order.scraped_data else {}
            site_name = data.get('site_name', 'Unknown')
            site_number = data.get('site_number', 'Unknown')
            
            if 'dispensers_scraped_at' in data:
                if 'dispensers' in data and data['dispensers']:
                    scraped_with_data.append((order.id, site_name, site_number, len(data['dispensers'])))
                else:
                    scraped_no_data.append((order.id, site_name, site_number, data.get('customer_url')))
            else:
                not_scraped.append((order.id, site_name, site_number, data.get('customer_url')))
        
        print(f"\n📊 DISPENSER SCRAPING STATUS:")
        print(f"   ✅ Scraped with dispenser data: {len(scraped_with_data)}")
        print(f"   ⚠️  Scraped but no dispensers found: {len(scraped_no_data)}")
        print(f"   ❌ Not scraped yet: {len(not_scraped)}")
        
        if scraped_with_data:
            print(f"\n✅ Successfully scraped dispensers:")
            for wo_id, site, num, count in scraped_with_data[:5]:
                print(f"   - {site} #{num}: {count} dispensers")
            if len(scraped_with_data) > 5:
                print(f"   ... and {len(scraped_with_data) - 5} more")
        
        if scraped_no_data:
            print(f"\n⚠️  Scraped but no dispensers found (location may not have equipment):")
            # Group by site
            by_site = {}
            for wo_id, site, num, url in scraped_no_data:
                key = site or "Unknown"
                if key not in by_site:
                    by_site[key] = []
                by_site[key].append((num, url))
            
            for site, locations in sorted(by_site.items())[:3]:
                print(f"   {site}: {len(locations)} locations")
                for num, url in locations[:2]:
                    print(f"      - Store #{num}")
                if len(locations) > 2:
                    print(f"      ... and {len(locations) - 2} more")
        
        if not_scraped:
            print(f"\n❌ Not attempted dispenser scraping:")
            # Group by site
            by_site = {}
            for wo_id, site, num, url in not_scraped:
                key = site or "Unknown"
                if key not in by_site:
                    by_site[key] = []
                by_site[key].append((num, wo_id[:8]))
            
            for site, locations in sorted(by_site.items()):
                print(f"   {site}: {len(locations)} locations")
                
    finally:
        db.close()

if __name__ == "__main__":
    check_status()