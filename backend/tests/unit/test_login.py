#!/usr/bin/env python3
"""
Test login functionality
"""

import requests
import json

def test_login():
    """Test the login endpoint"""
    print("🔐 Testing Login Endpoint")
    print("=" * 50)
    
    # Check if backend is running
    try:
        response = requests.get("http://localhost:8000/health")
        print(f"✅ Backend is running: {response.json()}")
    except:
        print("❌ Backend is not running!")
        print("   Run: ./tools/unix/start-fossawork.sh")
        return
    
    # Check login endpoint
    print("\n📝 Login endpoint: http://localhost:8000/api/auth/login")
    print("\nTo test login manually:")
    print("1. Open browser: http://localhost:5173")
    print("2. You should see the login page")
    print("3. Enter your WorkFossa credentials")
    print("4. Click Login")
    print("\nIf login fails, check:")
    print("- Browser console (F12) for errors")
    print("- Network tab to see the API response")
    print("- Make sure you're using correct WorkFossa credentials")
    
    # Test OPTIONS request (for CORS)
    try:
        response = requests.options("http://localhost:8000/api/auth/login")
        print(f"\n✅ CORS check: {response.status_code}")
        if 'access-control-allow-origin' in response.headers:
            print(f"   Allowed origins: {response.headers['access-control-allow-origin']}")
    except Exception as e:
        print(f"\n❌ CORS check failed: {e}")

if __name__ == "__main__":
    test_login()