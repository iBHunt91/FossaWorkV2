#!/usr/bin/env python3
"""
Extract customer URLs from existing raw HTML data and update the database
"""
import sys
import re
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.database import SessionLocal
from app.models import WorkOrder

def fix_customer_urls():
    """Extract customer URLs from raw HTML and update database"""
    
    print("🔧 FIXING CUSTOMER URLs FROM RAW HTML")
    print("="*60)
    
    db = SessionLocal()
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    try:
        # Get all work orders
        work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
        print(f"Found {len(work_orders)} work orders to process")
        
        updated_count = 0
        failed_count = 0
        
        for wo in work_orders:
            if not wo.scraped_data or not wo.scraped_data.get('raw_html'):
                print(f"❌ {wo.external_id}: No raw HTML")
                failed_count += 1
                continue
            
            raw_html = str(wo.scraped_data['raw_html'])
            
            # Extract customer URL using regex
            customer_url_matches = re.findall(r'href="([^"]*customers/locations/[^"]*)"', raw_html)
            
            if customer_url_matches:
                # Take the first match
                href = customer_url_matches[0]
                
                # Convert to absolute URL
                if href.startswith('/'):
                    customer_url = f"https://app.workfossa.com{href}"
                else:
                    customer_url = href
                
                # Update the scraped_data
                wo.scraped_data['customer_url'] = customer_url
                
                # Mark as modified for SQLAlchemy
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(wo, 'scraped_data')
                
                print(f"✅ {wo.external_id}: Updated customer_url = {customer_url}")
                updated_count += 1
            else:
                print(f"❌ {wo.external_id}: No customer URL found in HTML")
                failed_count += 1
        
        # Commit changes
        db.commit()
        
        print(f"\n📊 RESULTS:")
        print(f"  Updated: {updated_count}")
        print(f"  Failed: {failed_count}")
        print(f"  Total: {len(work_orders)}")
        
        if updated_count > 0:
            print(f"\n✅ SUCCESS! {updated_count} work orders now have customer URLs")
            print("Dispenser scraping should now work!")
        else:
            print(f"\n❌ FAILED! No customer URLs could be extracted")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    fix_customer_urls()