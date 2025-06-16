#!/usr/bin/env python3
"""
Test script for address parsing improvements in WorkFossa scraper
"""

import asyncio
import re
from typing import Dict

def test_format_address_components(components: Dict[str, str]) -> str:
    """Test implementation of the improved _format_address method"""
    parts = []
    
    # Add street address if available
    if components.get("street"):
        parts.append(components["street"])
    
    # Add intersection if available and no street
    if components.get("intersection") and not components.get("street"):
        parts.append(f"Near {components['intersection']}")
    elif components.get("intersection"):
        parts.append(f"({components['intersection']})")
    
    # Always include city/state if available
    if components.get("cityState"):
        parts.append(components["cityState"])
    
    # Add county if available
    if components.get("county"):
        parts.append(components["county"])
    
    # If we only have city/state, that's still useful information
    if parts:
        return ", ".join(parts)
    else:
        return "Address not available"

def test_extract_address_patterns():
    """Test address extraction patterns"""
    test_cases = [
        # Standard addresses
        {
            "input": "7-Eleven #32847\n1234 Main Street\nTampa, FL 33619",
            "expected_street": "1234 Main Street",
            "expected_cityState": "Tampa, FL 33619"
        },
        # Address without street number
        {
            "input": "Wawa Store #8021\nTampa, FL 33619",
            "expected_street": None,
            "expected_cityState": "Tampa, FL 33619"
        },
        # Single line address after store info
        {
            "input": "#32847, 1234 Main Street, Tampa, FL 33619",
            "expected_street": "1234 Main Street",
            "expected_cityState": "Tampa, FL 33619"
        },
        # Address with intersection
        {
            "input": "Shell Station #1234\nNear Main St & Elm Ave\nTampa, FL 33619",
            "expected_street": None,
            "expected_intersection": "Near Main St & Elm Ave",
            "expected_cityState": "Tampa, FL 33619"
        },
        # Highway address
        {
            "input": "Gas Station\n12345 Highway 301 N\nTampa, FL 33619",
            "expected_street": "12345 Highway 301 N",
            "expected_cityState": "Tampa, FL 33619"
        }
    ]
    
    print("🧪 Testing Address Extraction Patterns...")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 Test Case {i}:")
        print(f"Input: {repr(test_case['input'])}")
        
        # Simulate the parsing logic
        components = {"street": None, "intersection": None, "cityState": None, "county": None}
        
        # Split input into lines
        lines = [line.strip() for line in test_case['input'].split('\n') if line.strip()]
        
        # Remove store number lines and company names
        address_lines = []
        for line in lines:
            # Skip lines that are just store numbers or brand names
            if (line.startswith('#') or 
                re.match(r'^Store\s+\d+', line, re.IGNORECASE) or
                re.match(r'^(7-Eleven|Wawa|Shell|BP|Exxon|Marathon|Circle K|Costco)', line, re.IGNORECASE) or
                re.match(r'.*Station\s*(#\d+)?$', line, re.IGNORECASE)):
                continue
            address_lines.append(line)
        
        if address_lines:
            # Check for complete address in single line
            full_addr_match = re.match(r'(.+?)\s*,\s*([^,]+,\s*[A-Z]{2}\s*\d{5})', address_lines[0])
            if full_addr_match:
                components["street"] = full_addr_match.group(1).strip()
                components["cityState"] = full_addr_match.group(2).strip()
            else:
                # Multi-line parsing
                # Check if first line is city/state format
                city_state_pattern = r'^([^,]+),\s*([A-Z]{2})\s*(\d{5})?'
                if address_lines and re.match(city_state_pattern, address_lines[0]):
                    components["cityState"] = address_lines[0]
                else:
                    components["street"] = address_lines[0] if address_lines else None
                
                # Look for city/state pattern in remaining lines
                for line in address_lines[1:]:
                    if re.match(city_state_pattern, line):
                        components["cityState"] = line
                        break
                    elif ('&' in line or 'and' in line.lower()) and any(road in line.lower() for road in ['st', 'street', 'ave', 'road', 'rd']):
                        components["intersection"] = line
                
                # Check if street actually looks like intersection
                if components["street"] and ('&' in components["street"] or 'near' in components["street"].lower()):
                    components["intersection"] = components["street"]
                    components["street"] = None
        
        # Handle single line with store info
        if not components["street"] and not components["cityState"]:
            full_text = ' '.join(lines)
            after_store_match = re.search(r'#\d+[,\s]+(.+)', full_text)
            if after_store_match:
                potential_address = after_store_match.group(1).strip()
                parts = [p.strip() for p in potential_address.split(',')]
                if len(parts) >= 2:
                    components["street"] = parts[0]
                    components["cityState"] = ', '.join(parts[1:]).strip()
        
        formatted = test_format_address_components(components)
        
        print(f"Parsed Components:")
        print(f"  Street: {components['street']}")
        print(f"  Intersection: {components['intersection']}")
        print(f"  City/State: {components['cityState']}")
        print(f"  County: {components['county']}")
        print(f"Formatted Address: {formatted}")
        
        # Check expectations
        passed = True
        if "expected_street" in test_case:
            if components["street"] != test_case["expected_street"]:
                print(f"❌ Street mismatch: expected {test_case['expected_street']}, got {components['street']}")
                passed = False
        if "expected_cityState" in test_case:
            if components["cityState"] != test_case["expected_cityState"]:
                print(f"❌ City/State mismatch: expected {test_case['expected_cityState']}, got {components['cityState']}")
                passed = False
        if "expected_intersection" in test_case:
            if components["intersection"] != test_case["expected_intersection"]:
                print(f"❌ Intersection mismatch: expected {test_case['expected_intersection']}, got {components['intersection']}")
                passed = False
        
        if passed:
            print("✅ Test passed!")
        else:
            print("❌ Test failed!")

