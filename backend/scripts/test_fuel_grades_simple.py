#!/usr/bin/env python3
"""
Test the fuel_grades conversion logic
"""

def convert_fuel_grades_to_list(fuel_grades):
    """Convert fuel_grades dict to list of grade names for frontend display"""
    if not fuel_grades or not isinstance(fuel_grades, dict):
        return []
    
    # Extract grade names from the dict format
    grade_names = []
    for key, value in fuel_grades.items():
        # Skip API error keys
        if 'api' in key.lower() or 'error' in key.lower():
            continue
        
        # Get the name from the value if it's a dict, otherwise use the key
        if isinstance(value, dict) and 'name' in value:
            grade_names.append(value['name'])
        elif isinstance(value, str):
            grade_names.append(value)
        else:
            # Capitalize and clean the key as the grade name
            clean_name = key.replace('_', ' ').title()
            grade_names.append(clean_name)
    
    return grade_names

# Example data from the screenshot
example_data = {
    "work order Type API:": "error text",
    "regular": {"name": "Regular"},
    "plus": {"name": "Plus"}, 
    "diesel": {"name": "Diesel"}
}

print("Testing fuel grades conversion...")
print("Input:", example_data)
result = convert_fuel_grades_to_list(example_data)
print("Output:", result)
print("Expected: ['Regular', 'Plus', 'Diesel']")
print("✅ SUCCESS!" if result == ['Regular', 'Plus', 'Diesel'] else "❌ FAILED")