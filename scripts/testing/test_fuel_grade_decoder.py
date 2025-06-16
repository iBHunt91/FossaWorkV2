#!/usr/bin/env python3
"""
Test the fuel grade code decoder
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.data.fuel_grade_codes import decode_fuel_grade_code, decode_fuel_grade_string

def test_decoder():
    """Test fuel grade decoder with various inputs"""
    print("🧪 Testing Fuel Grade Code Decoder")
    print("=" * 50)
    
    # Test individual codes
    test_codes = [
        "0126",
        "0135",
        "0136",
        "0128",
        "0118",
        "87",
        "89",
        "91",
        "REG",
        "PREM",
        "DSL",
        "9999"  # Unknown code
    ]
    
    print("\n📋 Individual Code Tests:")
    for code in test_codes:
        decoded = decode_fuel_grade_code(code)
        print(f"  {code:10} -> {decoded}")
    
    # Test grade strings (as they appear in GRADE field)
    test_strings = [
        "0126 0135 0136",
        "0128 0136 0126",
        "0118",
        "REG PLUS PREM",
        "87 89 91",
        "0126,0135,0136",
        "0118 0119",
        ""  # Empty string
    ]
    
    print("\n📋 Grade String Tests:")
    for grade_string in test_strings:
        decoded = decode_fuel_grade_string(grade_string)
        print(f"  '{grade_string}' -> {decoded}")
    
    # Test what we saw in the screenshot
    print("\n📋 Real Example from Screenshot:")
    screenshot_example = "0126 0135 0136"
    decoded = decode_fuel_grade_string(screenshot_example)
    print(f"  '{screenshot_example}' -> {decoded}")
    print(f"  Expected: ['Regular', 'Plus', 'Premium'] or similar")

if __name__ == "__main__":
    test_decoder()