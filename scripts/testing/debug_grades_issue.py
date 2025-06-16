#!/usr/bin/env python3
"""
Debug why non-fuel items are appearing in grades_list
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

def debug_grades():
    """Debug the grades issue"""
    
    # Simulate what the JavaScript is sending
    raw_dispenser = {
        'title': 'Dispenser 1',
        'serial_number': '12345',
        'make': 'Gilbarco',
        'model': 'Encore',
        'fields': {
            'GRADE': '0126 0135 0136',
            'STAND_ALONE_CODE': 'ABC123',
            'NUMBER_OF_NOZZLES': '6',
            'METER_TYPE': 'HD Meter'
        },
        'dispenser_number': '1',
        'dispenser_numbers': ['1'],
        'custom_fields': {
            'GRADE': '0126 0135 0136',
            'STAND_ALONE_CODE': 'ABC123',
            'NUMBER_OF_NOZZLES': '6',
            'METER_TYPE': 'HD Meter'
        }
    }
    
    print("🔍 Debugging Grades Issue")
    print("=" * 70)
    print("\nRaw dispenser data from JavaScript:")
    print(json.dumps(raw_dispenser, indent=2))
    
    # Simulate what happens in dispenser_scraper.py
    from app.services.dispenser_scraper import DispenserScraper
    scraper = DispenserScraper()
    
    # Parse fuel grades
    fuel_grades = scraper._parse_fuel_grades(raw_dispenser.get('fields', {}))
    print(f"\nParsed fuel_grades: {fuel_grades}")
    
    # Extract grades from title
    grades_list = scraper._extract_grades_from_title(raw_dispenser.get('title', ''))
    print(f"\nExtracted grades_list from title: {grades_list}")
    
    # Check if GRADE field would be decoded
    if not grades_list and raw_dispenser.get('fields', {}).get('GRADE'):
        try:
            from app.data.fuel_grade_codes import decode_fuel_grade_string
            decoded_grades = decode_fuel_grade_string(raw_dispenser['fields']['GRADE'])
            print(f"\nDecoded grades from GRADE field: {decoded_grades}")
            grades_list = decoded_grades
        except ImportError:
            print("\n❌ Could not import fuel grade decoder")
    
    print(f"\nFinal grades_list: {grades_list}")
    
    # What would be stored in form_data
    form_data = {
        "stand_alone_code": raw_dispenser.get("stand_alone_code"),
        "grades_list": grades_list,
        "title": raw_dispenser.get("title"),
        "dispenser_numbers": raw_dispenser.get("dispenser_numbers", []),
        "custom_fields": raw_dispenser.get("custom_fields", {})
    }
    
    print(f"\nform_data that would be stored:")
    print(json.dumps(form_data, indent=2))
    
    # Check if custom_fields values are being shown as grades
    print("\n⚠️  Problem Analysis:")
    print("The issue is that when grades_list is empty, the frontend might be")
    print("showing ALL values from custom_fields as fuel grades.")
    print("\nCustom fields values:")
    for key, value in raw_dispenser.get('custom_fields', {}).items():
        print(f"  {key}: {value}")

if __name__ == "__main__":
    debug_grades()