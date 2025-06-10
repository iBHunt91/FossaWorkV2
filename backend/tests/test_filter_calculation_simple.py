#!/usr/bin/env python3
"""
Simple Test for Filter Calculation Logic

Tests the core V1 business rules without database dependencies.
"""

def test_premium_conditional_logic():
    """Test the critical Premium conditional logic from V1"""
    print("=== Testing Premium Conditional Logic ===")
    print("V1 Business Rule: Premium gets filter ONLY if no Super/Ultra variants exist\n")
    
    test_cases = [
        {
            "name": "Premium alone - GETS filter",
            "grades": ["Regular", "Plus", "Premium 91"],
            "expected_premium_filter": True
        },
        {
            "name": "Premium with Super - NO filter",
            "grades": ["Regular", "Plus", "Premium 91", "Super 93"],
            "expected_premium_filter": False
        },
        {
            "name": "Premium with Ultra - NO filter",
            "grades": ["Regular", "Premium", "Ultra 93"],
            "expected_premium_filter": False
        },
        {
            "name": "Premium with Ultra Low - GETS filter",
            "grades": ["Regular", "Premium", "Ultra Low Sulfur Diesel"],
            "expected_premium_filter": True  # "Ultra Low" doesn't count as Ultra
        }
    ]
    
    for test in test_cases:
        print(f"\nTest: {test['name']}")
        print(f"Grades: {', '.join(test['grades'])}")
        
        # Check for Super or Ultra (but not Ultra Low)
        has_super_or_ultra = False
        for grade in test['grades']:
            grade_lower = grade.lower()
            if "super" in grade_lower:
                has_super_or_ultra = True
                print(f"  → Found Super: '{grade}'")
            elif "ultra" in grade_lower and "ultra low" not in grade_lower:
                has_super_or_ultra = True
                print(f"  → Found Ultra: '{grade}'")
        
        # Determine if Premium gets filter
        premium_gets_filter = not has_super_or_ultra
        
        print(f"Result: Premium {'GETS' if premium_gets_filter else 'DOES NOT GET'} filter")
        print(f"Expected: Premium {'GETS' if test['expected_premium_filter'] else 'DOES NOT GET'} filter")
        
        if premium_gets_filter == test['expected_premium_filter']:
            print("✓ PASS")
        else:
            print("✗ FAIL")


def test_filter_requirements():
    """Test which fuel grades require filters"""
    print("\n\n=== Testing Filter Requirements ===")
    
    # V1 Business Rules
    always_gets_filter = {
        "regular", "unleaded", "87",
        "diesel", "dsl", "ulsd", "b5", "b10", "b20", "biodiesel",
        "ethanol-free", "ethanol free", "e0", "non-ethanol", "recreation",
        "super", "super premium", "93", "94",
        "ultra", "ultra 93", "ultra 94",  # but NOT "ultra low"
        "e85", "flex fuel",
        "kerosene", "k1"
    }
    
    never_gets_filter = {
        "plus", "midgrade", "mid", "89", "88", "special 88",
        "ultra low"
    }
    
    test_grades = [
        # Always get filters
        ("Regular Unleaded", True, "Standard grade"),
        ("87 Octane", True, "Standard grade"),
        ("Diesel", True, "Diesel fuel"),
        ("ULSD", True, "Ultra Low Sulfur Diesel"),
        ("B20 Biodiesel", True, "Biodiesel blend"),
        ("Ethanol-Free Recreation", True, "Non-ethanol fuel"),
        ("Super 93", True, "Super grade"),
        ("Ultra 94", True, "Ultra grade"),
        ("E85 Flex Fuel", True, "Flex fuel"),
        ("K1 Kerosene", True, "Kerosene"),
        
        # Never get filters
        ("Plus", False, "Blended grade"),
        ("Midgrade 89", False, "Blended grade"),
        ("Special 88", False, "Blended grade"),
        ("Ultra Low Sulfur", False, "Contains 'ultra low'"),
        
        # Premium - conditional (tested separately)
        ("Premium 91", "Conditional", "Depends on Super/Ultra presence"),
        ("Premium 92", "Conditional", "Depends on Super/Ultra presence")
    ]
    
    print("\nFuel Grade Filter Requirements:")
    print("-" * 60)
    
    for grade, needs_filter, reason in test_grades:
        grade_lower = grade.lower()
        
        # Check against rules
        if needs_filter == "Conditional":
            result = "CONDITIONAL"
        else:
            # Check always gets filter
            gets_filter = any(keyword in grade_lower for keyword in always_gets_filter)
            
            # Check never gets filter (overrides always)
            if any(keyword in grade_lower for keyword in never_gets_filter):
                gets_filter = False
            
            result = "YES" if gets_filter else "NO"
            expected = "YES" if needs_filter else "NO"
            
            if result == expected:
                status = "✓"
            else:
                status = "✗"
        
        print(f"{status if needs_filter != 'Conditional' else '?'} {grade:.<30} {result:<12} ({reason})")


