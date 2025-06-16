#!/usr/bin/env python3
"""
Quick test of dispenser batch scraping to verify timing fixes
"""

import requests
import json
import time

# Get work orders
print("🔍 Fetching work orders...")
response = requests.get("http://localhost:8000/api/work-orders")
if response.status_code != 200:
    print(f"❌ Failed to get work orders: {response.status_code}")
    exit(1)

data = response.json()
work_orders = data.get('data', {}).get('work_orders', [])
print(f"✅ Found {len(work_orders)} work orders")

# Filter for work orders with customer URLs
work_orders_with_urls = [
    wo for wo in work_orders 
    if wo.get('customer_url') and wo['customer_url'].startswith('http')
]
print(f"✅ Found {len(work_orders_with_urls)} work orders with customer URLs")

if not work_orders_with_urls:
    print("❌ No work orders with customer URLs found")
    exit(1)

# Take first 3 work orders for testing
test_orders = work_orders_with_urls[:3]
work_order_ids = [str(wo['id']) for wo in test_orders]

print(f"\n🚀 Starting batch dispenser scraping for {len(work_order_ids)} work orders")
print(f"Work order IDs: {work_order_ids}")

# Start batch scraping
batch_data = {"work_order_ids": work_order_ids}
response = requests.post(
    "http://localhost:8000/api/work-orders/batch-dispenser-scrape",
    json=batch_data
)

if response.status_code != 200:
    print(f"❌ Failed to start batch scraping: {response.status_code}")
    print(f"Response: {response.text}")
    exit(1)

batch_info = response.json()
batch_id = batch_info.get('batch_id')
print(f"✅ Batch started with ID: {batch_id}")

# Poll for completion
max_polls = 60  # 60 seconds max
poll_count = 0

while poll_count < max_polls:
    time.sleep(1)
    response = requests.get(f"http://localhost:8000/api/work-orders/batch-dispenser-status/{batch_id}")
    
    if response.status_code != 200:
        print(f"❌ Failed to get batch status: {response.status_code}")
        break
    
    status_data = response.json()
    status = status_data.get('status', 'unknown')
    progress = status_data.get('progress', 0)
    
    print(f"📊 Status: {status} - Progress: {progress:.1f}%")
    
    if status == 'completed':
        print("\n✅ Batch completed!")
        
        # Show results
        results = status_data.get('results', {})
        for wo_id, result in results.items():
            success = result.get('success', False)
            dispenser_count = result.get('dispenser_count', 0)
            error = result.get('error', '')
            
            if success:
                print(f"  ✅ Work Order {wo_id}: Found {dispenser_count} dispensers")
            else:
                print(f"  ❌ Work Order {wo_id}: Failed - {error}")
        
        break
    
    elif status == 'failed':
        print(f"\n❌ Batch failed: {status_data.get('error', 'Unknown error')}")
        break
    
    poll_count += 1

if poll_count >= max_polls:
    print("\n⏱️ Timeout waiting for batch to complete")

print("\n✅ Test completed")