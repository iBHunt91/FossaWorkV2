#!/usr/bin/env python3
"""
Quick test script to verify authentication is working
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_setup_status():
    """Check if system needs setup"""
    print("1. Checking system status...")
    response = requests.get(f"{BASE_URL}/api/setup/status")
    if response.ok:
        data = response.json()
        print(f"   - Setup required: {data.get('setup_required')}")
        print(f"   - User count: {data.get('user_count')}")
        return data.get('setup_required')
    else:
        print(f"   - Error: {response.status_code}")
        return None

def test_login(email, password):
    """Test login with credentials"""
    print(f"\n2. Testing login with email: {email}")
    
    payload = {
        "username": email,
        "password": password
    }
    
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"   - Status: {response.status_code}")
    
    if response.ok:
        data = response.json()
        print(f"   - Success! Token received: {data.get('access_token')[:20]}...")
        print(f"   - User: {data.get('user', {}).get('display_name', 'Unknown')}")
        return data
    else:
        try:
            error = response.json()
            print(f"   - Error: {error.get('detail', 'Unknown error')}")
        except:
            print(f"   - Error: {response.text}")
        return None

def main():
    print("=== WorkFossa Authentication Test ===\n")
    
    # Check system status
    setup_required = test_setup_status()
    
    # Test credentials
    print("\n3. Testing with mock credentials (Playwright not installed)")
    print("   Note: Any valid email format with non-empty password will work")
    
    # Test with a sample email
    test_email = "bruce.hunt@owlservices.com"
    test_password = "test123"
    
    result = test_login(test_email, test_password)
    
    if result:
        print("\n✅ Authentication successful!")
        print("\nTo use real WorkFossa verification:")
        print("1. Install Playwright:")
        print("   cd backend")
        print("   pip install playwright")
        print("   playwright install chromium")
        print("\n2. Or enable development mode:")
        print("   export WORKFOSSA_DEV_MODE=true")
        print("   python start_backend.py")
    else:
        print("\n❌ Authentication failed!")
        print("\nTroubleshooting:")
        print("1. Make sure backend is running on port 8000")
        print("2. Check backend logs for detailed errors")
        print("3. Try with a valid email format (e.g., name@domain.com)")

if __name__ == "__main__":
    main()