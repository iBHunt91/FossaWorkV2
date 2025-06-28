#!/usr/bin/env python3
"""Batch scrape dispensers for all work orders with customer URLs"""

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import json
from app.database import SessionLocal
from app.services.workfossa_scraper import WorkFossaScraper
from sqlalchemy import text
from sqlalchemy.orm import Session
import time

async def batch_scrape_dispensers():
    """Scrape dispensers for all work orders that have customer URLs"""
    
    db = SessionLocal()
    scraper = WorkFossaScraper()
    
    try:
        # Get work orders with customer URLs but no dispenser data
        orders = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE scraped_data IS NOT NULL
            AND scraped_data LIKE '%customer_url%'
            AND scraped_data NOT LIKE '%dispensers_scraped_at%'
            ORDER BY id
        """)).fetchall()
        
        print(f"Found {len(orders)} work orders to process")
        
        # Initialize scraper
        if not await scraper.init():
            print("Failed to initialize scraper")
            return
            
        success_count = 0
        failure_count = 0
        
        # Process each work order
        for i, order in enumerate(orders):
            try:
                data = json.loads(order.scraped_data) if order.scraped_data else {}
                customer_url = data.get('customer_url')
                
                if not customer_url:
                    print(f"❌ Work order {order.id[:8]}... has no customer URL")
                    failure_count += 1
                    continue
                
                print(f"\n[{i+1}/{len(orders)}] Processing work order {order.id[:8]}...")
                print(f"   Customer URL: {customer_url}")
                
                # Scrape dispensers
                result = await scraper.scrape_dispensers_for_work_order(
                    work_order_id=order.id,
                    customer_url=customer_url
                )
                
                if result['success']:
                    success_count += 1
                    print(f"   ✅ Found {len(result.get('dispensers', []))} dispensers")
                    
                    # Update database with results
                    data['dispensers'] = result.get('dispensers', [])
                    data['dispensers_scraped_at'] = time.time()
                    data['dispenser_scrape_success'] = True
                    
                    db.execute(text("""
                        UPDATE work_orders 
                        SET scraped_data = :data
                        WHERE id = :id
                    """), {"data": json.dumps(data), "id": order.id})
                    db.commit()
                else:
                    failure_count += 1
                    print(f"   ❌ Failed: {result.get('error', 'Unknown error')}")
                    
                    # Save error info
                    data['dispenser_scrape_success'] = False
                    data['dispenser_scrape_error'] = result.get('error', 'Unknown error')
                    data['dispensers_scraped_at'] = time.time()
                    
                    db.execute(text("""
                        UPDATE work_orders 
                        SET scraped_data = :data
                        WHERE id = :id
                    """), {"data": json.dumps(data), "id": order.id})
                    db.commit()
                
                # Small delay between requests
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"   ❌ Error processing work order: {e}")
                failure_count += 1
                continue
        
        # Summary
        print("\n" + "="*80)
        print(f"\n📊 BATCH SCRAPING COMPLETE:")
        print(f"   Total processed: {len(orders)}")
        print(f"   Successful: {success_count}")
        print(f"   Failed: {failure_count}")
        print(f"   Success rate: {(success_count/len(orders)*100):.1f}%")
        
    except Exception as e:
        print(f"❌ Batch scraping error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await scraper.close()
        db.close()

if __name__ == "__main__":
    asyncio.run(batch_scrape_dispensers())