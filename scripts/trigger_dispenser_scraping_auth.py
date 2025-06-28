#!/usr/bin/env python3
"""Trigger dispenser scraping via API with authentication"""

import requests
import json
import time
import sys

base_url = "http://localhost:8000"

# Login first
print("🔐 Logging in...")
login_data = {
    "username": "demo",
    "password": "demo123"
}

session = requests.Session()
login_response = session.post(f"{base_url}/api/auth/login", json=login_data)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    print(f"   Response: {login_response.text}")
    sys.exit(1)

login_result = login_response.json()
print(f"✅ Logged in as: {login_result['user']['username']}")
user_id = login_result['user']['id']

# Get auth token
token = login_result.get('access_token')
if token:
    session.headers.update({'Authorization': f'Bearer {token}'})

# Check work orders
print("\n📋 Checking work orders...")
wo_response = session.get(f"{base_url}/api/v1/work-orders/?user_id={user_id}")
if wo_response.status_code != 200:
    print(f"❌ Failed to get work orders: {wo_response.status_code}")
    print(f"   Response: {wo_response.text}")
    sys.exit(1)

work_orders = wo_response.json()
print(f"Found {len(work_orders)} work orders")

# Trigger batch dispenser scraping
print("\n🚀 Triggering batch dispenser scraping...")
scrape_response = session.post(f"{base_url}/api/v1/work-orders/scrape-dispensers/{user_id}")

if scrape_response.status_code == 200:
    result = scrape_response.json()
    print(f"✅ {result['message']}")
    print(f"   Work orders to process: {result.get('work_order_count', 'unknown')}")
    
    # Monitor progress
    print("\n📊 Monitoring progress...")
    last_percentage = -1
    while True:
        time.sleep(2)
        progress_response = session.get(f"{base_url}/api/v1/work-orders/scrape-dispensers/progress/{user_id}")
        if progress_response.status_code == 200:
            progress = progress_response.json()
            
            # Only print if percentage changed
            if progress['percentage'] != last_percentage:
                print(f"\n[{progress['percentage']:.0f}%] {progress['phase']}: {progress['message']}")
                print(f"   Processed: {progress['processed']}/{progress['total_work_orders']} (Success: {progress['successful']}, Failed: {progress['failed']})")
                last_percentage = progress['percentage']
            
            if progress['status'] in ['completed', 'failed']:
                print("\n" + "="*80)
                if progress['status'] == 'completed':
                    print(f"✅ Scraping completed!")
                    print(f"   Total work orders: {progress['total_work_orders']}")
                    print(f"   Successfully scraped: {progress['successful']}")
                    print(f"   Failed: {progress['failed']}")
                    success_rate = (progress['successful'] / progress['total_work_orders'] * 100) if progress['total_work_orders'] > 0 else 0
                    print(f"   Success rate: {success_rate:.1f}%")
                else:
                    print(f"❌ Scraping failed: {progress.get('error', 'Unknown error')}")
                break
        else:
            print(f"\n❌ Failed to get progress: {progress_response.status_code}")
            break
else:
    print(f"❌ Failed to start scraping: {scrape_response.status_code}")
    print(f"   Response: {scrape_response.text}")