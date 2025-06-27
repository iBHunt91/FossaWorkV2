#!/usr/bin/env python3
"""
Tests for scraping schedule API endpoints
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.models.user_models import User
from app.auth.dependencies import get_current_user


# Create test database
engine = create_engine("sqlite:///:memory:")
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    """Override database dependency"""
    try:
        db = TestSessionLocal()
        yield db
    finally:
        db.close()


# Mock user for authentication
mock_user = User(
    id="test_user_123",
    username="testuser",
    email="test@example.com"
)


def override_get_current_user():
    """Override authentication dependency"""
    return mock_user


# Apply overrides
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

# Create test client
client = TestClient(app)


@pytest.fixture
def test_db():
    """Create a fresh test database for each test"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestSessionLocal()
    yield db
    db.close()


@pytest.fixture
def sample_schedule(test_db):
    """Create a sample schedule for testing"""
    schedule = ScrapingSchedule(
        user_id=mock_user.id,
        schedule_type="work_orders",
        interval_hours=2.0,
        active_hours={"start": 6, "end": 22},
        enabled=True,
        last_run=datetime.utcnow() - timedelta(hours=1),
        next_run=datetime.utcnow() + timedelta(hours=1)
    )
    test_db.add(schedule)
    test_db.commit()
    test_db.refresh(schedule)
    return schedule


class TestCreateSchedule:
    """Test POST /api/scraping-schedules/"""
    
    def test_create_basic_schedule(self, test_db):
        """Test creating a basic schedule"""
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 1.5,
                "enabled": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["schedule_type"] == "work_orders"
        assert data["interval_hours"] == 1.5
        assert data["enabled"] is True
        assert data["user_id"] == mock_user.id
        assert data["status"] == "active"
        assert "id" in data
        assert "created_at" in data
    
    def test_create_schedule_with_active_hours(self, test_db):
        """Test creating a schedule with active hours"""
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "dispensers",
                "interval_hours": 2.0,
                "active_hours": {"start": 8, "end": 18},
                "enabled": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["active_hours"] == {"start": 8, "end": 18}
    
    def test_create_disabled_schedule(self, test_db):
        """Test creating a disabled schedule"""
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 1.0,
                "enabled": False
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert data["status"] == "paused"
        assert data["next_run"] is None
    
    def test_create_duplicate_schedule(self, test_db, sample_schedule):
        """Test creating a duplicate schedule fails"""
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 1.0,
                "enabled": True
            }
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    def test_create_schedule_invalid_interval(self, test_db):
        """Test creating schedule with invalid interval"""
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 0.1,  # Too small
                "enabled": True
            }
        )
        
        assert response.status_code == 422  # Validation error
        
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 48,  # Too large
                "enabled": True
            }
        )
        
        assert response.status_code == 422


class TestGetSchedules:
    """Test GET /api/scraping-schedules/"""
    
    def test_get_empty_schedules(self, test_db):
        """Test getting schedules when none exist"""
        response = client.get("/api/scraping-schedules/")
        
        assert response.status_code == 200
        assert response.json() == []
    
    def test_get_user_schedules(self, test_db):
        """Test getting schedules for current user"""
        # Create schedules for current user
        schedule1 = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            interval_hours=1.0
        )
        schedule2 = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="dispensers",
            interval_hours=2.0
        )
        # Create schedule for different user
        schedule3 = ScrapingSchedule(
            user_id="other_user",
            schedule_type="work_orders",
            interval_hours=3.0
        )
        
        test_db.add_all([schedule1, schedule2, schedule3])
        test_db.commit()
        
        response = client.get("/api/scraping-schedules/")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # Only current user's schedules
        assert all(s["user_id"] == mock_user.id for s in data)
        assert {s["schedule_type"] for s in data} == {"work_orders", "dispensers"}
    
    def test_get_schedules_with_status(self, test_db):
        """Test schedule status is correctly determined"""
        # Active schedule
        schedule1 = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            enabled=True,
            consecutive_failures=0
        )
        # Paused schedule
        schedule2 = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="dispensers",
            enabled=False,
            consecutive_failures=0
        )
        # Failed schedule
        schedule3 = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="reports",
            enabled=True,
            consecutive_failures=5
        )
        
        test_db.add_all([schedule1, schedule2, schedule3])
        test_db.commit()
        
        response = client.get("/api/scraping-schedules/")
        data = response.json()
        
        statuses = {s["schedule_type"]: s["status"] for s in data}
        assert statuses["work_orders"] == "active"
        assert statuses["dispensers"] == "paused"
        assert statuses["reports"] == "failed"


