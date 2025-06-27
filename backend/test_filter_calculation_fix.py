#!/usr/bin/env python3
"""
Test script to verify the filter calculation data format fix.
This script tests the actual work order 129651 scenario.
"""

import sys
import sqlite3
import json
from datetime import datetime

sys.path.append('.')

from app.services.filter_calculator import FilterCalculator

def get_actual_work_order_data():
    """Get actual work order and dispenser data from database."""
    conn = sqlite3.connect('fossawork_v2.db')
    cursor = conn.cursor()
    
    # Get work order 129651
    cursor.execute('SELECT * FROM work_orders WHERE external_id = ?', ('129651',))
    work_order_row = cursor.fetchone()
    
    if not work_order_row:
        print("ERROR: Work order 129651 not found in database")
        return None, None
    
    # Map row to dict (this mimics what the API would do)
    work_order = {
        'jobId': work_order_row[2],  # external_id
        'storeNumber': work_order_row[10] or '38437',  # store_number 
        'serviceCode': work_order_row[11] or '2861',  # service_code
        'customerName': work_order_row[3],  # site_name as customer
        'scheduledDate': work_order_row[5] if work_order_row[5] else datetime.now().isoformat(),
        'serviceName': work_order_row[18],  # service_name
        'instructions': work_order_row[15]  # instructions
    }
    
    # Get dispensers for this work order
    cursor.execute('''
        SELECT dispenser_number, fuel_grades, meter_type, make, model 
        FROM dispensers 
        WHERE work_order_id = ?
    ''', (work_order_row[0],))
    
    dispenser_rows = cursor.fetchall()
    dispensers = []
    
    for dispenser_row in dispenser_rows:
        dispenser = {
            'dispenserNumber': dispenser_row[0],
            'fuelGrades': json.loads(dispenser_row[1]) if dispenser_row[1] else {},
            'meterType': dispenser_row[2] or 'Electronic',
            'make': dispenser_row[3],
            'model': dispenser_row[4],
            'storeNumber': work_order['storeNumber']
        }
        dispensers.append(dispenser)
    
    conn.close()
    return work_order, dispensers

def test_filter_calculation_fix():
    """Test the complete filter calculation process with real data."""
    print("=" * 80)
    print("FILTER CALCULATION DATA FORMAT FIX TEST")
    print("=" * 80)
    print()
    
    # Get real data
    work_order, dispensers = get_actual_work_order_data()
    if not work_order:
        return
    
    print(f"Work Order: {work_order['jobId']}")
    print(f"Store Number: {work_order['storeNumber']}")
    print(f"Service Code: {work_order['serviceCode']}")
    print(f"Customer: {work_order['customerName']}")
    print(f"Dispensers Found: {len(dispensers)}")
    print()
    
    # Show dispenser data format issues
    print("DISPENSER DATA ANALYSIS:")
    print("-" * 40)
    for i, dispenser in enumerate(dispensers, 1):
        print(f"Dispenser {i}: {dispenser['dispenserNumber']}")
        print(f"  Fuel Grades Type: {type(dispenser['fuelGrades'])}")
        print(f"  Fuel Grades Raw: {dispenser['fuelGrades']}")
        print(f"  Meter Type: {dispenser['meterType']}")
        print()
    
    # Test transformation on each dispenser
    print("TRANSFORMATION TESTS:")
    print("-" * 40)
    calculator = FilterCalculator()
    
    total_transformed_grades = 0
    for i, dispenser in enumerate(dispensers, 1):
        fuel_grades_raw = dispenser['fuelGrades']
        transformed = calculator._transform_fuel_grades(fuel_grades_raw)
        
        print(f"Dispenser {i} ({dispenser['dispenserNumber']}):")
        print(f"  Before: {fuel_grades_raw}")
        print(f"  After:  {transformed}")
        print(f"  Success: {len(transformed) > 0}")
        total_transformed_grades += len(transformed)
        print()
    
    print(f"Total fuel grades after transformation: {total_transformed_grades}")
    print()
    
    # Test full filter calculation
    print("FULL FILTER CALCULATION TEST:")
    print("-" * 40)
    
    try:
        result = calculator.calculate_filters(
            work_orders=[work_order],
            dispensers=dispensers,
            overrides={}
        )
        
        print("✅ Filter calculation completed successfully!")
        print(f"Total filters calculated: {result['totalFilters']}")
        print(f"Total boxes needed: {result['totalBoxes']}")
        print(f"Filter types found: {len(result['summary'])}")
        print()
        
        if result['summary']:
            print("FILTER SUMMARY:")
            for item in result['summary']:
                print(f"  {item['partNumber']}: {item['quantity']} filters ({item['boxes']} boxes)")
        
        if result['warnings']:
            print(f"\nWARNINGS ({len(result['warnings'])}):")
            for warning in result['warnings']:
                print(f"  {warning['severity']}/10: {warning['message']}")
        
        print()
        print("DETAILED RESULTS:")
        for detail in result['details']:
            print(f"  Job {detail['jobId']}: {detail['dispenserCount']} dispensers, {len(detail['filters'])} filter types")
            for part_num, filter_info in detail['filters'].items():
                print(f"    {part_num}: {filter_info['quantity']} filters")
    
    except Exception as e:
        print(f"❌ Filter calculation failed: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    print("=" * 80)
    print("TEST COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    test_filter_calculation_fix()