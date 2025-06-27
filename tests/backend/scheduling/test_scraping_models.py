#!/usr/bin/env python3
"""
Tests for scraping schedule database models
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory, ScrapingStatistics


@pytest.fixture
def test_db():
    """Create a test database"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestSessionLocal()
    yield db
    db.close()


class TestScrapingSchedule:
    """Test ScrapingSchedule model"""
    
    def test_create_schedule(self, test_db):
        """Test creating a basic schedule"""
        schedule = ScrapingSchedule(
            user_id="test_user_123",
            schedule_type="work_orders",
            interval_hours=2.5,
            enabled=True
        )
        test_db.add(schedule)
        test_db.commit()
        
        assert schedule.id is not None
        assert schedule.user_id == "test_user_123"
        assert schedule.schedule_type == "work_orders"
        assert schedule.interval_hours == 2.5
        assert schedule.enabled is True
        assert schedule.consecutive_failures == 0
        assert schedule.created_at is not None
        assert schedule.updated_at is not None
    
    def test_schedule_with_active_hours(self, test_db):
        """Test schedule with active hours configuration"""
        schedule = ScrapingSchedule(
            user_id="test_user_123",
            schedule_type="dispensers",
            interval_hours=1.0,
            active_hours={"start": 6, "end": 22},
            enabled=True
        )
        test_db.add(schedule)
        test_db.commit()
        
        assert schedule.active_hours == {"start": 6, "end": 22}
    
    def test_schedule_with_config(self, test_db):
        """Test schedule with additional configuration"""
        config = {
            "max_retries": 3,
            "timeout": 30,
            "batch_size": 50
        }
        schedule = ScrapingSchedule(
            user_id="test_user_123",
            schedule_type="work_orders",
            interval_hours=1.0,
            config=config
        )
        test_db.add(schedule)
        test_db.commit()
        
        assert schedule.config == config
    
    def test_schedule_to_dict(self, test_db):
        """Test converting schedule to dictionary"""
        now = datetime.utcnow()
        schedule = ScrapingSchedule(
            user_id="test_user_123",
            schedule_type="work_orders",
            interval_hours=1.5,
            active_hours={"start": 9, "end": 17},
            enabled=True,
            last_run=now,
            next_run=now + timedelta(hours=1.5),
            consecutive_failures=2
        )
        test_db.add(schedule)
        test_db.commit()
        
        schedule_dict = schedule.to_dict()
        
        assert schedule_dict["id"] == schedule.id
        assert schedule_dict["user_id"] == "test_user_123"
        assert schedule_dict["schedule_type"] == "work_orders"
        assert schedule_dict["interval_hours"] == 1.5
        assert schedule_dict["active_hours"] == {"start": 9, "end": 17}
        assert schedule_dict["enabled"] is True
        assert schedule_dict["consecutive_failures"] == 2
        assert schedule_dict["last_run"] is not None
        assert schedule_dict["next_run"] is not None
    
    def test_multiple_schedules_per_user(self, test_db):
        """Test user can have multiple schedules for different types"""
        user_id = "test_user_123"
        
        schedule1 = ScrapingSchedule(
            user_id=user_id,
            schedule_type="work_orders",
            interval_hours=1.0
        )
        schedule2 = ScrapingSchedule(
            user_id=user_id,
            schedule_type="dispensers",
            interval_hours=2.0
        )
        
        test_db.add_all([schedule1, schedule2])
        test_db.commit()
        
        schedules = test_db.query(ScrapingSchedule).filter_by(user_id=user_id).all()
        assert len(schedules) == 2
        assert {s.schedule_type for s in schedules} == {"work_orders", "dispensers"}


