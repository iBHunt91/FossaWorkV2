#!/usr/bin/env python3
"""Check if scraping results are in memory but not saved"""

import requests
import json

# Check the progress endpoint which might have in-memory results
response = requests.get("http://localhost:8000/api/v1/work-orders/scrape-dispensers/progress/7bea3bdb7e8e303eacaba442bd824004")

if response.status_code == 200:
    progress = response.json()
    print("📊 Scraping Progress (from memory):")
    print(json.dumps(progress, indent=2))
else:
    print(f"❌ Failed to get progress: {response.status_code}")

# Try to get work orders via API to see if they have dispenser data
print("\n🔍 Checking work orders via API...")
try:
    # Try without auth first
    wo_response = requests.get("http://localhost:8000/api/v1/work-orders/?user_id=7bea3bdb7e8e303eacaba442bd824004")
    
    if wo_response.status_code == 200:
        work_orders = wo_response.json()
        print(f"Found {len(work_orders)} work orders")
        
        # Check first few for dispenser data
        for i, wo in enumerate(work_orders[:3]):
            print(f"\nWork Order {i+1}: {wo.get('external_id', wo.get('id', 'Unknown')[:8])}")
            if 'dispensers' in wo:
                print(f"  Dispensers: {len(wo['dispensers'])}")
                for d in wo['dispensers'][:2]:
                    print(f"    - {d.get('dispenser_number', '?')}: {d.get('dispenser_type', 'Unknown')}")
            if 'scraped_data' in wo:
                scraped = json.loads(wo['scraped_data']) if isinstance(wo['scraped_data'], str) else wo['scraped_data']
                if 'dispensers' in scraped:
                    print(f"  Scraped dispensers: {len(scraped['dispensers'])}")
                if 'dispensers_scraped_at' in scraped:
                    print(f"  Scraped at: {scraped['dispensers_scraped_at']}")
    else:
        print(f"Failed to get work orders: {wo_response.status_code}")
        
except Exception as e:
    print(f"Error: {e}")