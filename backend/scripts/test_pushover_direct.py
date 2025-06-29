#!/usr/bin/env python3
"""
Direct test of Pushover API
"""

import asyncio
import aiohttp
import sys

async def test_pushover_direct():
    """Test Pushover API directly"""
    
    # Your credentials from the API response above
    user_key = "u3h8ajytntb1pu3p6qtmpjy6pgaou2"
    api_token = "ayxnbk5eim41c11ybhivjf4ximp61v"
    
    print(f"Testing with user_key: {user_key[:10]}... (hidden)")
    print(f"Testing with api_token: {api_token[:10]}... (hidden)")
    
    # Test validation first
    print("\n1. Testing credential validation...")
    payload = {
        "token": api_token,
        "user": user_key
    }
    
    async with aiohttp.ClientSession() as session:
        # Validate credentials
        async with session.post(
            "https://api.pushover.net/1/users/validate.json",
            data=payload,
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            result = await response.json()
            print(f"Validation response status: {response.status}")
            print(f"Validation result: {result}")
            
            if response.status != 200 or result.get("status") != 1:
                print("❌ Credentials validation failed!")
                return
        
        # Send test message
        print("\n2. Sending test message...")
        message_payload = {
            "token": api_token,
            "user": user_key,
            "title": "🧪 FossaWork Direct Test",
            "message": "This is a direct test of the Pushover API. If you see this, the API is working!",
            "priority": 0,
            "sound": "pushover"
        }
        
        async with session.post(
            "https://api.pushover.net/1/messages.json",
            data=message_payload,
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            result = await response.json()
            print(f"Message response status: {response.status}")
            print(f"Message result: {result}")
            
            if response.status == 200 and result.get("status") == 1:
                print("✅ Test message sent successfully!")
            else:
                print("❌ Failed to send test message")
                if "errors" in result:
                    print(f"Errors: {result['errors']}")

if __name__ == "__main__":
    asyncio.run(test_pushover_direct())