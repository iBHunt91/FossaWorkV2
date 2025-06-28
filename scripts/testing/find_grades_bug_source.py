#!/usr/bin/env python3
"""
Find where the grades_list is getting contaminated with non-fuel items
"""
import sys
import os
import json
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from app.services.browser_automation import browser_automation
from app.services.dispenser_scraper import DispenserScraper

async def find_bug_source():
    """Find where grades_list gets contaminated"""
    db = SessionLocal()
    
    try:
        print("🔍 Finding Grades Bug Source")
        print("=" * 70)
        
        # Get a work order with contaminated grades
        dispensers = db.query(Dispenser).all()
        contaminated = None
        
        for d in dispensers:
            if d.form_data and d.form_data.get('grades_list'):
                grades_list = d.form_data['grades_list']
                for grade in grades_list:
                    if isinstance(grade, str) and any(x in grade.lower() for x in ['stand alone', 'nozzle', 'meter']):
                        contaminated = d
                        break
            if contaminated:
                break
        
        if not contaminated:
            print("✅ No contaminated dispensers found!")
            return
        
        print(f"\n🐛 Found contaminated dispenser: {contaminated.dispenser_number}")
        print(f"   Work Order ID: {contaminated.work_order_id}")
        print(f"   Grades List: {contaminated.form_data.get('grades_list')}")
        
        # Get the work order
        work_order = db.query(WorkOrder).filter(WorkOrder.id == contaminated.work_order_id).first()
        if not work_order:
            print("❌ Work order not found")
            return
        
        print(f"\n📋 Work Order: {work_order.external_id}")
        print(f"   Customer URL: {work_order.customer_url}")
        
        # Check scraped_data
        if work_order.scraped_data and 'dispensers' in work_order.scraped_data:
            print(f"\n📊 Checking scraped_data dispensers:")
            for scraped_disp in work_order.scraped_data['dispensers']:
                if str(scraped_disp.get('dispenser_number')) == str(contaminated.dispenser_number):
                    print(f"   Found matching dispenser in scraped_data")
                    print(f"   Scraped grades_list: {scraped_disp.get('grades_list')}")
                    
                    # Check if contamination is already in scraped_data
                    scraped_grades = scraped_disp.get('grades_list', [])
                    has_contamination = False
                    for grade in scraped_grades:
                        if isinstance(grade, str) and any(x in grade.lower() for x in ['stand alone', 'nozzle', 'meter']):
                            has_contamination = True
                            break
                    
                    if has_contamination:
                        print("   ❌ Contamination is ALREADY in scraped_data!")
                        print("   This means the bug is in the scraping process itself")
                        
                        # Check custom_fields
                        custom_fields = scraped_disp.get('custom_fields', {})
                        print(f"\n   Custom fields: {custom_fields}")
                        
                        # The bug might be here - if all custom field names are being added to grades_list
                        field_names = list(custom_fields.keys())
                        field_values = list(custom_fields.values())
                        
                        print(f"\n   Field names: {field_names}")
                        print(f"   Field values: {field_values}")
                        
                        # Transform field names like the bug does
                        transformed_names = []
                        for name in field_names:
                            transformed = name.replace('_', ' ').title()
                            transformed_names.append(transformed)
                        
                        print(f"\n   Transformed field names: {transformed_names}")
                        
                        # Check if these match what's in grades_list
                        matches = []
                        for grade in scraped_grades:
                            if grade in transformed_names:
                                matches.append(f"'{grade}' is a transformed field name!")
                            elif grade in field_values:
                                matches.append(f"'{grade}' is a field value!")
                        
                        if matches:
                            print("\n   🎯 FOUND THE BUG PATTERN:")
                            for match in matches:
                                print(f"      - {match}")
                            
                            print("\n   💡 The bug is likely in the JavaScript extraction code")
                            print("      that's putting ALL text from the dispenser container")
                            print("      into some array that becomes grades_list")
                    else:
                        print("   ✅ No contamination in scraped_data")
                        print("   The contamination happens AFTER scraping")
        
        # Now let's trace through the exact scraping process
        print("\n" + "="*70)
        print("🔬 TRACING THE SCRAPING PROCESS")
        print("="*70)
        
        # We need to check the JavaScript code that extracts dispensers
        print("\nThe JavaScript extraction code at line 873 calls:")
        print("  grades_list = self._extract_grades_from_title(raw.get('title', ''))")
        print("\nThis extracts from the title, which should be clean.")
        print("\nBut the contamination pattern suggests something else is happening.")
        print("\nLet's check if the JavaScript is returning contaminated data...")
        
        # The bug pattern from the user's screenshot shows:
        # ["Stand Alone Code", "0126", "Number of Nozzles (per side)", "0135", "0136", "HD Meter"]
        # This looks like it's extracting ALL lines from the dispenser container
        # and transforming field names
        
        print("\n🎯 BUG HYPOTHESIS:")
        print("The JavaScript code might be extracting ALL text lines from the dispenser")
        print("container and putting them into an array, which then becomes grades_list.")
        print("\nThe pattern suggests:")
        print("1. Field labels are being transformed (STAND_ALONE_CODE -> 'Stand Alone Code')")
        print("2. The GRADE field value '0126 0135 0136' is being split into individual codes")
        print("3. Field values like 'HD Meter' are being included")
        print("\nThis would happen if the JavaScript is doing something like:")
        print("  container.textContent.split('\\n') or similar")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(find_bug_source())