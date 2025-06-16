#!/usr/bin/env python3
"""
Check which work orders have/need dispenser information
"""

import requests
import json
from collections import Counter

# Get all work orders
print("🔍 Fetching work orders...")
response = requests.get("http://localhost:8000/api/work-orders")
if response.status_code != 200:
    print(f"❌ Failed to get work orders: {response.status_code}")
    exit(1)

data = response.json()
work_orders = data.get('data', {}).get('work_orders', [])
print(f"✅ Found {len(work_orders)} total work orders")

# Service codes that require dispensers
DISPENSER_SERVICE_CODES = ['2861', '2862', '3002', '3146']

# Analyze work orders
service_code_counts = Counter()
dispenser_required = []
has_customer_url = []
already_has_dispensers = []

for wo in work_orders:
    service_code = wo.get('service_code', 'Unknown')
    service_code_counts[service_code] += 1
    
    # Check if this service code requires dispensers
    if service_code in DISPENSER_SERVICE_CODES:
        dispenser_required.append(wo)
        
        # Check if it has a customer URL for scraping
        if wo.get('customer_url'):
            has_customer_url.append(wo)
            
        # Check if dispensers already scraped
        scraped_data = wo.get('scraped_data', {})
        if scraped_data.get('dispensers'):
            already_has_dispensers.append(wo)

# Display results
print("\n📊 Service Code Distribution:")
for code, count in service_code_counts.most_common():
    is_dispenser = " (REQUIRES DISPENSERS)" if code in DISPENSER_SERVICE_CODES else ""
    print(f"  {code}: {count} work orders{is_dispenser}")

print(f"\n📈 Dispenser Analysis:")
print(f"  Total work orders: {len(work_orders)}")
print(f"  Require dispensers: {len(dispenser_required)} ({len(dispenser_required)/len(work_orders)*100:.1f}%)")
print(f"  Have customer URL: {len(has_customer_url)} ({len(has_customer_url)/len(work_orders)*100:.1f}%)")
print(f"  Already have dispensers: {len(already_has_dispensers)} ({len(already_has_dispensers)/len(work_orders)*100:.1f}%)")
print(f"  Need dispenser scraping: {len(has_customer_url) - len(already_has_dispensers)}")

# Show examples of work orders that need dispensers
print("\n📋 Example work orders that need dispenser scraping:")
need_scraping = [wo for wo in has_customer_url if wo not in already_has_dispensers]
for wo in need_scraping[:5]:
    print(f"  - {wo['id']} ({wo['service_code']}): {wo.get('customer_name', 'Unknown')} - {wo.get('address', 'Unknown')}")