#!/usr/bin/env python3
"""
Test API endpoint for dispensers
"""

import requests
import json

# Test the API endpoint
print("🧪 Testing Dispenser API")
print("=" * 80)

# First get auth token (simulate login)
# For testing, we'll use the test endpoint directly
health_url = "http://localhost:8000/health"
test_url = "http://localhost:8000/api/v1/work-orders/test"

# Check health
response = requests.get(health_url)
print(f"Health check: {response.status_code}")
print(json.dumps(response.json(), indent=2))

# Check test endpoint
response = requests.get(test_url)
print(f"\nTest endpoint: {response.status_code}")
print(json.dumps(response.json(), indent=2))