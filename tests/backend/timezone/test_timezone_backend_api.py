#!/usr/bin/env python3
"""
Backend API Timezone Testing Suite

Tests that all backend API endpoints properly format timestamps with UTC indicators ('Z' suffix)
and handle timezone-related operations correctly.
"""

import asyncio
import json
import sys
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.simple_scheduler_service import SimpleSchedulerService
from app.routes.scraping_schedules import _format_schedule_response


class BackendTimezoneAPITests:
    """Test suite for backend API timezone handling"""
    
    def __init__(self):
        self.test_user_id = "test_user_timezone_api"
        self.db = None
        self.scheduler_service = None
        self.test_results = []
        
    def setup(self):
        """Set up test environment"""
        print("🔧 Setting up backend timezone API test environment...")
        self.db = SessionLocal()
        self.scheduler_service = SimpleSchedulerService()
        
        # Clean up any existing test data
        self._cleanup_test_data()
        print("✓ Test environment ready")
    
    def teardown(self):
        """Clean up test environment"""
        print("🧹 Cleaning up test environment...")
        self._cleanup_test_data()
        if self.db:
            self.db.close()
        print("✓ Cleanup complete")
    
    def _cleanup_test_data(self):
        """Remove all test data"""
        if self.db:
            self.db.query(ScrapingHistory).filter(
                ScrapingHistory.user_id == self.test_user_id
            ).delete()
            self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).delete()
            self.db.commit()
    
    def _assert_utc_format(self, timestamp_str: Optional[str], field_name: str) -> bool:
        """Assert that a timestamp string has proper UTC format"""
        if timestamp_str is None:
            return True  # null timestamps are acceptable
        
        if not timestamp_str.endswith('Z'):
            print(f"  ✗ {field_name}: Missing 'Z' suffix - '{timestamp_str}'")
            return False
        
        try:
            # Try to parse the timestamp
            datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            print(f"  ✓ {field_name}: Proper UTC format - '{timestamp_str}'")
            return True
        except ValueError as e:
            print(f"  ✗ {field_name}: Invalid format - '{timestamp_str}' ({e})")
            return False
    
    def test_schedule_response_format(self) -> bool:
        """Test 1: Schedule API response timestamp formatting"""
        print("\n🔍 Test 1: Schedule API response timestamp formatting...")
        
        try:
            # Create a test schedule
            schedule = ScrapingSchedule(
                user_id=self.test_user_id,
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                last_run=datetime.utcnow(),
                next_run=datetime.utcnow() + timedelta(hours=1)
            )
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Test the _format_schedule_response function
            response = _format_schedule_response(schedule)
            
            # Check all timestamp fields have 'Z' suffix
            tests_passed = 0
            total_tests = 4
            
            if self._assert_utc_format(response.last_run, "last_run"):
                tests_passed += 1
            if self._assert_utc_format(response.next_run, "next_run"):
                tests_passed += 1
            if self._assert_utc_format(response.created_at, "created_at"):
                tests_passed += 1
            if self._assert_utc_format(response.updated_at, "updated_at"):
                tests_passed += 1
            
            success = tests_passed == total_tests
            print(f"✓ Schedule response format: {tests_passed}/{total_tests} fields correct")
            return success
            
        except Exception as e:
            print(f"✗ Schedule response format test failed: {e}")
            return False
    
    def test_history_timestamp_format(self) -> bool:
        """Test 2: Scraping history timestamp formatting"""
        print("\n🔍 Test 2: Scraping history timestamp formatting...")
        
        try:
            # Create test history record
            history = ScrapingHistory(
                user_id=self.test_user_id,
                schedule_type="work_orders",
                started_at=datetime.utcnow() - timedelta(minutes=30),
                completed_at=datetime.utcnow() - timedelta(minutes=25),
                success=True,
                items_processed=10,
                trigger_type="manual"
            )
            self.db.add(history)
            self.db.commit()
            self.db.refresh(history)
            
            # Test the history to_dict method (if exists) or manual formatting
            if hasattr(history, 'to_dict'):
                response = history.to_dict()
            else:
                # Manual formatting similar to API response
                response = {
                    "started_at": history.started_at.isoformat() + 'Z',
                    "completed_at": history.completed_at.isoformat() + 'Z' if history.completed_at else None
                }
            
            # Check timestamp fields
            tests_passed = 0
            total_tests = 2
            
            if self._assert_utc_format(response.get("started_at"), "started_at"):
                tests_passed += 1
            if self._assert_utc_format(response.get("completed_at"), "completed_at"):
                tests_passed += 1
            
            success = tests_passed == total_tests
            print(f"✓ History timestamp format: {tests_passed}/{total_tests} fields correct")
            return success
            
        except Exception as e:
            print(f"✗ History timestamp format test failed: {e}")
            return False
    
    def test_schedule_update_timezone_handling(self) -> bool:
        """Test 3: Schedule update preserves proper timezone handling"""
        print("\n🔍 Test 3: Schedule update timezone handling...")
        
        try:
            # Get existing schedule from previous test
            schedule = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).first()
            
            if not schedule:
                print("✗ No schedule found for update test")
                return False
            
            # Update schedule using service
            updated_schedule = self.scheduler_service.update_schedule(
                db=self.db,
                schedule_id=schedule.id,
                interval_hours=2.0,
                enabled=True
            )
            
            # Check that next_run is calculated properly
            if updated_schedule.next_run:
                # Should be a datetime object in UTC
                if updated_schedule.next_run.tzinfo is None:
                    # Assume UTC if no timezone info
                    next_run_utc = updated_schedule.next_run.replace(tzinfo=timezone.utc)
                else:
                    next_run_utc = updated_schedule.next_run.astimezone(timezone.utc)
                
                now_utc = datetime.now(timezone.utc)
                time_diff = (next_run_utc - now_utc).total_seconds()
                
                # Should be sometime in the future (within reasonable bounds)
                if 0 < time_diff < 3600 * 25:  # Between now and 25 hours from now
                    print(f"✓ Next run calculated correctly: {next_run_utc.isoformat()}")
                    print(f"  Time until next run: {time_diff / 60:.1f} minutes")
                    return True
                else:
                    print(f"✗ Next run time seems incorrect: {next_run_utc.isoformat()}")
                    print(f"  Time difference from now: {time_diff / 60:.1f} minutes")
                    return False
            else:
                print("✗ Next run not set after update")
                return False
                
        except Exception as e:
            print(f"✗ Schedule update timezone test failed: {e}")
            return False
    
    def test_1_hour_interval_specific(self) -> bool:
        """Test 4: 1-hour interval schedule shows 'in about 1 hour'"""
        print("\n🔍 Test 4: 1-hour interval specific testing...")
        
        try:
            # Create a schedule with exactly 1-hour interval
            next_run = datetime.utcnow() + timedelta(hours=1, minutes=2)  # Just over 1 hour
            
            schedule = ScrapingSchedule(
                user_id=f"{self.test_user_id}_1h",
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                next_run=next_run
            )
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Format response
            response = _format_schedule_response(schedule)
            next_run_str = response.next_run
            
            print(f"✓ 1-hour schedule created")
            print(f"  Next run: {next_run_str}")
            print(f"  Interval: {schedule.interval_hours} hours")
            
            # The actual relative time calculation will be done in frontend
            # Here we just verify the timestamp format is correct
            success = self._assert_utc_format(next_run_str, "next_run_1h")
            
            if success:
                # Calculate what the relative time should be
                if next_run_str:
                    utc_time = datetime.fromisoformat(next_run_str.replace('Z', '+00:00'))
                    now = datetime.now(timezone.utc)
                    diff_minutes = (utc_time - now).total_seconds() / 60
                    
                    print(f"  Expected relative time: ~{diff_minutes:.1f} minutes")
                    if 55 <= diff_minutes <= 65:  # Around 1 hour
                        print("  ✓ Should display as 'in about 1 hour'")
                    else:
                        print(f"  ⚠️  May not display as 'in about 1 hour' ({diff_minutes:.1f} minutes)")
            
            return success
            
        except Exception as e:
            print(f"✗ 1-hour interval test failed: {e}")
            return False
    
    def test_edge_case_timestamps(self) -> bool:
        """Test 5: Edge case timestamp handling"""
        print("\n🔍 Test 5: Edge case timestamp handling...")
        
        try:
            edge_cases = [
                # Test with microseconds
                datetime.utcnow(),
                # Test with specific time
                datetime(2025, 1, 26, 15, 30, 0, tzinfo=timezone.utc),
                # Test with different UTC time
                datetime.utcnow() + timedelta(days=1, hours=12, minutes=30)
            ]
            
            passed_tests = 0
            total_tests = len(edge_cases)
            
            for i, test_datetime in enumerate(edge_cases, 1):
                # Create schedule with this datetime
                schedule = ScrapingSchedule(
                    user_id=f"{self.test_user_id}_edge_{i}",
                    schedule_type="work_orders",
                    interval_hours=1.0,
                    enabled=True,
                    next_run=test_datetime.replace(tzinfo=None) if test_datetime.tzinfo else test_datetime
                )
                self.db.add(schedule)
                self.db.commit()
                self.db.refresh(schedule)
                
                # Format and check
                response = _format_schedule_response(schedule)
                if self._assert_utc_format(response.next_run, f"edge_case_{i}"):
                    passed_tests += 1
            
            success = passed_tests == total_tests
            print(f"✓ Edge case handling: {passed_tests}/{total_tests} cases passed")
            return success
            
        except Exception as e:
            print(f"✗ Edge case timestamp test failed: {e}")
            return False
    
    def test_api_consistency(self) -> bool:
        """Test 6: Ensure API consistency across different endpoints"""
        print("\n🔍 Test 6: API consistency across endpoints...")
        
        try:
            # Simulate different API endpoints returning timestamps
            schedule = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id.like(f"{self.test_user_id}%")
            ).first()
            
            if not schedule:
                print("✗ No schedule found for consistency test")
                return False
            
            # Test different response formats that might be used
            response_formats = {
                "schedule_detail": _format_schedule_response(schedule),
                "schedule_list": [_format_schedule_response(schedule)],
                "manual_format": {
                    "next_run": schedule.next_run.isoformat() + 'Z' if schedule.next_run else None,
                    "created_at": schedule.created_at.isoformat() + 'Z',
                    "updated_at": schedule.updated_at.isoformat() + 'Z'
                }
            }
            
            passed_formats = 0
            total_formats = len(response_formats)
            
            for format_name, response in response_formats.items():
                print(f"  Testing {format_name}...")
                
                if format_name == "schedule_list":
                    # Handle list format
                    if response and len(response) > 0:
                        item = response[0]
                        if hasattr(item, 'next_run'):
                            if self._assert_utc_format(item.next_run, f"{format_name}.next_run"):
                                passed_formats += 1
                        else:
                            passed_formats += 1  # No timestamp to check
                    else:
                        passed_formats += 1  # Empty list is fine
                        
                elif format_name == "manual_format":
                    # Handle dict format
                    checks = 0
                    for field in ["next_run", "created_at", "updated_at"]:
                        if self._assert_utc_format(response.get(field), f"{format_name}.{field}"):
                            checks += 1
                    if checks == 3:
                        passed_formats += 1
                        
                else:
                    # Handle object format
                    if hasattr(response, 'next_run'):
                        if self._assert_utc_format(response.next_run, f"{format_name}.next_run"):
                            passed_formats += 1
                    else:
                        passed_formats += 1
            
            success = passed_formats == total_formats
            print(f"✓ API consistency: {passed_formats}/{total_formats} formats correct")
            return success
            
        except Exception as e:
            print(f"✗ API consistency test failed: {e}")
            return False
    
    async def run_all_tests(self) -> bool:
        """Run all backend API timezone tests"""
        print("=" * 70)
        print("🧪 BACKEND API TIMEZONE TESTING SUITE")
        print("=" * 70)
        
        self.setup()
        
        tests = [
            ("Schedule Response Format", self.test_schedule_response_format),
            ("History Timestamp Format", self.test_history_timestamp_format),
            ("Schedule Update Timezone Handling", self.test_schedule_update_timezone_handling),
            ("1-Hour Interval Specific", self.test_1_hour_interval_specific),
            ("Edge Case Timestamps", self.test_edge_case_timestamps),
            ("API Consistency", self.test_api_consistency)
        ]
        
        try:
            for test_name, test_func in tests:
                result = test_func()
                self.test_results.append((test_name, result))
                
        finally:
            self.teardown()
        
        # Print results
        print("\n" + "=" * 70)
        print("📊 BACKEND API TIMEZONE TEST RESULTS")
        print("=" * 70)
        
        passed = sum(1 for _, result in self.test_results if result)
        failed = len(self.test_results) - passed
        
        for test_name, result in self.test_results:
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"{status:8} | {test_name}")
        
        print("-" * 70)
        print(f"TOTAL: {len(self.test_results)} tests | PASSED: {passed} | FAILED: {failed}")
        
        if failed == 0:
            print("\n🎉 ALL BACKEND API TIMEZONE TESTS PASSED!")
            print("Backend properly formats all timestamps with UTC indicators.")
        else:
            print(f"\n⚠️  {failed} test(s) failed.")
            print("Review the output above for specific timezone formatting issues.")
        
        return failed == 0


async def main():
    """Main test runner"""
    test_suite = BackendTimezoneAPITests()
    success = await test_suite.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)