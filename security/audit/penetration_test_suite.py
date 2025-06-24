#!/usr/bin/env python3
"""
FossaWork V2 Penetration Testing Suite
Automated penetration testing for web applications
"""

import asyncio
import json
import requests
import sqlite3
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin, urlparse
import base64
import hashlib
import random
import string

class PenetrationTestSuite:
    """Comprehensive penetration testing framework"""
    
    def __init__(self, base_url: str = "http://localhost:8000", project_root: str = None):
        self.base_url = base_url.rstrip('/')
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.session = requests.Session()
        self.test_results = {
            "timestamp": datetime.now().isoformat(),
            "target": base_url,
            "tests": {},
            "vulnerabilities": [],
            "summary": {}
        }
        
    async def run_full_pentest(self) -> Dict[str, Any]:
        """Run complete penetration test suite"""
        print("🎯 Starting FossaWork V2 Penetration Testing...")
        
        # Authentication Testing
        await self._test_authentication_bypass()
        
        # Authorization Testing
        await self._test_authorization_bypass()
        
        # Session Management Testing
        await self._test_session_management()
        
        # Input Validation Testing
        await self._test_input_validation()
        
        # API Security Testing
        await self._test_api_security()
        
        # Business Logic Testing
        await self._test_business_logic()
        
        # Infrastructure Testing
        await self._test_infrastructure()
        
        # Generate summary
        self._generate_summary()
        
        return self.test_results
    
    async def _test_authentication_bypass(self):
        """Test authentication bypass vulnerabilities"""
        print("🔍 Testing Authentication Bypass...")
        
        test_cases = [
            self._test_sql_injection_auth(),
            self._test_weak_credentials(),
            self._test_session_fixation(),
            self._test_brute_force_protection(),
            self._test_password_reset_bypass(),
            self._test_jwt_vulnerabilities()
        ]
        
        results = []
        for test_case in test_cases:
            try:
                result = await test_case
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "test": test_case.__name__})
        
        self.test_results["tests"]["authentication"] = results
    
    async def _test_sql_injection_auth(self) -> Dict[str, Any]:
        """Test SQL injection in authentication"""
        payloads = [
            "admin' OR '1'='1",
            "admin'/*",
            "admin' OR 1=1--",
            "' UNION SELECT 1,2,3--",
            "admin'; DROP TABLE users;--"
        ]
        
        vulnerabilities = []
        
        for payload in payloads:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": payload, "password": "test"},
                    timeout=10
                )
                
                if response.status_code == 200 or "token" in response.text.lower():
                    vulnerabilities.append({
                        "type": "SQL Injection",
                        "payload": payload,
                        "response_code": response.status_code,
                        "severity": "CRITICAL"
                    })
                    
            except Exception as e:
                continue
        
        return {
            "test": "SQL Injection Authentication",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_weak_credentials(self) -> Dict[str, Any]:
        """Test weak credential acceptance"""
        weak_credentials = [
            ("admin", "admin"),
            ("admin", "password"),
            ("admin", "123456"),
            ("test", "test"),
            ("user", "user"),
            ("", ""),
            ("admin", "")
        ]
        
        vulnerabilities = []
        
        for username, password in weak_credentials:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": username, "password": password},
                    timeout=10
                )
                
                if response.status_code == 200:
                    vulnerabilities.append({
                        "type": "Weak Credentials",
                        "credentials": f"{username}:{password}",
                        "severity": "HIGH"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "Weak Credentials",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_session_fixation(self) -> Dict[str, Any]:
        """Test session fixation vulnerabilities"""
        vulnerabilities = []
        
        try:
            # Get initial session
            response1 = self.session.get(f"{self.base_url}/api/auth/status")
            session_before = self.session.cookies.get('session_id')
            
            # Login
            login_response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "testuser", "password": "testpass"}
            )
            
            # Check if session changed after login
            session_after = self.session.cookies.get('session_id')
            
            if session_before and session_before == session_after:
                vulnerabilities.append({
                    "type": "Session Fixation",
                    "description": "Session ID not regenerated after login",
                    "severity": "MEDIUM"
                })
                
        except Exception:
            pass
        
        return {
            "test": "Session Fixation",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_brute_force_protection(self) -> Dict[str, Any]:
        """Test brute force protection"""
        vulnerabilities = []
        
        # Attempt multiple failed logins
        failed_attempts = 0
        for i in range(10):
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": "admin", "password": f"wrong{i}"},
                    timeout=5
                )
                
                if response.status_code == 401:
                    failed_attempts += 1
                elif response.status_code == 429:  # Rate limited
                    break
                    
            except Exception:
                continue
            
            time.sleep(0.1)  # Small delay
        
        if failed_attempts >= 5:
            vulnerabilities.append({
                "type": "No Brute Force Protection",
                "description": f"Allowed {failed_attempts} failed login attempts",
                "severity": "HIGH"
            })
        
        return {
            "test": "Brute Force Protection",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_password_reset_bypass(self) -> Dict[str, Any]:
        """Test password reset bypass"""
        vulnerabilities = []
        
        # Test password reset without proper validation
        test_cases = [
            {"email": "admin@example.com"},
            {"email": "nonexistent@example.com"},
            {"email": ""},
            {"email": "' OR 1=1--"}
        ]
        
        for case in test_cases:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/auth/reset-password",
                    json=case,
                    timeout=10
                )
                
                if response.status_code == 200 and "reset" in response.text.lower():
                    vulnerabilities.append({
                        "type": "Password Reset Bypass",
                        "payload": case,
                        "severity": "HIGH"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "Password Reset Bypass",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_jwt_vulnerabilities(self) -> Dict[str, Any]:
        """Test JWT vulnerabilities"""
        vulnerabilities = []
        
        # Try to get a valid JWT first
        try:
            login_response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "testuser", "password": "testpass"}
            )
            
            if login_response.status_code == 200:
                token = login_response.json().get("access_token")
                
                if token:
                    # Test JWT manipulation
                    jwt_tests = [
                        self._test_jwt_none_algorithm(token),
                        self._test_jwt_weak_secret(token),
                        self._test_jwt_tampering(token)
                    ]
                    
                    for test_result in jwt_tests:
                        vulnerabilities.extend(test_result)
                        
        except Exception:
            pass
        
        return {
            "test": "JWT Vulnerabilities",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    def _test_jwt_none_algorithm(self, token: str) -> List[Dict]:
        """Test JWT none algorithm vulnerability"""
        vulnerabilities = []
        
        try:
            # Decode JWT header
            header = token.split('.')[0]
            header_decoded = json.loads(base64.b64decode(header + '=='))
            
            # Modify algorithm to 'none'
            header_decoded['alg'] = 'none'
            
            # Create malicious token
            malicious_header = base64.b64encode(json.dumps(header_decoded).encode()).decode().rstrip('=')
            payload = token.split('.')[1]
            malicious_token = f"{malicious_header}.{payload}."
            
            # Test with malicious token
            response = self.session.get(
                f"{self.base_url}/api/auth/profile",
                headers={"Authorization": f"Bearer {malicious_token}"}
            )
            
            if response.status_code == 200:
                vulnerabilities.append({
                    "type": "JWT None Algorithm",
                    "description": "JWT accepts 'none' algorithm",
                    "severity": "CRITICAL"
                })
                
        except Exception:
            pass
        
        return vulnerabilities
    
    def _test_jwt_weak_secret(self, token: str) -> List[Dict]:
        """Test JWT weak secret"""
        vulnerabilities = []
        
        weak_secrets = ["secret", "123456", "password", "jwt", "key"]
        
        for secret in weak_secrets:
            try:
                # Try to verify token with weak secret
                import jwt as pyjwt
                decoded = pyjwt.decode(token, secret, algorithms=["HS256"])
                
                vulnerabilities.append({
                    "type": "JWT Weak Secret",
                    "secret": secret,
                    "severity": "CRITICAL"
                })
                break
                
            except Exception:
                continue
        
        return vulnerabilities
    
    def _test_jwt_tampering(self, token: str) -> List[Dict]:
        """Test JWT tampering"""
        vulnerabilities = []
        
        try:
            # Modify payload
            parts = token.split('.')
            payload = json.loads(base64.b64decode(parts[1] + '=='))
            
            # Try to escalate privileges
            payload['role'] = 'admin'
            payload['is_admin'] = True
            
            tampered_payload = base64.b64encode(json.dumps(payload).encode()).decode().rstrip('=')
            tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"
            
            # Test with tampered token
            response = self.session.get(
                f"{self.base_url}/api/admin/users",
                headers={"Authorization": f"Bearer {tampered_token}"}
            )
            
            if response.status_code == 200:
                vulnerabilities.append({
                    "type": "JWT Tampering",
                    "description": "JWT signature not properly verified",
                    "severity": "CRITICAL"
                })
                
        except Exception:
            pass
        
        return vulnerabilities
    
    async def _test_authorization_bypass(self):
        """Test authorization bypass vulnerabilities"""
        print("🔍 Testing Authorization Bypass...")
        
        test_cases = [
            self._test_direct_object_reference(),
            self._test_privilege_escalation(),
            self._test_path_traversal(),
            self._test_function_level_access()
        ]
        
        results = []
        for test_case in test_cases:
            try:
                result = await test_case
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "test": test_case.__name__})
        
        self.test_results["tests"]["authorization"] = results
    
    async def _test_direct_object_reference(self) -> Dict[str, Any]:
        """Test insecure direct object references"""
        vulnerabilities = []
        
        # Test accessing other users' data
        test_ids = [1, 2, 3, 100, 999, "admin", "../admin"]
        
        for user_id in test_ids:
            try:
                response = self.session.get(
                    f"{self.base_url}/api/users/{user_id}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    vulnerabilities.append({
                        "type": "Insecure Direct Object Reference",
                        "resource": f"/api/users/{user_id}",
                        "severity": "HIGH"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "Insecure Direct Object Reference",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_privilege_escalation(self) -> Dict[str, Any]:
        """Test privilege escalation"""
        vulnerabilities = []
        
        # Test admin endpoints without proper authorization
        admin_endpoints = [
            "/api/admin/users",
            "/api/admin/settings",
            "/api/admin/logs",
            "/api/admin/config"
        ]
        
        for endpoint in admin_endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}")
                
                if response.status_code == 200:
                    vulnerabilities.append({
                        "type": "Privilege Escalation",
                        "endpoint": endpoint,
                        "severity": "CRITICAL"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "Privilege Escalation",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_path_traversal(self) -> Dict[str, Any]:
        """Test path traversal vulnerabilities"""
        vulnerabilities = []
        
        payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "....//....//....//etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
        ]
        
        for payload in payloads:
            try:
                response = self.session.get(
                    f"{self.base_url}/api/files/{payload}",
                    timeout=10
                )
                
                if response.status_code == 200 and ("root:" in response.text or "administrator" in response.text.lower()):
                    vulnerabilities.append({
                        "type": "Path Traversal",
                        "payload": payload,
                        "severity": "CRITICAL"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "Path Traversal",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_function_level_access(self) -> Dict[str, Any]:
        """Test function level access control"""
        vulnerabilities = []
        
        # Test different HTTP methods
        sensitive_endpoints = [
            "/api/users",
            "/api/settings",
            "/api/work-orders"
        ]
        
        methods = ["GET", "POST", "PUT", "DELETE", "PATCH"]
        
        for endpoint in sensitive_endpoints:
            for method in methods:
                try:
                    response = self.session.request(
                        method,
                        f"{self.base_url}{endpoint}",
                        timeout=10
                    )
                    
                    if response.status_code not in [401, 403, 405]:
                        vulnerabilities.append({
                            "type": "Function Level Access Control",
                            "method": method,
                            "endpoint": endpoint,
                            "status_code": response.status_code,
                            "severity": "MEDIUM"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": "Function Level Access Control",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_session_management(self):
        """Test session management vulnerabilities"""
        print("🔍 Testing Session Management...")
        
        test_cases = [
            self._test_session_hijacking(),
            self._test_session_timeout(),
            self._test_concurrent_sessions()
        ]
        
        results = []
        for test_case in test_cases:
            try:
                result = await test_case
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "test": test_case.__name__})
        
        self.test_results["tests"]["session_management"] = results
    
    async def _test_session_hijacking(self) -> Dict[str, Any]:
        """Test session hijacking vulnerabilities"""
        vulnerabilities = []
        
        # Test session prediction
        session_ids = []
        for i in range(5):
            try:
                response = self.session.get(f"{self.base_url}/api/auth/status")
                session_id = self.session.cookies.get('session_id')
                if session_id:
                    session_ids.append(session_id)
            except Exception:
                continue
        
        # Analyze session ID randomness
        if len(set(session_ids)) < len(session_ids):
            vulnerabilities.append({
                "type": "Predictable Session IDs",
                "description": "Session IDs are not sufficiently random",
                "severity": "HIGH"
            })
        
        return {
            "test": "Session Hijacking",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_session_timeout(self) -> Dict[str, Any]:
        """Test session timeout"""
        vulnerabilities = []
        
        # Login and check if session expires
        try:
            login_response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "testuser", "password": "testpass"}
            )
            
            if login_response.status_code == 200:
                # Wait and test if session is still valid
                time.sleep(2)
                
                response = self.session.get(f"{self.base_url}/api/auth/profile")
                
                if response.status_code == 200:
                    vulnerabilities.append({
                        "type": "No Session Timeout",
                        "description": "Session does not timeout appropriately",
                        "severity": "MEDIUM"
                    })
                    
        except Exception:
            pass
        
        return {
            "test": "Session Timeout",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_concurrent_sessions(self) -> Dict[str, Any]:
        """Test concurrent session handling"""
        vulnerabilities = []
        
        # Test multiple concurrent sessions
        sessions = []
        for i in range(3):
            session = requests.Session()
            try:
                response = session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": "testuser", "password": "testpass"}
                )
                if response.status_code == 200:
                    sessions.append(session)
            except Exception:
                continue
        
        if len(sessions) > 1:
            vulnerabilities.append({
                "type": "Unlimited Concurrent Sessions",
                "description": f"User can have {len(sessions)} concurrent sessions",
                "severity": "LOW"
            })
        
        return {
            "test": "Concurrent Sessions",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_input_validation(self):
        """Test input validation vulnerabilities"""
        print("🔍 Testing Input Validation...")
        
        test_cases = [
            self._test_xss_vulnerabilities(),
            self._test_sql_injection(),
            self._test_command_injection(),
            self._test_file_upload_bypass()
        ]
        
        results = []
        for test_case in test_cases:
            try:
                result = await test_case
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "test": test_case.__name__})
        
        self.test_results["tests"]["input_validation"] = results
    
    async def _test_xss_vulnerabilities(self) -> Dict[str, Any]:
        """Test XSS vulnerabilities"""
        vulnerabilities = []
        
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//"
        ]
        
        test_endpoints = [
            "/api/work-orders",
            "/api/settings",
            "/api/users"
        ]
        
        for endpoint in test_endpoints:
            for payload in xss_payloads:
                try:
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json={"data": payload, "comment": payload},
                        timeout=10
                    )
                    
                    if payload in response.text and response.headers.get('content-type', '').startswith('text/html'):
                        vulnerabilities.append({
                            "type": "Cross-Site Scripting (XSS)",
                            "endpoint": endpoint,
                            "payload": payload,
                            "severity": "HIGH"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": "XSS Vulnerabilities",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_sql_injection(self) -> Dict[str, Any]:
        """Test SQL injection vulnerabilities"""
        vulnerabilities = []
        
        sql_payloads = [
            "' OR '1'='1",
            "' UNION SELECT 1,2,3--",
            "'; DROP TABLE test;--",
            "' AND (SELECT COUNT(*) FROM users) > 0--",
            "1' OR SLEEP(5)--"
        ]
        
        test_endpoints = [
            "/api/work-orders",
            "/api/dispensers",
            "/api/users"
        ]
        
        for endpoint in test_endpoints:
            for payload in sql_payloads:
                try:
                    # Test in URL parameters
                    response = self.session.get(
                        f"{self.base_url}{endpoint}?id={payload}",
                        timeout=10
                    )
                    
                    if "sql" in response.text.lower() or "syntax error" in response.text.lower():
                        vulnerabilities.append({
                            "type": "SQL Injection",
                            "endpoint": endpoint,
                            "payload": payload,
                            "location": "URL parameter",
                            "severity": "CRITICAL"
                        })
                    
                    # Test in POST data
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json={"id": payload, "search": payload},
                        timeout=10
                    )
                    
                    if "sql" in response.text.lower() or "syntax error" in response.text.lower():
                        vulnerabilities.append({
                            "type": "SQL Injection",
                            "endpoint": endpoint,
                            "payload": payload,
                            "location": "POST data",
                            "severity": "CRITICAL"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": "SQL Injection",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_command_injection(self) -> Dict[str, Any]:
        """Test command injection vulnerabilities"""
        vulnerabilities = []
        
        cmd_payloads = [
            "; ls -la",
            "| whoami",
            "&& cat /etc/passwd",
            "`id`",
            "$(whoami)"
        ]
        
        test_endpoints = [
            "/api/system/command",
            "/api/files/process",
            "/api/backup/create"
        ]
        
        for endpoint in test_endpoints:
            for payload in cmd_payloads:
                try:
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json={"command": payload, "filename": payload},
                        timeout=10
                    )
                    
                    # Look for command output indicators
                    if any(indicator in response.text.lower() for indicator in ['root:', 'bin:', 'uid=', 'gid=']):
                        vulnerabilities.append({
                            "type": "Command Injection",
                            "endpoint": endpoint,
                            "payload": payload,
                            "severity": "CRITICAL"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": "Command Injection",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_file_upload_bypass(self) -> Dict[str, Any]:
        """Test file upload bypass vulnerabilities"""
        vulnerabilities = []
        
        # Test malicious file uploads
        malicious_files = [
            ("shell.php", "<?php system($_GET['cmd']); ?>", "application/x-php"),
            ("test.jsp", "<% Runtime.getRuntime().exec(request.getParameter(\"cmd\")); %>", "application/x-jsp"),
            ("script.asp", "<% eval request(\"cmd\") %>", "application/x-asp"),
            ("test.html", "<script>alert('XSS')</script>", "text/html")
        ]
        
        for filename, content, content_type in malicious_files:
            try:
                files = {'file': (filename, content, content_type)}
                response = self.session.post(
                    f"{self.base_url}/api/upload",
                    files=files,
                    timeout=10
                )
                
                if response.status_code == 200 and "uploaded" in response.text.lower():
                    vulnerabilities.append({
                        "type": "File Upload Bypass",
                        "filename": filename,
                        "content_type": content_type,
                        "severity": "HIGH"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "File Upload Bypass",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_api_security(self):
        """Test API security vulnerabilities"""
        print("🔍 Testing API Security...")
        
        test_cases = [
            self._test_rate_limiting(),
            self._test_cors_misconfiguration(),
            self._test_api_enumeration(),
            self._test_mass_assignment()
        ]
        
        results = []
        for test_case in test_cases:
            try:
                result = await test_case
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "test": test_case.__name__})
        
        self.test_results["tests"]["api_security"] = results
    
    async def _test_rate_limiting(self) -> Dict[str, Any]:
        """Test rate limiting"""
        vulnerabilities = []
        
        # Test rapid requests
        endpoint = f"{self.base_url}/api/work-orders"
        request_count = 0
        
        for i in range(50):
            try:
                response = self.session.get(endpoint, timeout=5)
                request_count += 1
                
                if response.status_code == 429:  # Rate limited
                    break
                    
            except Exception:
                break
        
        if request_count >= 30:
            vulnerabilities.append({
                "type": "No Rate Limiting",
                "description": f"Made {request_count} requests without rate limiting",
                "severity": "MEDIUM"
            })
        
        return {
            "test": "Rate Limiting",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_cors_misconfiguration(self) -> Dict[str, Any]:
        """Test CORS misconfiguration"""
        vulnerabilities = []
        
        # Test CORS with various origins
        test_origins = [
            "https://evil.com",
            "http://localhost:3000",
            "null",
            "*"
        ]
        
        for origin in test_origins:
            try:
                headers = {
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST"
                }
                
                response = self.session.options(
                    f"{self.base_url}/api/work-orders",
                    headers=headers,
                    timeout=10
                )
                
                cors_origin = response.headers.get("Access-Control-Allow-Origin")
                
                if cors_origin == "*" or cors_origin == origin:
                    vulnerabilities.append({
                        "type": "CORS Misconfiguration",
                        "origin": origin,
                        "allowed_origin": cors_origin,
                        "severity": "MEDIUM"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "CORS Misconfiguration",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_api_enumeration(self) -> Dict[str, Any]:
        """Test API enumeration"""
        vulnerabilities = []
        
        # Test common API endpoints
        common_endpoints = [
            "/api/docs",
            "/api/swagger",
            "/api/swagger.json",
            "/api/openapi.json",
            "/api/graphql",
            "/api/v1",
            "/api/v2",
            "/api/admin",
            "/api/test",
            "/api/debug"
        ]
        
        for endpoint in common_endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}")
                
                if response.status_code == 200:
                    vulnerabilities.append({
                        "type": "API Enumeration",
                        "endpoint": endpoint,
                        "description": "Exposed API endpoint",
                        "severity": "LOW"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "API Enumeration",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_mass_assignment(self) -> Dict[str, Any]:
        """Test mass assignment vulnerabilities"""
        vulnerabilities = []
        
        # Test mass assignment in user endpoints
        mass_assignment_payloads = [
            {"role": "admin", "is_admin": True},
            {"permissions": ["admin"], "access_level": "high"},
            {"user_id": 1, "admin": True}
        ]
        
        for payload in mass_assignment_payloads:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/users",
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    vulnerabilities.append({
                        "type": "Mass Assignment",
                        "payload": payload,
                        "severity": "HIGH"
                    })
                    
            except Exception:
                continue
        
        return {
            "test": "Mass Assignment",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_business_logic(self):
        """Test business logic vulnerabilities"""
        print("🔍 Testing Business Logic...")
        
        test_cases = [
            self._test_workflow_bypass(),
            self._test_race_conditions(),
            self._test_resource_limits()
        ]
        
        results = []
        for test_case in test_cases:
            try:
                result = await test_case
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "test": test_case.__name__})
        
        self.test_results["tests"]["business_logic"] = results
    
    async def _test_workflow_bypass(self) -> Dict[str, Any]:
        """Test workflow bypass vulnerabilities"""
        vulnerabilities = []
        
        # Test skipping workflow steps
        try:
            # Try to complete a work order without proper steps
            response = self.session.post(
                f"{self.base_url}/api/work-orders/complete",
                json={"work_order_id": 1, "status": "completed"},
                timeout=10
            )
            
            if response.status_code == 200:
                vulnerabilities.append({
                    "type": "Workflow Bypass",
                    "description": "Can complete work order without validation",
                    "severity": "MEDIUM"
                })
                
        except Exception:
            pass
        
        return {
            "test": "Workflow Bypass",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_race_conditions(self) -> Dict[str, Any]:
        """Test race condition vulnerabilities"""
        vulnerabilities = []
        
        # Test concurrent operations
        import threading
        
        def make_request():
            try:
                self.session.post(
                    f"{self.base_url}/api/work-orders",
                    json={"customer": "test", "service": "test"}
                )
            except:
                pass
        
        # Start multiple threads
        threads = []
        for i in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # Check for duplicate entries (simplified test)
        try:
            response = self.session.get(f"{self.base_url}/api/work-orders")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 5:
                    vulnerabilities.append({
                        "type": "Race Condition",
                        "description": "Possible race condition in work order creation",
                        "severity": "MEDIUM"
                    })
        except:
            pass
        
        return {
            "test": "Race Conditions",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_resource_limits(self) -> Dict[str, Any]:
        """Test resource limit vulnerabilities"""
        vulnerabilities = []
        
        # Test large payload handling
        large_payload = {"data": "A" * 10000000}  # 10MB
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/work-orders",
                json=large_payload,
                timeout=30
            )
            
            if response.status_code == 200:
                vulnerabilities.append({
                    "type": "No Resource Limits",
                    "description": "Accepts very large payloads",
                    "severity": "MEDIUM"
                })
                
        except Exception:
            pass
        
        return {
            "test": "Resource Limits",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_infrastructure(self):
        """Test infrastructure security"""
        print("🔍 Testing Infrastructure Security...")
        
        test_cases = [
            self._test_ssl_configuration(),
            self._test_security_headers(),
            self._test_information_disclosure()
        ]
        
        results = []
        for test_case in test_cases:
            try:
                result = await test_case
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "test": test_case.__name__})
        
        self.test_results["tests"]["infrastructure"] = results
    
    async def _test_ssl_configuration(self) -> Dict[str, Any]:
        """Test SSL/TLS configuration"""
        vulnerabilities = []
        
        # Test HTTPS enforcement
        try:
            http_url = self.base_url.replace("https://", "http://")
            response = self.session.get(http_url, timeout=10, allow_redirects=False)
            
            if response.status_code != 301 and response.status_code != 302:
                vulnerabilities.append({
                    "type": "No HTTPS Redirect",
                    "description": "HTTP traffic not redirected to HTTPS",
                    "severity": "HIGH"
                })
                
        except Exception:
            pass
        
        return {
            "test": "SSL Configuration",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_security_headers(self) -> Dict[str, Any]:
        """Test security headers"""
        vulnerabilities = []
        
        required_headers = {
            "X-Frame-Options": ["DENY", "SAMEORIGIN"],
            "X-Content-Type-Options": ["nosniff"],
            "X-XSS-Protection": ["1; mode=block"],
            "Strict-Transport-Security": ["max-age="],
            "Content-Security-Policy": ["default-src"]
        }
        
        try:
            response = self.session.get(f"{self.base_url}/")
            
            for header, expected_values in required_headers.items():
                header_value = response.headers.get(header, "")
                
                if not header_value:
                    vulnerabilities.append({
                        "type": "Missing Security Header",
                        "header": header,
                        "severity": "MEDIUM"
                    })
                elif not any(expected in header_value for expected in expected_values):
                    vulnerabilities.append({
                        "type": "Weak Security Header",
                        "header": header,
                        "value": header_value,
                        "severity": "LOW"
                    })
                    
        except Exception:
            pass
        
        return {
            "test": "Security Headers",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    async def _test_information_disclosure(self) -> Dict[str, Any]:
        """Test information disclosure"""
        vulnerabilities = []
        
        # Test for sensitive information in responses
        sensitive_endpoints = [
            "/api/config",
            "/api/debug",
            "/api/info",
            "/.env",
            "/config.json",
            "/package.json"
        ]
        
        sensitive_patterns = [
            r"password",
            r"secret",
            r"api[_-]?key",
            r"token",
            r"database.*://",
            r"mongodb://",
            r"mysql://",
            r"postgresql://"
        ]
        
        for endpoint in sensitive_endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}")
                
                if response.status_code == 200:
                    content = response.text.lower()
                    
                    for pattern in sensitive_patterns:
                        if re.search(pattern, content):
                            vulnerabilities.append({
                                "type": "Information Disclosure",
                                "endpoint": endpoint,
                                "pattern": pattern,
                                "severity": "HIGH"
                            })
                            break
                            
            except Exception:
                continue
        
        return {
            "test": "Information Disclosure",
            "vulnerabilities": vulnerabilities,
            "status": "FAIL" if vulnerabilities else "PASS"
        }
    
    def _generate_summary(self):
        """Generate test summary"""
        total_tests = 0
        passed_tests = 0
        total_vulnerabilities = 0
        
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        
        for category, tests in self.test_results["tests"].items():
            for test in tests:
                if isinstance(test, dict) and "status" in test:
                    total_tests += 1
                    if test["status"] == "PASS":
                        passed_tests += 1
                    
                    if "vulnerabilities" in test:
                        total_vulnerabilities += len(test["vulnerabilities"])
                        for vuln in test["vulnerabilities"]:
                            severity = vuln.get("severity", "LOW")
                            severity_counts[severity] += 1
        
        self.test_results["summary"] = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "total_vulnerabilities": total_vulnerabilities,
            "severity_breakdown": severity_counts,
            "pass_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0
        }
    
    def save_results(self, output_path: str):
        """Save penetration test results"""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(self.test_results, f, indent=2)
        
        print(f"✅ Penetration test results saved to {output_file}")

async def main():
    """Main function to run penetration tests"""
    project_root = "/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes"
    
    pentest = PenetrationTestSuite(
        base_url="http://localhost:8000",
        project_root=project_root
    )
    
    results = await pentest.run_full_pentest()
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = f"{project_root}/security/reports/penetration_test_{timestamp}.json"
    pentest.save_results(report_path)
    
    # Print summary
    summary = results["summary"]
    print("\n" + "="*60)
    print("🎯 PENETRATION TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {summary['total_tests']}")
    print(f"Passed: {summary['passed_tests']} | Failed: {summary['failed_tests']}")
    print(f"Pass Rate: {summary['pass_rate']:.1f}%")
    print(f"Total Vulnerabilities: {summary['total_vulnerabilities']}")
    print(f"Critical: {summary['severity_breakdown']['CRITICAL']}")
    print(f"High: {summary['severity_breakdown']['HIGH']}")
    print(f"Medium: {summary['severity_breakdown']['MEDIUM']}")
    print(f"Low: {summary['severity_breakdown']['LOW']}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())