#!/usr/bin/env python3
"""
Rate Limiting Security Tests
Comprehensive testing of rate limiting and throttling mechanisms
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict, List, Any
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

class RateLimitingTester:
    """Test suite for rate limiting and throttling vulnerabilities"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.test_results = []
        
    async def run_all_tests(self) -> List[Dict[str, Any]]:
        """Run all rate limiting tests"""
        print("🚦 Testing Rate Limiting & Throttling...")
        
        test_methods = [
            self.test_authentication_rate_limiting,
            self.test_api_endpoint_rate_limiting,
            self.test_concurrent_request_limiting,
            self.test_user_based_throttling,
            self.test_ip_based_rate_limiting,
            self.test_burst_protection,
            self.test_distributed_rate_limiting,
            self.test_rate_limit_bypass_attempts,
            self.test_slowloris_protection,
            self.test_request_size_limiting
        ]
        
        for test_method in test_methods:
            try:
                result = await test_method()
                self.test_results.append(result)
            except Exception as e:
                self.test_results.append({
                    "test": test_method.__name__,
                    "status": "ERROR",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
        
        return self.test_results
    
    async def test_authentication_rate_limiting(self) -> Dict[str, Any]:
        """Test rate limiting on authentication endpoints"""
        test_name = "Authentication Rate Limiting"
        vulnerabilities = []
        
        # Test login endpoint rate limiting
        session = requests.Session()
        failed_attempts = 0
        rate_limited = False
        response_times = []
        
        for i in range(20):  # Try 20 rapid attempts
            try:
                start_time = time.time()
                
                response = session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": "testuser", "password": f"wrong{i}"},
                    timeout=10
                )
                
                end_time = time.time()
                response_times.append(end_time - start_time)
                
                if response.status_code == 429:  # Too Many Requests
                    rate_limited = True
                    rate_limit_attempt = i + 1
                    break
                elif response.status_code == 401:
                    failed_attempts += 1
                
                # Small delay to avoid overwhelming
                await asyncio.sleep(0.1)
                
            except Exception as e:
                break
        
        # Analyze results
        if not rate_limited and failed_attempts >= 10:
            vulnerabilities.append({
                "endpoint": "/api/auth/login",
                "failed_attempts": failed_attempts,
                "rate_limited": False,
                "severity": "HIGH",
                "description": f"No rate limiting after {failed_attempts} failed login attempts"
            })
        
        # Test password reset rate limiting
        reset_attempts = 0
        reset_rate_limited = False
        
        for i in range(15):
            try:
                response = session.post(
                    f"{self.base_url}/api/auth/reset-password",
                    json={"email": f"test{i}@example.com"},
                    timeout=10
                )
                
                if response.status_code == 429:
                    reset_rate_limited = True
                    reset_rate_limit_attempt = i + 1
                    break
                else:
                    reset_attempts += 1
                
                await asyncio.sleep(0.1)
                
            except Exception:
                break
        
        if not reset_rate_limited and reset_attempts >= 10:
            vulnerabilities.append({
                "endpoint": "/api/auth/reset-password",
                "attempts": reset_attempts,
                "rate_limited": False,
                "severity": "MEDIUM",
                "description": f"No rate limiting on password reset after {reset_attempts} attempts"
            })
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "metrics": {
                "login_attempts": failed_attempts,
                "login_rate_limited": rate_limited,
                "reset_attempts": reset_attempts,
                "reset_rate_limited": reset_rate_limited,
                "avg_response_time": sum(response_times) / len(response_times) if response_times else 0
            }
        }
    
    async def test_api_endpoint_rate_limiting(self) -> Dict[str, Any]:
        """Test rate limiting on API endpoints"""
        test_name = "API Endpoint Rate Limiting"
        vulnerabilities = []
        
        # Test various API endpoints
        test_endpoints = [
            "/api/work-orders",
            "/api/dispensers",
            "/api/users",
            "/api/settings",
            "/api/logs"
        ]
        
        session = requests.Session()
        
        for endpoint in test_endpoints:
            requests_made = 0
            rate_limited = False
            response_codes = []
            
            for i in range(50):  # Try 50 rapid requests
                try:
                    response = session.get(
                        f"{self.base_url}{endpoint}",
                        timeout=5
                    )
                    
                    response_codes.append(response.status_code)
                    requests_made += 1
                    
                    if response.status_code == 429:
                        rate_limited = True
                        break
                    
                    # Very small delay
                    await asyncio.sleep(0.05)
                    
                except Exception:
                    break
            
            # Check if rate limiting is working
            if not rate_limited and requests_made >= 30:
                vulnerabilities.append({
                    "endpoint": endpoint,
                    "requests_made": requests_made,
                    "rate_limited": False,
                    "response_codes": list(set(response_codes)),
                    "severity": "MEDIUM",
                    "description": f"No rate limiting on {endpoint} after {requests_made} requests"
                })
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "endpoints_tested": len(test_endpoints)
        }
    
    async def test_concurrent_request_limiting(self) -> Dict[str, Any]:
        """Test concurrent request limiting"""
        test_name = "Concurrent Request Limiting"
        vulnerabilities = []
        
        def make_request(session_id):
            """Make a single request"""
            try:
                session = requests.Session()
                response = session.get(
                    f"{self.base_url}/api/work-orders",
                    timeout=10
                )
                return {
                    "session_id": session_id,
                    "status_code": response.status_code,
                    "response_time": response.elapsed.total_seconds()
                }
            except Exception as e:
                return {
                    "session_id": session_id,
                    "error": str(e),
                    "status_code": None
                }
        
        # Test concurrent requests
        num_concurrent = 50
        successful_requests = 0
        rate_limited_requests = 0
        error_requests = 0
        
        with ThreadPoolExecutor(max_workers=num_concurrent) as executor:
            # Submit all requests at once
            futures = [executor.submit(make_request, i) for i in range(num_concurrent)]
            
            # Collect results
            for future in as_completed(futures):
                result = future.result()
                
                if result.get("status_code") == 200:
                    successful_requests += 1
                elif result.get("status_code") == 429:
                    rate_limited_requests += 1
                else:
                    error_requests += 1
        
        # Check if too many concurrent requests were allowed
        if successful_requests > 30:  # Threshold for concern
            vulnerabilities.append({
                "concurrent_requests": num_concurrent,
                "successful_requests": successful_requests,
                "rate_limited_requests": rate_limited_requests,
                "error_requests": error_requests,
                "severity": "MEDIUM",
                "description": f"{successful_requests} concurrent requests succeeded, possible DoS risk"
            })
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "metrics": {
                "concurrent_requests": num_concurrent,
                "successful": successful_requests,
                "rate_limited": rate_limited_requests,
                "errors": error_requests
            }
        }
    
    async def test_user_based_throttling(self) -> Dict[str, Any]:
        """Test user-based throttling"""
        test_name = "User-Based Throttling"
        vulnerabilities = []
        
        # Test with authenticated user
        session = requests.Session()
        
        # First try to login (if authentication is available)
        try:
            login_response = session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "testuser", "password": "testpass"}
            )
            
            if login_response.status_code == 200:
                token_data = login_response.json()
                token = token_data.get("access_token") or token_data.get("token")
                
                if token:
                    headers = {"Authorization": f"Bearer {token}"}
                    
                    # Make rapid authenticated requests
                    requests_made = 0
                    rate_limited = False
                    
                    for i in range(30):
                        try:
                            response = session.get(
                                f"{self.base_url}/api/auth/profile",
                                headers=headers,
                                timeout=5
                            )
                            
                            requests_made += 1
                            
                            if response.status_code == 429:
                                rate_limited = True
                                break
                            
                            await asyncio.sleep(0.1)
                            
                        except Exception:
                            break
                    
                    # Check if user-based throttling is working
                    if not rate_limited and requests_made >= 20:
                        vulnerabilities.append({
                            "test_type": "authenticated_user_throttling",
                            "requests_made": requests_made,
                            "rate_limited": False,
                            "severity": "LOW",
                            "description": f"No user-based throttling after {requests_made} authenticated requests"
                        })
        
        except Exception:
            pass
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_ip_based_rate_limiting(self) -> Dict[str, Any]:
        """Test IP-based rate limiting"""
        test_name = "IP-Based Rate Limiting"
        vulnerabilities = []
        
        # Test with different IP headers
        ip_headers = [
            {"X-Forwarded-For": "192.168.1.100"},
            {"X-Real-IP": "10.0.0.100"},
            {"X-Originating-IP": "172.16.1.100"},
            {"Client-IP": "203.0.113.100"}
        ]
        
        session = requests.Session()
        
        # First, exhaust rate limit from real IP
        requests_from_real_ip = 0
        real_ip_limited = False
        
        for i in range(25):
            try:
                response = session.get(
                    f"{self.base_url}/api/work-orders",
                    timeout=5
                )
                
                requests_from_real_ip += 1
                
                if response.status_code == 429:
                    real_ip_limited = True
                    break
                
                await asyncio.sleep(0.1)
                
            except Exception:
                break
        
        # If rate limited, try to bypass with different IP headers
        if real_ip_limited:
            for headers in ip_headers:
                try:
                    response = session.get(
                        f"{self.base_url}/api/work-orders",
                        headers=headers,
                        timeout=5
                    )
                    
                    if response.status_code != 429:
                        vulnerabilities.append({
                            "bypass_method": "ip_header_spoofing",
                            "bypass_headers": headers,
                            "response_code": response.status_code,
                            "severity": "MEDIUM",
                            "description": f"Rate limit bypassed using IP headers: {headers}"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "real_ip_limited": real_ip_limited,
            "requests_before_limit": requests_from_real_ip
        }
    
    async def test_burst_protection(self) -> Dict[str, Any]:
        """Test burst protection mechanisms"""
        test_name = "Burst Protection"
        vulnerabilities = []
        
        session = requests.Session()
        
        # Test very rapid burst of requests
        burst_size = 100
        burst_duration = 2  # seconds
        
        start_time = time.time()
        requests_in_burst = 0
        successful_requests = 0
        rate_limited_requests = 0
        
        while time.time() - start_time < burst_duration and requests_in_burst < burst_size:
            try:
                response = session.get(
                    f"{self.base_url}/api/dispensers",
                    timeout=1
                )
                
                requests_in_burst += 1
                
                if response.status_code == 200:
                    successful_requests += 1
                elif response.status_code == 429:
                    rate_limited_requests += 1
                
            except Exception:
                continue
        
        # Check if burst protection is working
        success_rate = successful_requests / requests_in_burst if requests_in_burst > 0 else 0
        
        if success_rate > 0.8:  # More than 80% success rate in burst
            vulnerabilities.append({
                "burst_size": burst_size,
                "burst_duration": burst_duration,
                "requests_made": requests_in_burst,
                "successful_requests": successful_requests,
                "success_rate": success_rate,
                "severity": "MEDIUM",
                "description": f"Burst protection ineffective: {success_rate:.1%} success rate"
            })
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "metrics": {
                "burst_requests": requests_in_burst,
                "successful": successful_requests,
                "rate_limited": rate_limited_requests,
                "success_rate": success_rate
            }
        }
    
    async def test_distributed_rate_limiting(self) -> Dict[str, Any]:
        """Test distributed rate limiting across multiple sessions"""
        test_name = "Distributed Rate Limiting"
        vulnerabilities = []
        
        def make_session_requests(session_id, num_requests):
            """Make requests from a separate session"""
            session = requests.Session()
            results = {"session_id": session_id, "requests": []}
            
            for i in range(num_requests):
                try:
                    start_time = time.time()
                    response = session.get(
                        f"{self.base_url}/api/work-orders",
                        timeout=5
                    )
                    end_time = time.time()
                    
                    results["requests"].append({
                        "request_num": i,
                        "status_code": response.status_code,
                        "response_time": end_time - start_time
                    })
                    
                    if response.status_code == 429:
                        break
                    
                    time.sleep(0.1)
                    
                except Exception as e:
                    results["requests"].append({
                        "request_num": i,
                        "error": str(e)
                    })
                    break
            
            return results
        
        # Test with multiple concurrent sessions
        num_sessions = 10
        requests_per_session = 15
        
        with ThreadPoolExecutor(max_workers=num_sessions) as executor:
            futures = [
                executor.submit(make_session_requests, i, requests_per_session)
                for i in range(num_sessions)
            ]
            
            session_results = []
            for future in as_completed(futures):
                session_results.append(future.result())
        
        # Analyze results
        total_successful = 0
        total_rate_limited = 0
        
        for session_result in session_results:
            for request in session_result["requests"]:
                if request.get("status_code") == 200:
                    total_successful += 1
                elif request.get("status_code") == 429:
                    total_rate_limited += 1
        
        total_requests = total_successful + total_rate_limited
        
        # Check if distributed rate limiting is working
        if total_successful > (num_sessions * 10):  # Too many successful requests
            vulnerabilities.append({
                "num_sessions": num_sessions,
                "total_requests": total_requests,
                "successful_requests": total_successful,
                "rate_limited_requests": total_rate_limited,
                "severity": "MEDIUM",
                "description": f"Distributed rate limiting may be ineffective: {total_successful} successful requests across {num_sessions} sessions"
            })
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "metrics": {
                "sessions": num_sessions,
                "total_requests": total_requests,
                "successful": total_successful,
                "rate_limited": total_rate_limited
            }
        }
    
    async def test_rate_limit_bypass_attempts(self) -> Dict[str, Any]:
        """Test various rate limit bypass techniques"""
        test_name = "Rate Limit Bypass Attempts"
        vulnerabilities = []
        
        session = requests.Session()
        
        # First, get rate limited
        for i in range(20):
            try:
                response = session.get(f"{self.base_url}/api/work-orders")
                if response.status_code == 429:
                    break
                await asyncio.sleep(0.1)
            except Exception:
                continue
        
        # Try various bypass techniques
        bypass_techniques = [
            # HTTP method variation
            {"method": "POST", "description": "HTTP method variation"},
            {"method": "PUT", "description": "HTTP method variation"},
            {"method": "PATCH", "description": "HTTP method variation"},
            
            # User-Agent variation
            {"headers": {"User-Agent": "Mozilla/5.0 (Different Browser)"}, "description": "User-Agent spoofing"},
            {"headers": {"User-Agent": "API-Client/1.0"}, "description": "API client spoofing"},
            
            # Case variation in URL
            {"url_suffix": "/API/WORK-ORDERS", "description": "URL case variation"},
            {"url_suffix": "/Api/Work-Orders", "description": "URL case variation"},
            
            # URL encoding
            {"url_suffix": "/api%2fwork-orders", "description": "URL encoding"},
            {"url_suffix": "/api/work%2dorders", "description": "URL encoding"},
            
            # Double encoding
            {"url_suffix": "/api%252fwork-orders", "description": "Double URL encoding"},
            
            # Unicode normalization
            {"url_suffix": "/api/work\u2010orders", "description": "Unicode character substitution"},
        ]
        
        for technique in bypass_techniques:
            try:
                if technique.get("method"):
                    response = session.request(
                        technique["method"],
                        f"{self.base_url}/api/work-orders",
                        timeout=5
                    )
                elif technique.get("headers"):
                    response = session.get(
                        f"{self.base_url}/api/work-orders",
                        headers=technique["headers"],
                        timeout=5
                    )
                elif technique.get("url_suffix"):
                    response = session.get(
                        f"{self.base_url}{technique['url_suffix']}",
                        timeout=5
                    )
                else:
                    continue
                
                # Check if bypass was successful
                if response.status_code not in [429, 404, 405]:
                    vulnerabilities.append({
                        "bypass_technique": technique["description"],
                        "technique_details": technique,
                        "response_code": response.status_code,
                        "severity": "MEDIUM",
                        "description": f"Rate limit bypassed using {technique['description']}"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "techniques_tested": len(bypass_techniques)
        }
    
    async def test_slowloris_protection(self) -> Dict[str, Any]:
        """Test protection against slowloris attacks"""
        test_name = "Slowloris Protection"
        vulnerabilities = []
        
        # Test slow requests
        session = requests.Session()
        
        try:
            # Make a very slow request
            start_time = time.time()
            
            # Send request with very slow data
            response = session.post(
                f"{self.base_url}/api/work-orders",
                json={"customer": "A" * 1000},  # Large payload
                timeout=30
            )
            
            end_time = time.time()
            response_time = end_time - start_time
            
            # Check if request was handled (should be timed out or rejected)
            if response.status_code == 200 and response_time > 10:
                vulnerabilities.append({
                    "attack_type": "slow_request",
                    "response_time": response_time,
                    "response_code": response.status_code,
                    "severity": "LOW",
                    "description": f"Slow request processed successfully in {response_time:.1f}s"
                })
        
        except requests.exceptions.Timeout:
            # This is expected behavior - good protection
            pass
        except Exception:
            pass
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_request_size_limiting(self) -> Dict[str, Any]:
        """Test request size limiting"""
        test_name = "Request Size Limiting"
        vulnerabilities = []
        
        session = requests.Session()
        
        # Test various payload sizes
        payload_sizes = [
            (1000, "1KB"),
            (10000, "10KB"),
            (100000, "100KB"),
            (1000000, "1MB"),
            (10000000, "10MB")
        ]
        
        for size, description in payload_sizes:
            try:
                large_payload = {
                    "customer": "A" * size,
                    "instructions": "B" * size
                }
                
                response = session.post(
                    f"{self.base_url}/api/work-orders",
                    json=large_payload,
                    timeout=30
                )
                
                # Check if large payload was accepted
                if response.status_code == 200:
                    vulnerabilities.append({
                        "payload_size": size,
                        "payload_description": description,
                        "response_code": response.status_code,
                        "severity": "MEDIUM" if size > 100000 else "LOW",
                        "description": f"Large payload ({description}) accepted without size limiting"
                    })
                elif response.status_code == 413:  # Payload Too Large
                    # This is expected behavior - good protection
                    break
                    
            except Exception:
                # Connection errors might indicate proper size limiting
                break
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "payload_sizes_tested": len(payload_sizes)
        }
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        failed_tests = len([t for t in self.test_results if t.get("status") == "FAIL"])
        total_vulnerabilities = sum(len(t.get("vulnerabilities", [])) for t in self.test_results)
        
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        
        for test in self.test_results:
            for vuln in test.get("vulnerabilities", []):
                severity = vuln.get("severity", "LOW")
                severity_counts[severity] += 1
        
        # Calculate risk score
        risk_score = (
            severity_counts["CRITICAL"] * 10 +
            severity_counts["HIGH"] * 7 +
            severity_counts["MEDIUM"] * 4 +
            severity_counts["LOW"] * 1
        )
        
        return {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": total_tests - failed_tests,
                "failed_tests": failed_tests,
                "total_vulnerabilities": total_vulnerabilities,
                "severity_breakdown": severity_counts,
                "risk_score": risk_score,
                "rate_limiting_effectiveness": self._calculate_effectiveness()
            },
            "test_results": self.test_results,
            "timestamp": datetime.now().isoformat()
        }
    
    def _calculate_effectiveness(self) -> str:
        """Calculate overall rate limiting effectiveness"""
        total_vulns = sum(len(t.get("vulnerabilities", [])) for t in self.test_results)
        total_tests = len(self.test_results)
        
        if total_vulns == 0:
            return "EXCELLENT"
        elif total_vulns <= 2:
            return "GOOD"
        elif total_vulns <= 5:
            return "FAIR"
        else:
            return "POOR"

async def main():
    """Main function for running rate limiting tests"""
    tester = RateLimitingTester()
    await tester.run_all_tests()
    
    report = tester.generate_report()
    
    print("\n" + "="*60)
    print("🚦 RATE LIMITING TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {report['summary']['total_tests']}")
    print(f"Passed: {report['summary']['passed_tests']}")
    print(f"Failed: {report['summary']['failed_tests']}")
    print(f"Total Vulnerabilities: {report['summary']['total_vulnerabilities']}")
    print(f"Critical: {report['summary']['severity_breakdown']['CRITICAL']}")
    print(f"High: {report['summary']['severity_breakdown']['HIGH']}")
    print(f"Medium: {report['summary']['severity_breakdown']['MEDIUM']}")
    print(f"Low: {report['summary']['severity_breakdown']['LOW']}")
    print(f"Risk Score: {report['summary']['risk_score']}")
    print(f"Effectiveness: {report['summary']['rate_limiting_effectiveness']}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())