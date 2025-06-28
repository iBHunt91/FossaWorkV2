#!/usr/bin/env python3
"""
Test script to verify security headers are properly implemented

This script tests that all security headers are present and configured correctly
for different environments.
"""

import httpx
import asyncio
from typing import Dict, List, Tuple
from datetime import datetime
import json

# Configuration
BASE_URL = "http://localhost:8000"

# Required security headers
REQUIRED_HEADERS = {
    "common": [
        "X-Content-Type-Options",
        "X-XSS-Protection", 
        "X-Frame-Options",
        "Referrer-Policy",
        "Content-Security-Policy",
        "Permissions-Policy"
    ],
    "production": [
        "Strict-Transport-Security",
        "Expect-CT"
    ]
}

# Expected header values
EXPECTED_VALUES = {
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "X-Frame-Options": ["DENY", "SAMEORIGIN"],  # Either is acceptable
    "Referrer-Policy": "strict-origin-when-cross-origin"
}

# CSP directives that should be present
REQUIRED_CSP_DIRECTIVES = [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "connect-src",
    "frame-ancestors",
    "object-src"
]

class SecurityHeaderTester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True)
        self.results = []
        
    async def test_endpoint(self, path: str, description: str):
        """Test security headers on a specific endpoint"""
        print(f"\n🔍 Testing: {description} ({path})")
        print("=" * 50)
        
        try:
            response = await self.client.get(path)
            
            # Check status
            print(f"Status Code: {response.status_code}")
            
            # Test required headers
            missing_headers = []
            present_headers = []
            
            for header in REQUIRED_HEADERS["common"]:
                if header in response.headers:
                    present_headers.append(header)
                    value = response.headers[header]
                    print(f"✅ {header}: {value[:80]}{'...' if len(value) > 80 else ''}")
                    
                    # Check expected values
                    if header in EXPECTED_VALUES:
                        expected = EXPECTED_VALUES[header]
                        if isinstance(expected, list):
                            if value not in expected:
                                print(f"   ⚠️  Unexpected value. Expected one of: {expected}")
                        elif value != expected:
                            print(f"   ⚠️  Unexpected value. Expected: {expected}")
                else:
                    missing_headers.append(header)
                    print(f"❌ {header}: MISSING")
            
            # Analyze CSP if present
            if "Content-Security-Policy" in response.headers:
                self._analyze_csp(response.headers["Content-Security-Policy"])
            
            # Record results
            self.results.append({
                "endpoint": path,
                "description": description,
                "status": response.status_code,
                "missing_headers": missing_headers,
                "present_headers": present_headers,
                "passed": len(missing_headers) == 0
            })
            
        except Exception as e:
            print(f"❌ Error testing endpoint: {e}")
            self.results.append({
                "endpoint": path,
                "description": description,
                "error": str(e),
                "passed": False
            })
    
    def _analyze_csp(self, csp_value: str):
        """Analyze Content Security Policy header"""
        print("\n📋 CSP Analysis:")
        
        directives = {}
        for directive in csp_value.split(";"):
            parts = directive.strip().split(" ", 1)
            if len(parts) >= 1:
                key = parts[0]
                value = parts[1] if len(parts) > 1 else ""
                directives[key] = value
        
        # Check required directives
        for required in REQUIRED_CSP_DIRECTIVES:
            if required in directives:
                print(f"  ✓ {required}: {directives[required][:50]}{'...' if len(directives[required]) > 50 else ''}")
            else:
                print(f"  ✗ {required}: MISSING")
        
        # Security warnings
        if "'unsafe-eval'" in csp_value:
            print("  ⚠️  Warning: 'unsafe-eval' detected (security risk)")
        if "'unsafe-inline'" in directives.get("script-src", ""):
            print("  ⚠️  Warning: 'unsafe-inline' in script-src (XSS risk)")
        if "*" in directives.get("default-src", ""):
            print("  ⚠️  Warning: Wildcard in default-src (too permissive)")
    
    async def test_all_endpoints(self):
        """Test multiple endpoints"""
        endpoints = [
            ("/api/health", "Health Check API"),
            ("/api/v1/work-orders", "Work Orders API (requires auth)"),
            ("/docs", "API Documentation"),
            ("/", "Root endpoint")
        ]
        
        for path, description in endpoints:
            await self.test_endpoint(path, description)
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 SECURITY HEADERS TEST SUMMARY")
        print("="*60)
        
        total = len(self.results)
        passed = sum(1 for r in self.results if r.get("passed", False))
        
        print(f"\nTotal Endpoints Tested: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        print("\nDetailed Results:")
        for result in self.results:
            status = "✅ PASS" if result.get("passed") else "❌ FAIL"
            print(f"\n{status} {result['description']}")
            
            if result.get("error"):
                print(f"   Error: {result['error']}")
            elif result.get("missing_headers"):
                print(f"   Missing headers: {', '.join(result['missing_headers'])}")
            else:
                print(f"   All {len(result['present_headers'])} required headers present")
        
        # Recommendations
        print("\n💡 Recommendations:")
        
        all_missing = set()
        for result in self.results:
            if "missing_headers" in result:
                all_missing.update(result["missing_headers"])
        
        if all_missing:
            print("\nMissing Headers to Implement:")
            for header in all_missing:
                print(f"  - {header}")
        else:
            print("  ✅ All required security headers are implemented!")
        
        # Check for production headers
        print("\n🔒 Production Readiness:")
        prod_ready = True
        
        for header in REQUIRED_HEADERS.get("production", []):
            found = False
            for result in self.results:
                if header in result.get("present_headers", []):
                    found = True
                    break
            
            if not found:
                print(f"  ⚠️  {header} not found (required for production)")
                prod_ready = False
        
        if prod_ready:
            print("  ✅ Production security headers are ready!")
        else:
            print("  ❌ Additional headers needed for production deployment")
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

async def test_csp_violations():
    """Test CSP violation reporting"""
    print("\n🚨 Testing CSP Violation Handling")
    print("="*50)
    
    # This would typically be done in a browser
    # Here we just document how to test it
    print("To test CSP violations:")
    print("1. Open browser developer console")
    print("2. Navigate to the application")
    print("3. Try injecting inline scripts:")
    print('   document.body.innerHTML += "<script>alert(\'XSS\')</script>"')
    print("4. Check console for CSP violation messages")
    print("5. Check if violations are reported to CSP report URI (if configured)")

async def main():
    """Run security header tests"""
    print("🛡️  FossaWork V2 Security Headers Test")
    print(f"Testing against: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}\n")
    
    tester = SecurityHeaderTester()
    
    try:
        # Test endpoints
        await tester.test_all_endpoints()
        
        # Print summary
        tester.print_summary()
        
        # CSP violation testing info
        await test_csp_violations()
        
        print("\n✅ Security header testing complete!")
        
    except httpx.ConnectError:
        print("❌ Could not connect to the API. Is the server running?")
        print(f"   Expected server at: {BASE_URL}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())