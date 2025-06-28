#!/usr/bin/env python3
"""Run dispenser scraping for Bruce Hunt"""

import requests
import time
import sys

base_url = "http://localhost:8000"
user_id = "7bea3bdb7e8e303eacaba442bd824004"

print("🚀 Starting dispenser scraping for Bruce Hunt...")

# Trigger the scraping
try:
    response = requests.post(f"{base_url}/api/v1/work-orders/scrape-dispensers-batch?user_id={user_id}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ {result.get('message', 'Scraping started')}")
        print(f"   Work orders: {result.get('work_order_count', 'unknown')}")
    else:
        print(f"❌ Failed to start scraping: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

# Monitor progress
print("\n📊 Monitoring progress...")
last_percentage = -1
no_change_count = 0

while True:
    time.sleep(3)
    try:
        progress_response = requests.get(f"{base_url}/api/v1/work-orders/scrape-dispensers/progress/{user_id}")
        if progress_response.status_code == 200:
            progress = progress_response.json()
            
            current_percentage = progress.get('percentage', 0)
            
            # Always show the current status
            print(f"\r[{current_percentage:.0f}%] {progress.get('phase', 'unknown')}: {progress.get('message', '')} - Processed: {progress.get('processed', 0)}/{progress.get('total_work_orders', 0)}", end="", flush=True)
            
            # Check if completed or failed
            if progress.get('status') in ['completed', 'failed']:
                print("\n" + "="*80)
                if progress['status'] == 'completed':
                    print(f"✅ Scraping completed!")
                    print(f"   Total: {progress.get('total_work_orders', 0)}")
                    print(f"   Successful: {progress.get('successful', 0)}")
                    print(f"   Failed: {progress.get('failed', 0)}")
                else:
                    print(f"❌ Scraping failed: {progress.get('error', 'Unknown error')}")
                break
                
            # Check if stuck
            if current_percentage == last_percentage:
                no_change_count += 1
                if no_change_count > 20:  # 60 seconds with no progress
                    print(f"\n⚠️  No progress for 60 seconds. Current status: {progress}")
                    no_change_count = 0
            else:
                no_change_count = 0
                last_percentage = current_percentage
                
    except Exception as e:
        print(f"\n❌ Error getting progress: {e}")
        break

print("\n✅ Done")