class TestGetSchedule:
    """Test GET /api/scraping-schedules/{schedule_id}"""
    
    def test_get_existing_schedule(self, test_db, sample_schedule):
        """Test getting an existing schedule"""
        response = client.get(f"/api/scraping-schedules/{sample_schedule.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_schedule.id
        assert data["schedule_type"] == "work_orders"
        assert data["interval_hours"] == 2.0
    
    def test_get_nonexistent_schedule(self, test_db):
        """Test getting a schedule that doesn't exist"""
        response = client.get("/api/scraping-schedules/999")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_get_other_user_schedule(self, test_db):
        """Test getting another user's schedule fails"""
        schedule = ScrapingSchedule(
            user_id="other_user",
            schedule_type="work_orders",
            interval_hours=1.0
        )
        test_db.add(schedule)
        test_db.commit()
        
        response = client.get(f"/api/scraping-schedules/{schedule.id}")
        
        assert response.status_code == 404


class TestUpdateSchedule:
    """Test PUT /api/scraping-schedules/{schedule_id}"""
    
    def test_update_interval(self, test_db, sample_schedule):
        """Test updating schedule interval"""
        response = client.put(
            f"/api/scraping-schedules/{sample_schedule.id}",
            json={"interval_hours": 3.5}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["interval_hours"] == 3.5
        
        # Verify in database
        test_db.refresh(sample_schedule)
        assert sample_schedule.interval_hours == 3.5
    
    def test_update_active_hours(self, test_db, sample_schedule):
        """Test updating active hours"""
        response = client.put(
            f"/api/scraping-schedules/{sample_schedule.id}",
            json={"active_hours": {"start": 9, "end": 17}}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["active_hours"] == {"start": 9, "end": 17}
    
    def test_disable_schedule(self, test_db, sample_schedule):
        """Test disabling a schedule"""
        response = client.put(
            f"/api/scraping-schedules/{sample_schedule.id}",
            json={"enabled": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert data["status"] == "paused"
    
    def test_enable_schedule(self, test_db):
        """Test enabling a disabled schedule"""
        schedule = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            enabled=False
        )
        test_db.add(schedule)
        test_db.commit()
        
        response = client.put(
            f"/api/scraping-schedules/{schedule.id}",
            json={"enabled": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["next_run"] is not None
    
    def test_update_all_fields(self, test_db, sample_schedule):
        """Test updating multiple fields at once"""
        response = client.put(
            f"/api/scraping-schedules/{sample_schedule.id}",
            json={
                "interval_hours": 4.0,
                "active_hours": None,
                "enabled": False
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["interval_hours"] == 4.0
        assert data["active_hours"] is None
        assert data["enabled"] is False
    
    def test_update_nonexistent_schedule(self, test_db):
        """Test updating a schedule that doesn't exist"""
        response = client.put(
            "/api/scraping-schedules/999",
            json={"interval_hours": 2.0}
        )
        
        assert response.status_code == 404


class TestDeleteSchedule:
    """Test DELETE /api/scraping-schedules/{schedule_id}"""
    
    def test_delete_schedule(self, test_db, sample_schedule):
        """Test deleting a schedule"""
        response = client.delete(f"/api/scraping-schedules/{sample_schedule.id}")
        
        assert response.status_code == 200
        assert "success" in response.json()["message"]
        
        # Verify deleted from database
        assert test_db.query(ScrapingSchedule).filter_by(id=sample_schedule.id).first() is None
    
    def test_delete_nonexistent_schedule(self, test_db):
        """Test deleting a schedule that doesn't exist"""
        response = client.delete("/api/scraping-schedules/999")
        
        assert response.status_code == 404
    
    def test_delete_other_user_schedule(self, test_db):
        """Test deleting another user's schedule fails"""
        schedule = ScrapingSchedule(
            user_id="other_user",
            schedule_type="work_orders",
            interval_hours=1.0
        )
        test_db.add(schedule)
        test_db.commit()
        
        response = client.delete(f"/api/scraping-schedules/{schedule.id}")
        
        assert response.status_code == 404


class TestScheduleHistory:
    """Test GET /api/scraping-schedules/{schedule_id}/history"""
    
    def test_get_empty_history(self, test_db, sample_schedule):
        """Test getting history when none exists"""
        response = client.get(f"/api/scraping-schedules/{sample_schedule.id}/history")
        
        assert response.status_code == 200
        assert response.json() == []
    
    def test_get_schedule_history(self, test_db, sample_schedule):
        """Test getting history for a schedule"""
        # Create history entries
        for i in range(5):
            history = ScrapingHistory(
                user_id=mock_user.id,
                schedule_type="work_orders",
                started_at=datetime.utcnow() - timedelta(hours=i),
                completed_at=datetime.utcnow() - timedelta(hours=i) + timedelta(minutes=5),
                success=i % 2 == 0,  # Alternate success/failure
                items_processed=100 + i*10,
                duration_seconds=300
            )
            test_db.add(history)
        
        test_db.commit()
        
        response = client.get(f"/api/scraping-schedules/{sample_schedule.id}/history")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
        assert data[0]["items_processed"] == 100  # Most recent first
    
    def test_get_history_with_limit(self, test_db, sample_schedule):
        """Test getting limited history"""
        # Create 20 history entries
        for i in range(20):
            history = ScrapingHistory(
                user_id=mock_user.id,
                schedule_type="work_orders",
                started_at=datetime.utcnow() - timedelta(hours=i)
            )
            test_db.add(history)
        
        test_db.commit()
        
        # Test default limit
        response = client.get(f"/api/scraping-schedules/{sample_schedule.id}/history")
        assert len(response.json()) == 10  # Default limit
        
        # Test custom limit
        response = client.get(f"/api/scraping-schedules/{sample_schedule.id}/history?limit=5")
        assert len(response.json()) == 5
        
        # Test max limit
        response = client.get(f"/api/scraping-schedules/{sample_schedule.id}/history?limit=150")
        assert len(response.json()) == 20  # Capped at actual count
    
    def test_get_history_other_user(self, test_db):
        """Test getting history for another user's schedule fails"""
        schedule = ScrapingSchedule(
            user_id="other_user",
            schedule_type="work_orders"
        )
        test_db.add(schedule)
        test_db.commit()
        
        response = client.get(f"/api/scraping-schedules/{schedule.id}/history")
        
        assert response.status_code == 404


class TestRunScheduleNow:
    """Test POST /api/scraping-schedules/{schedule_id}/run"""
    
    def test_trigger_manual_run(self, test_db, sample_schedule):
        """Test triggering a manual run"""
        response = client.post(f"/api/scraping-schedules/{sample_schedule.id}/run")
        
        assert response.status_code == 200
        data = response.json()
        assert "will run" in data["message"]
        assert data["schedule_id"] == sample_schedule.id
        
        # Verify next_run was updated
        test_db.refresh(sample_schedule)
        assert sample_schedule.next_run is not None
        assert (sample_schedule.next_run - datetime.utcnow()).total_seconds() < 60
    
    def test_trigger_run_nonexistent(self, test_db):
        """Test triggering run for nonexistent schedule"""
        response = client.post("/api/scraping-schedules/999/run")
        
        assert response.status_code == 404
    
    def test_trigger_run_other_user(self, test_db):
        """Test triggering run for another user's schedule"""
        schedule = ScrapingSchedule(
            user_id="other_user",
            schedule_type="work_orders"
        )
        test_db.add(schedule)
        test_db.commit()
        
        response = client.post(f"/api/scraping-schedules/{schedule.id}/run")
        
        assert response.status_code == 404


class TestDaemonStatus:
    """Test GET /api/scraping-schedules/status/daemon"""
    
    def test_get_daemon_status_no_activity(self, test_db):
        """Test daemon status with no recent activity"""
        response = client.get("/api/scraping-schedules/status/daemon")
        
        assert response.status_code == 200
        data = response.json()
        assert data["daemon_status"] == "unknown"
        assert data["last_execution"] is None
        assert data["total_schedules"] == 0
        assert data["active_schedules"] == 0
        assert "message" in data
    
    def test_get_daemon_status_with_activity(self, test_db):
        """Test daemon status with recent activity"""
        # Create schedules
        schedule1 = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            enabled=True
        )
        schedule2 = ScrapingSchedule(
            user_id="other_user",
            schedule_type="dispensers",
            enabled=False
        )
        test_db.add_all([schedule1, schedule2])
        
        # Create recent history
        history = ScrapingHistory(
            user_id=mock_user.id,
            schedule_type="work_orders",
            started_at=datetime.utcnow() - timedelta(minutes=2)
        )
        test_db.add(history)
        test_db.commit()
        
        response = client.get("/api/scraping-schedules/status/daemon")
        
        assert response.status_code == 200
        data = response.json()
        assert data["daemon_status"] == "running"
        assert data["last_execution"] is not None
        assert data["total_schedules"] == 2
        assert data["active_schedules"] == 1


class TestErrorHandling:
    """Test error handling in API endpoints"""
    
    @patch('app.routes.scraping_schedules.logger')
    def test_create_schedule_database_error(self, mock_logger, test_db):
        """Test handling database error during create"""
        with patch.object(test_db, 'add', side_effect=Exception("Database error")):
            response = client.post(
                "/api/scraping-schedules/",
                json={
                    "schedule_type": "work_orders",
                    "interval_hours": 1.0,
                    "enabled": True
                }
            )
        
        assert response.status_code == 500
        assert "Failed to create schedule" in response.json()["detail"]
    
    def test_invalid_json_payload(self, test_db):
        """Test handling invalid JSON payload"""
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": "not_a_number",  # Invalid type
                "enabled": True
            }
        )
        
        assert response.status_code == 422
    
    def test_missing_required_fields(self, test_db):
        """Test handling missing required fields"""
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "enabled": True  # Missing schedule_type
            }
        )
        
        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__, "-v"])