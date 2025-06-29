#!/usr/bin/env python3
"""
Test the Pushover endpoint directly to see what response it returns
"""

import asyncio
import aiohttp
import json
import sys

async def test_pushover_endpoint():
    """Test the /api/notifications/test/pushover endpoint"""
    
    # Get auth token from command line or use a test token
    auth_token = sys.argv[1] if len(sys.argv) > 1 else None
    
    if not auth_token:
        print("Usage: python test_pushover_endpoint.py <auth_token>")
        print("You can get the auth token from browser DevTools > Application > Local Storage > authToken")
        return
    
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    
    url = "http://localhost:8000/api/notifications/test/pushover"
    
    print(f"Testing endpoint: {url}")
    print(f"Auth token: {auth_token[:20]}... (truncated)")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as response:
                status = response.status
                response_text = await response.text()
                
                print(f"\nResponse status: {status}")
                print(f"Response headers: {dict(response.headers)}")
                print(f"\nRaw response text:\n{response_text}")
                
                try:
                    response_data = json.loads(response_text)
                    print(f"\nParsed JSON response:")
                    print(json.dumps(response_data, indent=2))
                    
                    # Check the structure
                    if "success" in response_data:
                        print(f"\nTop-level success: {response_data['success']}")
                    if "results" in response_data:
                        print(f"Results object: {response_data['results']}")
                        if isinstance(response_data['results'], dict) and 'pushover' in response_data['results']:
                            print(f"Pushover result: {response_data['results']['pushover']}")
                    
                except json.JSONDecodeError as e:
                    print(f"\nFailed to parse JSON: {e}")
                
    except asyncio.TimeoutError:
        print("\nRequest timed out after 30 seconds")
    except Exception as e:
        print(f"\nError: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_pushover_endpoint())