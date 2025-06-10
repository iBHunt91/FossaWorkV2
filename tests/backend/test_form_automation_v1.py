#!/usr/bin/env python3
"""
Test V1-Compatible Form Automation Service

Comprehensive test suite to verify V1 business logic preservation
including service code detection, fuel classification, and strategy analysis.
"""

import asyncio
from datetime import datetime
from app.services.form_automation_v1 import FormAutomationV1Service, ServiceCode, AutomationTemplate
from app.database import get_db

# Test data matching V1 patterns
TEST_WORK_ORDERS = [
    {
        "name": "Standard Meter Calibration - Wawa",
        "data": {
            "id": "W-123456",
            "customer": {
                "name": "Wawa #001",
                "storeNumber": "7001",
                "address": "123 Main St, Philadelphia, PA 19103"
            },
            "services": [
                {
                    "type": "Meter Calibration",
                    "description": "Standard meter calibration for all dispensers",
                    "quantity": 4
                }
            ]
        },
        "expected": {
            "service_code": ServiceCode.STANDARD_METER_CALIBRATION,
            "dispenser_count": 4,
            "automation_template": AutomationTemplate.METERED_5_ITERATION
        }
    },
    {
        "name": "Specific Dispensers - Circle K",
        "data": {
            "id": "W-123457",
            "customer": {
                "name": "Circle K #002",
                "storeNumber": "8001",
                "address": "456 Oak Ave, Camden, NJ 08101"
            },
            "services": [
                {
                    "type": "Dispenser Service",
                    "description": "Calibrate dispensers 1, 3, and 5 only",
                    "quantity": 0  # Should parse from description
                }
            ]
        },
        "expected": {
            "service_code": ServiceCode.SPECIFIC_DISPENSERS,
            "dispenser_count": 3,  # Parsed from "1, 3, and 5"
            "automation_template": AutomationTemplate.METERED_5_ITERATION
        }
    },
    {
        "name": "Quantity-Based - Speedway",
        "data": {
            "id": "W-123458",
            "customer": {
                "name": "Speedway #003",
                "storeNumber": "9001",
                "address": "789 Pine St, Wilmington, DE 19801"
            },
            "services": [
                {
                    "type": "Service Request",
                    "description": "6 dispensers need calibration",
                    "quantity": 6
                }
            ]
        },
        "expected": {
            "service_code": ServiceCode.QUANTITY_BASED,
            "dispenser_count": 6,
            "automation_template": AutomationTemplate.METERED_5_ITERATION
        }
    },
    {
        "name": "Open Neck Prover - Shell",
        "data": {
            "id": "W-123459",
            "customer": {
                "name": "Shell #004",
                "storeNumber": "5001",
                "address": "321 Elm St, Baltimore, MD 21201"
            },
            "services": [
                {
                    "type": "Open Neck Prover",
                    "description": "Open neck prover calibration required",
                    "quantity": 2
                }
            ]
        },
        "expected": {
            "service_code": ServiceCode.OPEN_NECK_PROVER,
            "dispenser_count": 2,
            "automation_template": AutomationTemplate.OPEN_NECK_PROVER
        }
    }
]

# Fuel grade test data
FUEL_GRADE_TESTS = [
    {
        "name": "Standard Wawa Configuration",
        "fuel_grades": {
            1: ["regular", "plus", "premium", "diesel"],
            2: ["regular", "plus", "premium", "diesel"],
            3: ["regular", "plus", "premium", "diesel"],
            4: ["regular", "plus", "premium", "diesel"]
        },
        "expected_metered": {
            1: ["regular", "premium", "diesel"],  # plus is never metered
            2: ["regular", "premium", "diesel"],
            3: ["regular", "premium", "diesel"],
            4: ["regular", "premium", "diesel"]
        },
        "expected_non_metered": {
            1: ["plus"],
            2: ["plus"],
            3: ["plus"],
            4: ["plus"]
        }
    },
    {
        "name": "Circle K with Ethanol-Free",
        "fuel_grades": {
            1: ["regular", "plus", "premium", "diesel", "ethanol-free"],
            2: ["regular", "plus", "premium", "diesel", "ethanol-free"]
        },
        "expected_metered": {
            1: ["regular", "premium", "diesel", "ethanol-free"],
            2: ["regular", "premium", "diesel", "ethanol-free"]
        },
        "expected_non_metered": {
            1: ["plus"],
            2: ["plus"]
        }
    },
    {
        "name": "Speedway with Special 88",
        "fuel_grades": {
            1: ["regular", "special 88", "plus", "premium", "diesel"],
            2: ["regular", "special 88", "plus", "premium", "diesel"]
        },
        "expected_metered": {
            1: ["regular", "premium", "diesel"],
            2: ["regular", "premium", "diesel"]
        },
        "expected_non_metered": {
            1: ["special 88", "plus"],
            2: ["special 88", "plus"]
        }
    },
    {
        "name": "Premium with Super Variants (Special Case)",
        "fuel_grades": {
            1: ["regular", "plus", "premium", "super premium", "diesel"]
        },
        "expected_metered": {
            1: ["regular", "super premium", "diesel"]  # Premium becomes non-metered
        },
        "expected_non_metered": {
            1: ["plus", "premium"]  # Premium is non-metered when Super exists
        }
    }
]

