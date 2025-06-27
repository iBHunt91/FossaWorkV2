#!/usr/bin/env python3
"""
Tests for the scheduler daemon
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from scheduler_daemon import SchedulerDaemon
from app.database import Base
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.models.user_models import UserCredential


# Create test database
engine = create_engine("sqlite:///:memory:")
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture
def test_db():
    """Create a fresh test database for each test"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestSessionLocal()
    yield db
    db.close()


@pytest.fixture
def daemon():
    """Create a scheduler daemon instance"""
    daemon = SchedulerDaemon()
    daemon.check_interval = 1  # Speed up tests
    return daemon


@pytest.fixture
def sample_schedule(test_db):
    """Create a sample schedule"""
    schedule = ScrapingSchedule(
        user_id="test_user_123",
        schedule_type="work_orders",
        interval_hours=1.0,
        enabled=True,
        last_run=datetime.utcnow() - timedelta(hours=2)  # Should trigger
    )
    test_db.add(schedule)
    test_db.commit()
    test_db.refresh(schedule)
    return schedule


@pytest.fixture
def user_credential(test_db):
    """Create user credentials"""
    cred = UserCredential(
        user_id="test_user_123",
        service_name="workfossa",
        username="testuser",
        password="testpass"
    )
    test_db.add(cred)
    test_db.commit()
    return cred


class TestSchedulerDaemon:
    """Test SchedulerDaemon class"""
    
    def test_daemon_initialization(self):
        """Test daemon initializes correctly"""
        daemon = SchedulerDaemon()
        
        assert daemon.running is False
        assert daemon.active_jobs == set()
        assert daemon.check_interval == 60
    
    def test_should_run_schedule_enabled(self, daemon, sample_schedule):
        """Test schedule should run when conditions are met"""
        assert daemon.should_run_schedule(sample_schedule) is True
    
    def test_should_not_run_disabled(self, daemon, sample_schedule):
        """Test disabled schedule should not run"""
        sample_schedule.enabled = False
        assert daemon.should_run_schedule(sample_schedule) is False
    
    def test_should_not_run_too_many_failures(self, daemon, sample_schedule):
        """Test schedule with too many failures should not run"""
        sample_schedule.consecutive_failures = 5
        assert daemon.should_run_schedule(sample_schedule) is False
    
    def test_should_not_run_too_recent(self, daemon, sample_schedule):
        """Test schedule that ran recently should not run"""
        sample_schedule.last_run = datetime.utcnow() - timedelta(minutes=30)
        assert daemon.should_run_schedule(sample_schedule) is False
    
    def test_should_run_never_run_before(self, daemon):
        """Test schedule that never ran should run"""
        schedule = ScrapingSchedule(
            user_id="test_user",
            schedule_type="work_orders",
            enabled=True,
            last_run=None
        )
        assert daemon.should_run_schedule(schedule) is True
    
    def test_active_hours_within_range(self, daemon, sample_schedule):
        """Test schedule runs within active hours"""
        current_hour = datetime.utcnow().hour
        sample_schedule.active_hours = {
            "start": max(0, current_hour - 1),
            "end": min(23, current_hour + 1)
        }
        assert daemon.should_run_schedule(sample_schedule) is True
    
    def test_active_hours_outside_range(self, daemon, sample_schedule):
        """Test schedule doesn't run outside active hours"""
        current_hour = datetime.utcnow().hour
        # Set active hours to exclude current hour
        sample_schedule.active_hours = {
            "start": (current_hour + 2) % 24,
            "end": (current_hour + 3) % 24
        }
        assert daemon.should_run_schedule(sample_schedule) is False


