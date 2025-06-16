#!/usr/bin/env python3
"""
Test script for improved address extraction logic
"""

import re
import asyncio
from typing import Dict, List

class MockElement:
    """Mock element for testing"""
    def __init__(self, cells_data: List[str]):
        self.cells_data = cells_data
        self.full_text = "\n".join(cells_data)
    
    async def query_selector_all(self, selector: str):
        if selector == "td":
            return [MockCell(data) for data in self.cells_data]
        return []
    
    async def text_content(self):
        return self.full_text

class MockCell:
    """Mock table cell"""
    def __init__(self, text: str):
        self.text = text
    
    async def text_content(self):
        return self.text

async def extract_address_components(element) -> Dict[str, str]:
    """Extract address components - improved version"""
    try:
        components = {
            "street": None,
            "intersection": None,
            "cityState": None,
            "county": None
        }
        
        cells = await element.query_selector_all("td")
        
        # Try multiple cell positions as address can be in different locations
        cells_to_check = []
        
        # Prioritize cell 2 (most common location)
        if len(cells) >= 3:
            cells_to_check.append(cells[2])
        
        # Also check adjacent cells (1, 3, 4) as fallbacks
        if len(cells) >= 2:
            cells_to_check.append(cells[1])
        if len(cells) >= 4:
            cells_to_check.append(cells[3])
        if len(cells) >= 5:
            cells_to_check.append(cells[4])
        
        # Also check all remaining cells if needed
        for i, cell in enumerate(cells):
            if cell not in cells_to_check:
                cells_to_check.append(cell)
        
        # Try to find address in each cell
        for cell in cells_to_check:
            cell_text = await cell.text_content()
            
            if cell_text:
                # Quick check if this cell likely contains address info
                address_indicators = [
                    r'\d+\s+\w+',  # Street number pattern
                    r'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy',
                    r',\s*[A-Z]{2}\s*\d{5}',  # State and zip pattern
                    r'#\d+.*,.*[A-Z]{2}',  # Store number with state
                ]
                
                has_address_content = any(re.search(pattern, cell_text, re.IGNORECASE) for pattern in address_indicators)
                
                if has_address_content:
                    lines = [line.strip() for line in cell_text.split('\n') if line.strip()]
                    
                    # Enhanced parsing logic
                    address_lines = []
                    store_number_line = None
                    
                    for line in lines:
                        # Skip customer name (usually first line with company indicators)
                        if any(word in line.lower() for word in ['inc', 'llc', 'corp', 'corporation', 'company', 'stores']) and not any(pattern in line for pattern in ['Street', 'St', 'Ave', 'Rd']):
                            continue
                        
                        # Capture store numbers separately but don't skip them entirely
                        if line.startswith('#') or re.match(r'^Store\s+\d+', line, re.IGNORECASE):
                            store_number_line = line
                            # Sometimes address follows store number on same line
                            store_addr_match = re.search(r'(#\d+|Store\s+\d+)\s*[,-]?\s*(.+)', line, re.IGNORECASE)
                            if store_addr_match and len(store_addr_match.group(2).strip()) > 5:
                                address_lines.append(store_addr_match.group(2).strip())
                            continue
                        
                        # Skip pure numbers or very short lines
                        if re.match(r'^\d+$', line) or len(line) < 5:
                            continue
                        
                        # This is likely an address line
                        address_lines.append(line)
                    
                    if address_lines:
                        # Look for complete address in single line first
                        for line in address_lines:
                            # Check if line contains both street and city/state
                            full_addr_match = re.match(r'(.+?)\s*,\s*([^,]+,\s*[A-Z]{2}\s*\d{5})', line)
                            if full_addr_match:
                                components["street"] = full_addr_match.group(1).strip()
                                components["cityState"] = full_addr_match.group(2).strip()
                                print(f"Found complete address in single line: {line}")
                                return components
                        
                        # Otherwise parse multi-line address
                        # First address line is typically the street
                        components["street"] = address_lines[0]
                        
                        # Look for city, state pattern in remaining lines
                        city_state_pattern = r'^([^,]+),\s*([A-Z]{2})\s*(\d{5})?'
                        
                        for line in address_lines[1:]:
                            city_state_match = re.match(city_state_pattern, line)
                            if city_state_match:
                                components["cityState"] = line
                                break
                            # Check if line contains intersection info
                            elif ('&' in line or 'and' in line.lower()) and any(road in line.lower() for road in ['st', 'street', 'ave', 'road', 'rd']):
                                components["intersection"] = line
                            # Check for county info
                            elif 'county' in line.lower():
                                components["county"] = line
                            # Otherwise might be additional street info or city/state without standard format
                            elif not components["cityState"]:
                                # Check if this might be city/state even without perfect format
                                if re.search(r'[A-Z]{2}\s*\d{5}', line):
                                    components["cityState"] = line
                                else:
                                    # Append to street address
                                    components["street"] = f"{components['street']}, {line}"
                        
                        # If we found address components, we're done
                        if components["street"] or components["cityState"]:
                            print(f"Found address in cell {cells.index(cell)}: Street='{components['street']}', City/State='{components['cityState']}'")
                            break
        
        # Enhanced fallback: try to extract from full text with more patterns
        if not components["street"]:
            text_content = await element.text_content()
            if text_content:
                # Remove excessive whitespace and newlines for better pattern matching
                clean_text = ' '.join(text_content.split())
                
                # Try multiple address extraction patterns
                address_patterns = [
                    # Standard US address with street number
                    r'(\d+\s+[\w\s]+?(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy|Circle|Cir|Court|Ct|Plaza|Place|Pl)\.?)',
                    # Address with PO Box
                    r'(P\.?O\.?\s*Box\s*\d+)',
                    # Highway addresses
                    r'(\d+\s+(?:Highway|Hwy|Route|Rt)\s+\d+[A-Za-z]?)',
                    # Rural route addresses
                    r'((?:RR|Rural Route)\s*\d+\s*Box\s*\d+)',
                    # Addresses starting with building/suite
                    r'((?:Suite|Ste|Building|Bldg)\s*\d+[A-Za-z]?\s*,?\s*\d+\s+[\w\s]+)'
                ]
                
                for pattern in address_patterns:
                    street_match = re.search(pattern, clean_text, re.IGNORECASE)
                    if street_match:
                        components["street"] = street_match.group(1).strip()
                        print(f"Found street address using pattern: {components['street']}")
                        break
                
                # Enhanced city, state, zip patterns
                city_state_patterns = [
                    # Standard format: City, ST 12345
                    r'([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)',
                    # Format without comma: City ST 12345
                    r'([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)',
                    # Just state and zip
                    r'([A-Z]{2})\s*(\d{5}(?:-\d{4})?)'
                ]
                
                for pattern in city_state_patterns:
                    city_state_match = re.search(pattern, clean_text)
                    if city_state_match:
                        if len(city_state_match.groups()) == 3:
                            components["cityState"] = f"{city_state_match.group(1).strip()}, {city_state_match.group(2)} {city_state_match.group(3)}"
                        else:
                            components["cityState"] = city_state_match.group(0).strip()
                        print(f"Found city/state using pattern: {components['cityState']}")
                        break
        
        # Clean up components - remove duplicates and extra whitespace
        for key in components:
            if components[key]:
                # Remove duplicate words and clean up
                components[key] = ' '.join(components[key].split())
                # Remove trailing commas
                components[key] = components[key].rstrip(',').strip()
        
        # Log what we found for debugging
        if components["street"] or components["cityState"]:
            print(f"Address extraction complete: {components}")
        else:
            print("Could not extract address components from any cell")
        
        return components
        
    except Exception as e:
        print(f"Could not extract address components: {e}")
        return {"street": None, "intersection": None, "cityState": None, "county": None}

