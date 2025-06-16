"""
Fuel grade code mappings for WorkFossa dispensers
"""

# Common fuel grade codes to names
FUEL_GRADE_CODES = {
    # Regular grades
    "0126": "Regular",
    "0127": "Regular", 
    "87": "Regular",
    
    # Plus/Mid-grade
    "0135": "Plus",
    "89": "Plus",
    "88": "Plus",
    
    # Premium/Super
    "0136": "Premium",  # Changed from Plus to Premium based on common patterns
    "0128": "Super",
    "0129": "Premium",
    "91": "Premium",
    "93": "Super",
    
    # Diesel
    "0118": "Diesel",
    "0119": "Diesel",
    "0120": "Diesel",
    
    # Ethanol blends
    "0140": "Ethanol-Free Gasoline Plus",
    "0141": "E85",
    "0142": "E15",
    
    # DEF
    "0150": "DEF",
    
    # Alternative names
    "REG": "Regular",
    "MID": "Plus", 
    "PREM": "Premium",
    "DSL": "Diesel",
    "DIEF": "Diesel",
    "E85": "E85",
    "E15": "E15",
    "DEF": "DEF"
}

def decode_fuel_grade_code(code: str) -> str:
    """
    Convert a fuel grade code to a human-readable name.
    
    Args:
        code: The fuel grade code (e.g., "0126", "87", "REG")
        
    Returns:
        The human-readable fuel grade name, or the original code if not found
    """
    # Clean the code
    clean_code = code.strip().upper()
    
    # Check if it's a known code
    if clean_code in FUEL_GRADE_CODES:
        return FUEL_GRADE_CODES[clean_code]
    
    # Check without leading zeros
    if clean_code.startswith("0") and len(clean_code) > 1:
        without_zero = clean_code.lstrip("0")
        if without_zero in FUEL_GRADE_CODES:
            return FUEL_GRADE_CODES[without_zero]
    
    # If it contains a number that looks like octane rating
    if clean_code.isdigit() and 85 <= int(clean_code) <= 93:
        octane = int(clean_code)
        if octane <= 87:
            return "Regular"
        elif octane <= 89:
            return "Plus"
        else:
            return "Premium"
    
    # Return original if no match found
    return code

def decode_fuel_grade_string(grade_string: str) -> list[str]:
    """
    Decode a string containing multiple fuel grade codes.
    
    Args:
        grade_string: String containing grade codes (e.g., "0126 0135 0136")
        
    Returns:
        List of human-readable fuel grade names
    """
    if not grade_string:
        return []
    
    # Split by various delimiters
    import re
    codes = re.split(r'[\s,;|]+', grade_string.strip())
    
    # Decode each code
    grades = []
    for code in codes:
        if code:
            decoded = decode_fuel_grade_code(code)
            if decoded and decoded not in grades:  # Avoid duplicates
                grades.append(decoded)
    
    return grades