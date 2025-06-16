#!/usr/bin/env python3
"""
Debug where non-fuel items are being added to grades_list
"""
import asyncio
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

async def debug_grades():
    """Debug grades population"""
    print("🔍 Debugging Grades Population")
    print("=" * 70)
    
    # Simulate the JavaScript output from dispenser_scraper
    mock_js_output = {
        'success': True,
        'dispensers': [{
            'title': 'Dispenser 1/2',
            'serial_number': 'ABC123',
            'make': 'Gilbarco',
            'model': 'Encore',
            'fields': {
                'GRADE': '0126 0135 0136',
                'STAND_ALONE_CODE': 'XYZ789',
                'NUMBER_OF_NOZZLES': '6',
                'METER_TYPE': 'HD Meter'
            },
            'dispenser_number': '1/2',
            'dispenser_numbers': ['1', '2'],
            'stand_alone_code': 'XYZ789',
            'number_of_nozzles': '6',
            'meter_type': 'HD Meter',
            'fuel_grades': {},
            'custom_fields': {
                'GRADE': '0126 0135 0136',
                'STAND_ALONE_CODE': 'XYZ789', 
                'NUMBER_OF_NOZZLES': '6',
                'METER_TYPE': 'HD Meter'
            }
        }]
    }
    
    print("Mock JavaScript output:")
    print(json.dumps(mock_js_output['dispensers'][0], indent=2))
    
    # Import the actual processing logic
    from app.services.dispenser_scraper import DispenserScraper
    scraper = DispenserScraper()
    
    # Process the mock data
    raw = mock_js_output['dispensers'][0]
    
    # This is what happens in _extract_dispensers_simple
    fuel_grades = scraper._parse_fuel_grades(raw.get('fields', {}))
    print(f"\n1. Parsed fuel_grades: {fuel_grades}")
    
    grades_list = scraper._extract_grades_from_title(raw.get('title', ''))
    print(f"\n2. Extracted from title: {grades_list}")
    
    # Check if grades would be decoded
    if not grades_list and raw.get('fields', {}).get('GRADE'):
        try:
            from app.data.fuel_grade_codes import decode_fuel_grade_string
            decoded_grades = decode_fuel_grade_string(raw['fields']['GRADE'])
            print(f"\n3. Decoded from GRADE field: {decoded_grades}")
            grades_list = decoded_grades
        except:
            print("\n3. Could not decode GRADE field")
    
    print(f"\n4. Final grades_list: {grades_list}")
    
    # Check what would be stored
    form_data = {
        "stand_alone_code": raw.get("stand_alone_code"),
        "grades_list": grades_list,
        "title": raw.get("title"),
        "dispenser_numbers": raw.get("dispenser_numbers", []),
        "custom_fields": raw.get("custom_fields", {})
    }
    
    print(f"\n5. form_data that would be stored:")
    print(json.dumps(form_data, indent=2))
    
    # Now check if somewhere the custom_fields values are being shown
    print("\n⚠️  Analysis:")
    print("If the UI is showing 'Stand Alone Code', 'Number of Nozzles', etc.,")
    print("then something is extracting the KEYS from custom_fields and displaying them.")
    print("\nPossible issues:")
    print("1. Frontend is iterating over custom_fields keys instead of grades_list")
    print("2. Something is transforming field keys (STAND_ALONE_CODE -> Stand Alone Code)")
    print("3. The API is returning wrong data")

if __name__ == "__main__":
    asyncio.run(debug_grades())