class TestWorkOrderScraping:
    """Test work order scraping execution"""
    
    @pytest.mark.asyncio
    @patch('scheduler_daemon.SessionLocal')
    @patch('scheduler_daemon.WorkFossaScraper')
    @patch('scheduler_daemon.NotificationManager')
    async def test_successful_scraping(self, mock_notification, mock_scraper, mock_session, 
                                     daemon, test_db, sample_schedule, user_credential):
        """Test successful work order scraping"""
        # Setup mocks
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            user_credential,  # First call for credentials
            Mock(id=1),       # Second call for history update
            sample_schedule   # Third call for schedule update
        ]
        mock_db.execute.return_value.scalar.return_value = 10  # Existing count
        
        # Mock scraper
        mock_scraper_instance = AsyncMock()
        mock_scraper_instance.scrape_work_orders.return_value = [
            {"id": "W-12345", "store": "#1234"},
            {"id": "W-12346", "store": "#1235"}
        ]
        mock_scraper.return_value = mock_scraper_instance
        
        # Mock notification
        mock_notification_instance = AsyncMock()
        mock_notification.return_value = mock_notification_instance
        
        # Execute
        await daemon.execute_work_order_scraping("test_user_123", sample_schedule.id)
        
        # Verify scraper was called
        mock_scraper_instance.scrape_work_orders.assert_called_once()
        
        # Verify notification was sent
        mock_notification_instance.send_if_configured.assert_called_once_with(
            "scheduled_scrape_complete",
            {
                "items_found": 2,
                "existing_items": 10,
                "duration_seconds": pytest.approx(0, abs=5)
            }
        )
        
        # Verify consecutive failures reset
        assert sample_schedule.consecutive_failures == 0
    
    @pytest.mark.asyncio
    @patch('scheduler_daemon.SessionLocal')
    @patch('scheduler_daemon.logger')
    async def test_scraping_no_credentials(self, mock_logger, mock_session, daemon):
        """Test scraping fails when no credentials found"""
        # Setup mocks
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Mock no credentials found
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Execute
        await daemon.execute_work_order_scraping("test_user_123", 1)
        
        # Verify error was logged
        mock_logger.error.assert_called()
        assert "No WorkFossa credentials found" in str(mock_logger.error.call_args)
    
    @pytest.mark.asyncio
    @patch('scheduler_daemon.SessionLocal')
    @patch('scheduler_daemon.WorkFossaScraper')
    async def test_scraping_failure(self, mock_scraper, mock_session, daemon, 
                                  test_db, sample_schedule, user_credential):
        """Test handling scraping failure"""
        # Setup mocks
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            user_credential,
            Mock(id=1),  # History entry
            sample_schedule
        ]
        mock_db.query.return_value.filter_by.return_value.first.side_effect = [
            Mock(id=1),  # History entry
            sample_schedule
        ]
        
        # Mock scraper failure
        mock_scraper_instance = AsyncMock()
        mock_scraper_instance.scrape_work_orders.side_effect = Exception("Authentication failed")
        mock_scraper.return_value = mock_scraper_instance
        
        # Execute
        await daemon.execute_work_order_scraping("test_user_123", sample_schedule.id)
        
        # Verify consecutive failures incremented
        assert sample_schedule.consecutive_failures == 1
    
    @pytest.mark.asyncio
    async def test_duplicate_job_prevention(self, daemon):
        """Test that duplicate jobs are prevented"""
        job_key = "test_user_123_1"
        daemon.active_jobs.add(job_key)
        
        with patch('scheduler_daemon.logger') as mock_logger:
            await daemon.execute_work_order_scraping("test_user_123", 1)
            
            # Verify warning was logged
            mock_logger.warning.assert_called()
            assert "already running" in str(mock_logger.warning.call_args)


class TestScheduleChecking:
    """Test schedule checking and execution"""
    
    @pytest.mark.asyncio
    @patch('scheduler_daemon.SessionLocal')
    async def test_check_and_run_schedules(self, mock_session, daemon, test_db):
        """Test checking and running due schedules"""
        # Create test schedules
        schedule1 = ScrapingSchedule(
            id=1,
            user_id="user1",
            schedule_type="work_orders",
            enabled=True,
            last_run=datetime.utcnow() - timedelta(hours=2),
            interval_hours=1.0
        )
        schedule2 = ScrapingSchedule(
            id=2,
            user_id="user2",
            schedule_type="work_orders",
            enabled=True,
            last_run=None,  # Never run
            interval_hours=1.0
        )
        schedule3 = ScrapingSchedule(
            id=3,
            user_id="user3",
            schedule_type="work_orders",
            enabled=False,  # Disabled
            interval_hours=1.0
        )
        
        # Setup mocks
        mock_db = Mock()
        mock_session.return_value = mock_db
        mock_db.query.return_value.filter.return_value.all.return_value = [
            schedule1, schedule2, schedule3
        ]
        
        # Mock execute method
        with patch.object(daemon, 'execute_work_order_scraping', new_callable=AsyncMock) as mock_execute:
            await daemon.check_and_run_schedules()
            
            # Verify only enabled schedules that should run were executed
            assert mock_execute.call_count == 2
            
            # Verify next_run was updated
            assert schedule1.next_run is not None
            assert schedule2.next_run is not None
            assert schedule3.next_run is None  # Disabled schedule
    
    @pytest.mark.asyncio
    @patch('scheduler_daemon.SessionLocal')
    @patch('scheduler_daemon.logger')
    async def test_unknown_schedule_type(self, mock_logger, mock_session, daemon):
        """Test handling unknown schedule type"""
        schedule = ScrapingSchedule(
            id=1,
            user_id="user1",
            schedule_type="unknown_type",
            enabled=True,
            last_run=None
        )
        
        mock_db = Mock()
        mock_session.return_value = mock_db
        mock_db.query.return_value.filter.return_value.all.return_value = [schedule]
        
        await daemon.check_and_run_schedules()
        
        # Verify warning was logged
        mock_logger.warning.assert_called()
        assert "Unknown schedule type" in str(mock_logger.warning.call_args)
    
    @pytest.mark.asyncio
    @patch('scheduler_daemon.SessionLocal')
    @patch('scheduler_daemon.logger')
    async def test_check_schedules_error_handling(self, mock_logger, mock_session, daemon):
        """Test error handling in check_and_run_schedules"""
        mock_session.side_effect = Exception("Database connection error")
        
        await daemon.check_and_run_schedules()
        
        # Verify error was logged
        mock_logger.error.assert_called()
        assert "Error checking schedules" in str(mock_logger.error.call_args)


