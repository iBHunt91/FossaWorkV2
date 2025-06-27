#!/usr/bin/env python3
"""
Interactive test script for scheduling system
Allows manual verification of scheduling functionality
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.models.user_models import UserCredential
from scheduler_daemon import SchedulerDaemon


async def wait_for_user():
    """Pause and wait for user to continue"""
    print("\n⏸️  Press Enter to continue...")
    await asyncio.get_event_loop().run_in_executor(None, input)


class InteractiveScheduleTester:
    """Interactive tester for scheduling system"""
    
    def __init__(self):
        # Create test database
        self.engine = create_engine("sqlite:///test_schedule.db", echo=False)
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()
        self.user_id = "interactive_test_user"
        
    async def setup_test_data(self):
        """Set up test data"""
        print("\n🔧 Step 1: Setting up test data...")
        print("Creating user credentials and initial schedule")
        
        # Clear existing data
        self.db.query(ScrapingSchedule).delete()
        self.db.query(ScrapingHistory).delete()
        self.db.query(UserCredential).delete()
        
        # Create user credentials
        cred = UserCredential(
            user_id=self.user_id,
            service_name="workfossa",
            username="testuser",
            password="testpass123"
        )
        self.db.add(cred)
        
        # Create test schedule
        schedule = ScrapingSchedule(
            user_id=self.user_id,
            schedule_type="work_orders",
            interval_hours=0.5,  # 30 minutes for testing
            active_hours={"start": 0, "end": 24},  # Always active
            enabled=True,
            last_run=datetime.utcnow() - timedelta(hours=1),  # Should trigger
            consecutive_failures=0
        )
        self.db.add(schedule)
        self.db.commit()
        
        print(f"✅ Created schedule ID: {schedule.id}")
        print(f"   - Type: {schedule.schedule_type}")
        print(f"   - Interval: {schedule.interval_hours} hours")
        print(f"   - Enabled: {schedule.enabled}")
        print(f"   - Last run: {schedule.last_run}")
        
        await wait_for_user()
        return schedule
    
    async def test_schedule_checking(self):
        """Test schedule eligibility checking"""
        print("\n🔍 Step 2: Testing schedule eligibility...")
        
        daemon = SchedulerDaemon()
        schedules = self.db.query(ScrapingSchedule).all()
        
        for schedule in schedules:
            should_run = daemon.should_run_schedule(schedule)
            print(f"\nSchedule {schedule.id}:")
            print(f"  - Should run: {should_run}")
            print(f"  - Enabled: {schedule.enabled}")
            print(f"  - Last run: {schedule.last_run}")
            print(f"  - Hours since last run: {(datetime.utcnow() - schedule.last_run).total_seconds() / 3600:.2f}")
            print(f"  - Interval: {schedule.interval_hours} hours")
            print(f"  - Consecutive failures: {schedule.consecutive_failures}")
        
        await wait_for_user()
    
    async def test_daemon_execution(self):
        """Test daemon execution"""
        print("\n🚀 Step 3: Testing daemon execution...")
        print("This will simulate the daemon checking and running schedules")
        
        # Create daemon with test database
        daemon = SchedulerDaemon()
        daemon.check_interval = 5  # Check every 5 seconds for testing
        
        # Mock the scraper
        from unittest.mock import AsyncMock, patch
        
        async def mock_scrape(credentials):
            print(f"\n📡 Scraping with credentials: {credentials['username']}")
            await asyncio.sleep(2)  # Simulate work
            return [
                {"id": "W-12345", "store": "#1234", "customer": "Test Store 1"},
                {"id": "W-12346", "store": "#1235", "customer": "Test Store 2"},
                {"id": "W-12347", "store": "#1236", "customer": "Test Store 3"}
            ]
        
        with patch('scheduler_daemon.SessionLocal', return_value=self.db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_instance = AsyncMock()
                mock_instance.scrape_work_orders = mock_scrape
                mock_scraper.return_value = mock_instance
                
                print("\n⏱️  Running daemon check...")
                await daemon.check_and_run_schedules()
                
                print("\n⏳ Waiting for execution to complete...")
                await asyncio.sleep(3)
        
        print("\n✅ Daemon check complete")
        await wait_for_user()
    
    async def test_history_creation(self):
        """Check if history was created"""
        print("\n📊 Step 4: Checking execution history...")
        
        histories = self.db.query(ScrapingHistory).filter_by(user_id=self.user_id).all()
        
        if not histories:
            print("❌ No history entries found")
        else:
            print(f"✅ Found {len(histories)} history entries:")
            
            for history in histories:
                print(f"\n  History ID: {history.id}")
                print(f"  - Started: {history.started_at}")
                print(f"  - Completed: {history.completed_at}")
                print(f"  - Success: {history.success}")
                print(f"  - Items processed: {history.items_processed}")
                print(f"  - Duration: {history.duration_seconds:.2f}s" if history.duration_seconds else "  - Duration: N/A")
                print(f"  - Trigger: {history.trigger_type}")
                if history.error_message:
                    print(f"  - Error: {history.error_message}")
        
        await wait_for_user()
    
    async def test_schedule_update(self):
        """Check if schedule was updated after execution"""
        print("\n🔄 Step 5: Checking schedule updates...")
        
        schedule = self.db.query(ScrapingSchedule).filter_by(user_id=self.user_id).first()
        
        if schedule:
            print(f"Schedule ID: {schedule.id}")
            print(f"  - Last run: {schedule.last_run}")
            print(f"  - Next run: {schedule.next_run}")
            print(f"  - Consecutive failures: {schedule.consecutive_failures}")
            print(f"  - Updated at: {schedule.updated_at}")
            
            if schedule.last_run:
                time_since = (datetime.utcnow() - schedule.last_run).total_seconds() / 60
                print(f"  - Minutes since last run: {time_since:.1f}")
            
            if schedule.next_run:
                time_until = (schedule.next_run - datetime.utcnow()).total_seconds() / 60
                print(f"  - Minutes until next run: {time_until:.1f}")
        
        await wait_for_user()
    
    async def test_failure_scenario(self):
        """Test failure handling"""
        print("\n❌ Step 6: Testing failure scenario...")
        print("This will simulate a scraping failure")
        
        # Reset schedule for failure test
        schedule = self.db.query(ScrapingSchedule).filter_by(user_id=self.user_id).first()
        schedule.last_run = datetime.utcnow() - timedelta(hours=1)
        schedule.consecutive_failures = 0
        self.db.commit()
        
        daemon = SchedulerDaemon()
        
        # Mock scraper to fail
        from unittest.mock import AsyncMock, patch
        
        async def mock_scrape_fail(credentials):
            print(f"\n💥 Simulating scraping failure...")
            raise Exception("Authentication failed - Invalid credentials")
        
        with patch('scheduler_daemon.SessionLocal', return_value=self.db):
            with patch('scheduler_daemon.WorkFossaScraper') as mock_scraper:
                mock_instance = AsyncMock()
                mock_instance.scrape_work_orders = mock_scrape_fail
                mock_scraper.return_value = mock_instance
                
                await daemon.check_and_run_schedules()
                await asyncio.sleep(2)
        
        # Check results
        self.db.refresh(schedule)
        print(f"\n📈 Failure handling results:")
        print(f"  - Consecutive failures: {schedule.consecutive_failures}")
        print(f"  - Last run: {schedule.last_run}")
        
        # Check failure history
        failure_history = self.db.query(ScrapingHistory).filter_by(
            user_id=self.user_id,
            success=False
        ).order_by(ScrapingHistory.started_at.desc()).first()
        
        if failure_history:
            print(f"\n  Failure history:")
            print(f"  - Error: {failure_history.error_message}")
            print(f"  - Duration: {failure_history.duration_seconds:.2f}s" if failure_history.duration_seconds else "  - Duration: N/A")
        
        await wait_for_user()
    
    async def test_active_hours(self):
        """Test active hours enforcement"""
        print("\n⏰ Step 7: Testing active hours...")
        
        schedule = self.db.query(ScrapingSchedule).filter_by(user_id=self.user_id).first()
        current_hour = datetime.utcnow().hour
        
        # Set active hours to exclude current hour
        schedule.active_hours = {
            "start": (current_hour + 2) % 24,
            "end": (current_hour + 3) % 24
        }
        schedule.last_run = datetime.utcnow() - timedelta(hours=2)
        self.db.commit()
        
        print(f"Current hour: {current_hour}")
        print(f"Active hours: {schedule.active_hours['start']}:00 - {schedule.active_hours['end']}:00")
        
        daemon = SchedulerDaemon()
        should_run = daemon.should_run_schedule(schedule)
        print(f"Should run now: {should_run} (expected: False)")
        
        # Set active hours to include current hour
        schedule.active_hours = {
            "start": max(0, current_hour - 1),
            "end": min(23, current_hour + 1)
        }
        self.db.commit()
        
        should_run = daemon.should_run_schedule(schedule)
        print(f"\nAfter updating active hours to {schedule.active_hours['start']}:00 - {schedule.active_hours['end']}:00")
        print(f"Should run now: {should_run} (expected: True)")
        
        await wait_for_user()
    
    async def cleanup(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Show final state
        schedules = self.db.query(ScrapingSchedule).count()
        histories = self.db.query(ScrapingHistory).count()
        
        print(f"Final state:")
        print(f"  - Schedules: {schedules}")
        print(f"  - History entries: {histories}")
        
        self.db.close()
        
        # Optionally remove test database
        response = input("\nRemove test database? (y/n): ")
        if response.lower() == 'y':
            os.remove("test_schedule.db")
            print("✅ Test database removed")
        else:
            print("ℹ️  Test database kept at: test_schedule.db")
    
    async def run_all_tests(self):
        """Run all interactive tests"""
        print("=" * 60)
        print("🧪 Interactive Schedule Testing")
        print("=" * 60)
        print("This script will walk through various scheduling scenarios")
        print("allowing you to verify the behavior at each step.")
        
        try:
            await self.setup_test_data()
            await self.test_schedule_checking()
            await self.test_daemon_execution()
            await self.test_history_creation()
            await self.test_schedule_update()
            await self.test_failure_scenario()
            await self.test_active_hours()
        except KeyboardInterrupt:
            print("\n\n⚠️  Test interrupted by user")
        except Exception as e:
            print(f"\n\n❌ Error during testing: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await self.cleanup()
        
        print("\n✅ Interactive testing complete!")


async def main():
    """Main entry point"""
    tester = InteractiveScheduleTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())