#!/usr/bin/env python3
"""
Debug single scrape process to understand the data flow
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import asyncio
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from app.services.dispenser_scraper import dispenser_scraper

async def debug_scrape():
    """Debug the single scrape process"""
    
    print("🔍 Debugging Single Scrape Process")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get the work order
    work_order = db.query(WorkOrder).filter(WorkOrder.external_id == "129651").first()
    
    if not work_order:
        print("❌ Work order not found")
        return
    
    print(f"Work Order: {work_order.external_id} ({work_order.site_name})")
    print(f"Customer URL: {work_order.customer_url}")
    
    # Check current dispensers
    current_dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == work_order.id).all()
    print(f"\n📋 Current dispensers in DB: {len(current_dispensers)}")
    
    if current_dispensers:
        first = current_dispensers[0]
        print(f"  First dispenser fuel_grades: {json.dumps(first.fuel_grades, indent=2)}")
    
    # Now let's see what the scraper would extract
    print("\n🔍 Testing scraper extraction...")
    
    # Create a test page object
    class MockPage:
        url = work_order.customer_url
        
        async def goto(self, url):
            print(f"  Would navigate to: {url}")
            
        async def evaluate(self, script):
            # Simulate the JavaScript extraction
            return {
                'success': True,
                'dispensers': [
                    {
                        'title': '1/2 - Regular, Plus, Premium - Gilbarco',
                        'serial_number': 'ABC123',
                        'make': 'Gilbarco',
                        'model': 'Encore',
                        'fields': {
                            'GRADE': 'Regular, Plus, Premium'
                        },
                        'dispenser_number': '1/2',
                        'fuel_grades': {'description': 'Regular, Plus, Premium'}  # This might be the issue!
                    }
                ],
                'debug': {'message': 'Mock extraction'}
            }
        
        async def wait_for_timeout(self, timeout):
            pass
            
        async def screenshot(self, **kwargs):
            pass
    
    # Test the scraper
    mock_page = MockPage()
    dispenser_infos, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
        page=mock_page,
        work_order_id=work_order.id,
        visit_url=work_order.customer_url
    )
    
    print(f"\n📋 Scraper returned {len(dispenser_infos)} dispensers")
    
    for i, info in enumerate(dispenser_infos):
        print(f"\n  Dispenser {i+1}:")
        print(f"    Title: {info.title}")
        print(f"    Fuel Grades: {json.dumps(info.fuel_grades, indent=6)}")
        print(f"    Grades List: {info.grades_list}")
    
    db.close()

if __name__ == "__main__":
    asyncio.run(debug_scrape())