class MockDB:
    """Mock database session for testing"""
    pass

async def test_service_code_detection():
    """Test service code detection algorithm"""
    print("🧪 Testing Service Code Detection")
    print("=" * 50)
    
    service = FormAutomationV1Service(MockDB())
    
    all_passed = True
    
    for test_case in TEST_WORK_ORDERS:
        try:
            print(f"\n📋 Testing: {test_case['name']}")
            
            # Test service code detection
            services = test_case['data']['services']
            detected_code = await service._detect_service_code(services)
            expected_code = test_case['expected']['service_code']
            
            # Test dispenser count extraction
            dispenser_count = await service._extract_dispenser_count(services, detected_code)
            expected_count = test_case['expected']['dispenser_count']
            
            # Verify results
            code_correct = detected_code == expected_code
            count_correct = dispenser_count == expected_count
            
            print(f"  Service Code: {detected_code.value} {'✓' if code_correct else '✗'}")
            print(f"  Expected: {expected_code.value}")
            print(f"  Dispenser Count: {dispenser_count} {'✓' if count_correct else '✗'}")
            print(f"  Expected: {expected_count}")
            
            if not (code_correct and count_correct):
                all_passed = False
                print(f"  ❌ FAILED")
            else:
                print(f"  ✅ PASSED")
                
        except Exception as e:
            print(f"  ❌ ERROR: {str(e)}")
            all_passed = False
    
    print(f"\n🎯 Service Code Detection: {'✅ ALL PASSED' if all_passed else '❌ SOME FAILED'}")
    return all_passed

async def test_fuel_classification():
    """Test fuel grade classification algorithm"""
    print("\n🧪 Testing Fuel Grade Classification")
    print("=" * 50)
    
    service = FormAutomationV1Service(MockDB())
    
    all_passed = True
    
    for test_case in FUEL_GRADE_TESTS:
        try:
            print(f"\n⛽ Testing: {test_case['name']}")
            
            # Test fuel classification
            fuel_grades = test_case['fuel_grades']
            metered, non_metered = await service._classify_fuel_grades(fuel_grades)
            
            expected_metered = test_case['expected_metered']
            expected_non_metered = test_case['expected_non_metered']
            
            # Check each dispenser
            dispenser_passed = True
            for dispenser_num in fuel_grades.keys():
                metered_match = set(metered.get(dispenser_num, [])) == set(expected_metered.get(dispenser_num, []))
                non_metered_match = set(non_metered.get(dispenser_num, [])) == set(expected_non_metered.get(dispenser_num, []))
                
                if not (metered_match and non_metered_match):
                    dispenser_passed = False
                    print(f"    Dispenser {dispenser_num}: ❌")
                    print(f"      Metered: {metered.get(dispenser_num, [])} (expected: {expected_metered.get(dispenser_num, [])})")
                    print(f"      Non-metered: {non_metered.get(dispenser_num, [])} (expected: {expected_non_metered.get(dispenser_num, [])})")
                else:
                    print(f"    Dispenser {dispenser_num}: ✓")
            
            if dispenser_passed:
                print(f"  ✅ PASSED")
            else:
                print(f"  ❌ FAILED")
                all_passed = False
                
        except Exception as e:
            print(f"  ❌ ERROR: {str(e)}")
            all_passed = False
    
    print(f"\n🎯 Fuel Classification: {'✅ ALL PASSED' if all_passed else '❌ SOME FAILED'}")
    return all_passed

