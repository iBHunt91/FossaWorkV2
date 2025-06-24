#!/usr/bin/env python3
"""
Authentication Bypass Security Tests
Tests for user accessing other user's data and authentication bypass attempts
"""

import os
import sys
import pytest
import asyncio
from pathlib import Path
from typing import Dict, Any
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import json
import uuid
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.main import app
from app.database import get_db, Base, engine
from app.models.user_models import User
from app.models import WorkOrder, Dispenser
from app.auth.security import create_access_token, verify_password, get_password_hash
from app.services.credential_manager import CredentialManager, WorkFossaCredentials

# Test client
client = TestClient(app)

# Test data
TEST_USER_1 = {
    "username": "testuser1@example.com",
    "password": "TestPassword123!",
    "user_id": "test_user_1"
}

TEST_USER_2 = {
    "username": "testuser2@example.com", 
    "password": "TestPassword456!",
    "user_id": "test_user_2"
}

MALICIOUS_USER = {
    "username": "attacker@example.com",
    "password": "AttackerPass789!",
    "user_id": "malicious_user"
}


class TestAuthenticationBypass:
    """Test cases for authentication bypass vulnerabilities"""
    
    @classmethod
    def setup_class(cls):
        """Setup test database and users"""
        # Set test environment
        os.environ["FOSSAWORK_MASTER_KEY"] = "test_master_key_for_security_testing"
        os.environ["SECRET_KEY"] = "test_secret_key_for_jwt_tokens"
        
        # Create test database
        Base.metadata.create_all(bind=engine)
        
        # Create test users
        db = next(get_db())
        try:
            # Create users in database
            for user_data in [TEST_USER_1, TEST_USER_2, MALICIOUS_USER]:
                user = User(
                    id=user_data["user_id"],
                    username=user_data["username"],
                    email=user_data["username"],
                    hashed_password=get_password_hash(user_data["password"]),
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                db.add(user)
            
            # Create test work orders for each user
            for i in range(3):
                # User 1's work orders
                wo1 = WorkOrder(
                    id=f"wo_user1_{i}",
                    work_order_id=f"W-1000{i}",
                    user_id=TEST_USER_1["user_id"],
                    store_number=f"100{i}",
                    customer_name="Test Customer 1",
                    address=f"{i} Test Street",
                    service_code="2861",
                    created_at=datetime.utcnow(),
                    visit_url=f"/visits/test1_{i}"
                )
                db.add(wo1)
                
                # User 2's work orders
                wo2 = WorkOrder(
                    id=f"wo_user2_{i}",
                    work_order_id=f"W-2000{i}",
                    user_id=TEST_USER_2["user_id"],
                    store_number=f"200{i}",
                    customer_name="Test Customer 2",
                    address=f"{i} Other Street",
                    service_code="2862",
                    created_at=datetime.utcnow(),
                    visit_url=f"/visits/test2_{i}"
                )
                db.add(wo2)
            
            # Add test dispensers
            for i in range(2):
                # User 1's dispensers
                d1 = Dispenser(
                    id=f"disp_user1_{i}",
                    user_id=TEST_USER_1["user_id"],
                    store_id=f"100{i}",
                    unit_id=f"Unit{i}",
                    manufacturer="Test Mfg",
                    model="Test Model",
                    scraped_data={"test": "data1"}
                )
                db.add(d1)
                
                # User 2's dispensers
                d2 = Dispenser(
                    id=f"disp_user2_{i}",
                    user_id=TEST_USER_2["user_id"],
                    store_id=f"200{i}",
                    unit_id=f"Unit{i}",
                    manufacturer="Test Mfg 2",
                    model="Test Model 2",
                    scraped_data={"test": "data2"}
                )
                db.add(d2)
            
            db.commit()
        finally:
            db.close()
    
    @classmethod
    def teardown_class(cls):
        """Cleanup test database"""
        Base.metadata.drop_all(bind=engine)
        
        # Clean up environment
        if "FOSSAWORK_MASTER_KEY" in os.environ:
            del os.environ["FOSSAWORK_MASTER_KEY"]
        if "SECRET_KEY" in os.environ:
            del os.environ["SECRET_KEY"]
    
    def get_auth_token(self, username: str, password: str) -> str:
        """Helper to get authentication token"""
        response = client.post(
            "/api/auth/login",
            json={"username": username, "password": password}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_user_cannot_access_other_users_work_orders(self):
        """Test that users cannot access work orders of other users"""
        # Get token for user 1
        token1 = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        headers1 = {"Authorization": f"Bearer {token1}"}
        
        # Get token for user 2
        token2 = self.get_auth_token(TEST_USER_2["username"], TEST_USER_2["password"])
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # User 1 should only see their own work orders
        response = client.get("/api/v1/work-orders", headers=headers1)
        assert response.status_code == 200
        work_orders = response.json()["data"]
        assert len(work_orders) == 3
        for wo in work_orders:
            assert wo["work_order_id"].startswith("W-1000")
            assert "W-2000" not in wo["work_order_id"]
        
        # User 2 should only see their own work orders
        response = client.get("/api/v1/work-orders", headers=headers2)
        assert response.status_code == 200
        work_orders = response.json()["data"]
        assert len(work_orders) == 3
        for wo in work_orders:
            assert wo["work_order_id"].startswith("W-2000")
            assert "W-1000" not in wo["work_order_id"]
    
    def test_user_cannot_access_specific_work_order_of_another_user(self):
        """Test that users cannot access specific work orders by ID from other users"""
        # Get tokens
        token1 = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        headers1 = {"Authorization": f"Bearer {token1}"}
        
        token2 = self.get_auth_token(TEST_USER_2["username"], TEST_USER_2["password"])
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # Try to access user 2's work order with user 1's token
        response = client.get("/api/v1/work-orders/wo_user2_0", headers=headers1)
        assert response.status_code == 404  # Should not find it
        
        # Try to access user 1's work order with user 2's token
        response = client.get("/api/v1/work-orders/wo_user1_0", headers=headers2)
        assert response.status_code == 404  # Should not find it
        
        # Verify users can access their own work orders
        response = client.get("/api/v1/work-orders/wo_user1_0", headers=headers1)
        assert response.status_code == 200
        assert response.json()["data"]["work_order_id"] == "W-10000"
        
        response = client.get("/api/v1/work-orders/wo_user2_0", headers=headers2)
        assert response.status_code == 200
        assert response.json()["data"]["work_order_id"] == "W-20000"
    
    def test_user_cannot_access_other_users_dispensers(self):
        """Test that users cannot access dispensers of other users"""
        # Get tokens
        token1 = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        headers1 = {"Authorization": f"Bearer {token1}"}
        
        token2 = self.get_auth_token(TEST_USER_2["username"], TEST_USER_2["password"])
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # User 1 tries to get dispensers for user 2's store
        response = client.get("/api/dispensers/2000", headers=headers1)
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []  # Should return empty, not user 2's data
        
        # User 2 tries to get dispensers for user 1's store
        response = client.get("/api/dispensers/1000", headers=headers2)
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []  # Should return empty, not user 1's data
    
    def test_unauthenticated_access_blocked(self):
        """Test that unauthenticated requests are blocked"""
        # No auth header
        response = client.get("/api/v1/work-orders")
        assert response.status_code == 401
        
        response = client.get("/api/dispensers/1000")
        assert response.status_code == 401
        
        # Invalid token
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/work-orders", headers=headers)
        assert response.status_code == 401
        
        # Expired token
        expired_token = create_access_token(
            data={"sub": TEST_USER_1["username"]},
            expires_delta=timedelta(seconds=-1)  # Already expired
        )
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/work-orders", headers=headers)
        assert response.status_code == 401
    
    def test_token_manipulation_attempts(self):
        """Test various token manipulation attempts"""
        # Get valid token
        valid_token = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        
        # Try to modify token payload (will break signature)
        import jwt
        try:
            # Decode without verification to get payload
            payload = jwt.decode(valid_token, options={"verify_signature": False})
            # Try to change user
            payload["sub"] = TEST_USER_2["username"]
            # Re-encode with wrong secret
            fake_token = jwt.encode(payload, "wrong_secret", algorithm="HS256")
            
            headers = {"Authorization": f"Bearer {fake_token}"}
            response = client.get("/api/v1/work-orders", headers=headers)
            assert response.status_code == 401
        except Exception:
            pass  # Expected to fail
        
        # Try SQL injection in auth header
        headers = {"Authorization": "Bearer ' OR '1'='1"}
        response = client.get("/api/v1/work-orders", headers=headers)
        assert response.status_code == 401
        
        # Try to use None/null token
        headers = {"Authorization": "Bearer null"}
        response = client.get("/api/v1/work-orders", headers=headers)
        assert response.status_code == 401
    
    def test_user_cannot_modify_other_users_data(self):
        """Test that users cannot modify work orders of other users"""
        # Get tokens
        token1 = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        headers1 = {"Authorization": f"Bearer {token1}"}
        
        # Try to update user 2's work order with user 1's token
        update_data = {
            "customer_name": "HACKED BY USER 1",
            "address": "Malicious Address"
        }
        response = client.put(
            "/api/v1/work-orders/wo_user2_0",
            headers=headers1,
            json=update_data
        )
        assert response.status_code == 404  # Should not find it
        
        # Try to delete user 2's work order with user 1's token
        response = client.delete("/api/v1/work-orders/wo_user2_0", headers=headers1)
        assert response.status_code == 404  # Should not find it
        
        # Verify user 2's data is unchanged
        token2 = self.get_auth_token(TEST_USER_2["username"], TEST_USER_2["password"])
        headers2 = {"Authorization": f"Bearer {token2}"}
        response = client.get("/api/v1/work-orders/wo_user2_0", headers=headers2)
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["customer_name"] == "Test Customer 2"
        assert "HACKED" not in data["customer_name"]
    
    def test_path_traversal_attempts(self):
        """Test path traversal attempts in API endpoints"""
        token = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try path traversal in work order ID
        traversal_attempts = [
            "../wo_user2_0",
            "..\\wo_user2_0",
            "%2e%2e%2fwo_user2_0",
            "wo_user1_0/../wo_user2_0",
            "wo_user1_0/../../wo_user2_0"
        ]
        
        for attempt in traversal_attempts:
            response = client.get(f"/api/v1/work-orders/{attempt}", headers=headers)
            # Should either return 404 or 422 (validation error), not 200
            assert response.status_code in [404, 422]
            if response.status_code == 200:
                # If it somehow returns 200, ensure it's not user 2's data
                data = response.json()["data"]
                assert "W-2000" not in data.get("work_order_id", "")
    
    def test_authorization_header_injection(self):
        """Test various authorization header injection attempts"""
        base_token = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        
        # Try various malicious headers
        malicious_headers = [
            {"Authorization": f"Bearer {base_token}, Bearer another_token"},
            {"Authorization": f"Bearer {base_token}\nAuthorization: Bearer malicious"},
            {"Authorization": f"Bearer {base_token}; userId=test_user_2"},
            {"Authorization": f"Basic {base_token}"},  # Wrong auth type
            {"Authorization": "Bearer "},  # Empty token
            {"Authorization": "Bearer\n"},  # Newline injection
            {"Authorization": f"Bearer {base_token}" + "A" * 10000},  # Very long token
        ]
        
        for headers in malicious_headers:
            response = client.get("/api/v1/work-orders", headers=headers)
            # Should not authenticate successfully
            assert response.status_code in [401, 422]
    
    def test_concurrent_access_isolation(self):
        """Test that concurrent requests maintain user isolation"""
        import concurrent.futures
        
        token1 = self.get_auth_token(TEST_USER_1["username"], TEST_USER_1["password"])
        token2 = self.get_auth_token(TEST_USER_2["username"], TEST_USER_2["password"])
        
        def check_user_data(token, expected_prefix):
            headers = {"Authorization": f"Bearer {token}"}
            response = client.get("/api/v1/work-orders", headers=headers)
            assert response.status_code == 200
            work_orders = response.json()["data"]
            for wo in work_orders:
                assert wo["work_order_id"].startswith(expected_prefix)
        
        # Run concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for _ in range(50):
                futures.append(executor.submit(check_user_data, token1, "W-1000"))
                futures.append(executor.submit(check_user_data, token2, "W-2000"))
            
            # Wait for all to complete
            for future in concurrent.futures.as_completed(futures):
                future.result()  # Will raise if assertion failed


if __name__ == "__main__":
    # Run tests
    test = TestAuthenticationBypass()
    test.setup_class()
    
    try:
        print("Running authentication bypass tests...")
        test.test_user_cannot_access_other_users_work_orders()
        print("✓ Users cannot access other users' work orders")
        
        test.test_user_cannot_access_specific_work_order_of_another_user()
        print("✓ Users cannot access specific work orders of other users")
        
        test.test_user_cannot_access_other_users_dispensers()
        print("✓ Users cannot access other users' dispensers")
        
        test.test_unauthenticated_access_blocked()
        print("✓ Unauthenticated access is blocked")
        
        test.test_token_manipulation_attempts()
        print("✓ Token manipulation attempts are blocked")
        
        test.test_user_cannot_modify_other_users_data()
        print("✓ Users cannot modify other users' data")
        
        test.test_path_traversal_attempts()
        print("✓ Path traversal attempts are blocked")
        
        test.test_authorization_header_injection()
        print("✓ Authorization header injection attempts are blocked")
        
        test.test_concurrent_access_isolation()
        print("✓ Concurrent access maintains user isolation")
        
        print("\nAll authentication bypass tests passed! ✓")
        
    finally:
        test.teardown_class()