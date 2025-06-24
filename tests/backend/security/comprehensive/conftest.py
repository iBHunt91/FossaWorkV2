"""
Pytest configuration for security tests
Provides fixtures and configuration for comprehensive security testing
"""

import pytest
import os
import sys
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
import asyncio

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.main import app
from app.database import Base, get_db
from app.models.user_models import User
from app.auth.security import get_password_hash


# Test database configuration
TEST_DATABASE_URL = "sqlite:///./test_security.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def setup_test_env():
    """Setup test environment variables"""
    os.environ["SECRET_KEY"] = "test_secret_key_for_security_testing"
    os.environ["FOSSAWORK_MASTER_KEY"] = "test_master_key_for_security_testing"
    os.environ["ENVIRONMENT"] = "testing"
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    
    yield
    
    # Cleanup
    for key in ["SECRET_KEY", "FOSSAWORK_MASTER_KEY", "ENVIRONMENT", "DATABASE_URL"]:
        if key in os.environ:
            del os.environ[key]


@pytest.fixture(scope="function")
def test_db(setup_test_env) -> Generator[Session, None, None]:
    """Create a fresh test database for each test"""
    # Create tables
    Base.metadata.create_all(bind=test_engine)
    
    # Create session
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(test_db) -> TestClient:
    """Create a test client with test database"""
    def override_get_db():
        try:
            yield test_db
        finally:
            test_db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(test_db) -> User:
    """Create a test user"""
    user = User(
        id="test_user_fixture",
        username="testuser@example.com",
        email="testuser@example.com",
        hashed_password=get_password_hash("TestPassword123!"),
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(client, test_user) -> dict:
    """Get authentication headers for test user"""
    response = client.post(
        "/api/auth/login",
        json={"username": test_user.username, "password": "TestPassword123!"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def malicious_payloads():
    """Common malicious payloads for security testing"""
    return {
        "xss": [
            '<script>alert("XSS")</script>',
            '"><script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
        ],
        "sql_injection": [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "admin'--",
        ],
        "command_injection": [
            "; ls -la",
            "| whoami",
            "`id`",
            "$(cat /etc/passwd)",
        ],
        "path_traversal": [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        ],
    }


@pytest.fixture(scope="session")
def performance_threshold():
    """Performance thresholds for security tests"""
    return {
        "auth_endpoint": 0.5,  # 500ms
        "api_endpoint": 1.0,   # 1 second
        "heavy_endpoint": 5.0, # 5 seconds
        "rate_limit_trigger": 0.1,  # 100ms between requests
    }


# Pytest markers
def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "security: mark test as a security test"
    )
    config.addinivalue_line(
        "markers", "authentication: mark test as authentication-related"
    )
    config.addinivalue_line(
        "markers", "rate_limit: mark test as rate limiting test"
    )
    config.addinivalue_line(
        "markers", "cors: mark test as CORS-related"
    )
    config.addinivalue_line(
        "markers", "headers: mark test as security headers test"
    )
    config.addinivalue_line(
        "markers", "input_validation: mark test as input validation test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as performance-related"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow (takes > 1 second)"
    )


# Pytest plugins
pytest_plugins = [
    "pytest_asyncio",
]