#!/usr/bin/env python3
"""Test model extraction from dispenser HTML"""

# Sample HTML text from a dispenser
sample_text = """1/2 - Regular, Plus, Diesel, Ethanol-Free Gasoline Plus, Super - Gilbarco
S/N: EN00037196
MAKE: Gilbarco
MODEL: NL3
GRADE
Regular, Plus, Diesel, Ethanol-Free Gasoline Plus, Super"""

import re

# Test the regex patterns
make_match = re.search(r'MAKE:\s*([A-Za-z0-9\s]+?)(?=\n|MODEL:|$)', sample_text)
model_match = re.search(r'MODEL:\s*([A-Za-z0-9\s]+?)(?=\n|GRADE|$)', sample_text)

print("Sample text:")
print(sample_text)
print("\n" + "="*50 + "\n")

if make_match:
    print(f"Make found: '{make_match.group(1).strip()}'")
else:
    print("Make not found")

if model_match:
    print(f"Model found: '{model_match.group(1).strip()}'")
else:
    print("Model not found")

# Test JavaScript regex equivalent
print("\n" + "="*50)
print("JavaScript regex patterns:")
print("Make: /MAKE:\\s*([A-Za-z0-9\\s]+?)(?=\\n|MODEL:|$)/")
print("Model: /MODEL:\\s*([A-Za-z0-9\\s]+?)(?=\\n|GRADE|$)/")