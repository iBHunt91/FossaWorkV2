#!/usr/bin/env python3
"""
Test script to verify security fixes for authentication bypass vulnerability

Run this script to test that:
1. Users cannot access other users' data
2. Authentication is properly enforced
3. Security logging is working
"""

import asyncio
import httpx
import json
from datetime import datetime
from typing import Dict, Tuple

# Configuration
BASE_URL = "http://localhost:8000"
TEST_USERS = {
    "user_a": {
        "username": "test_user_a",
        "password": "test_password_a"
    },
    "user_b": {
        "username": "test_user_b", 
        "password": "test_password_b"
    }
}

class SecurityTester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL)
        self.tokens = {}
        self.results = []
        
    async def setup(self):
        """Create test users and get tokens"""
        print("🔧 Setting up test users...")
        
        for user_id, creds in TEST_USERS.items():
            # Try to create user (might already exist)
            try:
                await self.client.post(
                    "/api/auth/register",
                    json={
                        "username": creds["username"],
                        "password": creds["password"],
                        "email": f"{creds['username']}@test.com"
                    }
                )
            except:
                pass  # User might already exist
            
            # Login to get token
            response = await self.client.post(
                "/api/auth/login",
                data={
                    "username": creds["username"],
                    "password": creds["password"]
                }
            )
            
            if response.status_code == 200:
                self.tokens[user_id] = response.json()["access_token"]
                print(f"✅ Got token for {user_id}")
            else:
                print(f"❌ Failed to login {user_id}: {response.text}")
    
    async def test_endpoint(self, method: str, path: str, test_name: str, **kwargs):
        """Test a single endpoint"""
        print(f"\n🧪 Testing: {test_name}")
        
        # Test 1: No authentication
        print("  1️⃣ Testing without authentication...")
        response = await self.client.request(method, path, **kwargs)
        if response.status_code == 401:
            print("    ✅ Correctly rejected (401 Unauthorized)")
            self.results.append((test_name, "No Auth", True))
        else:
            print(f"    ❌ FAIL: Got {response.status_code} instead of 401")
            self.results.append((test_name, "No Auth", False))
        
        # Test 2: User A accessing their own data
        if "user_a" in self.tokens:
            print("  2️⃣ Testing user A accessing own data...")
            headers = {"Authorization": f"Bearer {self.tokens['user_a']}"}
            
            # Replace user_id in path/params with user A's ID
            test_kwargs = kwargs.copy()
            if "params" in test_kwargs:
                test_kwargs["params"]["user_id"] = "user_a"
            
            response = await self.client.request(method, path, headers=headers, **test_kwargs)
            if response.status_code in [200, 201, 204]:
                print("    ✅ User can access own data")
                self.results.append((test_name, "Own Data", True))
            else:
                print(f"    ❌ FAIL: Got {response.status_code}: {response.text}")
                self.results.append((test_name, "Own Data", False))
        
        # Test 3: User A trying to access user B's data
        if "user_a" in self.tokens and "user_b" in self.tokens:
            print("  3️⃣ Testing user A accessing user B's data...")
            headers = {"Authorization": f"Bearer {self.tokens['user_a']}"}
            
            # Try to access user B's data
            test_kwargs = kwargs.copy()
            if "params" in test_kwargs:
                test_kwargs["params"]["user_id"] = "user_b"
            
            response = await self.client.request(method, path, headers=headers, **test_kwargs)
            if response.status_code == 403:
                print("    ✅ Correctly rejected (403 Forbidden)")
                self.results.append((test_name, "Other's Data", True))
            elif response.status_code == 200:
                print(f"    ❌ CRITICAL FAIL: User A accessed user B's data!")
                self.results.append((test_name, "Other's Data", False))
            else:
                print(f"    ⚠️  Got {response.status_code}: {response.text}")
                self.results.append((test_name, "Other's Data", False))
    
    async def run_tests(self):
        """Run all security tests"""
        print("\n🔐 Starting Security Tests\n" + "="*50)
        
        # Critical endpoints
        await self.test_endpoint(
            "GET", 
            "/api/v1/credentials/workfossa/decrypt",
            "Credential Decryption",
            params={"user_id": "user_a"}
        )
        
        await self.test_endpoint(
            "GET",
            "/api/v1/work-orders",
            "Work Orders List", 
            params={"user_id": "user_a"}
        )
        
        await self.test_endpoint(
            "GET",
            "/api/settings/smtp/user_a",
            "SMTP Settings"
        )
        
        await self.test_endpoint(
            "GET",
            "/api/notifications/preferences/user_a",
            "Notification Preferences"
        )
    
    async def check_migration_report(self):
        """Check the security migration report"""
        print("\n📊 Checking Migration Report\n" + "="*50)
        
        try:
            response = await self.client.get("/api/admin/security-migration-report")
            if response.status_code == 200:
                report = response.json()
                print(f"Total legacy endpoints found: {report.get('total_legacy_endpoints', 0)}")
                print(f"Total violations: {report.get('total_violations', 0)}")
                
                if report.get('endpoints'):
                    print("\nEndpoints with user_id params:")
                    for ep in report['endpoints']:
                        critical = "🚨 CRITICAL" if ep['is_critical'] else ""
                        print(f"  - {ep['path']} ({ep['violation_count']} violations) {critical}")
                
                if report.get('recommendations'):
                    print("\nRecommendations:")
                    for rec in report['recommendations']:
                        print(f"  - {rec}")
            else:
                print("❌ Could not fetch migration report")
        except Exception as e:
            print(f"❌ Error fetching report: {e}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n📋 Test Summary\n" + "="*50)
        
        passed = sum(1 for _, _, result in self.results if result)
        total = len(self.results)
        
        print(f"\nResults: {passed}/{total} tests passed\n")
        
        # Group by test name
        test_groups = {}
        for test_name, test_type, result in self.results:
            if test_name not in test_groups:
                test_groups[test_name] = {}
            test_groups[test_name][test_type] = result
        
        # Print detailed results
        for test_name, results in test_groups.items():
            all_passed = all(results.values())
            status = "✅ PASS" if all_passed else "❌ FAIL"
            print(f"{status} {test_name}")
            for test_type, result in results.items():
                icon = "✓" if result else "✗"
                print(f"    {icon} {test_type}")
        
        # Security assessment
        print("\n🔒 Security Assessment:")
        critical_fails = [r for r in self.results if not r[2] and "Other's Data" in r[1]]
        
        if critical_fails:
            print("❌ CRITICAL: Authentication bypass vulnerability detected!")
            print("   Users can access other users' data on these endpoints:")
            for test_name, _, _ in critical_fails:
                print(f"   - {test_name}")
        else:
            print("✅ Good: No authentication bypass vulnerabilities detected")
        
        if passed == total:
            print("\n🎉 All security tests passed!")
        else:
            print(f"\n⚠️  {total - passed} security tests failed. Please fix these issues.")
    
    async def cleanup(self):
        """Cleanup resources"""
        await self.client.aclose()

async def main():
    """Run the security tests"""
    print("🚀 FossaWork V2 Security Test Suite")
    print(f"   Testing against: {BASE_URL}")
    print(f"   Time: {datetime.now().isoformat()}\n")
    
    tester = SecurityTester()
    
    try:
        await tester.setup()
        await tester.run_tests()
        await tester.check_migration_report()
        tester.print_summary()
    except httpx.ConnectError:
        print("❌ Could not connect to the API. Is the server running?")
        print(f"   Expected server at: {BASE_URL}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    asyncio.run(main())