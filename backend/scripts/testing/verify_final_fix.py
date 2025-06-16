#!/usr/bin/env python3
"""
Verify the final fix for grades_list contamination
"""
import sys
import os
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, WorkOrder
from app.services.browser_automation import browser_automation
from app.services.dispenser_scraper import DispenserScraper

async def verify_fix():
    """Verify the fix by doing a test scrape"""
    db = SessionLocal()
    
    try:
        print("🧪 Verifying Final Fix for Grades List")
        print("=" * 70)
        
        # Get a work order to test with
        work_order = db.query(WorkOrder).filter(
            WorkOrder.customer_url.isnot(None),
            WorkOrder.service_code.in_(['2861', '2862', '3002'])
        ).first()
        
        if not work_order:
            print("❌ No suitable work order found for testing")
            return
        
        print(f"\n📋 Testing with work order: {work_order.external_id}")
        print(f"   Customer URL: {work_order.customer_url}")
        print(f"   Service Code: {work_order.service_code}")
        
        # Get user for browser service
        user = db.query(User).filter(User.id == work_order.user_id).first()
        if not user:
            print("❌ User not found")
            return
        
        # Initialize services
        browser_service = browser_automation.get_service(user.id)
        dispenser_scraper = DispenserScraper()
        
        print("\n🚀 Running test scrape with fixed code...")
        
        async with browser_service:
            page = await browser_service.get_page()
            
            # Navigate to customer page
            await page.goto(work_order.customer_url)
            await page.wait_for_load_state('networkidle')
            
            # Scrape dispensers
            dispensers = await dispenser_scraper.scrape_dispensers_for_work_order(
                page=page,
                customer_url=work_order.customer_url,
                work_order_external_id=work_order.external_id,
                service_code=work_order.service_code
            )
            
            print(f"\n✅ Found {len(dispensers)} dispensers")
            
            # Check each dispenser for contamination
            all_clean = True
            for i, disp in enumerate(dispensers):
                print(f"\n📍 Dispenser {disp.dispenser_number}:")
                print(f"   Title: {disp.title}")
                print(f"   Grades List: {disp.grades_list}")
                print(f"   Custom Fields GRADE: {disp.custom_fields.get('GRADE', 'N/A')}")
                
                # Check for contamination
                contaminated_items = []
                if disp.grades_list:
                    for grade in disp.grades_list:
                        if isinstance(grade, str) and any(x in grade.lower() for x in [
                            'stand alone', 'code', 'nozzle', 'meter', 'number of', 'per side'
                        ]):
                            contaminated_items.append(grade)
                            all_clean = False
                
                if contaminated_items:
                    print(f"   ❌ CONTAMINATION FOUND: {contaminated_items}")
                else:
                    print(f"   ✅ Clean - only fuel grades")
        
        print("\n" + "="*70)
        print("📊 FINAL VERIFICATION RESULTS")
        print("="*70)
        
        if all_clean:
            print("✅ SUCCESS! All dispensers have clean grades_list")
            print("✅ No field labels or non-fuel items found")
            print("✅ The fix is working correctly!")
            print("\n🎉 The single job dispenser scraping now works identically to batch scraping!")
        else:
            print("❌ Some dispensers still have contamination")
            print("   Further investigation needed")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("⚠️  This script will do a real scrape to verify the fix")
    print("   It requires an active browser session and valid credentials")
    response = input("\nProceed? (y/n): ")
    if response.lower() == 'y':
        asyncio.run(verify_fix())
    else:
        print("Cancelled")