def test_frontend_address_formatting():
    """Test frontend address formatting improvements"""
    print("\n\n🎨 Testing Frontend Address Formatting...")
    print("=" * 50)
    
    test_addresses = [
        "7-Eleven Store #32847, 1234 Main Street, Tampa, FL 33619",
        "Tampa, FL 33619",  # City/state only
        "1234 Main Street\nTampa, FL 33619",  # Multi-line
        "",  # Empty
        "Near Main St & Elm Ave, Tampa, FL 33619",  # Intersection
    ]
    
    def format_address_frontend(address: str) -> str:
        """Frontend formatting logic"""
        if not address or address.strip() == '':
            return 'Address not available'
        
        # Split by newlines first, then by commas for better parsing
        lines = [line.strip() for line in address.split('\n') if line.strip()]
        
        # If no newlines, try splitting by commas
        if len(lines) == 1:
            lines = [line.strip() for line in address.split(',') if line.strip()]
        
        address_parts = []
        
        for line in lines:
            # Skip empty lines
            if not line.strip():
                continue
            
            # Skip lines that are just store numbers or brand names (but only if we have other address info)
            if re.match(r'^(Store|Site|#\d+|.*Stores?$)', line, re.IGNORECASE) and len(address_parts) > 0:
                continue
            
            # Skip pure zip codes if we have other parts
            if re.match(r'^\d{5}(-\d{4})?$', line) and len(address_parts) > 0:
                continue
            
            address_parts.append(line)
        
        # If we have multiple parts, join with commas
        if len(address_parts) > 1:
            return ', '.join(address_parts)
        
        # Single part - just return it cleaned up
        return re.sub(r'\n\s*', ', ', address).strip()
    
    for i, addr in enumerate(test_addresses, 1):
        print(f"\n📝 Frontend Test {i}:")
        print(f"Input: {repr(addr)}")
        formatted = format_address_frontend(addr)
        print(f"Formatted: {formatted}")
        
        # Show how it would appear with line breaks
        if formatted != 'Address not available':
            parts = formatted.split(', ')
            if len(parts) > 1:
                print("Display with line breaks:")
                for j, part in enumerate(parts):
                    indent = "  "
                    style = "font-medium" if j == 0 else ""
                    print(f"{indent}{part} {f'({style})' if style else ''}")

if __name__ == "__main__":
    print("🔍 Address Parsing Improvement Tests")
    print("=" * 60)
    
    test_extract_address_patterns()
    test_frontend_address_formatting()
    
    print("\n\n✨ All tests completed!")
    print("The improvements should handle:")
    print("• Addresses where street info is missing")
    print("• Addresses mixed with store numbers")
    print("• Single-line addresses with multiple components")
    print("• City/State only addresses")
    print("• Better frontend display with line breaks")