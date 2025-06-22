#!/usr/bin/env python3
"""
Test backend authentication to see what's happening
"""

import requests
import json

def test_backend_auth():
    import os
    print("Testing Backend Authentication")
    print("=" * 50)
    
    # Check setup status
    print("\n1. Checking setup status...")
    response = requests.get("http://localhost:8000/api/setup/status")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # Try to initialize
    print("\n2. Trying to initialize with credentials...")
    credentials = {
        "username": os.getenv("TEST_USERNAME", "test@example.com"),
        "password": os.getenv("TEST_PASSWORD", "test_password")
    }
    
    response = requests.post(
        "http://localhost:8000/api/setup/initialize",
        json=credentials,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # Try test endpoints
    print("\n3. Testing simple endpoint...")
    response = requests.post("http://localhost:8000/api/setup/test-simple")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    test_backend_auth()