#!/usr/bin/env python3
"""Test SMTP endpoint to verify it's returning data correctly"""

import asyncio
import httpx
from pathlib import Path
import json

async def test_smtp_endpoint():
    """Test the SMTP settings endpoint"""
    
    # First, let's check if the settings file exists
    user_id = "demo"  # or whatever user ID you're testing with
    settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
    
    print(f"Checking if settings file exists: {settings_path}")
    if settings_path.exists():
        print("Settings file exists!")
        with open(settings_path, 'r') as f:
            print(f"Current settings: {json.dumps(json.load(f), indent=2)}")
    else:
        print("Settings file does not exist - will use defaults")
    
    # Test the endpoint
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # You might need to add authentication headers here
            response = await client.get(f"http://localhost:8000/api/settings/smtp/{user_id}")
            
            print(f"\nEndpoint response status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"\nResponse data: {json.dumps(data, indent=2)}")
                
                # Check if the response has the expected structure
                if 'settings' in data:
                    print("\n✅ Response has 'settings' property")
                else:
                    print("\n❌ Response missing 'settings' property")
                    
            else:
                print(f"Error response: {response.text}")
                
        except Exception as e:
            print(f"Error testing endpoint: {e}")

if __name__ == "__main__":
    asyncio.run(test_smtp_endpoint())