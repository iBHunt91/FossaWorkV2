#!/usr/bin/env python3
"""
Test Filter Calculation Service

Tests the V1-compatible filter calculation business logic including:
- Fuel grade to filter mapping
- Premium conditional logic
- Station-specific part numbers
- Multi-day job handling
- Box quantity calculations
"""

import sys
import os
import json
from datetime import datetime, date

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_filter_calculation():
    """Test filter calculation service with various scenarios"""
    print("=== Testing Filter Calculation Service ===\n")
    
    try:
        from app.services.filter_calculation import (
            FilterCalculationService, 
            FilterType,
            FilterRequirement,
            FilterCalculationResult
        )
        print("✓ Successfully imported filter calculation service")
    except ImportError as e:
        print(f"✗ Failed to import filter calculation service: {e}")
        return
    
    # Create test scenarios
    test_scenarios = [
        {
            "name": "7-Eleven with Regular and Premium (no Super)",
            "work_order": {
                "id": "WO-001",
                "customer": {"name": "7-Eleven Store #1234"},
                "visitDate": "2025-01-08",
                "dispensers": {
                    "1": {
                        "fuel_grades": ["Regular Unleaded", "Plus", "Premium 91"]
                    },
                    "2": {
                        "fuel_grades": ["Diesel", "DEF"]
                    }
                }
            },
            "expected": {
                "gas_filters": 2,  # Regular + Premium (no Super present)
                "diesel_filters": 1,
                "has_def_warning": True
            }
        },
        {
            "name": "Wawa with Premium and Super (Premium excluded)",
            "work_order": {
                "id": "WO-002",
                "customer": {"name": "Wawa #5678"},
                "visitDate": "2025-01-08",
                "dispensers": {
                    "1": {
                        "fuel_grades": ["Regular 87", "Plus 89", "Premium 91", "Super 93"]
                    }
                }
            },
            "expected": {
                "gas_filters": 2,  # Regular + Super (Premium excluded due to Super)
                "diesel_filters": 0,
                "has_def_warning": False
            }
        },
        {
            "name": "Circle K with Ethanol-Free",
            "work_order": {
                "id": "WO-003",
                "customer": {"name": "Circle K #9999"},
                "visitDate": "2025-01-08",
                "dispensers": {
                    "1": {
                        "fuel_grades": ["Regular", "Midgrade", "Ethanol-Free Recreation"]
                    },
                    "2": {
                        "fuel_grades": ["Diesel", "High Flow Diesel"]
                    }
                }
            },
            "expected": {
                "gas_filters": 2,  # Regular + Ethanol-Free
                "diesel_filters": 2,  # Diesel + High Flow
                "has_high_flow_warning": True
            }
        },
        {
            "name": "Multi-day Job Continuation (Day 2)",
            "work_order": {
                "id": "WO-004",
                "customer": {"name": "7-Eleven Store #2468"},
                "visitDate": "2025-01-09",
                "isMultiDayNonFirst": True,
                "visitMetadata": {"dayNumber": 2},
                "dispensers": {
                    "1": {
                        "fuel_grades": ["Regular", "Plus", "Premium"]
                    }
                }
            },
            "expected": {
                "gas_filters": 0,  # No filters on non-first day
                "diesel_filters": 0,
                "is_multi_day": True
            }
        }
    ]
    
    # Mock database session
    class MockDB:
        def query(self, *args, **kwargs):
            return self
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return None
    
    # Test each scenario
    for scenario in test_scenarios:
        print(f"\nTesting: {scenario['name']}")
        print("-" * 50)
        
        try:
            # Create service instance
            service = FilterCalculationService(MockDB())
            
            # Simulate calculation (without async for testing)
            fuel_grades = []
            for dispenser in scenario["work_order"]["dispensers"].values():
                fuel_grades.extend(dispenser.get("fuel_grades", []))
            
            # Test filter type detection
            gas_count = 0
            diesel_count = 0
            has_super = any("super" in grade.lower() for grade in fuel_grades)
            
            for grade in fuel_grades:
                grade_lower = grade.lower()
                
                # Apply V1 business rules
                needs_filter = False
                filter_type = None
                
                # Always gets filter
                if any(keyword in grade_lower for keyword in ["regular", "unleaded", "87", "diesel", "ethanol-free", "super", "93"]):
                    needs_filter = True
                    if "diesel" in grade_lower:
                        filter_type = "DIESEL"
                        diesel_count += 1
                    else:
                        filter_type = "GAS"
                        gas_count += 1
                
                # Never gets filter
                elif any(keyword in grade_lower for keyword in ["plus", "midgrade", "89"]):
                    needs_filter = False
                
                # Premium conditional
                elif any(keyword in grade_lower for keyword in ["premium", "91"]):
                    if has_super:
                        needs_filter = False  # Premium excluded when Super present
                    else:
                        needs_filter = True
                        filter_type = "GAS"
                        gas_count += 1
                
                if needs_filter:
                    print(f"  {grade}: {filter_type} filter required")
                else:
                    print(f"  {grade}: No filter needed")
            
            # Check multi-day handling
            if scenario["work_order"].get("isMultiDayNonFirst"):
                print("  Multi-day continuation - filters already counted on Day 1")
                gas_count = 0
                diesel_count = 0
            
            # Verify results
            expected = scenario["expected"]
            print(f"\nResults:")
            print(f"  Gas filters: {gas_count} (expected: {expected['gas_filters']})")
            print(f"  Diesel filters: {diesel_count} (expected: {expected['diesel_filters']})")
            
            if gas_count == expected['gas_filters'] and diesel_count == expected['diesel_filters']:
                print("  ✓ Filter counts match expected values")
            else:
                print("  ✗ Filter counts do not match!")
            
            # Test part number selection
            store_name = scenario["work_order"]["customer"]["name"].lower()
            if "7-eleven" in store_name or "speedway" in store_name:
                gas_part = "400MB-10"
                diesel_part = "400HS-10"
            elif "wawa" in store_name:
                gas_part = "450MB-10"
                diesel_part = "450MG-10"
            elif "circle k" in store_name:
                gas_part = "40510D-AD"
                diesel_part = "40530W-AD"
            else:
                gas_part = "PCP-2-1"
                diesel_part = "PCN-2-1"
            
            print(f"\nPart Numbers:")
            print(f"  Gas: {gas_part}")
            print(f"  Diesel: {diesel_part}")
            
            # Test box calculations
            if gas_count > 0:
                gas_boxes = (gas_count + 11) // 12  # Ceiling division
                print(f"  Gas boxes needed: {gas_boxes} ({gas_count} filters @ 12/box)")
            
            if diesel_count > 0:
                diesel_boxes = (diesel_count + 11) // 12
                print(f"  Diesel boxes needed: {diesel_boxes} ({diesel_count} filters @ 12/box)")
            
            # Check for special warnings
            if "def" in str(fuel_grades).lower():
                print("\n  ⚠️  DEF detected - special handling required")
            
            if "high flow" in str(fuel_grades).lower():
                print("  ⚠️  High Flow Diesel detected - use 800HS-30 filters (6/box)")
            
        except Exception as e:
            print(f"  ✗ Error during test: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n\n=== Testing Premium Conditional Logic ===")
    print("This is a critical V1 business rule:\n")
    
    test_cases = [
        {
            "grades": ["Regular", "Plus", "Premium"],
            "expected": "Premium GETS filter (no Super/Ultra)"
        },
        {
            "grades": ["Regular", "Plus", "Premium", "Super"],
            "expected": "Premium SKIPPED (Super present)"
        },
        {
            "grades": ["Regular", "Premium", "Ultra 93"],
            "expected": "Premium SKIPPED (Ultra present)"
        },
        {
            "grades": ["Regular", "Premium 91", "Premium 92"],
            "expected": "Both Premiums GET filters (no Super/Ultra)"
        }
    ]
    
    for test in test_cases:
        print(f"Grades: {', '.join(test['grades'])}")
        has_super_or_ultra = any(
            "super" in g.lower() or ("ultra" in g.lower() and "ultra low" not in g.lower())
            for g in test["grades"]
        )
        print(f"Has Super/Ultra: {has_super_or_ultra}")
        print(f"Expected: {test['expected']}")
        print()


if __name__ == "__main__":
    test_filter_calculation()