class TestScrapingHistory:
    """Test ScrapingHistory model"""
    
    def test_create_history_entry(self, test_db):
        """Test creating a history entry"""
        started = datetime.utcnow()
        history = ScrapingHistory(
            user_id="test_user_123",
            schedule_type="work_orders",
            started_at=started,
            trigger_type="scheduled"
        )
        test_db.add(history)
        test_db.commit()
        
        assert history.id is not None
        assert history.user_id == "test_user_123"
        assert history.schedule_type == "work_orders"
        assert history.started_at == started
        assert history.trigger_type == "scheduled"
        assert history.success is False  # Default
        assert history.items_processed == 0  # Default
    
    def test_successful_history_entry(self, test_db):
        """Test a successful scraping run history"""
        started = datetime.utcnow()
        completed = started + timedelta(seconds=45.5)
        
        history = ScrapingHistory(
            user_id="test_user_123",
            schedule_type="work_orders",
            started_at=started,
            completed_at=completed,
            success=True,
            items_processed=150,
            items_added=10,
            items_updated=5,
            items_failed=0,
            duration_seconds=45.5,
            memory_usage_mb=125.3,
            trigger_type="manual"
        )
        test_db.add(history)
        test_db.commit()
        
        assert history.success is True
        assert history.items_processed == 150
        assert history.items_added == 10
        assert history.items_updated == 5
        assert history.items_failed == 0
        assert history.duration_seconds == 45.5
        assert history.memory_usage_mb == 125.3
        assert history.trigger_type == "manual"
    
    def test_failed_history_entry(self, test_db):
        """Test a failed scraping run history"""
        history = ScrapingHistory(
            user_id="test_user_123",
            schedule_type="dispensers",
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow() + timedelta(seconds=10),
            success=False,
            error_message="Authentication failed",
            error_details={
                "status_code": 401,
                "endpoint": "/login",
                "timestamp": datetime.utcnow().isoformat()
            },
            duration_seconds=10.0
        )
        test_db.add(history)
        test_db.commit()
        
        assert history.success is False
        assert history.error_message == "Authentication failed"
        assert history.error_details["status_code"] == 401
    
    def test_history_with_metadata(self, test_db):
        """Test history entry with additional metadata"""
        metadata = {
            "browser_version": "Chrome 120.0",
            "page_load_time": 2.5,
            "api_calls": 15,
            "filters_applied": ["status:active", "date:today"]
        }
        
        history = ScrapingHistory(
            user_id="test_user_123",
            schedule_type="work_orders",
            started_at=datetime.utcnow(),
            run_metadata=metadata
        )
        test_db.add(history)
        test_db.commit()
        
        assert history.run_metadata == metadata
    
    def test_history_to_dict(self, test_db):
        """Test converting history to dictionary"""
        started = datetime.utcnow()
        completed = started + timedelta(seconds=30)
        
        history = ScrapingHistory(
            user_id="test_user_123",
            schedule_type="work_orders",
            started_at=started,
            completed_at=completed,
            success=True,
            items_processed=100,
            duration_seconds=30.0
        )
        test_db.add(history)
        test_db.commit()
        
        history_dict = history.to_dict()
        
        assert history_dict["id"] == history.id
        assert history_dict["user_id"] == "test_user_123"
        assert history_dict["schedule_type"] == "work_orders"
        assert history_dict["success"] is True
        assert history_dict["items_processed"] == 100
        assert history_dict["duration_seconds"] == 30.0
        assert "started_at" in history_dict
        assert "completed_at" in history_dict


class TestScrapingStatistics:
    """Test ScrapingStatistics model"""
    
    def test_create_statistics(self, test_db):
        """Test creating statistics entry"""
        stats = ScrapingStatistics(
            user_id="test_user_123",
            schedule_type="work_orders"
        )
        test_db.add(stats)
        test_db.commit()
        
        assert stats.id is not None
        assert stats.user_id == "test_user_123"
        assert stats.schedule_type == "work_orders"
        assert stats.total_runs == 0
        assert stats.successful_runs == 0
        assert stats.failed_runs == 0
    
    def test_update_statistics(self, test_db):
        """Test updating statistics with run data"""
        first_run = datetime.utcnow()
        
        stats = ScrapingStatistics(
            user_id="test_user_123",
            schedule_type="dispensers",
            total_runs=10,
            successful_runs=8,
            failed_runs=2,
            total_items_processed=1500,
            total_items_added=100,
            total_items_updated=50,
            avg_duration_seconds=45.5,
            avg_items_per_run=150.0,
            first_run=first_run,
            last_successful_run=first_run + timedelta(hours=9),
            last_failed_run=first_run + timedelta(hours=5)
        )
        test_db.add(stats)
        test_db.commit()
        
        assert stats.total_runs == 10
        assert stats.successful_runs == 8
        assert stats.failed_runs == 2
        assert stats.total_items_processed == 1500
        assert stats.avg_duration_seconds == 45.5
        assert stats.avg_items_per_run == 150.0
    
    def test_statistics_to_dict(self, test_db):
        """Test converting statistics to dictionary"""
        now = datetime.utcnow()
        
        stats = ScrapingStatistics(
            user_id="test_user_123",
            schedule_type="work_orders",
            total_runs=5,
            successful_runs=4,
            failed_runs=1,
            first_run=now - timedelta(days=7),
            last_successful_run=now - timedelta(hours=1)
        )
        test_db.add(stats)
        test_db.commit()
        
        stats_dict = stats.to_dict()
        
        assert stats_dict["total_runs"] == 5
        assert stats_dict["successful_runs"] == 4
        assert stats_dict["failed_runs"] == 1
        assert "first_run" in stats_dict
        assert "last_successful_run" in stats_dict
        assert stats_dict["last_failed_run"] is None


class TestModelRelationships:
    """Test relationships between models"""
    
    def test_user_schedule_history_relationship(self, test_db):
        """Test relationship between user, schedule, and history"""
        user_id = "test_user_123"
        
        # Create schedule
        schedule = ScrapingSchedule(
            user_id=user_id,
            schedule_type="work_orders",
            interval_hours=1.0
        )
        test_db.add(schedule)
        test_db.commit()
        
        # Create multiple history entries
        for i in range(3):
            history = ScrapingHistory(
                user_id=user_id,
                schedule_type="work_orders",
                started_at=datetime.utcnow() - timedelta(hours=i),
                success=True,
                items_processed=100 + i*10
            )
            test_db.add(history)
        
        test_db.commit()
        
        # Query history for user and schedule type
        histories = test_db.query(ScrapingHistory).filter_by(
            user_id=user_id,
            schedule_type="work_orders"
        ).all()
        
        assert len(histories) == 3
        assert all(h.user_id == user_id for h in histories)
        assert all(h.schedule_type == "work_orders" for h in histories)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])