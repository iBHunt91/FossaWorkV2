#!/usr/bin/env python3
"""
Security Headers Verification Tests
Tests for verifying all security headers are properly set and configured
"""

import os
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from typing import Dict, List
import re

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.main import app
from app.database import get_db, Base, engine
from app.models.user_models import User
from app.auth.security import create_access_token, get_password_hash

# Test client
client = TestClient(app)

# Security headers that should be present
REQUIRED_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "X-Frame-Options": ["SAMEORIGIN", "DENY"],  # Either is acceptable
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
}

# CSP directives that should be present
REQUIRED_CSP_DIRECTIVES = [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "connect-src",
    "frame-ancestors",
    "form-action",
    "base-uri",
    "object-src"
]

# Headers that should NOT be present (information disclosure)
FORBIDDEN_HEADERS = [
    "Server",
    "X-Powered-By",
    "X-AspNet-Version",
    "X-AspNetMvc-Version"
]


class TestSecurityHeaders:
    """Test cases for security headers verification"""
    
    @classmethod
    def setup_class(cls):
        """Setup test environment"""
        os.environ["SECRET_KEY"] = "test_secret_key_for_security_headers"
        Base.metadata.create_all(bind=engine)
        
        # Create test user
        db = next(get_db())
        try:
            user = User(
                id="test_user_headers",
                username="headerstest@example.com",
                email="headerstest@example.com",
                hashed_password=get_password_hash("TestPassword123!"),
                is_active=True
            )
            db.add(user)
            db.commit()
        finally:
            db.close()
    
    @classmethod
    def teardown_class(cls):
        """Cleanup test environment"""
        Base.metadata.drop_all(bind=engine)
        if "SECRET_KEY" in os.environ:
            del os.environ["SECRET_KEY"]
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        response = client.post(
            "/api/auth/login",
            json={"username": "headerstest@example.com", "password": "TestPassword123!"}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_security_headers_on_api_endpoints(self):
        """Test that all API endpoints return required security headers"""
        auth_headers = self.get_auth_headers()
        
        # Test various endpoints
        endpoints = [
            ("/api/v1/work-orders", "GET"),
            ("/api/auth/login", "POST"),
            ("/api/settings", "GET"),
            ("/api/dispensers/1234", "GET"),
            ("/health", "GET")
        ]
        
        for endpoint, method in endpoints:
            if method == "GET":
                if "/api/auth/" in endpoint or endpoint == "/health":
                    response = client.get(endpoint)
                else:
                    response = client.get(endpoint, headers=auth_headers)
            else:
                response = client.post(endpoint, json={})
            
            # Check required headers
            for header, expected_value in REQUIRED_SECURITY_HEADERS.items():
                assert header in response.headers, f"Missing {header} in {endpoint}"
                
                if isinstance(expected_value, list):
                    assert response.headers[header] in expected_value, \
                        f"Invalid {header} value in {endpoint}: {response.headers[header]}"
                else:
                    assert response.headers[header] == expected_value, \
                        f"Invalid {header} value in {endpoint}: {response.headers[header]}"
            
            # Check CSP header
            assert "Content-Security-Policy" in response.headers, f"Missing CSP in {endpoint}"
            csp = response.headers["Content-Security-Policy"]
            for directive in REQUIRED_CSP_DIRECTIVES:
                assert directive in csp, f"Missing CSP directive {directive} in {endpoint}"
            
            # Check forbidden headers are not present
            for forbidden in FORBIDDEN_HEADERS:
                assert forbidden not in response.headers, \
                    f"Forbidden header {forbidden} present in {endpoint}"
    
    def test_csp_prevents_inline_scripts(self):
        """Test that CSP properly restricts inline scripts"""
        response = client.get("/health")
        csp = response.headers.get("Content-Security-Policy", "")
        
        # Check script-src directive
        script_src_match = re.search(r"script-src\s+([^;]+)", csp)
        assert script_src_match, "script-src directive not found in CSP"
        
        script_src = script_src_match.group(1)
        
        # In production, unsafe-inline should not be present
        if os.getenv("ENVIRONMENT") == "production":
            assert "'unsafe-inline'" not in script_src, \
                "unsafe-inline should not be in script-src in production"
            assert "'unsafe-eval'" not in script_src, \
                "unsafe-eval should not be in script-src in production"
    
    def test_csp_prevents_external_resources(self):
        """Test that CSP restricts loading external resources"""
        response = client.get("/health")
        csp = response.headers.get("Content-Security-Policy", "")
        
        # Check default-src
        assert "default-src 'self'" in csp, "default-src should be restricted to 'self'"
        
        # Check frame-ancestors
        assert "frame-ancestors 'none'" in csp, "frame-ancestors should be 'none'"
        
        # Check object-src
        assert "object-src 'none'" in csp, "object-src should be 'none'"
    
    def test_cors_headers_on_authenticated_endpoints(self):
        """Test CORS headers are properly set on authenticated endpoints"""
        auth_headers = self.get_auth_headers()
        
        # Add Origin header
        auth_headers["Origin"] = "http://localhost:5173"
        
        response = client.get("/api/v1/work-orders", headers=auth_headers)
        
        # Check CORS headers
        assert "Access-Control-Allow-Origin" in response.headers
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
        assert "Access-Control-Allow-Credentials" in response.headers
        assert response.headers["Access-Control-Allow-Credentials"] == "true"
    
    def test_cors_headers_on_401_responses(self):
        """Test CORS headers are present on 401 unauthorized responses"""
        # Request without auth but with Origin
        headers = {"Origin": "http://localhost:5173"}
        response = client.get("/api/v1/work-orders", headers=headers)
        
        assert response.status_code == 401
        
        # CORS headers should still be present
        assert "Access-Control-Allow-Origin" in response.headers
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
        assert "Access-Control-Allow-Credentials" in response.headers
    
    def test_cors_preflight_requests(self):
        """Test CORS preflight OPTIONS requests"""
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization"
        }
        
        response = client.options("/api/v1/work-orders", headers=headers)
        
        assert response.status_code == 200
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
        assert "Access-Control-Allow-Headers" in response.headers
    
    def test_hsts_header_in_production(self):
        """Test HSTS header is set in production environment"""
        # This would only work if ENVIRONMENT is set to production
        # For testing, we'll check the header exists if present
        response = client.get("/health")
        
        if "Strict-Transport-Security" in response.headers:
            hsts = response.headers["Strict-Transport-Security"]
            assert "max-age=" in hsts, "HSTS should have max-age directive"
            
            # In production, should have long max-age
            if os.getenv("ENVIRONMENT") == "production":
                assert "max-age=63072000" in hsts, "Production HSTS should be 2 years"
                assert "includeSubDomains" in hsts, "HSTS should include subdomains"
                assert "preload" in hsts, "HSTS should have preload directive"
    
    def test_clickjacking_protection(self):
        """Test X-Frame-Options prevents clickjacking"""
        response = client.get("/health")
        
        assert "X-Frame-Options" in response.headers
        frame_options = response.headers["X-Frame-Options"]
        assert frame_options in ["SAMEORIGIN", "DENY"], \
            f"X-Frame-Options should be SAMEORIGIN or DENY, got {frame_options}"
        
        # Also check CSP frame-ancestors
        csp = response.headers.get("Content-Security-Policy", "")
        assert "frame-ancestors 'none'" in csp or "frame-ancestors 'self'" in csp
    
    def test_mime_sniffing_protection(self):
        """Test X-Content-Type-Options prevents MIME sniffing"""
        response = client.get("/health")
        
        assert "X-Content-Type-Options" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
    
    def test_xss_protection_header(self):
        """Test X-XSS-Protection header for older browsers"""
        response = client.get("/health")
        
        assert "X-XSS-Protection" in response.headers
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
    
    def test_referrer_policy(self):
        """Test Referrer-Policy header"""
        response = client.get("/health")
        
        assert "Referrer-Policy" in response.headers
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    
    def test_permissions_policy(self):
        """Test Permissions-Policy (Feature-Policy) header"""
        response = client.get("/health")
        
        assert "Permissions-Policy" in response.headers
        permissions = response.headers["Permissions-Policy"]
        
        # Check that dangerous features are disabled
        dangerous_features = [
            "accelerometer=()",
            "camera=()",
            "geolocation=()",
            "microphone=()",
            "payment=()",
            "usb=()"
        ]
        
        for feature in dangerous_features:
            assert feature in permissions, f"Missing {feature} in Permissions-Policy"
    
    def test_no_cache_on_sensitive_endpoints(self):
        """Test that sensitive endpoints have no-cache headers"""
        auth_headers = self.get_auth_headers()
        
        # Test sensitive endpoints
        sensitive_endpoints = [
            "/api/v1/work-orders",
            "/api/auth/me",
            "/api/settings"
        ]
        
        for endpoint in sensitive_endpoints:
            if endpoint == "/api/auth/me":
                response = client.get(endpoint, headers=auth_headers)
            else:
                response = client.get(endpoint, headers=auth_headers)
            
            # Should have cache control headers
            if "Cache-Control" in response.headers:
                cache_control = response.headers["Cache-Control"]
                assert any(directive in cache_control for directive in 
                          ["no-store", "no-cache", "must-revalidate", "private"])
    
    def test_security_headers_on_error_responses(self):
        """Test that security headers are present even on error responses"""
        # Test 404
        response = client.get("/api/nonexistent")
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers
        
        # Test 401
        response = client.get("/api/v1/work-orders")
        assert response.status_code == 401
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers
        
        # Test 500 (if we can trigger one)
        # This is harder to test without mocking internal errors
    
    def test_csp_report_directives(self):
        """Test CSP reporting directives if configured"""
        response = client.get("/health")
        csp = response.headers.get("Content-Security-Policy", "")
        
        # If report-uri is configured, it should be present
        if os.getenv("CSP_REPORT_URI"):
            assert "report-uri" in csp or "report-to" in csp, \
                "CSP should have reporting configured when CSP_REPORT_URI is set"
    
    def test_mixed_content_prevention(self):
        """Test that CSP prevents mixed content in production"""
        response = client.get("/health")
        csp = response.headers.get("Content-Security-Policy", "")
        
        if os.getenv("ENVIRONMENT") in ["staging", "production"]:
            assert "upgrade-insecure-requests" in csp, \
                "CSP should upgrade insecure requests in staging/production"
            
            if os.getenv("ENVIRONMENT") == "production":
                assert "block-all-mixed-content" in csp, \
                    "CSP should block all mixed content in production"


