#!/usr/bin/env python3
"""
Integration tests for the complete scheduling system
Tests the full workflow from UI to backend to daemon execution
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import os

from app.main import app
from app.database import Base, get_db
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.models.user_models import User, UserCredential
from app.auth.dependencies import get_current_user
from scheduler_daemon import SchedulerDaemon


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
    id="integration_test_user",
    username="integrationtest",
    email="integration@test.com"
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
    
    # Create test user credentials
    cred = UserCredential(
        user_id=mock_user.id,
        service_name="workfossa",
        username="testuser",
        password="testpass"
    )
    db.add(cred)
    db.commit()
    
    yield db
    db.close()


@pytest.fixture
def temp_data_dir():
    """Create temporary directory for test data"""
    with tempfile.TemporaryDirectory() as tmpdir:
        os.environ['DATA_DIR'] = tmpdir
        yield tmpdir


class TestCompleteSchedulingWorkflow:
    """Test the complete scheduling workflow from creation to execution"""
    
    @pytest.mark.asyncio
    async def test_create_schedule_and_execute(self, test_db, temp_data_dir):
        """Test creating a schedule via API and executing it with daemon"""
        # Step 1: Create schedule via API
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 1.0,
                "active_hours": {"start": 0, "end": 24},  # Always active for testing
                "enabled": True
            }
        )
        
        assert response.status_code == 200
        schedule_data = response.json()
        schedule_id = schedule_data["id"]
        
        # Step 2: Verify schedule is in database
        schedule = test_db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
        assert schedule is not None
        assert schedule.enabled is True
        assert schedule.interval_hours == 1.0
        
        # Step 3: Mock scraper and run daemon
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                # Mock successful scraping
                mock_scraper_instance = AsyncMock()
                mock_scraper_instance.scrape_work_orders.return_value = [
                    {"id": "W-12345", "store": "#1234", "customer": "Test Store"},
                    {"id": "W-12346", "store": "#1235", "customer": "Test Store 2"}
                ]
                mock_scraper.return_value = mock_scraper_instance
                
                # Create and run daemon
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                
                # Wait for async execution
                await asyncio.sleep(0.5)
                
                # Verify scraper was called
                mock_scraper_instance.scrape_work_orders.assert_called_once()
        
        # Step 4: Verify history was created
        history = test_db.query(ScrapingHistory).filter_by(
            user_id=mock_user.id,
            schedule_type="work_orders"
        ).first()
        
        assert history is not None
        assert history.success is True
        assert history.items_processed == 2
        assert history.trigger_type == "scheduled"
        
        # Step 5: Verify schedule was updated
        test_db.refresh(schedule)
        assert schedule.last_run is not None
        assert schedule.next_run is not None
        assert schedule.consecutive_failures == 0
        
        # Step 6: Get history via API
        response = client.get(f"/api/scraping-schedules/{schedule_id}/history")
        assert response.status_code == 200
        history_data = response.json()
        assert len(history_data) == 1
        assert history_data[0]["success"] is True
        assert history_data[0]["items_processed"] == 2
    
    @pytest.mark.asyncio
    async def test_manual_run_workflow(self, test_db):
        """Test manual run trigger through API"""
        # Create schedule
        schedule = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            interval_hours=24.0,  # Long interval
            enabled=True,
            last_run=datetime.utcnow() - timedelta(hours=1),
            next_run=datetime.utcnow() + timedelta(hours=23)
        )
        test_db.add(schedule)
        test_db.commit()
        
        # Trigger manual run
        response = client.post(f"/api/scraping-schedules/{schedule.id}/run")
        assert response.status_code == 200
        
        # Verify next_run was updated to now
        test_db.refresh(schedule)
        time_until_run = (schedule.next_run - datetime.utcnow()).total_seconds()
        assert time_until_run < 60  # Should run within a minute
        
        # Mock and run daemon
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_scraper_instance = AsyncMock()
                mock_scraper_instance.scrape_work_orders.return_value = []
                mock_scraper.return_value = mock_scraper_instance
                
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                await asyncio.sleep(0.1)
                
                # Verify manual run was executed
                mock_scraper_instance.scrape_work_orders.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_schedule_disable_enable_workflow(self, test_db):
        """Test disabling and re-enabling a schedule"""
        # Create active schedule
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 1.0,
                "enabled": True
            }
        )
        schedule_id = response.json()["id"]
        
        # Disable schedule
        response = client.put(
            f"/api/scraping-schedules/{schedule_id}",
            json={"enabled": False}
        )
        assert response.status_code == 200
        assert response.json()["enabled"] is False
        assert response.json()["status"] == "paused"
        
        # Verify daemon doesn't run disabled schedule
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                await asyncio.sleep(0.1)
                
                # Should not be called for disabled schedule
                mock_scraper.assert_not_called()
        
        # Re-enable schedule
        response = client.put(
            f"/api/scraping-schedules/{schedule_id}",
            json={"enabled": True}
        )
        assert response.status_code == 200
        assert response.json()["enabled"] is True
        assert response.json()["next_run"] is not None
    
    @pytest.mark.asyncio
    async def test_failure_handling_workflow(self, test_db):
        """Test how system handles scraping failures"""
        # Create schedule
        schedule = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            interval_hours=1.0,
            enabled=True
        )
        test_db.add(schedule)
        test_db.commit()
        schedule_id = schedule.id
        
        # Simulate multiple failures
        for i in range(3):
            with patch('scheduler_daemon.SessionLocal', return_value=test_db):
                with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                    # Mock scraper failure
                    mock_scraper_instance = AsyncMock()
                    mock_scraper_instance.scrape_work_orders.side_effect = Exception(f"Test failure {i+1}")
                    mock_scraper.return_value = mock_scraper_instance
                    
                    daemon = SchedulerDaemon()
                    await daemon.check_and_run_schedules()
                    await asyncio.sleep(0.1)
            
            # Check consecutive failures
            test_db.refresh(schedule)
            assert schedule.consecutive_failures == i + 1
        
        # Get schedule status via API
        response = client.get(f"/api/scraping-schedules/{schedule_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["consecutive_failures"] == 3
        assert data["status"] == "active"  # Still active until 5 failures
        
        # Get history showing failures
        response = client.get(f"/api/scraping-schedules/{schedule_id}/history")
        history = response.json()
        assert len(history) == 3
        assert all(not h["success"] for h in history)
        assert all("Test failure" in h["error_message"] for h in history)
    
    @pytest.mark.asyncio
    async def test_active_hours_enforcement(self, test_db):
        """Test that schedules respect active hours"""
        current_hour = datetime.utcnow().hour
        
        # Create schedule active in next hour (not now)
        schedule = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            interval_hours=0.5,
            active_hours={
                "start": (current_hour + 2) % 24,
                "end": (current_hour + 3) % 24
            },
            enabled=True,
            last_run=datetime.utcnow() - timedelta(hours=1)
        )
        test_db.add(schedule)
        test_db.commit()
        
        # Run daemon - should not execute due to active hours
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                await asyncio.sleep(0.1)
                
                # Should not run outside active hours
                mock_scraper.assert_not_called()
        
        # Update to current hour
        response = client.put(
            f"/api/scraping-schedules/{schedule.id}",
            json={
                "active_hours": {
                    "start": max(0, current_hour - 1),
                    "end": min(23, current_hour + 1)
                }
            }
        )
        assert response.status_code == 200
        
        # Now it should run
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_scraper_instance = AsyncMock()
                mock_scraper_instance.scrape_work_orders.return_value = []
                mock_scraper.return_value = mock_scraper_instance
                
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                await asyncio.sleep(0.1)
                
                # Should run within active hours
                mock_scraper_instance.scrape_work_orders.assert_called_once()


class TestMultiUserScheduling:
    """Test scheduling with multiple users"""
    
    @pytest.mark.asyncio
    async def test_user_isolation(self, test_db):
        """Test that users can only see and modify their own schedules"""
        # Create schedules for multiple users
        users = ["user1", "user2", "user3"]
        
        for user_id in users:
            schedule = ScrapingSchedule(
                user_id=user_id,
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True
            )
            test_db.add(schedule)
            
            # Add credentials for each user
            cred = UserCredential(
                user_id=user_id,
                service_name="workfossa",
                username=f"{user_id}_username",
                password="password"
            )
            test_db.add(cred)
        
        test_db.commit()
        
        # Current user should only see their schedule
        response = client.get("/api/scraping-schedules/")
        assert response.status_code == 200
        schedules = response.json()
        assert len(schedules) == 0  # mock_user has no schedules
        
        # Create schedule for current user
        response = client.post(
            "/api/scraping-schedules/",
            json={
                "schedule_type": "work_orders",
                "interval_hours": 2.0,
                "enabled": True
            }
        )
        assert response.status_code == 200
        
        # Now should see one schedule
        response = client.get("/api/scraping-schedules/")
        schedules = response.json()
        assert len(schedules) == 1
        assert schedules[0]["user_id"] == mock_user.id
        
        # Cannot access other user's schedule
        other_schedule = test_db.query(ScrapingSchedule).filter_by(user_id="user1").first()
        response = client.get(f"/api/scraping-schedules/{other_schedule.id}")
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_concurrent_user_execution(self, test_db):
        """Test daemon handles multiple users' schedules concurrently"""
        # Create schedules for multiple users
        user_ids = ["user1", "user2", "user3"]
        
        for user_id in user_ids:
            schedule = ScrapingSchedule(
                user_id=user_id,
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                last_run=datetime.utcnow() - timedelta(hours=2)
            )
            test_db.add(schedule)
            
            cred = UserCredential(
                user_id=user_id,
                service_name="workfossa",
                username=f"{user_id}_username",
                password="password"
            )
            test_db.add(cred)
        
        test_db.commit()
        
        # Track which users' schedules were executed
        executed_users = []
        
        async def mock_scrape(credentials):
            # Extract user from credentials
            user = credentials['username'].split('_')[0]
            executed_users.append(user)
            await asyncio.sleep(0.1)  # Simulate work
            return [{"id": f"W-{user}-001"}]
        
        # Run daemon
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_scraper_instance = AsyncMock()
                mock_scraper_instance.scrape_work_orders = mock_scrape
                mock_scraper.return_value = mock_scraper_instance
                
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                
                # Wait for all tasks
                await asyncio.sleep(0.5)
        
        # Verify all users' schedules were executed
        assert len(executed_users) == 3
        assert set(executed_users) == {"user1", "user2", "user3"}
        
        # Verify history was created for each user
        for user_id in user_ids:
            history = test_db.query(ScrapingHistory).filter_by(user_id=user_id).first()
            assert history is not None
            assert history.success is True
            assert history.items_processed == 1


