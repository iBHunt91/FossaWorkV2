#!/usr/bin/env python3
"""
Test Security Headers Implementation

Verifies that all security headers are properly applied to responses.

Author: Security Headers Specialist
Date: 2025-01-23
"""

import asyncio
import httpx
from typing import Dict, List, Optional
from tabulate import tabulate
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "../../backend"))


class SecurityHeadersTester:
    """Test security headers implementation"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.required_headers = {
            "Content-Security-Policy": "CSP header for XSS protection",
            "X-Frame-Options": "Clickjacking protection",
            "X-Content-Type-Options": "MIME type sniffing protection",
            "X-XSS-Protection": "XSS filter (legacy but useful)",
            "Referrer-Policy": "Referrer information control",
            "Permissions-Policy": "Browser feature permissions"
        }
        self.conditional_headers = {
            "Strict-Transport-Security": "HSTS (not in development)"
        }
        
    async def test_endpoint(self, endpoint: str, method: str = "GET") -> Dict[str, Optional[str]]:
        """Test a single endpoint for security headers"""
        async with httpx.AsyncClient() as client:
            try:
                if method == "GET":
                    response = await client.get(f"{self.base_url}{endpoint}")
                elif method == "POST":
                    response = await client.post(f"{self.base_url}{endpoint}", json={})
                else:
                    response = await client.request(method, f"{self.base_url}{endpoint}")
                
                return {
                    "status": response.status_code,
                    "headers": dict(response.headers)
                }
            except Exception as e:
                return {
                    "status": "error",
                    "headers": {},
                    "error": str(e)
                }
    
    def check_csp_directives(self, csp_header: str) -> Dict[str, List[str]]:
        """Parse and check CSP directives"""
        directives = {}
        for directive in csp_header.split(";"):
            directive = directive.strip()
            if directive:
                parts = directive.split()
                if parts:
                    directive_name = parts[0]
                    sources = parts[1:] if len(parts) > 1 else []
                    directives[directive_name] = sources
        return directives
    
    def analyze_headers(self, headers: Dict[str, str], endpoint: str) -> Dict[str, any]:
        """Analyze security headers for an endpoint"""
        results = {
            "endpoint": endpoint,
            "missing": [],
            "present": [],
            "issues": []
        }
        
        # Check required headers
        for header, description in self.required_headers.items():
            if header.lower() in [h.lower() for h in headers]:
                results["present"].append(header)
                
                # Special checks for specific headers
                if header == "Content-Security-Policy":
                    csp_value = headers.get(header, "")
                    csp_directives = self.check_csp_directives(csp_value)
                    
                    # Check for important directives
                    if "default-src" not in csp_directives:
                        results["issues"].append("CSP missing default-src directive")
                    if "frame-ancestors" not in csp_directives:
                        results["issues"].append("CSP missing frame-ancestors directive")
                    
                    # Check for unsafe directives in production
                    if os.getenv("ENVIRONMENT") == "production":
                        for directive, sources in csp_directives.items():
                            if "'unsafe-inline'" in sources and directive == "script-src":
                                results["issues"].append("CSP uses unsafe-inline for scripts in production")
                            if "'unsafe-eval'" in sources:
                                results["issues"].append(f"CSP uses unsafe-eval in {directive}")
                
                elif header == "X-Frame-Options":
                    value = headers.get(header, "")
                    if value not in ["DENY", "SAMEORIGIN"]:
                        results["issues"].append(f"X-Frame-Options has invalid value: {value}")
                
            else:
                results["missing"].append(header)
        
        # Check conditional headers
        for header, description in self.conditional_headers.items():
            if header.lower() in [h.lower() for h in headers]:
                results["present"].append(f"{header} (conditional)")
        
        return results
    
    async def run_tests(self):
        """Run security header tests on multiple endpoints"""
        endpoints = [
            # API endpoints
            ("/", "GET"),
            ("/health", "GET"),
            ("/api/v1/status", "GET"),
            ("/api/auth/login", "POST"),
            ("/api/work-orders", "GET"),
            
            # Static resources (if served by FastAPI)
            ("/static/test.js", "GET"),
            ("/static/test.css", "GET"),
        ]
        
        print("\n🔒 Security Headers Test Report")
        print("=" * 80)
        print(f"Testing: {self.base_url}")
        print(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
        print("=" * 80)
        
        all_results = []
        
        for endpoint, method in endpoints:
            result = await self.test_endpoint(endpoint, method)
            if result["status"] == "error":
                print(f"\n❌ Error testing {endpoint}: {result.get('error', 'Unknown error')}")
                continue
            
            analysis = self.analyze_headers(result["headers"], endpoint)
            all_results.append(analysis)
            
            # Print results for this endpoint
            print(f"\n📍 Endpoint: {method} {endpoint} (Status: {result['status']})")
            
            if analysis["present"]:
                print("✅ Present headers:")
                for header in analysis["present"]:
                    print(f"   - {header}")
            
            if analysis["missing"]:
                print("❌ Missing headers:")
                for header in analysis["missing"]:
                    print(f"   - {header}")
            
            if analysis["issues"]:
                print("⚠️  Issues found:")
                for issue in analysis["issues"]:
                    print(f"   - {issue}")
            
            # Show CSP details for first endpoint
            if endpoint == "/" and "Content-Security-Policy" in result["headers"]:
                print("\n📋 CSP Directives:")
                csp_directives = self.check_csp_directives(result["headers"]["Content-Security-Policy"])
                for directive, sources in csp_directives.items():
                    print(f"   {directive}: {' '.join(sources) if sources else '(no value)'}")
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 Summary")
        print("=" * 80)
        
        total_endpoints = len(all_results)
        fully_secure = sum(1 for r in all_results if not r["missing"] and not r["issues"])
        
        print(f"Total endpoints tested: {total_endpoints}")
        print(f"Fully secure endpoints: {fully_secure}")
        print(f"Security coverage: {(fully_secure/total_endpoints*100):.1f}%")
        
        # Recommendations
        print("\n💡 Recommendations:")
        if os.getenv("ENVIRONMENT") == "development":
            print("- Development environment detected. Some security headers are relaxed.")
            print("- Test with ENVIRONMENT=production for stricter validation.")
        else:
            print("- Consider implementing Content Security Policy reporting.")
            print("- Review and tighten CSP directives for production use.")
            print("- Implement nonce-based CSP for inline scripts if needed.")
        
        return all_results


async def main():
    """Main test runner"""
    # Check if server is running
    try:
        async with httpx.AsyncClient() as client:
            await client.get("http://localhost:8000/health")
    except Exception:
        print("❌ Error: Backend server is not running on http://localhost:8000")
        print("Please start the backend server first:")
        print("  cd backend && uvicorn app.main:app --reload --port 8000")
        return
    
    tester = SecurityHeadersTester()
    await tester.run_tests()


if __name__ == "__main__":
    asyncio.run(main())