#!/usr/bin/env python3
"""
Simple Form Automation Test

Test the core V1 business logic algorithms without database dependencies.
Tests service code detection, fuel classification, and automation strategy.
"""

import asyncio
import re
from enum import Enum
from typing import Dict, Any, List, Tuple

class ServiceCode(Enum):
    """V1-Compatible Service Code Classification"""
    STANDARD_METER_CALIBRATION = "2861"
    SPECIFIC_DISPENSERS = "2862"
    QUANTITY_BASED = "3002"
    OPEN_NECK_PROVER = "3146"

class AutomationTemplate(Enum):
    """V1 Automation Template Types"""
    METERED_5_ITERATION = "metered_5"
    NON_METERED_3_ITERATION = "non_metered_3"
    OPEN_NECK_PROVER = "open_neck"

class MockFormAutomationService:
    """Simplified service for testing core logic"""
    
    # V1 Fuel Grade Classification Rules
    ALWAYS_METERED_FUELS = {
        "regular", "diesel", "super", "ethanol-free", "e0", "premium plus", "unleaded plus"
    }
    
    NEVER_METERED_FUELS = {
        "plus", "special 88", "extra 89", "midgrade 89", "89 octane", "88 octane", "e85"
    }
    
    PREMIUM_KEYWORDS = {
        "premium", "supreme", "ultra", "v-power", "synergy", "top tier"
    }
    
    SERVICE_CODE_PATTERNS = {
        "2861": {
            "description": "Standard Meter Calibration - Sequential Dispensers",
            "pattern": r"meter.*calibration|calibration.*meter",
            "strategy": "sequential_all_dispensers"
        },
        "2862": {
            "description": "Specific Dispensers - Parse Instructions",
            "pattern": r"dispenser.*(\d+)|(\d+).*dispenser",
            "strategy": "parse_specific_dispensers"
        },
        "3002": {
            "description": "Quantity-Based Dispenser Count",
            "pattern": r"(\d+)\s*(dispenser|disp)",
            "strategy": "quantity_based_count"
        },
        "3146": {
            "description": "Open Neck Prover Forms",
            "pattern": r"open.*neck|prover.*open|neck.*prover",
            "strategy": "open_neck_prover_form"
        }
    }
    
    async def detect_service_code(self, services: List[Dict[str, Any]]) -> ServiceCode:
        """Detect service code using V1 pattern matching"""
        for service in services:
            service_type = service.get("type", "").lower()
            description = service.get("description", "").lower()
            combined_text = f"{service_type} {description}"
            
            # Check each service code pattern
            for code, config in self.SERVICE_CODE_PATTERNS.items():
                if re.search(config["pattern"], combined_text, re.IGNORECASE):
                    return ServiceCode(code)
            
            # Fallback: Check for explicit service codes
            code_match = re.search(r"\b(2861|2862|3002|3146)\b", combined_text)
            if code_match:
                return ServiceCode(code_match.group(1))
        
        return ServiceCode.STANDARD_METER_CALIBRATION
    
    async def extract_dispenser_count(self, services: List[Dict[str, Any]], service_code: ServiceCode) -> int:
        """Extract dispenser count using V1 logic"""
        for service in services:
            quantity = service.get("quantity", 0)
            if quantity > 0:
                return quantity
            
            description = service.get("description", "")
            
            if service_code == ServiceCode.QUANTITY_BASED:
                quantity_match = re.search(r"(\d+)\s*(?:dispenser|disp)", description, re.IGNORECASE)
                if quantity_match:
                    return int(quantity_match.group(1))
            
            elif service_code == ServiceCode.SPECIFIC_DISPENSERS:
                dispenser_matches = re.findall(r"\b(\d+)\b", description)
                if dispenser_matches:
                    return len(set(dispenser_matches))
            
            number_match = re.search(r"\b(\d+)\b", description)
            if number_match:
                num = int(number_match.group(1))
                if 1 <= num <= 20:
                    return num
        
        return 4
    
    async def classify_fuel_grades(self, fuel_grades: Dict[int, List[str]]) -> Tuple[Dict[int, List[str]], Dict[int, List[str]]]:
        """Classify fuel grades as metered vs non-metered"""
        metered_grades = {}
        non_metered_grades = {}
        
        for dispenser_num, grades in fuel_grades.items():
            metered_list = []
            non_metered_list = []
            
            # Check for Super variants (affects Premium logic)
            has_super_variants = any("super" in grade.lower() for grade in grades)
            
            for grade in grades:
                grade_lower = grade.lower().strip()
                
                # Always metered fuels
                if any(fuel in grade_lower for fuel in self.ALWAYS_METERED_FUELS):
                    # Special Premium logic
                    if any(keyword in grade_lower for keyword in self.PREMIUM_KEYWORDS):
                        if has_super_variants:
                            non_metered_list.append(grade)  # Premium NOT metered if Super exists
                        else:
                            metered_list.append(grade)  # Premium IS metered if no Super
                    else:
                        metered_list.append(grade)
                
                # Never metered fuels
                elif any(fuel in grade_lower for fuel in self.NEVER_METERED_FUELS):
                    non_metered_list.append(grade)
                
                # Default: assume metered
                else:
                    metered_list.append(grade)
            
            metered_grades[dispenser_num] = metered_list
            non_metered_grades[dispenser_num] = non_metered_list
        
        return metered_grades, non_metered_grades
    
    async def calculate_iterations(
        self, 
        template: AutomationTemplate,
        dispenser_numbers: List[int],
        metered_grades: Dict[int, List[str]],
        non_metered_grades: Dict[int, List[str]]
    ) -> int:
        """Calculate total automation iterations"""
        if template == AutomationTemplate.OPEN_NECK_PROVER:
            return len(dispenser_numbers) * 3
        
        total = 0
        for dispenser_num in dispenser_numbers:
            metered_count = len(metered_grades.get(dispenser_num, []))
            non_metered_count = len(non_metered_grades.get(dispenser_num, []))
            
            if template == AutomationTemplate.METERED_5_ITERATION:
                total += (metered_count * 5) + (non_metered_count * 3)
            else:
                total += (metered_count + non_metered_count) * 3
        
        return total

