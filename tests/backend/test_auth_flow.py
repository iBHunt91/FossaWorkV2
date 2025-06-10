#!/usr/bin/env python3
"""
Comprehensive test of the authentication flow
"""

import requests
import json
import sys
import time

BASE_URL = "http://localhost:8000"

class AuthTester:
    def __init__(self):
        self.token = None
        self.test_credentials = {
            "username": "test@example.com",
            "password": "test_password_123"
        }
    
    def test_server_health(self):
        """Test if server is running"""
        print("🏥 Testing server health...")
        try:
            response = requests.get(BASE_URL)
            data = response.json()
            print(f"   ✅ Server is running: {data.get('message')}")
            return True
        except Exception as e:
            print(f"   ❌ Server not reachable: {e}")
            print("   Run: tools\\start-backend-dev.bat")
            return False
    
    def test_setup_status(self):
        """Check if setup is required"""
        print("\n🔍 Checking setup status...")
        try:
            response = requests.get(f"{BASE_URL}/api/setup/status")
            data = response.json()
            print(f"   User count: {data.get('user_count', 0)}")
            print(f"   Setup required: {data.get('setup_required', False)}")
            return data
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return None
    
    def test_initialize_user(self):
        """Test user initialization (only works if no users exist)"""
        print("\n👤 Testing user initialization...")
        print("   ⚠️  Note: This uses test credentials, not real WorkFossa")
        
        try:
            # For testing, we'll try the endpoint even though it may fail
            # without real WorkFossa credentials
            response = requests.post(
                f"{BASE_URL}/api/setup/initialize",
                json=self.test_credentials
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print(f"   ✅ User created successfully!")
                print(f"   Token: {self.token[:20]}...")
                return True
            else:
                print(f"   ❌ Status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False
    
    def test_login(self):
        """Test login endpoint"""
        print("\n🔐 Testing login...")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                data={
                    "username": self.test_credentials["username"],
                    "password": self.test_credentials["password"]
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print(f"   ✅ Login successful!")
                print(f"   Token: {self.token[:20]}...")
                return True
            else:
                print(f"   ❌ Status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False
    
    def test_auth_check(self):
        """Test authentication check"""
        print("\n🔍 Testing auth check...")
        
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/check",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Authenticated as: {data.get('username')}")
                return True
            else:
                print(f"   ❌ Status {response.status_code}: Not authenticated")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False
    
    def test_protected_route(self):
        """Test accessing protected route"""
        print("\n🔒 Testing protected route access...")
        
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/users/me",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ User profile retrieved:")
                print(f"      ID: {data.get('id')}")
                print(f"      Username: {data.get('username')}")
                print(f"      Email: {data.get('email')}")
                return True
            else:
                print(f"   ❌ Status {response.status_code}: Access denied")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("=" * 60)
        print("🧪 FossaWork V2 Authentication Test Suite")
        print("=" * 60)
        
        # Check server
        if not self.test_server_health():
            return
        
        # Check setup status
        status = self.test_setup_status()
        if not status:
            return
        
        # Test based on current state
        if status.get("setup_required"):
            print("\n📝 System is in zero-user state")
            print("   Testing initialization flow...")
            
            # Try to initialize (will fail without real WorkFossa creds)
            self.test_initialize_user()
            
            print("\n⚠️  Note: User creation requires real WorkFossa credentials")
            print("   The test credentials won't work with actual WorkFossa verification")
        else:
            print("\n📝 Users exist in system")
            print("   Testing login flow...")
            
            # Test login
            if self.test_login():
                # Test authenticated access
                self.test_auth_check()
                self.test_protected_route()
        
        print("\n" + "=" * 60)
        print("✅ Test suite complete!")
        print("=" * 60)
        
        print("\n📚 Additional Resources:")
        print("   - API Documentation: http://localhost:8000/docs")
        print("   - Reset Database: tools\\reset-database.bat")
        print("   - Quick Start Guide: QUICK_START_GUIDE.md")

if __name__ == "__main__":
    tester = AuthTester()
    tester.run_all_tests()