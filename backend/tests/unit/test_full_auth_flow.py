#!/usr/bin/env python3
"""
Test full authentication flow
"""

import requests
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

def test_auth_flow():
    """Test the full authentication flow"""
    print("🔐 Testing Full Authentication Flow")
    print("=" * 50)
    
    base_url = "http://localhost:8000"
    
    # Step 1: Try to login with test credentials
    print("\n1️⃣ Testing login endpoint...")
    
    # Note: You'll need to replace with actual WorkFossa credentials
    login_data = {
        "username": "bruce.hunt@owlservices.com",
        "password": "YOUR_WORKFOSSA_PASSWORD"  # Replace with actual password
    }
    
    print("⚠️  Note: Replace 'YOUR_WORKFOSSA_PASSWORD' with actual password in the script")
    print("   For security, we won't use the actual password in this test")
    
    # Instead, let's check the auth endpoint structure
    try:
        # Check if login endpoint exists
        response = requests.options(f"{base_url}/api/v1/auth/login")
        print(f"   Login endpoint available: {response.status_code}")
        
        # Try with dummy credentials to see error format
        response = requests.post(
            f"{base_url}/api/v1/auth/login",
            json={"username": "test@test.com", "password": "test123"}
        )
        print(f"   Test login response: {response.status_code}")
        if response.status_code != 200:
            print(f"   Error: {response.json()}")
    except Exception as e:
        print(f"❌ Login test failed: {e}")
    
    print("\n📝 Manual Test Instructions:")
    print("1. Open browser: http://localhost:5173")
    print("2. Login with your WorkFossa credentials")
    print("3. Check browser console for any errors")
    print("4. Check Network tab to see if auth token is being sent")
    print("\n💡 Common Issues:")
    print("- Token not stored in localStorage after login")
    print("- Token not included in Authorization header")
    print("- Token expired")
    print("- CORS issues between frontend and backend")

if __name__ == "__main__":
    test_auth_flow()