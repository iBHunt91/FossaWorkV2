"""
Pytest fixtures for scheduling tests
Provides common test data and utilities
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.models.user_models import User, UserCredential
from app.auth.dependencies import get_current_user
from app.main import app


# Test database setup
@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    """Create test database session"""
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSessionLocal()
    
    # Clear all tables
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    yield session
    session.close()


# Mock user fixtures
@pytest.fixture
def test_user():
    """Create test user"""
    return User(
        id="test_user_123",
        username="testuser",
        email="test@example.com"
    )


@pytest.fixture
def test_user_2():
    """Create second test user"""
    return User(
        id="test_user_456",
        username="testuser2",
        email="test2@example.com"
    )


# Test client setup
@pytest.fixture
def client(test_session, test_user):
    """Create test client with dependency overrides"""
    def override_get_db():
        try:
            yield test_session
        finally:
            pass
    
    def override_get_current_user():
        return test_user
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Clean up overrides
    app.dependency_overrides.clear()


# Schedule fixtures
@pytest.fixture
def active_schedule(test_session, test_user):
    """Create an active schedule"""
    schedule = ScrapingSchedule(
        user_id=test_user.id,
        schedule_type="work_orders",
        interval_hours=2.0,
        active_hours={"start": 6, "end": 22},
        enabled=True,
        last_run=datetime.utcnow() - timedelta(hours=3),
        next_run=datetime.utcnow() + timedelta(hours=1),
        consecutive_failures=0
    )
    test_session.add(schedule)
    test_session.commit()
    test_session.refresh(schedule)
    return schedule


@pytest.fixture
def disabled_schedule(test_session, test_user):
    """Create a disabled schedule"""
    schedule = ScrapingSchedule(
        user_id=test_user.id,
        schedule_type="dispensers",
        interval_hours=1.0,
        enabled=False,
        consecutive_failures=0
    )
    test_session.add(schedule)
    test_session.commit()
    test_session.refresh(schedule)
    return schedule


@pytest.fixture
def failed_schedule(test_session, test_user):
    """Create a schedule with many failures"""
    schedule = ScrapingSchedule(
        user_id=test_user.id,
        schedule_type="reports",
        interval_hours=1.0,
        enabled=True,
        consecutive_failures=5,
        last_run=datetime.utcnow() - timedelta(hours=1)
    )
    test_session.add(schedule)
    test_session.commit()
    test_session.refresh(schedule)
    return schedule


# Credentials fixtures
@pytest.fixture
def user_credentials(test_session, test_user):
    """Create user credentials"""
    cred = UserCredential(
        user_id=test_user.id,
        service_name="workfossa",
        username="testuser",
        password="testpass123"
    )
    test_session.add(cred)
    test_session.commit()
    test_session.refresh(cred)
    return cred


# History fixtures
@pytest.fixture
def successful_history(test_session, test_user):
    """Create successful execution history"""
    started = datetime.utcnow() - timedelta(hours=1)
    history = ScrapingHistory(
        user_id=test_user.id,
        schedule_type="work_orders",
        started_at=started,
        completed_at=started + timedelta(minutes=5),
        success=True,
        items_processed=150,
        items_added=10,
        items_updated=5,
        items_failed=0,
        duration_seconds=300,
        trigger_type="scheduled"
    )
    test_session.add(history)
    test_session.commit()
    test_session.refresh(history)
    return history


@pytest.fixture
def failed_history(test_session, test_user):
    """Create failed execution history"""
    started = datetime.utcnow() - timedelta(hours=2)
    history = ScrapingHistory(
        user_id=test_user.id,
        schedule_type="work_orders",
        started_at=started,
        completed_at=started + timedelta(seconds=30),
        success=False,
        items_processed=0,
        error_message="Authentication failed",
        error_details={
            "status_code": 401,
            "error": "Invalid credentials"
        },
        duration_seconds=30,
        trigger_type="manual"
    )
    test_session.add(history)
    test_session.commit()
    test_session.refresh(history)
    return history


@pytest.fixture
def multiple_histories(test_session, test_user):
    """Create multiple history entries"""
    histories = []
    
    for i in range(10):
        started = datetime.utcnow() - timedelta(hours=i)
        history = ScrapingHistory(
            user_id=test_user.id,
            schedule_type="work_orders",
            started_at=started,
            completed_at=started + timedelta(minutes=5),
            success=i % 3 != 0,  # Every 3rd fails
            items_processed=100 + i * 10,
            items_added=5 + i,
            items_updated=2 + i,
            duration_seconds=300 + i * 10,
            trigger_type="scheduled" if i % 2 == 0 else "manual"
        )
        test_session.add(history)
        histories.append(history)
    
    test_session.commit()
    return histories


# Utility fixtures
@pytest.fixture
def mock_scraper_success():
    """Mock scraper that returns successful results"""
    from unittest.mock import AsyncMock
    
    mock = AsyncMock()
    mock.scrape_work_orders.return_value = [
        {"id": "W-12345", "store": "#1234", "customer": "Test Store 1"},
        {"id": "W-12346", "store": "#1235", "customer": "Test Store 2"},
        {"id": "W-12347", "store": "#1236", "customer": "Test Store 3"}
    ]
    return mock


@pytest.fixture
def mock_scraper_failure():
    """Mock scraper that fails"""
    from unittest.mock import AsyncMock
    
    mock = AsyncMock()
    mock.scrape_work_orders.side_effect = Exception("Authentication failed")
    return mock


@pytest.fixture
def mock_notification_manager():
    """Mock notification manager"""
    from unittest.mock import AsyncMock
    
    mock = AsyncMock()
    mock.send_if_configured.return_value = None
    return mock


# Sample data fixtures
@pytest.fixture
def sample_schedule_data():
    """Sample data for creating a schedule"""
    return {
        "schedule_type": "work_orders",
        "interval_hours": 1.5,
        "active_hours": {"start": 8, "end": 18},
        "enabled": True
    }


@pytest.fixture
def sample_work_orders():
    """Sample work order data"""
    return [
        {
            "id": "W-12345",
            "store": "#1234",
            "customer": "7-Eleven",
            "address": "123 Main St, City, ST 12345",
            "service_code": "2861",
            "scheduled_date": datetime.utcnow().isoformat()
        },
        {
            "id": "W-12346",
            "store": "#1235",
            "customer": "Wawa",
            "address": "456 Oak Ave, Town, ST 12346",
            "service_code": "2862",
            "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat()
        }
    ]


# Helper functions
@pytest.fixture
def create_test_schedules():
    """Factory function to create multiple test schedules"""
    def _create_schedules(session, user_id, count=5):
        schedules = []
        for i in range(count):
            schedule = ScrapingSchedule(
                user_id=user_id,
                schedule_type=f"type_{i}",
                interval_hours=1.0 + i * 0.5,
                enabled=i % 2 == 0,  # Alternate enabled/disabled
                consecutive_failures=i if i < 3 else 0,
                last_run=datetime.utcnow() - timedelta(hours=i)
            )
            session.add(schedule)
            schedules.append(schedule)
        
        session.commit()
        return schedules
    
    return _create_schedules


@pytest.fixture
def assert_schedule_equal():
    """Helper to assert schedule equality"""
    def _assert_equal(schedule1, schedule2):
        assert schedule1.user_id == schedule2.user_id
        assert schedule1.schedule_type == schedule2.schedule_type
        assert schedule1.interval_hours == schedule2.interval_hours
        assert schedule1.active_hours == schedule2.active_hours
        assert schedule1.enabled == schedule2.enabled
        assert schedule1.consecutive_failures == schedule2.consecutive_failures
    
    return _assert_equal