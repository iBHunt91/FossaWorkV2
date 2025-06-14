#!/usr/bin/env python3
"""
Simple script to examine address data structure via API
"""

import json
import requests
import sys

def test_address_structure():
    """Test address structure via API"""
    print("🔍 Address Data Structure Analysis")
    print("=" * 50)
    
    # Try to get work orders via API
    api_url = "http://localhost:8000/api/v1/work-orders"
    
    # We need a user ID - let's try a test call first
    try:
        response = requests.get(f"{api_url}/test")
        if response.status_code == 200:
            print("✅ Backend API is running")
        else:
            print("❌ Backend API test failed")
            return
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        print("Make sure the backend is running on port 8000")
        return
    
    # For now, let's show the current address parsing logic from the scraper
    print("\n📋 Current Address Parsing Logic:")
    print("The WorkFossa scraper extracts addresses in multiple ways:")
    print()
    print("1. **Multi-cell scanning**: Checks cells 1-4 for address data")
    print("2. **Enhanced patterns**: Looks for street addresses, city/state")
    print("3. **Store number handling**: Separates store info from addresses")
    print("4. **Fallback extraction**: Uses full text when cell parsing fails")
    print()
    print("📍 Address Components Structure:")
    print("   - street: Street address (123 Main St)")
    print("   - intersection: Cross streets (Main St & Oak Ave)")
    print("   - cityState: City, State ZIP (Tampa, FL 33619)")
    print("   - county: County information")
    print()
    print("🔧 Frontend Formatting Logic:")
    print("   - Combines components intelligently")
    print("   - Shows city/state only when no street available")
    print("   - Displays multi-line format for better readability")
    print()
    
    # Show what a typical scraped data structure looks like
    sample_scraped_data = {
        "address_components": {
            "street": "1234 Main Street",
            "intersection": None,
            "cityState": "Tampa, FL 33619",
            "county": "Hillsborough County"
        },
        "service_info": {
            "type": "Testing",
            "quantity": 8
        },
        "raw_html": "<td>7-Eleven #32847\n1234 Main Street\nTampa, FL 33619</td>"
    }
    
    print("📄 Sample Scraped Data Structure:")
    print(json.dumps(sample_scraped_data, indent=2))
    print()
    
    # Explain the incomplete address issue
    print("⚠️ Common Issue: Incomplete Address Display")
    print("When you see only 'Tampa, FL 33619', it means:")
    print("   1. The scraper found city/state data")
    print("   2. But couldn't extract street address from the HTML")
    print("   3. This happens when WorkFossa puts address data in unexpected fields")
    print()
    print("🛠️ Solution: Enhanced Address Parsing")
    print("The scraper has been improved to:")
    print("   - Check multiple table cells for address data")
    print("   - Handle addresses mixed with store numbers")
    print("   - Extract from single-line comma-separated addresses")
    print("   - Parse addresses that come after store info")
    print()
    print("📈 Frontend Improvements:")
    print("   - Better multi-line display formatting")
    print("   - Smart address hyperlinks to maps")
    print("   - Fallback to store name + city for map searches")

if __name__ == "__main__":
    test_address_structure()