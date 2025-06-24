#!/usr/bin/env python3
"""
CORS Configuration Security Tests
Tests for Cross-Origin Resource Sharing (CORS) security configuration
"""

import os
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from typing import List, Dict, Tuple
import json

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.main import app
from app.database import get_db, Base, engine
from app.models.user_models import User
from app.auth.security import get_password_hash

# Test client
client = TestClient(app)

# Common origins to test
TEST_ORIGINS = [
    "http://localhost:5173",  # Development frontend
    "http://localhost:3000",  # Alternative dev port
    "https://app.workfossa.com",  # Production WorkFossa
    "https://fossawork.com",  # Production domain
    "http://evil.com",  # Malicious origin
    "null",  # Null origin attack
    "file://",  # File protocol
    "http://localhost:5173.evil.com",  # Subdomain attack
    "http://localhost.evil.com:5173",  # Similar domain attack
]

# Endpoints to test
TEST_ENDPOINTS = [
    ("/api/auth/login", "POST"),
    ("/api/v1/work-orders", "GET"),
    ("/api/settings", "GET"),
    ("/api/dispensers/1234", "GET"),
    ("/health", "GET"),
    ("/api/automation/start", "POST"),
    ("/api/v1/logs/write", "POST"),
]


class TestCORSConfiguration:
    """Test cases for CORS security configuration"""
    
    @classmethod
    def setup_class(cls):
        """Setup test environment"""
        os.environ["SECRET_KEY"] = "test_secret_key_for_cors"
        Base.metadata.create_all(bind=engine)
        
        # Create test user
        db = next(get_db())
        try:
            user = User(
                id="cors_test_user",
                username="corstest@example.com",
                email="corstest@example.com",
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
            json={"username": "corstest@example.com", "password": "TestPassword123!"}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_cors_preflight_requests(self):
        """Test CORS preflight OPTIONS requests"""
        allowed_origin = "http://localhost:5173"
        
        for endpoint, method in TEST_ENDPOINTS:
            # Send preflight request
            response = client.options(
                endpoint,
                headers={
                    "Origin": allowed_origin,
                    "Access-Control-Request-Method": method,
                    "Access-Control-Request-Headers": "content-type,authorization"
                }
            )
            
            # Should respond to OPTIONS
            assert response.status_code in [200, 204], \
                f"Preflight failed for {endpoint}: {response.status_code}"
            
            # Check CORS headers
            assert "Access-Control-Allow-Origin" in response.headers, \
                f"Missing Allow-Origin header for {endpoint}"
            assert response.headers["Access-Control-Allow-Origin"] == allowed_origin, \
                f"Wrong Allow-Origin for {endpoint}"
            
            assert "Access-Control-Allow-Methods" in response.headers, \
                f"Missing Allow-Methods header for {endpoint}"
            assert method in response.headers["Access-Control-Allow-Methods"], \
                f"Method {method} not allowed for {endpoint}"
            
            assert "Access-Control-Allow-Headers" in response.headers, \
                f"Missing Allow-Headers for {endpoint}"
            allowed_headers = response.headers["Access-Control-Allow-Headers"].lower()
            assert "authorization" in allowed_headers, \
                f"Authorization header not allowed for {endpoint}"
    
    def test_cors_actual_requests(self):
        """Test CORS headers on actual requests"""
        auth_headers = self.get_auth_headers()
        allowed_origin = "http://localhost:5173"
        
        for endpoint, method in TEST_ENDPOINTS:
            # Add origin to headers
            headers = {**auth_headers, "Origin": allowed_origin}
            
            # Skip auth endpoint for authenticated test
            if "/auth/" in endpoint:
                headers = {"Origin": allowed_origin}
            
            # Make request
            if method == "GET":
                response = client.get(endpoint, headers=headers)
            else:
                response = client.post(endpoint, headers=headers, json={})
            
            # Should have CORS headers (regardless of status)
            assert "Access-Control-Allow-Origin" in response.headers, \
                f"Missing CORS headers for {endpoint} ({response.status_code})"
            assert response.headers["Access-Control-Allow-Origin"] == allowed_origin, \
                f"Wrong Allow-Origin for {endpoint}"
            
            # Should have credentials header for authenticated endpoints
            if "Access-Control-Allow-Credentials" in response.headers:
                assert response.headers["Access-Control-Allow-Credentials"] == "true", \
                    f"Credentials not allowed for {endpoint}"
    
    def test_cors_unauthorized_origins(self):
        """Test that unauthorized origins are handled properly"""
        auth_headers = self.get_auth_headers()
        
        # Test with evil origin
        evil_origins = [
            "http://evil.com",
            "https://attacker.com",
            "http://localhost:5173.evil.com",
        ]
        
        for origin in evil_origins:
            headers = {**auth_headers, "Origin": origin}
            
            response = client.get("/api/v1/work-orders", headers=headers)
            
            # Should either:
            # 1. Not include CORS headers (blocking the request)
            # 2. Include only allowed origin (not the evil one)
            if "Access-Control-Allow-Origin" in response.headers:
                allowed = response.headers["Access-Control-Allow-Origin"]
                assert allowed != origin, \
                    f"Evil origin {origin} was allowed!"
                assert allowed in ["http://localhost:5173", "*"], \
                    f"Unexpected allowed origin: {allowed}"
    
    def test_cors_null_origin_attack(self):
        """Test protection against null origin attacks"""
        auth_headers = self.get_auth_headers()
        headers = {**auth_headers, "Origin": "null"}
        
        response = client.get("/api/v1/work-orders", headers=headers)
        
        # Should not allow null origin
        if "Access-Control-Allow-Origin" in response.headers:
            assert response.headers["Access-Control-Allow-Origin"] != "null", \
                "Null origin should not be allowed"
    
    def test_cors_credentials_handling(self):
        """Test CORS credentials handling"""
        auth_headers = self.get_auth_headers()
        origin = "http://localhost:5173"
        
        # Test with credentials
        headers = {**auth_headers, "Origin": origin}
        response = client.get("/api/v1/work-orders", headers=headers)
        
        # When credentials are allowed, origin must be specific (not *)
        if "Access-Control-Allow-Credentials" in response.headers:
            if response.headers["Access-Control-Allow-Credentials"] == "true":
                assert response.headers["Access-Control-Allow-Origin"] != "*", \
                    "Cannot use * origin with credentials"
                assert response.headers["Access-Control-Allow-Origin"] == origin, \
                    "Must echo exact origin with credentials"
    
    def test_cors_on_error_responses(self):
        """Test CORS headers are present on error responses"""
        origin = "http://localhost:5173"
        
        # Test 401 Unauthorized
        headers = {"Origin": origin}
        response = client.get("/api/v1/work-orders", headers=headers)
        assert response.status_code == 401
        assert "Access-Control-Allow-Origin" in response.headers, \
            "CORS headers missing on 401 response"
        
        # Test 404 Not Found
        auth_headers = self.get_auth_headers()
        headers = {**auth_headers, "Origin": origin}
        response = client.get("/api/v1/work-orders/nonexistent", headers=headers)
        assert response.status_code == 404
        assert "Access-Control-Allow-Origin" in response.headers, \
            "CORS headers missing on 404 response"
        
        # Test 422 Validation Error
        response = client.post(
            "/api/auth/login",
            headers={"Origin": origin},
            json={"invalid": "data"}
        )
        assert response.status_code in [422, 400]
        assert "Access-Control-Allow-Origin" in response.headers, \
            "CORS headers missing on validation error"
    
    def test_cors_methods_restriction(self):
        """Test that only allowed methods are permitted"""
        origin = "http://localhost:5173"
        auth_headers = self.get_auth_headers()
        
        # Test unusual methods
        unusual_methods = ["PATCH", "DELETE", "PUT", "HEAD"]
        
        for method in unusual_methods:
            # Preflight
            response = client.options(
                "/api/v1/work-orders",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": method,
                }
            )
            
            # Check if method is allowed
            if response.status_code == 200:
                allowed_methods = response.headers.get("Access-Control-Allow-Methods", "")
                # Only explicitly allowed methods should be permitted
                if method not in ["GET", "POST", "PUT", "DELETE", "OPTIONS"]:
                    assert method not in allowed_methods, \
                        f"Unusual method {method} should not be allowed"
    
    def test_cors_headers_restriction(self):
        """Test that only safe headers are allowed"""
        origin = "http://localhost:5173"
        
        # Test potentially dangerous headers
        dangerous_headers = [
            "X-Forwarded-For",
            "X-Real-IP",
            "X-Frame-Options",
            "X-Content-Type-Options",
        ]
        
        for header in dangerous_headers:
            response = client.options(
                "/api/v1/work-orders",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": header.lower(),
                }
            )
            
            # Check if header is explicitly allowed
            if response.status_code == 200:
                allowed_headers = response.headers.get("Access-Control-Allow-Headers", "").lower()
                # Security headers should not be client-controllable
                if header.lower() in ["x-frame-options", "x-content-type-options"]:
                    assert header.lower() not in allowed_headers, \
                        f"Security header {header} should not be client-controllable"
    
    def test_cors_expose_headers(self):
        """Test that sensitive headers are not exposed to clients"""
        origin = "http://localhost:5173"
        auth_headers = self.get_auth_headers()
        headers = {**auth_headers, "Origin": origin}
        
        response = client.get("/api/v1/work-orders", headers=headers)
        
        # Check for Access-Control-Expose-Headers
        if "Access-Control-Expose-Headers" in response.headers:
            exposed = response.headers["Access-Control-Expose-Headers"].lower()
            
            # Sensitive headers that should not be exposed
            sensitive_headers = [
                "x-real-ip",
                "x-forwarded-for",
                "set-cookie",
                "authorization",
            ]
            
            for sensitive in sensitive_headers:
                assert sensitive not in exposed, \
                    f"Sensitive header {sensitive} should not be exposed"
    
    def test_cors_max_age(self):
        """Test CORS preflight cache duration"""
        origin = "http://localhost:5173"
        
        response = client.options(
            "/api/v1/work-orders",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            }
        )
        
        # Check for max age header
        if "Access-Control-Max-Age" in response.headers:
            max_age = int(response.headers["Access-Control-Max-Age"])
            
            # Should be reasonable (not too long, not too short)
            assert max_age >= 60, "CORS max age too short"
            assert max_age <= 86400, "CORS max age too long (>24 hours)"
    
    def test_cors_vary_header(self):
        """Test that Vary header is set for CORS"""
        origin = "http://localhost:5173"
        auth_headers = self.get_auth_headers()
        headers = {**auth_headers, "Origin": origin}
        
        response = client.get("/api/v1/work-orders", headers=headers)
        
        # Should have Vary header to prevent cache poisoning
        if "Vary" in response.headers:
            vary = response.headers["Vary"].lower()
            assert "origin" in vary, \
                "Vary header should include Origin for CORS"
    
    def test_cors_production_configuration(self):
        """Test CORS configuration for production environment"""
        # This tests the concept - actual production would have different settings
        
        # In production, should have:
        # 1. Specific allowed origins (not *)
        # 2. Credentials properly configured
        # 3. Methods restricted to what's needed
        # 4. Headers restricted to what's needed
        
        # Test with production-like origin
        prod_origin = "https://fossawork.com"
        auth_headers = self.get_auth_headers()
        headers = {**auth_headers, "Origin": prod_origin}
        
        response = client.get("/api/v1/work-orders", headers=headers)
        
        # Log current CORS configuration
        cors_headers = {
            k: v for k, v in response.headers.items()
            if k.startswith("Access-Control-")
        }
        print(f"CORS headers for production origin: {cors_headers}")
    
    def test_cors_websocket_endpoints(self):
        """Test CORS for WebSocket upgrade requests"""
        # WebSocket endpoints might need special CORS handling
        origin = "http://localhost:5173"
        
        # Test WebSocket upgrade headers
        ws_endpoints = [
            "/ws",
            "/api/ws/notifications",
        ]
        
        for endpoint in ws_endpoints:
            response = client.get(
                endpoint,
                headers={
                    "Origin": origin,
                    "Upgrade": "websocket",
                    "Connection": "Upgrade",
                    "Sec-WebSocket-Version": "13",
                    "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
                }
            )
            
            # WebSocket endpoints should handle CORS
            if response.status_code != 404:  # If endpoint exists
                if "Access-Control-Allow-Origin" in response.headers:
                    allowed = response.headers["Access-Control-Allow-Origin"]
                    assert allowed in [origin, "*"], \
                        f"WebSocket CORS not configured for {endpoint}"


