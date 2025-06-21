"""Basic tests for scheduler service functionality."""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.app.services.scheduler_service import SchedulerService
from backend.app.models.scraping_models import ScrapingSchedule


class TestSchedulerServiceBasic:
    """Test basic scheduler service operations."""
    
    @pytest.fixture
    def scheduler_service(self):
        """Create a scheduler service instance."""
        with patch('backend.app.services.scheduler_service.BackgroundScheduler'):
            service = SchedulerService()
            yield service
            if hasattr(service, 'shutdown'):
                service.shutdown()
    
    def test_scheduler_initialization(self, scheduler_service):
        """Test scheduler service initializes correctly."""
        assert scheduler_service is not None
        assert hasattr(scheduler_service, 'scheduler')
        assert hasattr(scheduler_service, 'add_job')
        assert hasattr(scheduler_service, 'remove_job')
    
    def test_add_hourly_job(self, scheduler_service):
        """Test adding an hourly scraping job."""
        schedule = Mock(spec=ScrapingSchedule)
        schedule.id = 1
        schedule.user_id = "test-user"
        schedule.name = "Test Schedule"
        schedule.is_active = True
        schedule.schedule_type = "hourly"
        schedule.schedule_config = {"interval": 1}
        
        with patch.object(scheduler_service, 'add_job') as mock_add:
            scheduler_service.schedule_scraping_job(schedule)
            mock_add.assert_called_once()
            
            # Verify job configuration
            call_args = mock_add.call_args
            assert 'hourly_scrape_1' in str(call_args)
    
    def test_remove_job(self, scheduler_service):
        """Test removing a scheduled job."""
        schedule_id = 1
        
        with patch.object(scheduler_service.scheduler, 'remove_job') as mock_remove:
            scheduler_service.remove_job(schedule_id)
            mock_remove.assert_called_once_with(f'hourly_scrape_{schedule_id}')
    
    def test_calculate_next_run_hourly(self, scheduler_service):
        """Test next run calculation for hourly schedule."""
        now = datetime.now()
        schedule = Mock(spec=ScrapingSchedule)
        schedule.schedule_type = "hourly"
        schedule.schedule_config = {"interval": 2}  # Every 2 hours
        schedule.last_run = now - timedelta(hours=1)
        
        next_run = scheduler_service._calculate_next_run(schedule)
        
        # Should be 1 hour from now (2 hours from last run)
        expected = schedule.last_run + timedelta(hours=2)
        assert abs((next_run - expected).total_seconds()) < 60  # Within 1 minute


if __name__ == "__main__":
    pytest.main([__file__, "-v"])