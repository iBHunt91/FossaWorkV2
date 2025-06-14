#!/usr/bin/env python3
"""Check current dispenser scraping results"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import json
from app.database import SessionLocal
from sqlalchemy import text as sql_text

def check_results():
    """Check dispenser scraping results"""
    
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("DISPENSER SCRAPING RESULTS")
        print("=" * 60)
        
        # Count work orders with dispenser data
        result = db.execute(sql_text("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN scraped_data LIKE '%dispensers%' THEN 1 END) as with_dispensers,
                COUNT(CASE WHEN scraped_data LIKE '%"dispensers": []%' THEN 1 END) as empty_dispensers
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND (scraped_data LIKE '%"job_code": "2025 AccuMeasure"%' 
                 OR scraped_data LIKE '%"job_code": "2025 AccuMeasure Closed Dip/Monitor"%')
        """)).fetchone()
        
        print(f"\n📈 Overall Summary:")
        print(f"   Total AccuMeasure work orders: {result.total}")
        print(f"   With dispenser field: {result.with_dispensers}")
        print(f"   With empty dispensers: {result.empty_dispensers}")
        print(f"   With actual dispensers: {result.with_dispensers - result.empty_dispensers}")
        
        # Get sample of successful scrapes
        samples = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND scraped_data LIKE '%dispensers%'
            AND scraped_data NOT LIKE '%"dispensers": []%'
            AND scraped_data NOT LIKE '%"dispensers": null%'
            LIMIT 5
        """)).fetchall()
        
        if samples:
            print(f"\n📋 Sample Successful Scrapes:")
            for sample in samples:
                data = json.loads(sample.scraped_data) if sample.scraped_data else {}
                dispensers = data.get('dispensers', [])
                if dispensers:
                    print(f"\n   Work Order: {sample.external_id} - {sample.site_name}")
                    print(f"   Dispensers: {len(dispensers)}")
                    for i, d in enumerate(dispensers[:2]):  # Show first 2
                        print(f"   - Dispenser {i+1}: {d.get('title', 'N/A')} (S/N: {d.get('serial_number', 'N/A')})")
        
        # Check failed work orders
        failed = db.execute(sql_text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id IN ('110296', '110297', '110298', '110299', '110300')
            ORDER BY external_id
        """)).fetchall()
        
        print(f"\n🔍 Checking Specific Work Orders:")
        for wo in failed:
            data = json.loads(wo.scraped_data) if wo.scraped_data else {}
            dispensers = data.get('dispensers', [])
            status = "✅ Has dispensers" if dispensers else "❌ No dispensers"
            print(f"   {wo.external_id}: {wo.site_name} - {status} ({len(dispensers)} found)")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_results()