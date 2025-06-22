#!/usr/bin/env python3
"""
Test the API call directly using httpx to see what's happening
"""

import os
import sys
import asyncio
import traceback

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes/backend')
sys.path.insert(0, '.')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

async def test_api_call():
    print("=== Testing API Call Directly ===")
    
    try:
        import httpx
        
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmVhM2JkYjdlOGUzMDNlYWNhYmE0NDJiZDgyNDAwNCIsInVzZXJuYW1lIjoiYnJ1Y2UuaHVudEBvd2xzZXJ2aWNlcy5jb20iLCJleHAiOjE3NTA2NDI3MzR9.wYbVr3QpmJlpbkITMvs5G01oEGL0b7YaffugMru_1Zo"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print("Making HTTP request to backend...")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://localhost:8000/api/scraping-schedules/",
                headers=headers,
                timeout=10.0
            )
            
            print(f"Status code: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                print(f"✓ Success! Response: {response.json()}")
            else:
                print(f"❌ Error response:")
                print(f"Response text: {response.text}")
                
                # Try to get more details
                try:
                    error_json = response.json()
                    print(f"Error JSON: {error_json}")
                except:
                    print("Could not parse error as JSON")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Full traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api_call())