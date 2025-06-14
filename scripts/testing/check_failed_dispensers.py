#!/usr/bin/env python3
"""Check which work orders failed dispenser scraping"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json

# Create database connection
db_path = Path(__file__).parent.parent / "fossawork_v2.db"
engine = create_engine(f"sqlite:///{db_path}")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    # Get all work orders
    result = db.execute(text("""
        SELECT wo.id, wo.external_id, wo.site_name, wo.scraped_data,
               COUNT(d.id) as dispenser_count
        FROM work_orders wo
        LEFT JOIN dispensers d ON wo.id = d.work_order_id
        GROUP BY wo.id
        ORDER BY dispenser_count ASC
    """))
    work_orders = result.fetchall()
    
    print(f"Total work orders: {len(work_orders)}")
    print()
    
    # Categorize work orders
    with_dispensers = []
    without_dispensers = []
    
    for wo in work_orders:
        if wo[4] == 0:  # dispenser_count
            without_dispensers.append(wo)
        else:
            with_dispensers.append(wo)
    
    print(f"Work orders WITH dispensers: {len(with_dispensers)}")
    print(f"Work orders WITHOUT dispensers: {len(without_dispensers)}")
    print()
    
    if without_dispensers:
        print("Work orders that FAILED dispenser scraping (no dispensers found):")
        print("-" * 80)
        for wo in without_dispensers[:20]:  # Show first 20
            scraped_data = json.loads(wo[3]) if wo[3] else {}
            customer_url = scraped_data.get('customer_url', 'No URL')
            print(f"❌ {wo[1]} - {wo[2]}")
            print(f"   Customer URL: {customer_url}")
            
            # Check if it's a service that should have dispensers
            service_code = scraped_data.get('service_info', {}).get('code', '')
            if service_code in ['2861', '2862', '3146', '3002']:
                print(f"   ⚠️  Service code {service_code} - Should have dispensers!")
            print()
        
        if len(without_dispensers) > 20:
            print(f"... and {len(without_dispensers) - 20} more")
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()