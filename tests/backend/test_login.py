#!/usr/bin/env python3
"""Test login endpoint"""

import urllib.request
import urllib.error
import json

# Test login endpoint
url = "http://localhost:8000/api/auth/login"
data = {
    "username": "bruce.hunt@owlservices.com",
    "password": "Crompco0511"  # Your actual password from console
}

headers = {
    "Content-Type": "application/json",
    "Origin": "http://localhost:5173"
}

print(f"Testing login endpoint: {url}")
print(f"Request data: {json.dumps(data, indent=2)}")

try:
    req = urllib.request.Request(url, 
                                data=json.dumps(data).encode('utf-8'),
                                headers=headers,
                                method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"\nStatus Code: {response.getcode()}")
            print(f"Headers: {dict(response.headers)}")
            response_data = json.loads(response.read().decode())
            print(f"Response: {json.dumps(response_data, indent=2)}")
            
            if response.getcode() == 200:
                print(f"\nSuccess! Token: {response_data.get('access_token', 'No token')[:20]}...")
    except urllib.error.HTTPError as e:
        print(f"\nHTTP Error {e.code}: {e.reason}")
        print(f"Response: {e.read().decode()}")
        
except Exception as e:
    print(f"\nError: {e}")