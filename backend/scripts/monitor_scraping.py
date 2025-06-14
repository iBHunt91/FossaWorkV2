#!/usr/bin/env python3
"""Monitor scraping progress"""

import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:8000"
USER_ID = "7bea3bdb7e8e303eacaba442bd824004"
TOKEN = None

def login():
    """Login to get token"""
    global TOKEN
    print("Logging in...")
    url = f"{BASE_URL}/api/auth/login"
    
    data = {
        "username": "bruce.hunt@owlservices.com",
        "password": "Crompco0511"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        req = urllib.request.Request(url, 
                                    data=json.dumps(data).encode('utf-8'),
                                    headers=headers,
                                    method='POST')
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            TOKEN = result['access_token']
            return True
    except Exception as e:
        print(f"Login error: {e}")
        return False

def get_work_orders():
    """Get work orders"""
    url = f"{BASE_URL}/api/v1/work-orders?user_id={USER_ID}"
    
    headers = {
        "Authorization": f"Bearer {TOKEN}"
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data
    except Exception as e:
        print(f"Error getting work orders: {e}")
        return []

def main():
    """Monitor scraping progress"""
    print("=== Monitoring Work Order Scraping ===\n")
    
    # Login first
    if not login():
        print("Failed to login")
        return
    
    print("Monitoring for work orders...")
    print("(Will check every 5 seconds for 30 seconds)\n")
    
    start_time = time.time()
    check_count = 0
    
    while time.time() - start_time < 30:
        check_count += 1
        work_orders = get_work_orders()
        
        print(f"Check #{check_count}: Found {len(work_orders)} work orders")
        
        if work_orders:
            print("\nWork orders found!")
            for wo in work_orders[:5]:  # Show first 5
                site_name = wo.get('location', {}).get('site_name', 'Unknown')
                external_id = wo.get('basic_info', {}).get('external_id', 'N/A')
                print(f"  - {site_name} ({external_id})")
            break
        
        time.sleep(5)
    
    if not work_orders:
        print("\nNo work orders found after 30 seconds.")
        print("The scraping might be failing or taking longer than expected.")

if __name__ == "__main__":
    main()