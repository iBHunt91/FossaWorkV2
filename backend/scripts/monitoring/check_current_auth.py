#!/usr/bin/env python3
"""
Check current authentication status
"""

import requests

def check_auth():
    """Check if authentication is working"""
    print("🔐 Checking Current Authentication")
    print("=" * 50)
    
    # First, let's test if the backend is responding
    try:
        response = requests.get("http://localhost:8000/health")
        print(f"✅ Backend is running: {response.json()}")
    except Exception as e:
        print(f"❌ Backend error: {e}")
        return
    
    print("\n📝 To check your authentication:")
    print("1. Open browser DevTools (F12)")
    print("2. Go to Console tab")
    print("3. Type this and press Enter:")
    print("   localStorage.getItem('token')")
    print("\n4. If you see a token (long string), copy it")
    print("5. In Console, test with:")
    print("""
   fetch('http://localhost:8000/api/v1/work-orders/?user_id=7bea3bdb7e8e303eacaba442bd824004', {
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('token')
     }
   }).then(r => r.json()).then(console.log)
   """)
    
    print("\n⚠️  Common issues:")
    print("- If token is null: You need to login")
    print("- If you get 401: Token is invalid/expired")
    print("- If you get 500: There's a backend error")
    
    print("\n🔧 Quick fix if token exists but doesn't work:")
    print("1. The backend may have restarted with a different SECRET_KEY")
    print("2. Just logout and login again to get a new token")

if __name__ == "__main__":
    check_auth()