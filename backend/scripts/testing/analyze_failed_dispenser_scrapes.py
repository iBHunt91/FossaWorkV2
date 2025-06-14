#!/usr/bin/env python3
"""Analyze failed dispenser scraping attempts"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
from app.database import SessionLocal
from sqlalchemy import text

def analyze_failures():
    """Analyze why dispenser scraping failed"""
    
    db = SessionLocal()
    try:
        # Get all work orders
        all_orders = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE scraped_data IS NOT NULL
        """)).fetchall()
        
        print(f"Total work orders with scraped data: {len(all_orders)}")
        
        # Categorize work orders
        with_dispensers = []
        without_dispensers = []
        no_customer_url = []
        
        for order in all_orders:
            data = json.loads(order.scraped_data) if order.scraped_data else {}
            
            if 'dispensers_scraped_at' in data:
                with_dispensers.append((order.id, data.get('customer_url'), data.get('site_name'), data.get('site_number')))
            elif data.get('customer_url'):
                without_dispensers.append((order.id, data.get('customer_url'), data.get('site_name'), data.get('site_number')))
            else:
                no_customer_url.append((order.id, data.get('site_name'), data.get('site_number')))
        
        print(f"\n📊 ANALYSIS:")
        print(f"   Successfully scraped dispensers: {len(with_dispensers)}")
        print(f"   Failed to scrape dispensers: {len(without_dispensers)}")
        print(f"   No customer URL: {len(no_customer_url)}")
        
        if without_dispensers:
            print(f"\n❌ Failed dispenser scraping ({len(without_dispensers)} work orders):")
            
            # Group by site name
            by_site = {}
            for wo_id, url, site_name, site_num in without_dispensers:
                site_key = site_name or "Unknown"
                if site_key not in by_site:
                    by_site[site_key] = []
                by_site[site_key].append((wo_id, url, site_num))
            
            # Print grouped by site
            for site_name, orders in sorted(by_site.items()):
                print(f"\n   {site_name} ({len(orders)} failures):")
                for wo_id, url, site_num in orders[:3]:  # Show first 3
                    print(f"      - WO {wo_id}: Store #{site_num}")
                    print(f"        URL: {url}")
                if len(orders) > 3:
                    print(f"      ... and {len(orders) - 3} more")
        
        # Extract location IDs from URLs
        print(f"\n🔍 Analyzing location IDs from failed URLs:")
        location_ids = []
        for _, url, _, _ in without_dispensers:
            if url and '/locations/' in url:
                # Extract location ID from URL
                parts = url.rstrip('/').split('/')
                if parts[-1].isdigit():
                    location_ids.append(int(parts[-1]))
        
        if location_ids:
            location_ids.sort()
            print(f"   Location IDs: {location_ids}")
            print(f"   Range: {min(location_ids)} to {max(location_ids)}")
            
            # Check for patterns
            if all(lid > 100000 for lid in location_ids):
                print(f"   ⚠️  All location IDs are > 100,000 (newer locations)")
            if all(lid < 50000 for lid in location_ids):
                print(f"   ⚠️  All location IDs are < 50,000 (older locations)")
                
    finally:
        db.close()

if __name__ == "__main__":
    analyze_failures()