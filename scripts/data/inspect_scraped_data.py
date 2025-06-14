#!/usr/bin/env python3
"""
Inspect what's actually in the scraped_data to understand why customer URLs aren't being extracted
"""
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.database import SessionLocal
from app.models import WorkOrder

def inspect_scraped_data():
    """Inspect scraped_data to see what's actually there"""
    
    print("🔍 INSPECTING SCRAPED DATA")
    print("="*60)
    
    db = SessionLocal()
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    try:
        # Get first few work orders
        work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).limit(3).all()
        
        for i, wo in enumerate(work_orders, 1):
            print(f"\n{i}. WORK ORDER: {wo.external_id}")
            print(f"   Site: {wo.site_name}")
            print(f"   Service: {wo.service_code}")
            
            if wo.scraped_data:
                print(f"   📊 Scraped data keys: {list(wo.scraped_data.keys())}")
                
                # Check each key
                for key, value in wo.scraped_data.items():
                    if key == 'customer_url':
                        print(f"   🔗 customer_url: {value}")
                    elif key == 'raw_html':
                        print(f"   📄 raw_html: {len(str(value))} characters")
                    elif key == 'address_components':
                        print(f"   📍 address_components: {value}")
                    elif key == 'service_info':
                        print(f"   🛠️  service_info: {value}")
                    else:
                        print(f"   📝 {key}: {str(value)[:100]}...")
            else:
                print("   ❌ No scraped_data")
            
            # Check for any customer-related content in raw HTML
            if wo.scraped_data and wo.scraped_data.get('raw_html'):
                raw_html = str(wo.scraped_data['raw_html'])
                
                # Look for customer links
                if '/customers/locations/' in raw_html:
                    print("   ✅ Found '/customers/locations/' in raw HTML")
                    
                    # Extract a snippet
                    import re
                    matches = re.findall(r'href="[^"]*customers/locations/[^"]*"', raw_html)
                    if matches:
                        print(f"   🔗 Customer link examples: {matches[:2]}")
                else:
                    print("   ❌ No '/customers/locations/' found in raw HTML")
                    
                    # Look for other patterns
                    if 'customers' in raw_html.lower():
                        print("   📝 Found 'customers' in HTML (different pattern?)")
                    
                    # Look for any links at all
                    link_count = raw_html.count('href=')
                    print(f"   🔗 Total links in HTML: {link_count}")
        
        print(f"\n🎯 DIAGNOSIS:")
        print("If customer URLs are null but '/customers/locations/' exists in raw HTML:")
        print("  → The extraction logic needs to be debugged")
        print("If '/customers/locations/' is not in raw HTML:")
        print("  → WorkFossa page structure may have changed")
        print("  → Need to update scraping selectors")
        
    finally:
        db.close()

if __name__ == "__main__":
    inspect_scraped_data()