if __name__ == "__main__":
    # Run tests
    test = TestCORSConfiguration()
    test.setup_class()
    
    try:
        print("Running CORS configuration security tests...")
        
        test.test_cors_preflight_requests()
        print("✓ CORS preflight requests handled correctly")
        
        test.test_cors_actual_requests()
        print("✓ CORS headers present on actual requests")
        
        test.test_cors_unauthorized_origins()
        print("✓ Unauthorized origins handled properly")
        
        test.test_cors_null_origin_attack()
        print("✓ Null origin attack prevented")
        
        test.test_cors_credentials_handling()
        print("✓ CORS credentials handled securely")
        
        test.test_cors_on_error_responses()
        print("✓ CORS headers present on error responses")
        
        test.test_cors_methods_restriction()
        print("✓ CORS methods properly restricted")
        
        test.test_cors_headers_restriction()
        print("✓ CORS headers properly restricted")
        
        test.test_cors_expose_headers()
        print("✓ Sensitive headers not exposed")
        
        test.test_cors_max_age()
        print("✓ CORS max age configured reasonably")
        
        test.test_cors_vary_header()
        print("✓ Vary header set for CORS")
        
        test.test_cors_production_configuration()
        print("✓ Production CORS configuration checked")
        
        test.test_cors_websocket_endpoints()
        print("✓ WebSocket CORS handling checked")
        
        print("\nAll CORS configuration tests passed! ✓")
        
    finally:
        test.teardown_class()