# Test data
TEST_CASES = [
    {
        "name": "Standard Meter Calibration",
        "services": [{"type": "Meter Calibration", "description": "Standard meter calibration", "quantity": 4}],
        "expected_code": ServiceCode.STANDARD_METER_CALIBRATION,
        "expected_count": 4
    },
    {
        "name": "Specific Dispensers",
        "services": [{"type": "Service", "description": "Calibrate dispensers 1, 3, and 5", "quantity": 0}],
        "expected_code": ServiceCode.SPECIFIC_DISPENSERS,
        "expected_count": 3
    },
    {
        "name": "Quantity Based",
        "services": [{"type": "Request", "description": "6 dispensers need service", "quantity": 6}],
        "expected_code": ServiceCode.QUANTITY_BASED,
        "expected_count": 6
    },
    {
        "name": "Open Neck Prover",
        "services": [{"type": "Open Neck Prover", "description": "Prover calibration", "quantity": 2}],
        "expected_code": ServiceCode.OPEN_NECK_PROVER,
        "expected_count": 2
    }
]

FUEL_TESTS = [
    {
        "name": "Standard Configuration",
        "grades": {1: ["regular", "plus", "premium", "diesel"]},
        "expected_metered": {1: ["regular", "premium", "diesel"]},
        "expected_non_metered": {1: ["plus"]}
    },
    {
        "name": "Premium with Super (Special Case)",
        "grades": {1: ["regular", "plus", "premium", "super premium", "diesel"]},
        "expected_metered": {1: ["regular", "super premium", "diesel"]},
        "expected_non_metered": {1: ["plus", "premium"]}  # Premium becomes non-metered
    },
    {
        "name": "Speedway with Special 88",
        "grades": {1: ["regular", "special 88", "plus", "premium", "diesel"]},
        "expected_metered": {1: ["regular", "premium", "diesel"]},
        "expected_non_metered": {1: ["special 88", "plus"]}
    }
]

