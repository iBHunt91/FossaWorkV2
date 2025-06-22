#!/usr/bin/env python3
"""
Test API endpoints with proper authentication token
"""

import os
import sys
import requests
import json

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes/backend')
sys.path.insert(0, '.')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Create a valid JWT token
from app.auth.security import create_access_token
from datetime import timedelta

print("=== API Authentication Test ===")

# Create token for existing user
user_id = "7bea3bdb7e8e303eacaba442bd824004"  # Bruce's user ID
token = create_access_token(
    data={"sub": user_id, "username": "bruce.hunt@owlservices.com"},
    expires_delta=timedelta(hours=1)
)

print(f"✓ Created JWT token: {token[:50]}...")

# Test endpoints with authentication
base_url = "http://localhost:8000"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

endpoints_to_test = [
    ("GET", "/api/auth/me", "Get current user info"),
    ("GET", "/api/auth/check", "Check auth status"),
    ("GET", "/api/scraping-schedules/", "Get scraping schedules"),
    ("GET", "/health", "Health check (no auth required)"),
]

print(f"\n=== Testing API Endpoints ===")

for method, endpoint, description in endpoints_to_test:
    try:
        print(f"\nTesting {method} {endpoint} - {description}")
        
        if method == "GET":
            response = requests.get(f"{base_url}{endpoint}", headers=headers)
        elif method == "POST":
            response = requests.post(f"{base_url}{endpoint}", headers=headers)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"✓ Success: {json.dumps(data, indent=2)[:200]}...")
            except:
                print(f"✓ Success: {response.text[:200]}...")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

print("\n=== Authentication Test Complete ===")