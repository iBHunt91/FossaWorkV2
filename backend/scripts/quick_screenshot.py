#!/usr/bin/env python3
"""Quick screenshot of failed work order"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.database import SessionLocal
from app.services.dispenser_scraper import dispenser_scraper
from sqlalchemy import text
import json
from datetime import datetime

async def quick_screenshot():
    """Use dispenser scraper to navigate and take screenshot"""
    
    db = SessionLocal()
    
    try:
        # Get failed order
        failed_order = db.execute(text("""
            SELECT external_id, site_name, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND external_id = '110296'
        """)).fetchone()
        
        if not failed_order:
            print("Failed order not found")
            return
            
        data = json.loads(failed_order.scraped_data) if failed_order.scraped_data else {}
        customer_url = data.get('customer_url')
        
        print(f"🔍 Checking: {failed_order.external_id} - {failed_order.site_name}")
        print(f"   URL: {customer_url}")
        
        if not customer_url:
            print("No customer URL")
            return
            
        # Get credentials
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        # Use dispenser scraper which already has login logic
        result = await dispenser_scraper.scrape_single_work_order(
            work_order_id=failed_order.external_id,
            customer_url=customer_url,
            credentials={
                'username': cred.username,
                'password': cred.password
            },
            user_id='7bea3bdb7e8e303eacaba442bd824004',
            take_screenshot=True  # This will save debug screenshots
        )
        
        if result['success']:
            print(f"✅ Scraping completed: {len(result.get('dispensers', []))} dispensers found")
        else:
            print(f"❌ Scraping failed: {result.get('error', 'Unknown error')}")
            
        print("\n📸 Check the screenshots directory for debug images")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(quick_screenshot())