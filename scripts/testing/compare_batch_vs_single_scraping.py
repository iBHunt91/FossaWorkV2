#!/usr/bin/env python3
"""
Compare batch vs single dispenser scraping to find where they diverge
This directly addresses the user's request to ensure single scraping works "like the batch dispenser does"
"""
import sys
import os
import json
import asyncio
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import User, WorkOrder, Dispenser
from app.services.browser_automation import browser_automation
from app.services.dispenser_scraper import DispenserScraper
from app.services.workfossa_scraper import WorkFossaScraper
from sqlalchemy.orm.attributes import flag_modified

async def compare_batch_vs_single():
    """Compare batch and single scraping on the same work order"""
    db = SessionLocal()
    
    try:
        print("🔍 Batch vs Single Dispenser Scraping Comparison")
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
        
        print("\n" + "="*70)
        print("🚀 STEP 1: Single Job Scraping (Current Issue)")
        print("="*70)
        
        # Single job scraping - this is what has the issue
        async with browser_service:
            page = await browser_service.get_page()
            
            # Navigate to customer page
            await page.goto(work_order.customer_url)
            await page.wait_for_load_state('networkidle')
            
            # Call the same method used by single job endpoint
            single_results = await dispenser_scraper.scrape_dispensers_for_work_order(
                page=page,
                customer_url=work_order.customer_url,
                work_order_external_id=work_order.external_id,
                service_code=work_order.service_code
            )
            
            print(f"\n✅ Single scraping found {len(single_results)} dispensers")
            
            # Analyze results
            for i, disp in enumerate(single_results[:2]):  # First 2 dispensers
                print(f"\n  Dispenser {i+1}:")
                print(f"    Number: {disp.dispenser_number}")
                print(f"    Grades List: {disp.grades_list}")
                print(f"    Custom Fields GRADE: {disp.custom_fields.get('GRADE', 'N/A')}")
        
        print("\n" + "="*70)
        print("🚀 STEP 2: Batch Scraping (Working Correctly)")
        print("="*70)
        
        # Batch scraping - this works correctly
        # Simulate batch process by using the exact same scraping method
        async with browser_service:
            page = await browser_service.get_page()
            
            # Navigate to customer page
            await page.goto(work_order.customer_url)
            await page.wait_for_load_state('networkidle')
            
            # Use EXACT same method as single - they should be identical!
            batch_results = await dispenser_scraper.scrape_dispensers_for_work_order(
                page=page,
                customer_url=work_order.customer_url,
                work_order_external_id=work_order.external_id,
                service_code=work_order.service_code
            )
            
            print(f"\n✅ Batch scraping found {len(batch_results)} dispensers")
            
            # Analyze results
            for i, disp in enumerate(batch_results[:2]):  # First 2 dispensers
                print(f"\n  Dispenser {i+1}:")
                print(f"    Number: {disp.dispenser_number}")
                print(f"    Grades List: {disp.grades_list}")
                print(f"    Custom Fields GRADE: {disp.custom_fields.get('GRADE', 'N/A')}")
        
        print("\n" + "="*70)
        print("📊 COMPARISON RESULTS")
        print("="*70)
        
        # Compare the results
        if len(single_results) != len(batch_results):
            print(f"❌ Different number of dispensers: Single={len(single_results)}, Batch={len(batch_results)}")
        else:
            print(f"✅ Same number of dispensers: {len(single_results)}")
        
        # Compare grades_list for each dispenser
        print("\n🔍 Grades List Comparison:")
        for i in range(min(len(single_results), len(batch_results), 3)):
            single_disp = single_results[i]
            batch_disp = batch_results[i]
            
            print(f"\n  Dispenser {single_disp.dispenser_number}:")
            print(f"    Single grades: {single_disp.grades_list}")
            print(f"    Batch grades:  {batch_disp.grades_list}")
            
            if single_disp.grades_list != batch_disp.grades_list:
                print("    ❌ MISMATCH!")
                
                # Check what's different
                single_set = set(single_disp.grades_list) if single_disp.grades_list else set()
                batch_set = set(batch_disp.grades_list) if batch_disp.grades_list else set()
                
                only_in_single = single_set - batch_set
                only_in_batch = batch_set - single_set
                
                if only_in_single:
                    print(f"    Items only in single: {list(only_in_single)}")
                if only_in_batch:
                    print(f"    Items only in batch: {list(only_in_batch)}")
            else:
                print("    ✅ Match")
        
        print("\n" + "="*70)
        print("💡 KEY INSIGHT")
        print("="*70)
        print("Both single and batch use the EXACT SAME method:")
        print("  dispenser_scraper.scrape_dispensers_for_work_order()")
        print("\nIf they produce different results, the issue is likely:")
        print("1. Data persistence/contamination between calls")
        print("2. Browser state differences")
        print("3. Timing issues")
        print("4. The data is being modified AFTER scraping")
        
        # Check database for differences
        print("\n" + "="*70)
        print("🗄️ DATABASE CHECK")
        print("="*70)
        
        # Get dispensers from database
        db_dispensers = db.query(Dispenser).filter(
            Dispenser.work_order_id == work_order.id
        ).order_by(Dispenser.dispenser_number).all()
        
        print(f"\nFound {len(db_dispensers)} dispensers in database")
        for i, disp in enumerate(db_dispensers[:3]):
            print(f"\n  DB Dispenser {disp.dispenser_number}:")
            grades_list = disp.form_data.get('grades_list', []) if disp.form_data else []
            print(f"    Grades List: {grades_list}")
            
            # Check for contamination
            contaminated = False
            for grade in grades_list:
                if isinstance(grade, str) and any(x in grade.lower() for x in ['stand alone', 'nozzle', 'meter']):
                    contaminated = True
                    break
            
            if contaminated:
                print("    ❌ CONTAMINATED with field labels!")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(compare_batch_vs_single())