class TestDaemonLifecycle:
    """Test daemon lifecycle operations"""
    
    @pytest.mark.asyncio
    async def test_daemon_run_loop(self, daemon):
        """Test daemon run loop"""
        daemon.check_interval = 0.1  # Very short interval for testing
        
        with patch.object(daemon, 'check_and_run_schedules', new_callable=AsyncMock) as mock_check:
            # Run daemon for a short time
            async def stop_after_delay():
                await asyncio.sleep(0.3)
                daemon.stop()
            
            asyncio.create_task(stop_after_delay())
            await daemon.run()
            
            # Verify check_and_run_schedules was called multiple times
            assert mock_check.call_count >= 2
    
    @pytest.mark.asyncio
    async def test_daemon_error_recovery(self, daemon):
        """Test daemon continues after errors"""
        daemon.check_interval = 0.1
        call_count = 0
        
        async def mock_check():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Test error")
            elif call_count >= 3:
                daemon.stop()
        
        with patch.object(daemon, 'check_and_run_schedules', side_effect=mock_check):
            await daemon.run()
            
            # Verify daemon continued after error
            assert call_count >= 3
    
    def test_daemon_stop(self, daemon):
        """Test stopping the daemon"""
        daemon.running = True
        daemon.stop()
        
        assert daemon.running is False


class TestIntegration:
    """Integration tests for the scheduler daemon"""
    
    @pytest.mark.asyncio
    @patch('scheduler_daemon.WorkFossaScraper')
    @patch('scheduler_daemon.NotificationManager')
    async def test_full_schedule_execution_flow(self, mock_notification, mock_scraper, test_db):
        """Test complete flow from schedule check to execution"""
        # Create test data
        user_id = "test_user_123"
        
        # Create schedule
        schedule = ScrapingSchedule(
            user_id=user_id,
            schedule_type="work_orders",
            interval_hours=1.0,
            enabled=True,
            last_run=datetime.utcnow() - timedelta(hours=2)
        )
        test_db.add(schedule)
        
        # Create credentials
        cred = UserCredential(
            user_id=user_id,
            service_name="workfossa",
            username="testuser",
            password="testpass"
        )
        test_db.add(cred)
        test_db.commit()
        
        # Setup mocks
        mock_scraper_instance = AsyncMock()
        mock_scraper_instance.scrape_work_orders.return_value = [{"id": "W-12345"}]
        mock_scraper.return_value = mock_scraper_instance
        
        mock_notification_instance = AsyncMock()
        mock_notification.return_value = mock_notification_instance
        
        # Create daemon with real database
        daemon = SchedulerDaemon()
        
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            await daemon.check_and_run_schedules()
            
            # Wait for async task to complete
            await asyncio.sleep(0.1)
            
            # Verify schedule was updated
            test_db.refresh(schedule)
            assert schedule.next_run is not None
            
            # Verify history was created
            history = test_db.query(ScrapingHistory).filter_by(user_id=user_id).first()
            assert history is not None
            assert history.schedule_type == "work_orders"
    
    @pytest.mark.asyncio
    async def test_concurrent_schedule_execution(self, daemon, test_db):
        """Test multiple schedules can run concurrently"""
        # Create multiple schedules for different users
        schedules = []
        for i in range(3):
            schedule = ScrapingSchedule(
                user_id=f"user_{i}",
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                last_run=None
            )
            schedules.append(schedule)
            test_db.add(schedule)
            
            # Add credentials
            cred = UserCredential(
                user_id=f"user_{i}",
                service_name="workfossa",
                username=f"user{i}",
                password="pass"
            )
            test_db.add(cred)
        
        test_db.commit()
        
        # Track execution
        execution_times = []
        
        async def mock_scrape(*args):
            execution_times.append(datetime.utcnow())
            await asyncio.sleep(0.1)  # Simulate work
            return []
        
        with patch('scheduler_daemon.SessionLocal', return_value=test_db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_scraper_instance = AsyncMock()
                mock_scraper_instance.scrape_work_orders = mock_scrape
                mock_scraper.return_value = mock_scraper_instance
                
                await daemon.check_and_run_schedules()
                
                # Wait for all tasks to complete
                await asyncio.sleep(0.3)
                
                # Verify all schedules were executed
                assert len(execution_times) == 3
                
                # Verify they started roughly at the same time (concurrent)
                time_diff = (execution_times[-1] - execution_times[0]).total_seconds()
                assert time_diff < 0.1  # Should be nearly simultaneous


if __name__ == "__main__":
    pytest.main([__file__, "-v"])