# Test cases
test_cases = [
    {
        "name": "Standard WorkFossa table - address in cell 2",
        "cells": [
            "",  # Checkbox
            "W-123456",  # Work order ID
            "7-Eleven Stores\n#1234\n123 Main Street\nAnytown, CA 90210",  # Customer info
            "2861 - All Dispensers Test",  # Service
            "Mon, Jul 8"  # Visit date
        ]
    },
    {
        "name": "Address in different cell position",
        "cells": [
            "",  # Checkbox  
            "W-789012",  # Work order ID
            "Wawa Inc",  # Customer name only
            "456 Oak Avenue\nSpringfield, TX 75001\nDallas County",  # Address in cell 3
            "3146 - Open Neck Prover"  # Service
        ]
    },
    {
        "name": "Complete address in single line",
        "cells": [
            "",
            "W-345678",
            "Shell Station #5678, 789 Highway 101, Los Angeles, CA 90025",
            "2862 - Specific Dispensers",
            "Tue, Jul 9"
        ]
    },
    {
        "name": "Address with intersection",
        "cells": [
            "",
            "W-567890",
            "Circle K\n#9012\n1000 Market St\n& Broadway\nSan Francisco, CA 94102",
            "3002 - All Dispensers Test",
            "Wed, Jul 10"
        ]
    },
    {
        "name": "Highway address",
        "cells": [
            "",
            "W-234567",
            "Marathon\nStore 3456\n2500 Highway 50\nSacramento, CA 95814",
            "2861",
            "Thu, Jul 11"
        ]
    },
    {
        "name": "PO Box address",
        "cells": [
            "",
            "W-876543",
            "BP Corporation\nP.O. Box 1234\nHouston, TX 77001",
            "Testing",
            "Fri, Jul 12"
        ]
    },
    {
        "name": "Address spread across cells",
        "cells": [
            "",
            "W-111222\nExxonMobil",  # ID and name in cell 1
            "#4567",  # Store number in cell 2
            "3000 Pine Street",  # Street in cell 3
            "Philadelphia, PA 19104"  # City/State in cell 4
        ]
    }
]

async def main():
    print("Testing improved address extraction logic")
    print("=" * 60)
    
    for i, test_case in enumerate(test_cases):
        print(f"\nTest Case {i+1}: {test_case['name']}")
        print("-" * 60)
        
        # Create mock element
        element = MockElement(test_case['cells'])
        
        # Extract address
        result = await extract_address_components(element)
        
        # Format address
        parts = []
        if result.get("street"):
            parts.append(result["street"])
        if result.get("intersection"):
            parts.append(result["intersection"])
        if result.get("cityState"):
            parts.append(result["cityState"])
        if result.get("county"):
            parts.append(result["county"])
        
        formatted_address = ", ".join(parts) if parts else "Address not available"
        
        print(f"\nExtracted Components:")
        print(f"  Street: {result.get('street', 'None')}")
        print(f"  Intersection: {result.get('intersection', 'None')}")
        print(f"  City/State: {result.get('cityState', 'None')}")
        print(f"  County: {result.get('county', 'None')}")
        print(f"\nFormatted Address: {formatted_address}")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())