class TestSchedulingStatistics:
    """Test scheduling statistics and aggregation"""
    
    def test_daemon_status_aggregation(self, test_db):
        """Test daemon status endpoint with various schedule states"""
        # Create schedules in different states
        schedules = [
            ScrapingSchedule(
                user_id="user1",
                schedule_type="work_orders",
                enabled=True,
                consecutive_failures=0
            ),
            ScrapingSchedule(
                user_id="user2",
                schedule_type="dispensers",
                enabled=True,
                consecutive_failures=2
            ),
            ScrapingSchedule(
                user_id="user3",
                schedule_type="work_orders",
                enabled=False,
                consecutive_failures=0
            ),
            ScrapingSchedule(
                user_id="user4",
                schedule_type="reports",
                enabled=True,
                consecutive_failures=5  # Failed
            ),
        ]
        
        for schedule in schedules:
            test_db.add(schedule)
        
        # Add recent history
        history = ScrapingHistory(
            user_id="user1",
            schedule_type="work_orders",
            started_at=datetime.utcnow() - timedelta(minutes=2),
            success=True
        )
        test_db.add(history)
        test_db.commit()
        
        # Get daemon status
        response = client.get("/api/scraping-schedules/status/daemon")
        assert response.status_code == 200
        
        status = response.json()
        assert status["daemon_status"] == "running"  # Recent execution
        assert status["total_schedules"] == 4
        assert status["active_schedules"] == 3  # Excludes disabled
        assert status["last_execution"] is not None
    
    def test_schedule_history_pagination(self, test_db):
        """Test history pagination and limits"""
        # Create schedule
        schedule = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            enabled=True
        )
        test_db.add(schedule)
        test_db.commit()
        
        # Create many history entries
        for i in range(50):
            history = ScrapingHistory(
                user_id=mock_user.id,
                schedule_type="work_orders",
                started_at=datetime.utcnow() - timedelta(hours=i),
                completed_at=datetime.utcnow() - timedelta(hours=i) + timedelta(minutes=5),
                success=i % 3 != 0,  # Every 3rd fails
                items_processed=100 + i,
                duration_seconds=300
            )
            test_db.add(history)
        
        test_db.commit()
        
        # Test default limit
        response = client.get(f"/api/scraping-schedules/{schedule.id}/history")
        assert response.status_code == 200
        history = response.json()
        assert len(history) == 10  # Default limit
        
        # Test custom limit
        response = client.get(f"/api/scraping-schedules/{schedule.id}/history?limit=25")
        history = response.json()
        assert len(history) == 25
        
        # Test ordering (most recent first)
        assert history[0]["items_processed"] == 100  # Most recent
        assert history[24]["items_processed"] == 124  # 25th most recent
        
        # Test max limit
        response = client.get(f"/api/scraping-schedules/{schedule.id}/history?limit=200")
        history = response.json()
        assert len(history) == 50  # All entries


