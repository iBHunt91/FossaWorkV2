#!/usr/bin/env python3
"""
Test script to verify comprehensive filter calculation logging.
This script simulates filter calculation requests to verify all logging is working properly.
"""

import sys
import os
import logging
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Set up logging to see our debug messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_filter_calculation_logging():
    """Test filter calculation with sample data to verify logging."""
    
    print("🔍 Testing Filter Calculation Logging")
    print("=" * 50)
    
    # Import services
    from app.services.filter_calculator import FilterCalculator
    
    # Sample work order data
    work_orders = [
        {
            "jobId": "12345",
            "storeNumber": "1234",
            "serviceCode": "2861",
            "customerName": "7-Eleven Stores, Inc",
            "scheduledDate": "2025-01-15T10:00:00Z"
        },
        {
            "jobId": "12346", 
            "storeNumber": "1235",
            "serviceCode": "2862",
            "customerName": "Speedway LLC",
            "scheduledDate": "2025-01-16T10:00:00Z",
            "instructions": "Dispensers 1-3"
        }
    ]
    
    # Sample dispenser data
    dispensers = [
        {
            "storeNumber": "1234",
            "dispenserNumber": "1",
            "meterType": "Electronic", 
            "fuelGrades": [
                {"grade": "Regular"},
                {"grade": "Diesel"},
                {"grade": "Premium"}
            ]
        },
        {
            "storeNumber": "1234",
            "dispenserNumber": "2",
            "meterType": "Electronic",
            "fuelGrades": [
                {"grade": "Regular"},
                {"grade": "Diesel"}
            ]
        },
        {
            "storeNumber": "1235",
            "dispenserNumber": "1", 
            "meterType": "Ecometer",
            "fuelGrades": [
                {"grade": "Regular"},
                {"grade": "Diesel"},
                {"grade": "DEF"}
            ]
        }
    ]
    
    print("📝 Sample Data:")
    print(f"  Work Orders: {len(work_orders)}")
    print(f"  Dispensers: {len(dispensers)}")
    print()
    
    print("🚀 Starting Filter Calculation...")
    print("-" * 30)
    
    try:
        # Create calculator and run calculation
        calculator = FilterCalculator()
        
        result = calculator.calculate_filters(
            work_orders=work_orders,
            dispensers=dispensers,
            overrides=None
        )
        
        print("✅ Filter Calculation Completed Successfully!")
        print(f"📊 Results:")
        print(f"  Summary Items: {len(result.get('summary', []))}")
        print(f"  Detail Items: {len(result.get('details', []))}")
        print(f"  Warnings: {len(result.get('warnings', []))}")
        print(f"  Total Filters: {result.get('totalFilters', 0)}")
        print(f"  Total Boxes: {result.get('totalBoxes', 0)}")
        
        # Print summary details
        if result.get('summary'):
            print("\n🔧 Filter Summary:")
            for item in result['summary']:
                print(f"  - {item['partNumber']}: {item['quantity']} units ({item['boxes']} boxes)")
        
        # Print warnings if any
        if result.get('warnings'):
            print("\n⚠️  Warnings:")
            for warning in result['warnings']:
                print(f"  - {warning.get('message')} (severity: {warning.get('severity')})")
        
        print("\n🎯 Check the console output above for detailed logging messages with [FILTER_CALC_SERVICE] prefix")
        
    except Exception as e:
        print(f"❌ Filter Calculation Failed: {e}")
        import traceback
        traceback.print_exc()

def test_missing_data_scenarios():
    """Test scenarios with missing data to verify logging."""
    
    print("\n🔍 Testing Missing Data Scenarios")
    print("=" * 50)
    
    from app.services.filter_calculator import FilterCalculator
    
    print("📝 Test 1: No work orders")
    calculator = FilterCalculator()
    result = calculator.calculate_filters(
        work_orders=[],
        dispensers=[],
        overrides=None
    )
    print(f"  Result: {len(result.get('summary', []))} items, {len(result.get('warnings', []))} warnings")
    
    print("\n📝 Test 2: Work orders but no dispensers")
    work_orders = [
        {
            "jobId": "99999",
            "storeNumber": "9999", 
            "serviceCode": "2861",
            "customerName": "Test Store",
            "scheduledDate": "2025-01-15T10:00:00Z"
        }
    ]
    
    result = calculator.calculate_filters(
        work_orders=work_orders,
        dispensers=[],
        overrides=None
    )
    print(f"  Result: {len(result.get('summary', []))} items, {len(result.get('warnings', []))} warnings")
    
    print("\n📝 Test 3: Invalid work order data")
    invalid_work_orders = [
        {
            "jobId": "invalid",
            # Missing required fields
        }
    ]
    
    result = calculator.calculate_filters(
        work_orders=invalid_work_orders,
        dispensers=[],
        overrides=None
    )
    print(f"  Result: {len(result.get('summary', []))} items, {len(result.get('warnings', []))} warnings")

if __name__ == "__main__":
    print("🧪 Filter Calculation Logging Test")
    print("=" * 60)
    print()
    
    test_filter_calculation_logging()
    test_missing_data_scenarios()
    
    print("\n✅ Logging Test Complete!")
    print("Check the console output for detailed logging messages.")
    print("All log messages should include prefixes like [FILTER_CALC_SERVICE] for easy identification.")