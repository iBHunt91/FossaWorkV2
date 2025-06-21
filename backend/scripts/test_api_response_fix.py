#!/usr/bin/env python3
"""Test the API response format for history"""

import requests
import json
from datetime import datetime

# Try to get a token
try:
    with open('data/test_credentials.json', 'r') as f:
        creds = json.load(f)
        token = creds.get('token')
except:
    print("No test credentials found, trying without auth")
    token = None

# Test the history endpoint
if token:
    headers = {"Authorization": f"Bearer {token}"}
else:
    headers = {}

try:
    response = requests.get(
        "http://localhost:8000/api/scraping-schedules/history/work_orders?limit=1",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\nResponse: {json.dumps(data, indent=2)}")
        
        if data:
            # Check timestamp format
            first = data[0]
            started_at = first.get('started_at')
            print(f"\nTimestamp format check:")
            print(f"Raw value: {started_at}")
            print(f"Has 'Z': {'Z' in started_at if started_at else False}")
            print(f"Has '+': {'+' in started_at if started_at else False}")
            
            # Try parsing
            if started_at:
                try:
                    # Try with Z appended
                    if not ('Z' in started_at or '+' in started_at):
                        test_date = datetime.fromisoformat(started_at + 'Z')
                        print(f"Parsed with Z: {test_date}")
                except:
                    pass
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")