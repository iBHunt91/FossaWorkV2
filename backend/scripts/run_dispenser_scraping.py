#!/usr/bin/env python3
"""Run dispenser scraping for all work orders"""

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import json
from app.database import SessionLocal
from app.services.browser_automation import browser_automation
from app.services.workfossa_scraper import WorkFossaScraper
from sqlalchemy import text
import time

async def run_dispenser_scraping():
    """Run dispenser scraping for all work orders with customer URLs"""
    
    db = SessionLocal()
    
    try:
        # Get work orders that need dispenser scraping
        orders = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE scraped_data IS NOT NULL
            AND scraped_data LIKE '%customer_url%'
            AND scraped_data NOT LIKE '%dispensers_scraped_at%'
            ORDER BY id
            LIMIT 10
        """)).fetchall()
        
        print(f"Found {len(orders)} work orders to process (showing first 10)")
        
        if not orders:
            print("No work orders need dispenser scraping")
            return
        
        # Initialize browser automation service
        await browser_automation.init()
        
        # Create scraper instance
        scraper = WorkFossaScraper(browser_automation)
        
        success_count = 0
        failure_count = 0
        
        # Process each work order
        for i, order in enumerate(orders):
            try:
                data = json.loads(order.scraped_data) if order.scraped_data else {}
                customer_url = data.get('customer_url')
                
                print(f"\n[{i+1}/{len(orders)}] Processing work order {order.id[:8]}...")
                print(f"   Site: {data.get('site_name', 'Unknown')} #{data.get('site_number', 'Unknown')}")
                print(f"   Customer URL: {customer_url}")
                
                if not customer_url:
                    print("   ❌ No customer URL found")
                    failure_count += 1
                    continue
                
                # Scrape dispensers using the scraper method
                result = await scraper.scrape_dispensers_for_work_order(
                    work_order_id=order.id,
                    customer_url=customer_url
                )
                
                if result['success']:
                    success_count += 1
                    dispensers = result.get('dispensers', [])
                    print(f"   ✅ Found {len(dispensers)} dispensers")
                    
                    # Update database
                    data['dispensers'] = dispensers
                    data['dispensers_scraped_at'] = time.time()
                    data['dispenser_scrape_success'] = True
                    
                    db.execute(text("""
                        UPDATE work_orders 
                        SET scraped_data = :data
                        WHERE id = :id
                    """), {"data": json.dumps(data), "id": order.id})
                    db.commit()
                    
                    # Show dispenser details
                    for j, disp in enumerate(dispensers[:3]):  # Show first 3
                        print(f"      Dispenser {j+1}: {disp.get('title', 'Unknown')}")
                        if disp.get('make'):
                            print(f"         Make/Model: {disp.get('make')} {disp.get('model', '')}")
                    if len(dispensers) > 3:
                        print(f"      ... and {len(dispensers) - 3} more")
                        
                else:
                    failure_count += 1
                    error_msg = result.get('error', 'Unknown error')
                    print(f"   ❌ Failed: {error_msg}")
                    
                    # Still update database to mark as attempted
                    data['dispensers_scraped_at'] = time.time()
                    data['dispenser_scrape_success'] = False
                    data['dispenser_scrape_error'] = error_msg
                    
                    db.execute(text("""
                        UPDATE work_orders 
                        SET scraped_data = :data
                        WHERE id = :id
                    """), {"data": json.dumps(data), "id": order.id})
                    db.commit()
                
                # Small delay between requests
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                failure_count += 1
                continue
        
        # Summary
        print("\n" + "="*80)
        print(f"\n📊 DISPENSER SCRAPING SUMMARY:")
        print(f"   Total processed: {len(orders)}")
        print(f"   Successful: {success_count}")
        print(f"   Failed: {failure_count}")
        if len(orders) > 0:
            print(f"   Success rate: {(success_count/len(orders)*100):.1f}%")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await browser_automation.close()
        db.close()

if __name__ == "__main__":
    asyncio.run(run_dispenser_scraping())