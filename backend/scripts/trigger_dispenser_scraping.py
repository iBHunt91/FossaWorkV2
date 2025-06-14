#!/usr/bin/env python3
"""Trigger dispenser scraping via API"""

import requests
import json
import time

# Get user ID from a work order
base_url = "http://localhost:8000"

# First get work orders
response = requests.get(f"{base_url}/api/work-orders")
if response.status_code == 200:
    work_orders = response.json()
    if work_orders:
        # Get user_id from first work order
        first_order = work_orders[0]
        user_id = first_order.get('user_id', 'demo')
        print(f"Using user_id: {user_id}")
        
        # Trigger batch dispenser scraping
        print("\n🚀 Triggering batch dispenser scraping...")
        scrape_response = requests.post(f"{base_url}/api/work-orders/scrape-dispensers/{user_id}")
        
        if scrape_response.status_code == 200:
            result = scrape_response.json()
            print(f"✅ {result['message']}")
            print(f"   Work orders: {result['work_order_count']}")
            
            # Monitor progress
            print("\n📊 Monitoring progress...")
            while True:
                time.sleep(2)
                progress_response = requests.get(f"{base_url}/api/work-orders/scrape-dispensers/progress/{user_id}")
                if progress_response.status_code == 200:
                    progress = progress_response.json()
                    print(f"\r[{progress['percentage']:.0f}%] {progress['phase']}: {progress['message']}", end="", flush=True)
                    
                    if progress['status'] in ['completed', 'failed']:
                        print()  # New line
                        if progress['status'] == 'completed':
                            print(f"\n✅ Scraping completed!")
                            print(f"   Total: {progress['total_work_orders']}")
                            print(f"   Successful: {progress['successful']}")
                            print(f"   Failed: {progress['failed']}")
                        else:
                            print(f"\n❌ Scraping failed: {progress.get('error', 'Unknown error')}")
                        break
                else:
                    print(f"\n❌ Failed to get progress: {progress_response.status_code}")
                    break
        else:
            print(f"❌ Failed to start scraping: {scrape_response.status_code}")
            print(f"   Response: {scrape_response.text}")
    else:
        print("❌ No work orders found")
else:
    print(f"❌ Failed to get work orders: {response.status_code}")