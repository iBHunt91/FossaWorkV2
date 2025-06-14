#!/usr/bin/env python3
"""Test work order scraping"""

import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:8000"
USER_ID = "7bea3bdb7e8e303eacaba442bd824004"
TOKEN = None

def login():
    """Login to get token"""
    global TOKEN
    print("1. Logging in...")
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
            print(f"   Success! Token obtained")
            return True
    except Exception as e:
        print(f"   Error: {e}")
        return False

def check_credentials():
    """Check if credentials are stored"""
    print("\n2. Checking stored credentials...")
    
    # Check via API
    url = f"{BASE_URL}/api/v1/credentials/workfossa?user_id={USER_ID}"
    
    headers = {
        "Authorization": f"Bearer {TOKEN}"
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"   Credentials found: {data}")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"   No credentials found (404)")
        else:
            print(f"   HTTP Error {e.code}: {e.read().decode()}")
        return False
    except Exception as e:
        print(f"   Error: {e}")
        return False

def trigger_scrape():
    """Trigger work order scraping"""
    print("\n3. Triggering work order scrape...")
    url = f"{BASE_URL}/api/v1/work-orders/scrape?user_id={USER_ID}"
    
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        req = urllib.request.Request(url, 
                                    data=b'{}',  # Empty body
                                    headers=headers,
                                    method='POST')
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            print(f"   Response: {json.dumps(result, indent=2)}")
            return True
    except urllib.error.HTTPError as e:
        print(f"   HTTP Error {e.code}: {e.read().decode()}")
        return False
    except Exception as e:
        print(f"   Error: {e}")
        return False

def get_work_orders():
    """Get work orders"""
    print("\n4. Getting work orders...")
    url = f"{BASE_URL}/api/v1/work-orders?user_id={USER_ID}"
    
    headers = {
        "Authorization": f"Bearer {TOKEN}"
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"   Found {len(data)} work orders")
            for wo in data[:3]:  # Show first 3
                print(f"   - {wo.get('site_name', 'Unknown')} ({wo.get('external_id', 'N/A')})")
            return True
    except Exception as e:
        print(f"   Error: {e}")
        return False

def main():
    """Run tests"""
    print("=== Testing Work Order Scraping ===")
    
    # Login first
    if not login():
        print("Failed to login")
        return
    
    # Check credentials
    has_creds = check_credentials()
    
    # Try to scrape
    if trigger_scrape():
        print("\nScraping triggered successfully!")
        print("Note: Scraping runs in the background, it may take a moment.")
    
    # Get work orders
    get_work_orders()
    
    if not has_creds:
        print("\n⚠️  No WorkFossa credentials found in database.")
        print("Please configure your credentials in Settings first.")

if __name__ == "__main__":
    main()