class TestErrorRecovery:
    """Test error recovery and resilience"""
    
    @pytest.mark.asyncio
    async def test_daemon_recovery_from_errors(self, test_db):
        """Test daemon continues after various errors"""
        # Create multiple schedules
        for i in range(3):
            schedule = ScrapingSchedule(
                user_id=f"user{i}",
                schedule_type="work_orders",
                enabled=True,
                last_run=datetime.utcnow() - timedelta(hours=2)
            )
            test_db.add(schedule)
            
            cred = UserCredential(
                user_id=f"user{i}",
                service_name="workfossa",
                username=f"user{i}",
                password="pass"
            )
            test_db.add(cred)
        
        test_db.commit()
        
        # Track executions
        execution_results = {}
        
        async def mock_scrape(credentials):
            user = credentials['username']
            if user == "user0":
                raise Exception("User 0 always fails")
            elif user == "user1":
                execution_results[user] = "success"
                return [{"id": "W-001"}]
            else:
                execution_results[user] = "success"
                return [{"id": "W-002"}]
        
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_scraper_instance = AsyncMock()
                mock_scraper_instance.scrape_work_orders = mock_scrape
                mock_scraper.return_value = mock_scraper_instance
                
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                await asyncio.sleep(0.5)
        
        # Verify partial success
        assert "user1" in execution_results
        assert "user2" in execution_results
        assert execution_results["user1"] == "success"
        assert execution_results["user2"] == "success"
        
        # Verify failure was recorded
        failed_schedule = test_db.query(ScrapingSchedule).filter_by(user_id="user0").first()
        assert failed_schedule.consecutive_failures == 1
    
    @pytest.mark.asyncio
    async def test_schedule_auto_disable_after_failures(self, test_db):
        """Test schedule stops running after too many failures"""
        schedule = ScrapingSchedule(
            user_id=mock_user.id,
            schedule_type="work_orders",
            enabled=True,
            consecutive_failures=4  # One more failure will disable
        )
        test_db.add(schedule)
        test_db.commit()
        
        # Cause one more failure
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_scraper_instance = AsyncMock()
                mock_scraper_instance.scrape_work_orders.side_effect = Exception("Final failure")
                mock_scraper.return_value = mock_scraper_instance
                
                daemon = SchedulerDaemon()
                await daemon.check_and_run_schedules()
                await asyncio.sleep(0.1)
        
        # Check status via API
        response = client.get(f"/api/scraping-schedules/{schedule.id}")
        data = response.json()
        assert data["consecutive_failures"] == 5
        assert data["status"] == "failed"
        
        # Verify daemon won't run it anymore
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                daemon = SchedulerDaemon()
                
                # Update last_run to make it eligible
                schedule.last_run = datetime.utcnow() - timedelta(hours=2)
                test_db.commit()
                
                await daemon.check_and_run_schedules()
                await asyncio.sleep(0.1)
                
                # Should not be called due to too many failures
                mock_scraper.assert_not_called()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])