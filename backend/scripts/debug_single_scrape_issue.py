#!/usr/bin/env python3
"""
Debug single work order scraping issue
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

def debug_single_scrape():
    """Check data from single scrape vs batch scrape"""
    
    print("🔍 Debugging Single vs Batch Scrape Data")
    print("=" * 80)
    
    db = SessionLocal()
    
    # Get all work orders with dispensers
    work_orders = db.query(WorkOrder).all()
    
    single_scrape_issues = []
    batch_scrape_good = []
    
    for wo in work_orders:
        dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
        
        if dispensers:
            # Check first dispenser's fuel_grades
            first_disp = dispensers[0]
            fuel_grades = first_disp.fuel_grades
            
            # Check if fuel_grades contains API error text
            has_api_error = False
            if fuel_grades:
                for key in fuel_grades.keys():
                    if 'api' in key.lower() or 'type' in key.lower() and 'api' in str(fuel_grades[key]).lower():
                        has_api_error = True
                        break
            
            if has_api_error:
                single_scrape_issues.append({
                    'work_order': wo.external_id,
                    'site': wo.site_name,
                    'dispenser_count': len(dispensers),
                    'fuel_grades_sample': fuel_grades
                })
            else:
                batch_scrape_good.append({
                    'work_order': wo.external_id,
                    'site': wo.site_name,
                    'dispenser_count': len(dispensers),
                    'fuel_grades_sample': fuel_grades
                })
    
    print(f"\n📊 Summary:")
    print(f"  - Work orders with API errors: {len(single_scrape_issues)}")
    print(f"  - Work orders with clean data: {len(batch_scrape_good)}")
    
    if single_scrape_issues:
        print(f"\n❌ Work Orders with API Error Text ({len(single_scrape_issues)}):")
        for issue in single_scrape_issues[:3]:  # Show first 3
            print(f"\n  Work Order: {issue['work_order']} ({issue['site']})")
            print(f"  Dispensers: {issue['dispenser_count']}")
            print(f"  Fuel Grades: {json.dumps(issue['fuel_grades_sample'], indent=4)}")
    
    if batch_scrape_good:
        print(f"\n✅ Work Orders with Clean Data ({len(batch_scrape_good)}):")
        for good in batch_scrape_good[:3]:  # Show first 3
            print(f"\n  Work Order: {good['work_order']} ({good['site']})")
            print(f"  Dispensers: {good['dispenser_count']}")
            print(f"  Fuel Grades: {json.dumps(good['fuel_grades_sample'], indent=4)}")
    
    # Check scraped_data too
    print("\n\n🔍 Checking scraped_data field:")
    for wo in work_orders[:5]:  # Check first 5
        if wo.scraped_data and 'dispensers' in wo.scraped_data:
            print(f"\n  Work Order: {wo.external_id}")
            disp_data = wo.scraped_data['dispensers']
            if disp_data:
                first = disp_data[0]
                print(f"  First dispenser fuel_grades: {first.get('fuel_grades', 'N/A')}")
    
    db.close()

if __name__ == "__main__":
    debug_single_scrape()