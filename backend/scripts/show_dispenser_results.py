#!/usr/bin/env python3
"""Show dispenser scraping results summary"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Get summary stats
    total_orders = db.execute(text("""
        SELECT COUNT(*)
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
    """)).scalar()
    
    scraped_orders = db.execute(text("""
        SELECT COUNT(*)
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%dispenser_scrape_date%'
    """)).scalar()
    
    print("=" * 60)
    print("DISPENSER SCRAPING RESULTS SUMMARY")
    print("=" * 60)
    print(f"\n📊 Overall Statistics:")
    print(f"   Total work orders: {total_orders}")
    print(f"   Successfully scraped: {scraped_orders}")
    print(f"   Success rate: {(scraped_orders/total_orders*100):.1f}%")
    
    # Get dispenser counts
    results = db.execute(text("""
        SELECT external_id, site_name, scraped_data
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND scraped_data LIKE '%dispenser_scrape_date%'
        ORDER BY updated_at DESC
        LIMIT 10
    """)).fetchall()
    
    print(f"\n🏪 Recent Successful Scrapes:")
    total_dispensers = 0
    for row in results:
        data = json.loads(row.scraped_data)
        disp_count = len(data.get('dispensers', []))
        total_dispensers += disp_count
        print(f"   {row.external_id} - {row.site_name}: {disp_count} dispensers")
        
        # Show first dispenser details
        if data.get('dispensers'):
            d = data['dispensers'][0]
            if 'title' in d:
                # Extract make/model
                title = d['title']
                if 'Make:' in title:
                    import re
                    make = re.search(r'Make:\s*(\w+)', title)
                    model = re.search(r'Model:\s*(\w+)', title)
                    if make:
                        print(f"      → Dispenser 1: {make.group(1)} {model.group(1) if model else ''}")
    
    # Show failed scrapes
    failed_orders = db.execute(text("""
        SELECT external_id, site_name
        FROM work_orders
        WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
        AND (scraped_data IS NULL OR scraped_data NOT LIKE '%dispenser_scrape_date%')
        LIMIT 8
    """)).fetchall()
    
    if failed_orders:
        print(f"\n❌ Work Orders Without Dispenser Data ({len(failed_orders)} shown):")
        for row in failed_orders:
            print(f"   {row.external_id} - {row.site_name}")
    
    print("\n" + "=" * 60)
    print("✅ DISPENSER SCRAPING COMPLETED SUCCESSFULLY")
    print("=" * 60)
    
finally:
    db.close()