#!/usr/bin/env python3
"""
Test script to verify URL extraction is working correctly
"""
import re

def test_url_patterns():
    """Test URL pattern matching"""
    
    # Test URLs
    test_urls = [
        ("https://app.workfossa.com/app/work/129651/visits/131650/", "visit"),
        ("https://app.workfossa.com/app/customers/locations/46768/", "customer"),
        ("https://app.workfossa.com/app/work/129651/", "work_order"),
        ("/app/work/129651/visits/131650/", "visit"),
        ("/app/customers/locations/46768/", "customer"),
        ("/visits/131650/", "visit"),
    ]
    
    print("=== URL Pattern Testing ===\n")
    
    for url, expected_type in test_urls:
        print(f"URL: {url}")
        print(f"Expected type: {expected_type}")
        
        # Check patterns
        has_visits = '/visits/' in url
        has_customers = '/customers/locations/' in url
        
        print(f"  Contains /visits/: {has_visits}")
        print(f"  Contains /customers/locations/: {has_customers}")
        
        # Extract IDs
        visit_id_match = re.search(r'/visits/(\d+)', url)
        customer_id_match = re.search(r'/customers/locations/(\d+)', url)
        work_order_id_match = re.search(r'/work/(\d+)', url)
        
        if visit_id_match:
            print(f"  Visit ID: {visit_id_match.group(1)}")
        if customer_id_match:
            print(f"  Customer Location ID: {customer_id_match.group(1)}")
        if work_order_id_match:
            print(f"  Work Order ID: {work_order_id_match.group(1)}")
        
        # Determine actual type
        if has_visits and not has_customers:
            actual_type = "visit"
        elif has_customers and not has_visits:
            actual_type = "customer"
        elif '/app/work/' in url and not has_visits:
            actual_type = "work_order"
        else:
            actual_type = "unknown"
        
        print(f"  Detected type: {actual_type}")
        print(f"  ✅ PASS" if actual_type == expected_type else f"  ❌ FAIL")
        print("-" * 60)

if __name__ == "__main__":
    test_url_patterns()