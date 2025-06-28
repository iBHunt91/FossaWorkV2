#!/usr/bin/env python3
"""Test API endpoints to diagnose timeout issues"""

import requests
import time
import json

# Base URL
BASE_URL = "http://localhost:8000"

def test_endpoint(name, url, headers=None):
    """Test an endpoint and measure response time"""
    print(f"\nTesting {name}...")
    print(f"URL: {url}")
    
    start_time = time.time()
    try:
        response = requests.get(url, headers=headers, timeout=30)
        elapsed = time.time() - start_time
        
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Time: {elapsed:.2f} seconds")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Response: {json.dumps(data, indent=2)[:200]}...")
        else:
            print(f"✗ Error: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"✗ TIMEOUT after {elapsed:.2f} seconds")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"✗ ERROR after {elapsed:.2f} seconds: {str(e)}")

def main():
    print("API Endpoint Timeout Test")
    print("=" * 50)
    
    # Test health endpoint (no auth required)
    test_endpoint("Health Check", f"{BASE_URL}/health")
    
    # Test scraping schedules endpoint (requires auth)
    # Note: This will fail with 401 without a valid token
    test_endpoint("Scraping Schedules", f"{BASE_URL}/api/scraping-schedules/")
    
    # Test daemon status
    test_endpoint("Daemon Status", f"{BASE_URL}/api/scraping-schedules/status/daemon")
    
if __name__ == "__main__":
    main()