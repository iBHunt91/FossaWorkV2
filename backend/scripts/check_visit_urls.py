#!/usr/bin/env python3
"""
Check visit URLs in the database to diagnose extraction issues
"""
import sqlite3
import json
from pathlib import Path

def check_visit_urls():
    """Check all visit URLs in the database"""
    db_path = Path(__file__).parent.parent / "fossawork_v2.db"
    
    if not db_path.exists():
        print("❌ Database not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("🔍 Checking visit URLs in database...")
    print("=" * 80)
    
    # Get all work orders with visit URLs
    cursor.execute("""
        SELECT id, visit_url, visit_number, customer_url, site_name, service_code
        FROM work_orders 
        ORDER BY created_at DESC
    """)
    
    rows = cursor.fetchall()
    print(f"Total work orders: {len(rows)}")
    
    # Analyze visit URLs
    visit_url_patterns = {
        'with_visits': 0,
        'without_visits': 0,
        'work_only': 0,
        'null_visit': 0
    }
    
    print("\nSample visit URLs:")
    print("-" * 80)
    
    sample_count = 0
    for work_order_id, visit_url, visit_number, customer_url, site_name, service_code in rows:
        try:
            if visit_url:
                if '/visits/' in visit_url:
                    visit_url_patterns['with_visits'] += 1
                    pattern = "✅ WITH /visits/"
                elif '/work/' in visit_url:
                    visit_url_patterns['work_only'] += 1
                    pattern = "⚠️  WORK ONLY"
                else:
                    pattern = "❓ OTHER"
            else:
                visit_url_patterns['null_visit'] += 1
                pattern = "❌ NULL"
            
            # Show first 10 examples
            if sample_count < 10:
                print(f"\nWork Order: {work_order_id}")
                print(f"  Site: {site_name}")
                print(f"  Service Code: {service_code}")
                print(f"  Visit URL: {visit_url}")
                print(f"  Visit Number: {visit_number}")
                print(f"  Pattern: {pattern}")
                
                # Check if customer_url exists
                if customer_url:
                    print(f"  Customer URL: {customer_url}")
                
                sample_count += 1
                
        except Exception as e:
            print(f"Error parsing work order {work_order_id}: {e}")
    
    print("\n" + "=" * 80)
    print("VISIT URL ANALYSIS:")
    print("=" * 80)
    print(f"✅ With /visits/ pattern: {visit_url_patterns['with_visits']}")
    print(f"⚠️  With /work/ only: {visit_url_patterns['work_only']}")
    print(f"❌ NULL visit URLs: {visit_url_patterns['null_visit']}")
    print(f"📊 Total: {len(rows)}")
    
    # Check for work orders that might need re-scraping
    cursor.execute("""
        SELECT COUNT(*) 
        FROM work_orders 
        WHERE visit_url LIKE '%/work/%' 
        AND visit_url NOT LIKE '%/visits/%'
    """)
    
    needs_rescrape = cursor.fetchone()[0]
    print(f"\n🔄 Work orders that may need re-scraping: {needs_rescrape}")
    
    conn.close()

if __name__ == "__main__":
    check_visit_urls()