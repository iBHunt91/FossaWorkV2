#!/usr/bin/env python3
"""
Fix the grade extraction regex to only extract fuel grades
"""
import re

def test_grade_extraction():
    """Test the current regex pattern with sample data"""
    
    # Sample text that might be causing the issue
    sample_text = """
Dispenser 1/2
S/N: ABC123
Make: Gilbarco
Model: Encore 700
Grade
Stand Alone Code
0126
Number of Nozzles (per side)
0135
0136
HD Meter
STAND ALONE CODE
ABC123
METER TYPE
HD Meter
"""
    
    print("🔍 Testing Grade Extraction Regex")
    print("=" * 70)
    print("Sample text:")
    print(sample_text)
    print("=" * 70)
    
    # Current regex pattern from line 1220
    current_pattern = r'Grade\s*\n((?:[^\n]+\n?)+?)(?=(?:STAND|METER|Electronic|NUMBER|$))'
    
    print("\n📊 Current Regex Pattern:")
    print(f"Pattern: {current_pattern}")
    
    match = re.search(current_pattern, sample_text, re.IGNORECASE | re.MULTILINE)
    if match:
        grade_text = match.group(1).strip()
        fuel_list = [f.strip() for f in grade_text.split('\n') if f.strip()]
        print(f"\nExtracted text: '{grade_text}'")
        print(f"Fuel list: {fuel_list}")
        print("\n❌ BUG CONFIRMED: Extracting field labels and values!")
    else:
        print("\nNo match found")
    
    # Better regex patterns to test
    print("\n" + "="*70)
    print("🔧 TESTING IMPROVED PATTERNS")
    print("="*70)
    
    # Pattern 1: Only extract lines that look like fuel codes or fuel names
    pattern1 = r'Grade\s*\n((?:(?:\d{4}|Regular|Plus|Premium|Super|Diesel|Ethanol[^\n]*)\s*\n?)+)'
    print("\n📋 Pattern 1: Match only fuel codes or known fuel names")
    print(f"Pattern: {pattern1}")
    
    match1 = re.search(pattern1, sample_text, re.IGNORECASE | re.MULTILINE)
    if match1:
        grade_text = match1.group(1).strip()
        fuel_list = [f.strip() for f in grade_text.split('\n') if f.strip()]
        print(f"Extracted: {fuel_list}")
    else:
        print("No match")
    
    # Pattern 2: Extract only 4-digit codes after Grade
    pattern2 = r'Grade\s*\n((?:\d{4}\s*\n?)+)'
    print("\n📋 Pattern 2: Match only 4-digit fuel codes")
    print(f"Pattern: {pattern2}")
    
    match2 = re.search(pattern2, sample_text, re.IGNORECASE | re.MULTILINE)
    if match2:
        grade_text = match2.group(1).strip()
        fuel_list = [f.strip() for f in grade_text.split() if f.strip()]
        print(f"Extracted: {fuel_list}")
    else:
        print("No match")
    
    # Pattern 3: Look for Grade field value in custom field format
    # This matches the actual structure from the scraper
    sample_custom_field = """
GRADE
0126 0135 0136
STAND ALONE CODE
ABC123
"""
    
    print("\n📋 Pattern 3: Custom field format (GRADE followed by value on next line)")
    pattern3 = r'GRADE\s*\n\s*([^\n]+?)(?:\n|$)'
    print(f"Pattern: {pattern3}")
    
    match3 = re.search(pattern3, sample_custom_field, re.IGNORECASE)
    if match3:
        grade_value = match3.group(1).strip()
        print(f"Extracted GRADE value: '{grade_value}'")
        # These would then be decoded using decode_fuel_grade_string
    else:
        print("No match")
    
    print("\n" + "="*70)
    print("💡 RECOMMENDATION")
    print("="*70)
    print("The bug is in the regex pattern at line 1220 of dispenser_scraper.py")
    print("It's capturing ALL text between 'Grade' and the next field keyword.")
    print("\nThe fix is to use a more specific pattern that:")
    print("1. Only captures lines with 4-digit fuel codes")
    print("2. Or use the custom field extraction that's already in the old method")
    print("3. Decode the fuel codes to proper names")

if __name__ == "__main__":
    test_grade_extraction()