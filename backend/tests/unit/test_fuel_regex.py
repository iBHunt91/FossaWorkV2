#!/usr/bin/env python3
"""
Test the fuel grade extraction regex to ensure it captures all grades correctly
"""

import re

# Test data that mimics the actual format from WorkFossa
test_text = """1/2 - Regular, Plus, Premium, Super, Ethanol-Free Gasoline Plus - Gilbarco
S/N: 1CB223020893
MAKE: Gilbarco
MODEL: NL2
Grade
Regular
Plus
Premium
Super
Ethanol-Free Gasoline Plus
STAND ALONE CODE
0128
METER TYPE
Electronic
NUMBER OF NOZZLES PER SIDE
2"""

print("🧪 Testing Fuel Grade Regex Extraction")
print("=" * 80)
print("Test data:")
print(test_text)
print("\n" + "=" * 80)

# Test the Grade field extraction (from dispenser_scraper.py line 1116)
grade_match = re.search(r'Grade\s*\n((?:[^\n]+\n?)+?)(?=(?:STAND|METER|Electronic|NUMBER|$))', test_text, re.IGNORECASE | re.MULTILINE)
if grade_match:
    grade_text = grade_match.group(1).strip()
    fuel_list = [f.strip() for f in grade_text.split('\n') if f.strip()]
    print(f"\n✅ Successfully extracted fuel grades:")
    for i, fuel in enumerate(fuel_list, 1):
        print(f"  {i}. {fuel}")
    
    # Create fuel grades dict (from dispenser_scraper.py lines 1129-1134)
    fuel_grades = {}
    for fuel in fuel_list:
        fuel_key = fuel.lower().replace(' ', '_').replace('-', '_')
        fuel_grades[fuel_key] = {'name': fuel}
    
    print(f"\n📊 Fuel grades dictionary (no hardcoded octane values):")
    for key, value in fuel_grades.items():
        print(f"  {key}: {value}")
    
    # Check for specific grades
    print(f"\n🔍 Checking for specific grades:")
    print(f"  Super: {'✅ Found' if 'super' in fuel_grades else '❌ Missing'}")
    print(f"  Ethanol-Free Gasoline Plus: {'✅ Found' if 'ethanol_free_gasoline_plus' in fuel_grades else '❌ Missing'}")
    
else:
    print("❌ Failed to extract fuel grades with regex")

# Test alternate format with comma-separated grades
print("\n\n" + "=" * 80)
print("Testing comma-separated format from title:")
title_grades = "Regular, Plus, Premium, Super, Ethanol-Free Gasoline Plus"
fuel_list = [f.strip() for f in title_grades.split(',')]
print(f"✅ Extracted from title: {fuel_list}")

# Show what the old code would have done (with octane)
print("\n⚠️  OLD CODE (with hardcoded octane) would have created:")
old_fuel_grades = {}
for fuel in fuel_list:
    fuel_lower = fuel.lower()
    fuel_key = fuel_lower.replace(' ', '_').replace('-', '_')
    
    if 'regular' in fuel_lower:
        old_fuel_grades['regular'] = {'octane': 87, 'name': fuel}
    elif 'plus' in fuel_lower and 'ethanol' not in fuel_lower:
        old_fuel_grades['plus'] = {'octane': 89, 'name': fuel}
    elif 'premium' in fuel_lower:
        old_fuel_grades['premium'] = {'octane': 91, 'name': fuel}
    elif 'super' in fuel_lower:
        old_fuel_grades['super'] = {'octane': 93, 'name': fuel}
    else:
        old_fuel_grades[fuel_key] = {'octane': None, 'name': fuel}

for key, value in old_fuel_grades.items():
    print(f"  {key}: {value}")

print("\n✅ The new code correctly only stores what's scraped, no hardcoded octane values!")