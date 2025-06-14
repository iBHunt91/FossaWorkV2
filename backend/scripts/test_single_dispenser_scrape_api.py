#!/usr/bin/env python3
"""Test scraping a single work order's dispensers via direct API"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.database import SessionLocal
from app.services.browser_automation import BrowserAutomationService
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.dispenser_scraper import dispenser_scraper
from sqlalchemy import text
import json

async def test_single_scrape():
    """Test scraping dispensers for one work order"""
    
    db = SessionLocal()
    browser_service = None
    automation = None
    
    try:
        # Get a work order
        order = db.execute(text("""
            SELECT id, scraped_data
            FROM work_orders
            WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'
            AND scraped_data LIKE '%customer_url%'
            LIMIT 1
        """)).fetchone()
        
        if not order:
            print("No work orders found")
            return
            
        data = json.loads(order.scraped_data)
        customer_url = data.get('customer_url')
        
        print(f"🧪 Testing dispenser scraping for work order: {order.id[:8]}...")
        print(f"   Customer URL: {customer_url}")
        
        # Initialize services
        browser_service = BrowserAutomationService()
        automation = WorkFossaAutomationService(browser_service)
        
        # Get credentials from environment or database
        from app.models.user_models import UserCredential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("❌ No WorkFossa credentials found")
            return
            
        # Login
        print("🔐 Logging in...")
        login_result = await automation.login(cred.username, cred.password)
        if not login_result['success']:
            print(f"❌ Login failed: {login_result.get('error')}")
            return
            
        # Get page
        page = automation.pages.get('main')
        if not page:
            print("❌ No page available")
            return
            
        # Navigate to customer URL
        print(f"🌐 Navigating to {customer_url}")
        await page.goto(customer_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Use the scraper
        print("🔧 Scraping dispensers...")
        dispensers, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
            page=page,
            work_order_id=order.id,
            visit_url=customer_url
        )
        
        if dispensers:
            print(f"\n✅ Found {len(dispensers)} dispensers!")
            for i, d in enumerate(dispensers):
                print(f"   {i+1}. {d.title}")
                print(f"      Make/Model: {d.make} {d.model}")
                print(f"      Serial: {d.serial_number}")
                
            # Update the database
            print("\n💾 Updating database...")
            
            # Convert dispensers to dict format
            dispenser_data = []
            for d in dispensers:
                dispenser_data.append({
                    'title': d.title,
                    'serial_number': d.serial_number,
                    'make': d.make,
                    'model': d.model,
                    'dispenser_number': d.dispenser_number,
                    'fuel_grades': d.fuel_grades,
                    'custom_fields': d.custom_fields
                })
            
            # Update scraped_data
            data['dispensers'] = dispenser_data
            data['dispensers_scraped_at'] = datetime.now().isoformat()
            data['dispenser_scrape_success'] = True
            
            db.execute(text("""
                UPDATE work_orders 
                SET scraped_data = :data
                WHERE id = :id
            """), {"data": json.dumps(data), "id": order.id})
            db.commit()
            
            print("✅ Database updated!")
            
        else:
            print("❌ No dispensers found")
            # Check page content
            content = await page.content()
            if "could not find this location" in content.lower():
                print("   ⚠️  Location appears to be deleted")
            elif "equipment" not in content.lower():
                print("   ⚠️  No Equipment tab found")
            else:
                print("   ⚠️  Unknown issue")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if automation:
            await automation.close()
        db.close()

if __name__ == "__main__":
    from datetime import datetime
    asyncio.run(test_single_scrape())