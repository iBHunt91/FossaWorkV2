"""
Fuel grade validation utilities
"""
from typing import List, Dict, Any

# Known fuel grade names
VALID_FUEL_GRADES = {
    'regular', 'plus', 'premium', 'super', 'diesel', 'def', 
    'e85', 'e15', 'ethanol', 'unleaded', 'midgrade', 'mid',
    'ethanol-free', 'ethanol free', 'race fuel', 'racing fuel',
    'aviation', 'avgas', 'jet fuel', 'kerosene', 'biodiesel',
    'cng', 'lng', 'propane', 'hydrogen'
}

# Known non-fuel field names and values
NON_FUEL_KEYWORDS = {
    'stand alone', 'standalone', 'code', 'nozzle', 'nozzles',
    'meter', 'type', 'number of', 'per side', 'serial',
    'make', 'model', 'manufacturer', 'hd meter', 'mechanical',
    'electronic', 'digital', 'analog', 'standard', 'high flow'
}

def is_valid_fuel_grade(grade: str) -> bool:
    """Check if a string is a valid fuel grade"""
    if not isinstance(grade, str):
        return False
    
    grade_lower = grade.lower().strip()
    
    # Check if it's a known fuel grade
    for valid_grade in VALID_FUEL_GRADES:
        if valid_grade in grade_lower:
            return True
    
    # Check if it contains non-fuel keywords
    for keyword in NON_FUEL_KEYWORDS:
        if keyword in grade_lower:
            return False
    
    # Check if it's a 4-digit code (fuel grade code)
    if grade.isdigit() and len(grade) == 4:
        return True
    
    # If it's a single word that could be a fuel type
    if len(grade_lower.split()) == 1 and grade_lower.isalpha():
        # Could be a fuel grade we don't know about
        return True
    
    return False

def clean_grades_list(grades: List[str]) -> List[str]:
    """Clean a grades list to only include valid fuel grades"""
    if not grades:
        return []
    
    cleaned = []
    for grade in grades:
        if is_valid_fuel_grade(grade):
            cleaned.append(grade)
    
    return cleaned

def extract_fuel_grades_from_custom_fields(custom_fields: Dict[str, Any]) -> List[str]:
    """Extract only fuel grades from custom fields"""
    grades = []
    
    # Look for GRADE field specifically
    if custom_fields.get('GRADE'):
        grade_value = str(custom_fields['GRADE'])
        # Try to decode if it has fuel grade codes
        try:
            from app.data.fuel_grade_codes import decode_fuel_grade_string
            decoded = decode_fuel_grade_string(grade_value)
            if decoded:
                grades.extend(decoded)
        except:
            # If we can't decode, try to parse as text
            if ' ' in grade_value:
                # Space-separated codes or names
                parts = grade_value.split()
                for part in parts:
                    if is_valid_fuel_grade(part):
                        grades.append(part)
    
    return grades