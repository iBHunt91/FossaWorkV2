#!/usr/bin/env python3
"""
Test the fuel_grades conversion function
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routes.work_orders import convert_fuel_grades_to_list

# Test cases
test_cases = [
    # Case 1: Normal fuel grades
    {
        "input": {
            "regular": {"name": "Regular"},
            "plus": {"name": "Plus"},
            "premium": {"name": "Premium"}
        },
        "expected": ["Regular", "Plus", "Premium"]
    },
    # Case 2: Fuel grades with API error text
    {
        "input": {
            "work order Type API:": "error text",
            "regular": {"name": "Regular"},
            "diesel": {"name": "Diesel"}
        },
        "expected": ["Regular", "Diesel"]
    },
    # Case 3: Simple string values
    {
        "input": {
            "Regular": "87",
            "Plus": "89",
            "Premium": "93"
        },
        "expected": ["87", "89", "93"]
    },
    # Case 4: Keys only (no name property)
    {
        "input": {
            "regular": {},
            "plus": {},
            "diesel": {}
        },
        "expected": ["Regular", "Plus", "Diesel"]
    },
    # Case 5: Mixed format
    {
        "input": {
            "regular": {"name": "Regular 87"},
            "diesel": "Diesel",
            "e85": {},
            "def": {"name": "DEF"}
        },
        "expected": ["Regular 87", "Diesel", "E85", "DEF"]
    }
]

print("Testing fuel_grades conversion function...")
print("=" * 60)

for i, test in enumerate(test_cases):
    print(f"\nTest Case {i+1}:")
    print(f"Input: {test['input']}")
    result = convert_fuel_grades_to_list(test['input'])
    print(f"Output: {result}")
    print(f"Expected: {test['expected']}")
    print(f"✅ PASS" if result == test['expected'] else f"❌ FAIL")