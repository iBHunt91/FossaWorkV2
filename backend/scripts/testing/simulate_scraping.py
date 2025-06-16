#!/usr/bin/env python3
"""
Simulate the scraping process to find where the bug happens
"""
import re

def simulate_bug():
    """Simulate where the bug might be happening"""
    print("🔍 Simulating Scraping Bug")
    print("=" * 70)
    
    # This is what might be on the WorkFossa page
    html_text = """
    Stand Alone Code
    ABC123
    GRADE
    0126 0135 0136
    Number of Nozzles (per side)
    6
    METER TYPE
    HD Meter
    """
    
    # If someone is extracting text and putting it into an array
    lines = [line.strip() for line in html_text.strip().split('\n') if line.strip()]
    
    print("If extracting all lines:")
    for i, line in enumerate(lines):
        print(f"  [{i}] {line}")
    
    # The pattern in the screenshot suggests alternating labels and values
    # But only SOME are included
    
    # What if there's code that's doing this:
    grades_list = []
    
    # Add field labels (but only some?)
    grades_list.append("Stand Alone Code")  # Label
    
    # Split and add GRADE values
    grade_value = "0126 0135 0136"
    grades_list.extend(grade_value.split())  # Individual codes
    
    # Add more labels
    grades_list.insert(2, "Number of Nozzles (per side)")  # Label
    
    # Add some values
    grades_list.append("HD Meter")  # Value
    
    print(f"\nResulting grades_list: {grades_list}")
    print("\nThis matches the screenshot pattern!")
    
    # The actual order from screenshot:
    screenshot_order = [
        "Stand Alone Code",      # Field label
        "0126",                  # First grade code
        "Number of Nozzles (per side)",  # Field label
        "0135",                  # Second grade code
        "0136",                  # Third grade code
        "HD Meter"               # Meter type value
    ]
    
    print(f"\nScreenshot order: {screenshot_order}")
    
    print("\n💡 The bug seems to be:")
    print("1. Field labels are being added to grades_list")
    print("2. GRADE value is being split and individual codes added")
    print("3. They're being interleaved in a specific order")
    print("4. This suggests the HTML might have labels and values interleaved")

if __name__ == "__main__":
    simulate_bug()