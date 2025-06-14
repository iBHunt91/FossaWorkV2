#!/usr/bin/env python3
"""Run batch dispenser scraping with all fixes"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

import asyncio
import requests
import json

async def run_batch_scrape():
    """Trigger batch dispenser scraping via API"""
    
    # API endpoint
    url = "http://localhost:8000/api/work-orders/batch-scrape-dispensers"
    
    # Headers with auth
    headers = {
        "Content-Type": "application/json",
        "X-User-ID": "7bea3bdb7e8e303eacaba442bd824004"
    }
    
    print("=" * 60)
    print("BATCH DISPENSER SCRAPING")
    print("=" * 60)
    
    print("\n🚀 Triggering batch dispenser scraping...")
    print(f"   URL: {url}")
    print(f"   User: Bruce Hunt")
    
    try:
        response = requests.post(url, headers=headers, json={})
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ API Response: {result['message']}")
            print(f"   Task ID: {result.get('task_id', 'N/A')}")
            
            # Wait for task to complete
            print("\n⏳ Waiting for batch scraping to complete...")
            print("   This may take several minutes...")
            
            # Check results after waiting
            await asyncio.sleep(180)  # Wait 3 minutes
            
            print("\n📊 Checking results...")
            
            # Query database for results
            from app.database import SessionLocal
            from sqlalchemy import text as sql_text
            
            db = SessionLocal()
            try:
                # Count work orders with dispenser data
                result = db.execute(sql_text("""
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN scraped_data LIKE '%dispensers%' THEN 1 END) as with_dispensers,
                        COUNT(CASE WHEN scraped_data LIKE '%"dispensers": []%' THEN 1 END) as empty_dispensers,
                        COUNT(CASE WHEN json_extract(scraped_data, '$.dispensers') IS NOT NULL 
                                   AND json_array_length(json_extract(scraped_data, '$.dispensers')) > 0 
                              THEN 1 END) as successful_dispensers
                    FROM work_orders
                    WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
                    AND external_id IN (
                        SELECT external_id FROM work_orders 
                        WHERE job_code IN ('2025 AccuMeasure', '2025 AccuMeasure Closed Dip/Monitor')
                    )
                """)).fetchone()
                
                print(f"\n📈 Results Summary:")
                print(f"   Total work orders: {result.total}")
                print(f"   With dispenser data: {result.with_dispensers}")
                print(f"   With empty dispensers: {result.empty_dispensers}")
                print(f"   Successfully scraped: {result.successful_dispensers}")
                print(f"   Success rate: {(result.successful_dispensers / result.total * 100):.1f}%")
                
                # Show sample of successful scrapes
                samples = db.execute(sql_text("""
                    SELECT external_id, site_name, 
                           json_array_length(json_extract(scraped_data, '$.dispensers')) as dispenser_count
                    FROM work_orders
                    WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
                    AND json_extract(scraped_data, '$.dispensers') IS NOT NULL
                    AND json_array_length(json_extract(scraped_data, '$.dispensers')) > 0
                    LIMIT 5
                """)).fetchall()
                
                if samples:
                    print(f"\n📋 Sample Successful Scrapes:")
                    for sample in samples:
                        print(f"   - {sample.external_id}: {sample.site_name} ({sample.dispenser_count} dispensers)")
                
            finally:
                db.close()
                
        else:
            print(f"\n❌ API Error: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Starting batch dispenser scraping...")
    asyncio.run(run_batch_scrape())