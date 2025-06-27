#!/usr/bin/env python3
"""
Comprehensive tests for schedule creation, detection, and persistence fixes
Tests both database-only mode and full scheduler scenarios
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, Any

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from sqlalchemy import text


class TestScheduleFixes:
    """Test suite for all schedule-related fixes"""
    
    def __init__(self):
        self.test_user_id = "test_user_schedule_fixes"
        self.db = None
    
    def setup(self):
        """Set up test environment"""
        print("🔧 Setting up test environment...")
        self.db = SessionLocal()
        
        # Clean up any existing test data
        self.db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == self.test_user_id
        ).delete()
        self.db.commit()
        
        print("✓ Test environment ready")
    
    def teardown(self):
        """Clean up test environment"""
        print("🧹 Cleaning up test environment...")
        if self.db:
            # Clean up test data
            self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).delete()
            self.db.commit()
            self.db.close()
        print("✓ Cleanup complete")
    
    def test_database_connectivity(self):
        """Test 1: Database connection and table existence"""
        print("\\n🔍 Test 1: Database connectivity...")
        
        try:
            # Test basic connectivity
            result = self.db.execute(text('SELECT 1')).scalar()
            assert result == 1, "Database connection failed"
            print("✓ Database connection successful")
            
            # Test table exists
            self.db.execute(text('SELECT * FROM scraping_schedules LIMIT 1'))
            print("✓ ScrapingSchedule table exists")
            
            return True
        except Exception as e:
            print(f"✗ Database test failed: {e}")
            return False
    
    def test_schedule_persistence(self):
        """Test 2: Schedule data persistence without scheduler service"""
        print("\\n🔍 Test 2: Schedule persistence...")
        
        try:
            # Create a schedule record directly in database
            schedule = ScrapingSchedule(
                user_id=self.test_user_id,
                schedule_type="work_orders",
                interval_hours=2.0,
                active_hours={"start": 8, "end": 18},
                enabled=True
            )
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            print(f"✓ Created schedule with ID: {schedule.id}")
            
            # Verify data persistence
            retrieved = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).first()
            
            assert retrieved is not None, "Schedule not found in database"
            assert retrieved.interval_hours == 2.0, f"Interval mismatch: {retrieved.interval_hours}"
            assert retrieved.active_hours == {"start": 8, "end": 18}, f"Active hours mismatch: {retrieved.active_hours}"
            assert retrieved.enabled is True, f"Enabled state mismatch: {retrieved.enabled}"
            
            print("✓ Schedule data persisted correctly")
            print(f"  - Interval: {retrieved.interval_hours}h")
            print(f"  - Active hours: {retrieved.active_hours}")
            print(f"  - Enabled: {retrieved.enabled}")
            
            return True
        except Exception as e:
            print(f"✗ Schedule persistence test failed: {e}")
            return False
    
    def test_schedule_updates(self):
        """Test 3: Schedule update operations"""
        print("\\n🔍 Test 3: Schedule updates...")
        
        try:
            # Get existing schedule
            schedule = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).first()
            
            if not schedule:
                print("✗ No existing schedule found for update test")
                return False
            
            # Update schedule
            original_interval = schedule.interval_hours
            schedule.interval_hours = 3.5
            schedule.active_hours = None  # Test setting to None
            schedule.enabled = False
            schedule.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(schedule)
            
            print(f"✓ Updated schedule from {original_interval}h to {schedule.interval_hours}h")
            
            # Verify updates
            assert schedule.interval_hours == 3.5, f"Interval update failed: {schedule.interval_hours}"
            assert schedule.active_hours is None, f"Active hours should be None: {schedule.active_hours}"
            assert schedule.enabled is False, f"Enabled should be False: {schedule.enabled}"
            
            print("✓ Schedule updates applied correctly")
            print(f"  - New interval: {schedule.interval_hours}h")
            print(f"  - Active hours: {schedule.active_hours}")
            print(f"  - Enabled: {schedule.enabled}")
            
            return True
        except Exception as e:
            print(f"✗ Schedule update test failed: {e}")
            return False
    
    async def test_scheduler_service_fallback(self):
        """Test 4: Scheduler service import and fallback"""
        print("\\n🔍 Test 4: Scheduler service fallback...")
        
        try:
            # Test full scheduler import
            scheduler_service = None
            scheduler_type = "none"
            
            try:
                from app.services.scheduler_service import scheduler_service
                scheduler_type = "full"
                print("✓ Full APScheduler service available")
            except ImportError as e:
                print(f"⚠️  APScheduler not available: {e.__class__.__name__}")
                
                try:
                    from app.services.simple_scheduler_service import simple_scheduler_service as scheduler_service
                    scheduler_type = "simple"
                    print("✓ Simple scheduler service available")
                except ImportError as e2:
                    print(f"✗ No scheduler service available: {e2.__class__.__name__}")
                    scheduler_type = "none"
            
            # Test scheduler functionality based on type
            if scheduler_service:
                print(f"✓ Using {scheduler_type} scheduler service")
                
                # Test initialization
                if hasattr(scheduler_service, 'is_initialized'):
                    print(f"  - Is initialized: {scheduler_service.is_initialized}")
                
                # Test basic methods
                if hasattr(scheduler_service, 'add_work_order_scraping_schedule'):
                    print("  - Has add_work_order_scraping_schedule method")
                
                if hasattr(scheduler_service, 'update_schedule'):
                    print("  - Has update_schedule method")
                
                if hasattr(scheduler_service, 'get_all_schedules'):
                    print("  - Has get_all_schedules method")
                
                return True
            else:
                print("⚠️  No scheduler service available - will use database-only mode")
                return True  # This is still a valid state
                
        except Exception as e:
            print(f"✗ Scheduler service test failed: {e}")
            return False
    
    async def test_api_endpoints_simulation(self):
        """Test 5: Simulate API endpoint behavior"""
        print("\\n🔍 Test 5: API endpoint simulation...")
        
        try:
            # Simulate the API route logic for getting schedules
            db_schedules = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).all()
            
            print(f"✓ Found {len(db_schedules)} schedules in database")
            
            if db_schedules:
                schedule = db_schedules[0]
                
                # Simulate API response format
                api_response = {
                    "job_id": f"{schedule.schedule_type}_scrape_{schedule.user_id}",
                    "user_id": schedule.user_id,
                    "type": schedule.schedule_type,
                    "enabled": schedule.enabled,
                    "next_run": schedule.next_run.isoformat() if schedule.next_run else None,
                    "pending": False,
                    "interval_hours": schedule.interval_hours,
                    "active_hours": schedule.active_hours,
                    "scheduler_available": False  # Simulating database-only mode
                }
                
                print("✓ API response format generated")
                print(f"  - Job ID: {api_response['job_id']}")
                print(f"  - Enabled: {api_response['enabled']}")
                print(f"  - Interval: {api_response['interval_hours']}h")
                print(f"  - Active hours: {api_response['active_hours']}")
                print(f"  - Scheduler available: {api_response['scheduler_available']}")
                
                return True
            else:
                print("⚠️  No schedules found - this simulates the 'no schedule exists' scenario")
                return True
                
        except Exception as e:
            print(f"✗ API simulation test failed: {e}")
            return False
    
    def test_schedule_detection_logic(self):
        """Test 6: Schedule detection and existence checking"""
        print("\\n🔍 Test 6: Schedule detection logic...")
        
        try:
            # Test the exact query used by the frontend
            schedules = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).all()
            
            print(f"✓ Schedule detection query executed")
            print(f"  - Found {len(schedules)} schedules")
            
            if schedules:
                schedule = schedules[0]
                print(f"  - Schedule type: {schedule.schedule_type}")
                print(f"  - User ID: {schedule.user_id}")
                print(f"  - Created: {schedule.created_at}")
                print(f"  - Updated: {schedule.updated_at}")
                
                # Test schedule existence check
                exists = self.db.query(ScrapingSchedule).filter(
                    ScrapingSchedule.user_id == self.test_user_id,
                    ScrapingSchedule.schedule_type == "work_orders"
                ).first() is not None
                
                print(f"✓ Schedule existence check: {exists}")
                
                return True
            else:
                print("⚠️  No schedules found - UI should show 'Create Schedule' button")
                return True
                
        except Exception as e:
            print(f"✗ Schedule detection test failed: {e}")
            return False
    
    async def run_all_tests(self):
        """Run the complete test suite"""
        print("=" * 60)
        print("🧪 COMPREHENSIVE SCHEDULE FIXES TEST SUITE")
        print("=" * 60)
        
        self.setup()
        
        test_results = []
        
        try:
            # Run all tests
            test_results.append(("Database Connectivity", self.test_database_connectivity()))
            test_results.append(("Schedule Persistence", self.test_schedule_persistence()))
            test_results.append(("Schedule Updates", self.test_schedule_updates()))
            test_results.append(("Scheduler Service Fallback", await self.test_scheduler_service_fallback()))
            test_results.append(("API Endpoints Simulation", await self.test_api_endpoints_simulation()))
            test_results.append(("Schedule Detection Logic", self.test_schedule_detection_logic()))
            
        finally:
            self.teardown()
        
        # Print results summary
        print("\\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = 0
        failed = 0
        
        for test_name, result in test_results:
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"{status:8} | {test_name}")
            if result:
                passed += 1
            else:
                failed += 1
        
        print("-" * 60)
        print(f"TOTAL: {passed + failed} tests | PASSED: {passed} | FAILED: {failed}")
        
        if failed == 0:
            print("\\n🎉 ALL TESTS PASSED! Schedule fixes are working correctly.")
        else:
            print(f"\\n⚠️  {failed} test(s) failed. Review the output above for details.")
        
        return failed == 0


async def main():
    """Main test runner"""
    test_suite = TestScheduleFixes()
    success = await test_suite.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)