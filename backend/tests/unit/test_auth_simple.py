#!/usr/bin/env python3
"""
Simple test of authentication and basic endpoints
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_auth():
    """Test authentication flow"""
    
    # Test health endpoint (no auth required)
    print("1. Testing health endpoint (no auth)...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Health response: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.json()}")
    
    # Get token from a test file if it exists
    token = None
    try:
        with open("/Users/ibhunt/Documents/GitHub/FossaWorkV2-hourly-scrape/backend/data/users/7bea3bdb7e8e303eacaba442bd824004/auth_token.txt", "r") as f:
            token = f.read().strip()
            print(f"\n2. Found existing token: {token[:20]}...")
    except:
        print("\n2. No existing token found")
    
    if token:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Test user preferences (known working endpoint)
        print("\n3. Testing user preferences endpoint...")
        response = requests.get(f"{BASE_URL}/api/user-preferences", headers=headers)
        print(f"User preferences response: {response.status_code}")
        
        # Test notification preferences
        print("\n4. Testing notification preferences endpoint...")
        response = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=headers)
        print(f"Notification preferences response: {response.status_code}")
        if response.status_code != 200:
            print(f"Error: {response.text}")
        
        # Test SMTP settings
        print("\n5. Testing SMTP settings endpoint...")
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        response = requests.get(f"{BASE_URL}/api/settings/smtp/{user_id}", headers=headers)
        print(f"SMTP settings response: {response.status_code}")
        if response.status_code != 200:
            print(f"Error: {response.text}")

if __name__ == "__main__":
    print("=== Simple Auth Test ===")
    test_auth()