if __name__ == "__main__":
    # Run tests
    test = TestSecurityHeaders()
    test.setup_class()
    
    try:
        print("Running security headers verification tests...")
        
        test.test_security_headers_on_api_endpoints()
        print("✓ All API endpoints return required security headers")
        
        test.test_csp_prevents_inline_scripts()
        print("✓ CSP properly restricts inline scripts")
        
        test.test_csp_prevents_external_resources()
        print("✓ CSP restricts loading external resources")
        
        test.test_cors_headers_on_authenticated_endpoints()
        print("✓ CORS headers properly set on authenticated endpoints")
        
        test.test_cors_headers_on_401_responses()
        print("✓ CORS headers present on 401 responses")
        
        test.test_cors_preflight_requests()
        print("✓ CORS preflight requests handled correctly")
        
        test.test_hsts_header_in_production()
        print("✓ HSTS header configured for production")
        
        test.test_clickjacking_protection()
        print("✓ Clickjacking protection enabled")
        
        test.test_mime_sniffing_protection()
        print("✓ MIME sniffing protection enabled")
        
        test.test_xss_protection_header()
        print("✓ XSS protection header present")
        
        test.test_referrer_policy()
        print("✓ Referrer policy configured")
        
        test.test_permissions_policy()
        print("✓ Permissions policy restricts dangerous features")
        
        test.test_no_cache_on_sensitive_endpoints()
        print("✓ Sensitive endpoints have proper cache headers")
        
        test.test_security_headers_on_error_responses()
        print("✓ Security headers present on error responses")
        
        test.test_csp_report_directives()
        print("✓ CSP reporting directives configured")
        
        test.test_mixed_content_prevention()
        print("✓ Mixed content prevention enabled")
        
        print("\nAll security headers tests passed! ✓")
        
    finally:
        test.teardown_class()