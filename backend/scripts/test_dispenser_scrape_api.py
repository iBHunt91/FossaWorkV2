#!/usr/bin/env python3
"""
Test the dispenser scraping API endpoint
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import json
from app.database import SessionLocal
from app.models import WorkOrder

async def test_dispenser_scrape():
    """Test dispenser scraping through the API"""
    
    print("🧪 Testing Dispenser Scrape API")
    print("=" * 80)
    
    # Get a work order with customer URL
    db = SessionLocal()
    work_order = db.query(WorkOrder).filter(
        WorkOrder.customer_url.isnot(None)
    ).first()
    
    if not work_order:
        print("❌ No work orders with customer URL found")
        db.close()
        return
    
    print(f"Found work order: {work_order.external_id}")
    print(f"Customer URL: {work_order.customer_url}")
    
    # Test direct scraping
    from app.services.dispenser_scraper import dispenser_scraper
    from app.services.browser_automation import BrowserAutomationService
    
    # Force headless mode
    os.environ['BROWSER_VISIBLE'] = 'false'
    
    service = BrowserAutomationService(headless=True)
    
    try:
        # Create a test session
        await service.start()
        page = service.page
        
        if not page:
            print("❌ Failed to create browser page")
            return
        
        print("✅ Browser started in headless mode")
        
        # Navigate to customer URL
        print(f"🔗 Navigating to: {work_order.customer_url}")
        await page.goto(work_order.customer_url, wait_until="domcontentloaded", timeout=30000)
        
        # Run dispenser scraper
        dispensers, html = await dispenser_scraper.scrape_dispensers_for_work_order(
            page, 
            work_order_id=work_order.id,
            visit_url=None  # Already at customer page
        )
        
        print(f"✅ Found {len(dispensers)} dispensers")
        
        for disp in dispensers:
            print(f"\n📋 Dispenser {disp.dispenser_number}:")
            print(f"  Make: {disp.make}")
            print(f"  Model: {disp.model}")
            print(f"  Fuel Grades: {disp.fuel_grades}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await service.stop()
        db.close()
        print("\n✅ Test complete")

if __name__ == "__main__":
    asyncio.run(test_dispenser_scrape())