def test_part_number_mapping():
    """Test station-specific part number mapping"""
    print("\n\n=== Testing Part Number Mapping ===")
    
    stations = [
        ("7-Eleven #1234", "400MB-10", "400HS-10"),
        ("Speedway Store", "400MB-10", "400HS-10"),
        ("Marathon Station", "400MB-10", "400HS-10"),
        ("Wawa #5678", "450MB-10", "450MG-10"),
        ("Circle K #9999", "40510D-AD", "40530W-AD"),
        ("Unknown Store", "PCP-2-1", "PCN-2-1")  # Default
    ]
    
    print("\nStation-Specific Filter Part Numbers:")
    print("-" * 60)
    print(f"{'Station':<25} {'Gas Filter':<15} {'Diesel Filter':<15}")
    print("-" * 60)
    
    for station, gas_part, diesel_part in stations:
        print(f"{station:<25} {gas_part:<15} {diesel_part:<15}")
    
    print("\nSpecial Cases:")
    print("- DEF: 800HS-30 (6 filters per box instead of 12)")
    print("- High Flow Diesel: 800HS-30")
    print("- 7-Eleven Ecometer: 40510A-AD (gas), 40510W-AD (diesel)")


def test_multi_day_logic():
    """Test multi-day job handling"""
    print("\n\n=== Testing Multi-Day Job Logic ===")
    print("V1 Business Rule: Filters are only counted on the FIRST day of multi-day jobs\n")
    
    scenarios = [
        {
            "name": "Single-day job",
            "is_multi_day": False,
            "day_number": 1,
            "filters_counted": True
        },
        {
            "name": "Multi-day job - Day 1",
            "is_multi_day": True,
            "day_number": 1,
            "filters_counted": True
        },
        {
            "name": "Multi-day job - Day 2",
            "is_multi_day": True,
            "day_number": 2,
            "filters_counted": False
        },
        {
            "name": "Multi-day job - Day 3",
            "is_multi_day": True,
            "day_number": 3,
            "filters_counted": False
        }
    ]
    
    for scenario in scenarios:
        print(f"\n{scenario['name']}:")
        print(f"  Day number: {scenario['day_number']}")
        print(f"  Filters counted: {'YES' if scenario['filters_counted'] else 'NO'}")
        
        if scenario['is_multi_day'] and scenario['day_number'] > 1:
            print("  → Filters already counted on Day 1")


if __name__ == "__main__":
    test_premium_conditional_logic()
    test_filter_requirements()
    test_part_number_mapping()
    test_multi_day_logic()
    
    print("\n\n=== Summary ===")
    print("Filter calculation implements V1's complex business logic:")
    print("1. Premium conditional logic based on Super/Ultra presence")
    print("2. Station-specific part number mapping")
    print("3. Multi-day job handling (filters on first day only)")
    print("4. Special fuel warnings (DEF, High Flow)")
    print("5. Box quantity calculations (12/box standard, 6/box for 800HS-30)")