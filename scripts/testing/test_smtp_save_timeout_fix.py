#!/usr/bin/env python3
"""
Test script to verify SMTP settings save timeout fix
"""

import asyncio
import aiohttp
import json
import time
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# API configuration
API_BASE_URL = "http://localhost:8000"

async def test_smtp_save():
    """Test SMTP settings save with the async fix"""
    print("🧪 Testing SMTP Settings Save Timeout Fix")
    print("=" * 50)
    
    # Test configuration
    test_user_id = "test_user_123"
    
    # SMTP settings to save
    smtp_settings = {
        "smtp_server": "smtp.gmail.com",
        "smtp_port": 587,
        "username": "test@example.com",
        "password": "test_password_123",
        "use_tls": True,
        "use_ssl": False,
        "from_email": "test@example.com",
        "from_name": "Test User",
        "timeout": 30
    }
    
    print(f"📝 Testing with user ID: {test_user_id}")
    print(f"📧 SMTP Server: {smtp_settings['smtp_server']}")
    print(f"🔌 Port: {smtp_settings['smtp_port']}")
    
    async with aiohttp.ClientSession() as session:
        try:
            # Test 1: Save SMTP settings
            print("\n⏱️  Test 1: Saving SMTP settings...")
            start_time = time.time()
            
            async with session.post(
                f"{API_BASE_URL}/api/settings/smtp/{test_user_id}",
                json=smtp_settings,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                elapsed = time.time() - start_time
                
                if response.status == 200:
                    result = await response.json()
                    print(f"✅ Save successful in {elapsed:.2f} seconds")
                    print(f"   Response: {result.get('message', 'No message')}")
                elif response.status == 504:
                    print(f"❌ Save timed out after {elapsed:.2f} seconds")
                    error_data = await response.text()
                    print(f"   Error: {error_data}")
                else:
                    print(f"❌ Save failed with status {response.status} after {elapsed:.2f} seconds")
                    error_data = await response.text()
                    print(f"   Error: {error_data}")
            
            # Test 2: Retrieve settings to verify save
            print("\n⏱️  Test 2: Retrieving saved settings...")
            start_time = time.time()
            
            async with session.get(
                f"{API_BASE_URL}/api/settings/smtp/{test_user_id}",
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                elapsed = time.time() - start_time
                
                if response.status == 200:
                    result = await response.json()
                    settings = result.get('settings', {})
                    print(f"✅ Retrieved settings in {elapsed:.2f} seconds")
                    print(f"   Server: {settings.get('smtp_server')}")
                    print(f"   Port: {settings.get('smtp_port')}")
                    print(f"   Username: {settings.get('username')}")
                    print(f"   Password: {'*' * 8 if settings.get('password') else 'Not set'}")
                else:
                    print(f"❌ Retrieval failed with status {response.status}")
            
            # Test 3: Rapid successive saves (stress test)
            print("\n⏱️  Test 3: Rapid successive saves (stress test)...")
            success_count = 0
            fail_count = 0
            
            for i in range(5):
                smtp_settings['from_name'] = f"Test User {i+1}"
                start_time = time.time()
                
                try:
                    async with session.post(
                        f"{API_BASE_URL}/api/settings/smtp/{test_user_id}",
                        json=smtp_settings,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        elapsed = time.time() - start_time
                        
                        if response.status == 200:
                            success_count += 1
                            print(f"   Save {i+1}: ✅ Success in {elapsed:.2f}s")
                        else:
                            fail_count += 1
                            print(f"   Save {i+1}: ❌ Failed (status {response.status}) in {elapsed:.2f}s")
                except asyncio.TimeoutError:
                    fail_count += 1
                    elapsed = time.time() - start_time
                    print(f"   Save {i+1}: ❌ Timeout after {elapsed:.2f}s")
                
                # Small delay between saves
                await asyncio.sleep(0.5)
            
            print(f"\n📊 Stress test results: {success_count} succeeded, {fail_count} failed")
            
        except Exception as e:
            print(f"\n❌ Unexpected error: {type(e).__name__}: {str(e)}")
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")

if __name__ == "__main__":
    print("🚀 Starting SMTP Save Timeout Fix Test")
    print("⚠️  Make sure the backend server is running on port 8000")
    print()
    
    try:
        asyncio.run(test_smtp_save())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed: {type(e).__name__}: {str(e)}")