async def test_strategy_analysis():
    """Test complete strategy analysis"""
    print("\n🧪 Testing Complete Strategy Analysis")
    print("=" * 50)
    
    service = FormAutomationV1Service(MockDB())
    
    all_passed = True
    
    for test_case in TEST_WORK_ORDERS:
        try:
            print(f"\n🎯 Testing: {test_case['name']}")
            
            # Run complete analysis
            strategy = await service.analyze_work_order(test_case['data'])
            
            # Verify results
            code_correct = strategy.service_code == test_case['expected']['service_code']
            count_correct = len(strategy.dispenser_numbers) == test_case['expected']['dispenser_count']
            template_correct = strategy.automation_template == test_case['expected']['automation_template']
            
            print(f"  Service Code: {strategy.service_code.value} {'✓' if code_correct else '✗'}")
            print(f"  Dispenser Count: {len(strategy.dispenser_numbers)} {'✓' if count_correct else '✗'}")
            print(f"  Template: {strategy.automation_template.value} {'✓' if template_correct else '✗'}")
            print(f"  Total Iterations: {strategy.total_iterations}")
            
            if code_correct and count_correct and template_correct:
                print(f"  ✅ PASSED")
            else:
                print(f"  ❌ FAILED")
                all_passed = False
                
        except Exception as e:
            print(f"  ❌ ERROR: {str(e)}")
            all_passed = False
    
    print(f"\n🎯 Strategy Analysis: {'✅ ALL PASSED' if all_passed else '❌ SOME FAILED'}")
    return all_passed

async def test_iteration_calculation():
    """Test iteration calculation formulas"""
    print("\n🧪 Testing Iteration Calculation")
    print("=" * 50)
    
    service = FormAutomationV1Service(MockDB())
    
    try:
        # Test case: 2 dispensers, mixed fuel types
        test_metered = {1: ["regular", "diesel"], 2: ["regular", "premium"]}
        test_non_metered = {1: ["plus"], 2: ["plus"]}
        
        # 5-iteration template
        iterations_5 = await service._calculate_total_iterations(
            AutomationTemplate.METERED_5_ITERATION,
            [1, 2],
            test_metered,
            test_non_metered
        )
        
        # Expected: Dispenser 1: (2 metered * 5) + (1 non-metered * 3) = 13
        #          Dispenser 2: (2 metered * 5) + (1 non-metered * 3) = 13
        #          Total: 26
        expected_5 = 26
        
        # 3-iteration template  
        iterations_3 = await service._calculate_total_iterations(
            AutomationTemplate.NON_METERED_3_ITERATION,
            [1, 2],
            test_metered,
            test_non_metered
        )
        
        # Expected: Each fuel gets 3 iterations regardless
        #          Dispenser 1: 3 fuels * 3 = 9
        #          Dispenser 2: 3 fuels * 3 = 9  
        #          Total: 18
        expected_3 = 18
        
        print(f"  5-Iteration Template: {iterations_5} {'✓' if iterations_5 == expected_5 else '✗'}")
        print(f"  Expected: {expected_5}")
        print(f"  3-Iteration Template: {iterations_3} {'✓' if iterations_3 == expected_3 else '✗'}")
        print(f"  Expected: {expected_3}")
        
        calculation_passed = (iterations_5 == expected_5) and (iterations_3 == expected_3)
        print(f"\n🎯 Iteration Calculation: {'✅ PASSED' if calculation_passed else '❌ FAILED'}")
        return calculation_passed
        
    except Exception as e:
        print(f"  ❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    async def run_all_tests():
        print("🚀 Starting V1-Compatible Form Automation Tests\n")
        
        # Run all test suites
        test1 = await test_service_code_detection()
        test2 = await test_fuel_classification()
        test3 = await test_strategy_analysis()
        test4 = await test_iteration_calculation()
        
        print("\n" + "=" * 70)
        print("📈 Final Test Results:")
        print(f"  Service Code Detection: {'✅ PASS' if test1 else '❌ FAIL'}")
        print(f"  Fuel Classification: {'✅ PASS' if test2 else '❌ FAIL'}")
        print(f"  Strategy Analysis: {'✅ PASS' if test3 else '❌ FAIL'}")
        print(f"  Iteration Calculation: {'✅ PASS' if test4 else '❌ FAIL'}")
        
        all_passed = test1 and test2 and test3 and test4
        
        if all_passed:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ V1-Compatible Form Automation Service is working correctly!")
            print("🚀 Ready for integration with browser automation engine!")
        else:
            print("\n⚠️  SOME TESTS FAILED!")
            print("❌ Form automation service needs fixes before production use.")
        
        return all_passed
    
    # Run the test suite
    asyncio.run(run_all_tests())