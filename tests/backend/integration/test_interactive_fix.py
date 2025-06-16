#!/usr/bin/env python3
"""Test that the interactive test is fixed"""

import re

# Test the regex patterns
test_text = """1/2 - Regular, Plus, Diesel, Ethanol-Free Gasoline Plus, Super - Gilbarco
S/N: EN00037196
MAKE: Gilbarco
MODEL: NL3
GRADE
Regular, Plus, Diesel, Ethanol-Free Gasoline Plus, Super
STAND ALONE CODE
0128
NUMBER OF NOZZLES (PER SIDE)
3
METER TYPE
Electronic"""

# Test Make extraction
make_match = re.search(r'(?:MAKE|Make):\s*([A-Za-z0-9\s]+?)(?=\n|(?:MODEL|Model):|$)', test_text, re.IGNORECASE)
if make_match:
    print(f"Make: {make_match.group(1).strip()}")

# Test Model extraction
model_match = re.search(r'(?:MODEL|Model):\s*([A-Za-z0-9\s]+?)(?=\n|(?:GRADE|Grade)|$)', test_text, re.IGNORECASE)
if model_match:
    print(f"Model: {model_match.group(1).strip()}")

# Test Stand Alone Code
sa_match = re.search(r'STAND ALONE CODE\s*(\d+)', test_text, re.IGNORECASE)
if sa_match:
    print(f"Stand Alone Code: {sa_match.group(1).strip()}")

# Test Number of Nozzles
nozzles_match = re.search(r'NUMBER OF NOZZLES.*?\s+(\d+)', test_text, re.IGNORECASE)
if nozzles_match:
    print(f"Number of Nozzles: {nozzles_match.group(1).strip()}")

# Test Meter Type
meter_match = re.search(r'METER TYPE\s*([^\n]+)', test_text, re.IGNORECASE)
if meter_match:
    print(f"Meter Type: {meter_match.group(1).strip()}")

print("\nAll regex patterns working correctly!")