async def test_service_codes():
    """Test service code detection"""
    print("🧪 Testing Service Code Detection")
    print("=" * 50)
    
    service = MockFormAutomationService()
    all_passed = True
    
    for test in TEST_CASES:
        try:
            detected_code = await service.detect_service_code(test["services"])
            detected_count = await service.extract_dispenser_count(test["services"], detected_code)
            
            code_ok = detected_code == test["expected_code"]
            count_ok = detected_count == test["expected_count"]
            
            print(f"\n📋 {test['name']}")
            print(f"  Code: {detected_code.value} {'✓' if code_ok else '✗'} (expected: {test['expected_code'].value})")
            print(f"  Count: {detected_count} {'✓' if count_ok else '✗'} (expected: {test['expected_count']})")
            
            if not (code_ok and count_ok):
                all_passed = False
                
        except Exception as e:
            print(f"  ❌ ERROR: {str(e)}")
            all_passed = False
    
    print(f"\n🎯 Service Code Detection: {'✅ PASSED' if all_passed else '❌ FAILED'}")
    return all_passed

async def test_fuel_classification():
    """Test fuel grade classification"""
    print("\n🧪 Testing Fuel Grade Classification")
    print("=" * 50)
    
    service = MockFormAutomationService()
    all_passed = True
    
    for test in FUEL_TESTS:
        try:
            metered, non_metered = await service.classify_fuel_grades(test["grades"])
            
            metered_ok = metered == test["expected_metered"]
            non_metered_ok = non_metered == test["expected_non_metered"]
            
            print(f"\n⛽ {test['name']}")
            print(f"  Metered: {metered} {'✓' if metered_ok else '✗'}")
            print(f"  Expected: {test['expected_metered']}")
            print(f"  Non-metered: {non_metered} {'✓' if non_metered_ok else '✗'}")
            print(f"  Expected: {test['expected_non_metered']}")
            
            if not (metered_ok and non_metered_ok):
                all_passed = False
                
        except Exception as e:
            print(f"  ❌ ERROR: {str(e)}")
            all_passed = False
    
    print(f"\n🎯 Fuel Classification: {'✅ PASSED' if all_passed else '❌ FAILED'}")
    return all_passed

async def test_iteration_calculation():
    """Test iteration calculation"""
    print("\n🧪 Testing Iteration Calculation")
    print("=" * 50)
    
    service = MockFormAutomationService()
    
    try:
        # Test case: 2 dispensers with mixed fuel types
        metered = {1: ["regular", "diesel"], 2: ["regular", "premium"]}
        non_metered = {1: ["plus"], 2: ["plus"]}
        
        # 5-iteration template: (2*5 + 1*3) + (2*5 + 1*3) = 13 + 13 = 26
        iterations_5 = await service.calculate_iterations(
            AutomationTemplate.METERED_5_ITERATION, [1, 2], metered, non_metered
        )
        
        # 3-iteration template: (3*3) + (3*3) = 9 + 9 = 18
        iterations_3 = await service.calculate_iterations(
            AutomationTemplate.NON_METERED_3_ITERATION, [1, 2], metered, non_metered
        )
        
        expected_5 = 26
        expected_3 = 18
        
        calc_5_ok = iterations_5 == expected_5
        calc_3_ok = iterations_3 == expected_3
        
        print(f"  5-Iteration: {iterations_5} {'✓' if calc_5_ok else '✗'} (expected: {expected_5})")
        print(f"  3-Iteration: {iterations_3} {'✓' if calc_3_ok else '✗'} (expected: {expected_3})")
        
        calculation_passed = calc_5_ok and calc_3_ok
        print(f"\n🎯 Iteration Calculation: {'✅ PASSED' if calculation_passed else '❌ FAILED'}")
        return calculation_passed
        
    except Exception as e:
        print(f"  ❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    async def main():
        print("🚀 Starting V1 Form Automation Logic Tests\n")
        
        test1 = await test_service_codes()
        test2 = await test_fuel_classification() 
        test3 = await test_iteration_calculation()
        
        print("\n" + "=" * 60)
        print("📈 Final Results:")
        print(f"  Service Code Detection: {'✅ PASS' if test1 else '❌ FAIL'}")
        print(f"  Fuel Classification: {'✅ PASS' if test2 else '❌ FAIL'}")
        print(f"  Iteration Calculation: {'✅ PASS' if test3 else '❌ FAIL'}")
        
        all_passed = test1 and test2 and test3
        
        if all_passed:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ V1 form automation business logic is working correctly!")
            print("🚀 Core algorithms validated and ready for production integration!")
        else:
            print("\n⚠️  Some tests failed. Need to fix algorithms before proceeding.")
    
    asyncio.run(main())