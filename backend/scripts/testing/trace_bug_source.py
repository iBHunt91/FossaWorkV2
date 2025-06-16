#!/usr/bin/env python3
"""
Trace where the bug is coming from
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

def trace_bug():
    """Trace the bug source"""
    print("🔍 Tracing Bug Source")
    print("=" * 70)
    
    # The bug pattern from the screenshot
    bug_pattern = [
        "Stand Alone Code",      # Transformed field label
        "0126",                  # First fuel grade code
        "Number of Nozzles (per side)",  # Transformed field label
        "0135",                  # Second fuel grade code
        "0136",                  # Third fuel grade code
        "HD Meter"               # Meter type value
    ]
    
    print("Bug pattern from screenshot:")
    for i, item in enumerate(bug_pattern):
        print(f"  [{i}] {item}")
    
    print("\n💡 Analysis:")
    print("1. 'Stand Alone Code' is STAND_ALONE_CODE transformed")
    print("2. '0126', '0135', '0136' are from GRADE field '0126 0135 0136' split")
    print("3. 'Number of Nozzles (per side)' is a transformed label")
    print("4. 'HD Meter' is the value of METER_TYPE field")
    
    print("\n🐛 The bug seems to be:")
    print("- Something is extracting ALL text from the dispenser container")
    print("- Field labels are being transformed (underscore to space, title case)")
    print("- The GRADE value is being split into individual codes")
    print("- Everything is being put into grades_list")
    
    print("\n🔍 Possible locations:")
    print("1. JavaScript extraction in dispenser_scraper.py")
    print("2. Python processing in dispenser_scraper.py")
    print("3. WorkFossa scraper if it's pre-processing dispenser data")
    print("4. Some other extraction logic that's reading the page differently")
    
    # Check if the pattern matches what would happen if someone did:
    # 1. Extract all text lines from container
    # 2. Transform field names
    # 3. Split GRADE values
    # 4. Interleave them somehow
    
    print("\n📝 The specific order suggests:")
    print("The HTML might have this structure:")
    print("  <div>Stand Alone Code</div>")
    print("  <div>ABC123</div>")
    print("  <div>GRADE</div>")
    print("  <div>0126 0135 0136</div>")
    print("  <div>Number of Nozzles (per side)</div>")
    print("  <div>6</div>")
    print("  <div>METER TYPE</div>")
    print("  <div>HD Meter</div>")
    print("\nAnd something is extracting and processing this incorrectly")

if __name__ == "__main__":
    trace_bug()