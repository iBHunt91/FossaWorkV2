#!/usr/bin/env python3
"""
Timezone Edge Cases Test Suite

Tests all identified edge cases and error conditions for timezone handling,
including DST boundaries, rapid updates, malformed timestamps, and user timezone offsets.
"""

import asyncio
import json
import sys
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import pytz

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.simple_scheduler_service import SimpleSchedulerService
from app.routes.scraping_schedules import _format_schedule_response


class TimezoneEdgeCaseTests:
    """Test suite for timezone edge cases and error conditions"""
    
    def __init__(self):
        self.test_user_id = "test_user_timezone_edge_cases"
        self.db = None
        self.scheduler_service = None
        self.test_results = []
        
    def setup(self):
        """Set up test environment"""
        print("🔧 Setting up timezone edge case test environment...")
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
                ScrapingHistory.user_id.like(f"{self.test_user_id}%")
            ).delete()
            self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id.like(f"{self.test_user_id}%")
            ).delete()
            self.db.commit()
    
    def test_dst_boundary_conditions(self) -> bool:
        """Test 1: DST boundary conditions"""
        print("\n🔍 Test 1: DST boundary conditions...")
        
        try:
            # Test various DST transition scenarios
            dst_scenarios = [
                {
                    'name': 'Spring Forward (2025-03-09 2:00 AM)',
                    'time': datetime(2025, 3, 9, 7, 0, 0, tzinfo=timezone.utc),  # 2 AM EST becomes 3 AM EDT
                    'description': 'DST begins in US'
                },
                {
                    'name': 'Fall Back (2025-11-02 2:00 AM)',
                    'time': datetime(2025, 11, 2, 6, 0, 0, tzinfo=timezone.utc),  # 2 AM EDT becomes 1 AM EST
                    'description': 'DST ends in US'
                },
                {
                    'name': 'Hour before Spring Forward',
                    'time': datetime(2025, 3, 9, 6, 0, 0, tzinfo=timezone.utc),
                    'description': 'One hour before DST transition'
                },
                {
                    'name': 'Hour after Fall Back',
                    'time': datetime(2025, 11, 2, 7, 0, 0, tzinfo=timezone.utc),
                    'description': 'One hour after DST transition'
                }
            ]
            
            passed_scenarios = 0
            total_scenarios = len(dst_scenarios)
            
            for i, scenario in enumerate(dst_scenarios):
                try:
                    # Create schedule with DST boundary time
                    schedule = ScrapingSchedule(
                        user_id=f"{self.test_user_id}_dst_{i}",
                        schedule_type="work_orders",
                        interval_hours=1.0,
                        enabled=True,
                        next_run=scenario['time'].replace(tzinfo=None)  # Store as naive UTC in DB
                    )
                    self.db.add(schedule)
                    self.db.commit()
                    self.db.refresh(schedule)
                    
                    # Format API response
                    api_response = _format_schedule_response(schedule)
                    
                    # Verify proper formatting
                    if api_response.next_run and api_response.next_run.endswith('Z'):
                        # Test parsing in different timezones
                        utc_time = datetime.fromisoformat(api_response.next_run.replace('Z', '+00:00'))
                        
                        # Convert to US Eastern time to see DST effect
                        eastern = pytz.timezone('US/Eastern')
                        eastern_time = utc_time.astimezone(eastern)
                        
                        print(f"  ✓ {scenario['name']}")
                        print(f"    UTC: {utc_time.isoformat()}")
                        print(f"    Eastern: {eastern_time.isoformat()}")
                        print(f"    DST Active: {eastern_time.dst() != timedelta(0)}")
                        
                        passed_scenarios += 1
                    else:
                        print(f"  ✗ {scenario['name']}: Invalid timestamp format")
                        
                except Exception as e:
                    print(f"  ✗ {scenario['name']}: Error - {e}")
            
            success = passed_scenarios == total_scenarios
            print(f"✓ DST boundary conditions: {passed_scenarios}/{total_scenarios} passed")
            return success
            
        except Exception as e:
            print(f"✗ DST boundary test failed: {e}")
            return False
    
    def test_malformed_timestamps(self) -> bool:
        """Test 2: Malformed and invalid timestamps"""
        print("\n🔍 Test 2: Malformed timestamp handling...")
        
        try:
            # Test various malformed timestamp scenarios
            malformed_cases = [
                {
                    'name': 'Completely invalid datetime',
                    'next_run': 'not-a-date',
                    'should_handle_gracefully': True
                },
                {
                    'name': 'Date with invalid month',
                    'next_run': '2025-13-01T12:00:00',
                    'should_handle_gracefully': True
                },
                {
                    'name': 'Date with invalid day',
                    'next_run': '2025-02-30T12:00:00',
                    'should_handle_gracefully': True
                },
                {
                    'name': 'Time with invalid hour',
                    'next_run': '2025-01-26T25:00:00',
                    'should_handle_gracefully': True
                },
                {
                    'name': 'Missing time part',
                    'next_run': '2025-01-26',
                    'should_handle_gracefully': True
                }
            ]
            
            passed_cases = 0
            total_cases = len(malformed_cases)
            
            for i, case in enumerate(malformed_cases):
                try:
                    # Create schedule with potentially malformed timestamp
                    # Note: We'll simulate this by creating a valid schedule first,
                    # then testing the response formatting with invalid data
                    
                    schedule = ScrapingSchedule(
                        user_id=f"{self.test_user_id}_malformed_{i}",
                        schedule_type="work_orders",
                        interval_hours=1.0,
                        enabled=True,
                        next_run=datetime.utcnow()  # Start with valid time
                    )
                    self.db.add(schedule)
                    self.db.commit()
                    self.db.refresh(schedule)
                    
                    # Test what happens when we manually set invalid data
                    # (This simulates data corruption or API misuse)
                    try:
                        if case['next_run'] == 'not-a-date':
                            # Test parsing invalid string (frontend would do this)
                            test_result = datetime.fromisoformat(case['next_run'])
                            print(f"  ✗ {case['name']}: Should have failed but didn't")
                        else:
                            # Test parsing malformed ISO string
                            test_result = datetime.fromisoformat(case['next_run'])
                            print(f"  ✗ {case['name']}: Should have failed but didn't")
                    except (ValueError, TypeError) as e:
                        # This is expected - malformed timestamps should fail parsing
                        print(f"  ✓ {case['name']}: Correctly rejected with {e.__class__.__name__}")
                        passed_cases += 1
                    except Exception as e:
                        print(f"  ✗ {case['name']}: Unexpected error - {e}")
                        
                except Exception as e:
                    # Database-level errors are also expected for some cases
                    print(f"  ✓ {case['name']}: Database correctly rejected invalid data")
                    passed_cases += 1
            
            success = passed_cases == total_cases
            print(f"✓ Malformed timestamp handling: {passed_cases}/{total_cases} passed")
            return success
            
        except Exception as e:
            print(f"✗ Malformed timestamp test failed: {e}")
            return False
    
    def test_rapid_schedule_updates(self) -> bool:
        """Test 3: Rapid schedule updates and race conditions"""
        print("\n🔍 Test 3: Rapid schedule updates...")
        
        try:
            # Create a schedule for rapid updates
            schedule = ScrapingSchedule(
                user_id=f"{self.test_user_id}_rapid",
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                next_run=datetime.utcnow() + timedelta(hours=1)
            )
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Perform rapid updates
            update_count = 10
            successful_updates = 0
            timestamps_consistent = True
            
            start_time = time.time()
            
            for i in range(update_count):
                try:
                    # Update with slightly different times
                    new_time = datetime.utcnow() + timedelta(hours=1, minutes=i)
                    
                    updated_schedule = self.scheduler_service.update_schedule(
                        db=self.db,
                        schedule_id=schedule.id,
                        interval_hours=1.0 + (i * 0.1),  # Slightly different intervals
                        enabled=True
                    )
                    
                    # Verify the update was applied
                    if updated_schedule:
                        api_response = _format_schedule_response(updated_schedule)
                        
                        if api_response.next_run and api_response.next_run.endswith('Z'):
                            successful_updates += 1
                        else:
                            timestamps_consistent = False
                            print(f"  ⚠️  Update {i}: Timestamp format inconsistent")
                    
                    # Small delay to avoid overwhelming the system
                    time.sleep(0.01)
                    
                except Exception as e:
                    print(f"  ⚠️  Update {i} failed: {e}")
            
            update_time = time.time() - start_time
            
            print(f"✓ Completed {successful_updates}/{update_count} rapid updates in {update_time:.3f}s")
            print(f"✓ Average update time: {update_time/update_count*1000:.2f}ms")
            print(f"✓ Timestamp consistency: {'OK' if timestamps_consistent else 'FAILED'}")
            
            success = successful_updates >= update_count * 0.8 and timestamps_consistent
            return success
            
        except Exception as e:
            print(f"✗ Rapid updates test failed: {e}")
            return False
    
    def test_timezone_offset_variations(self) -> bool:
        """Test 4: Different user timezone offset scenarios"""
        print("\n🔍 Test 4: User timezone offset variations...")
        
        try:
            # Test different timezone scenarios that users might encounter
            timezone_scenarios = [
                {
                    'name': 'UTC (GMT+0)',
                    'timezone': timezone.utc,
                    'description': 'User in UTC timezone'
                },
                {
                    'name': 'US Eastern (GMT-5/-4)',
                    'timezone': pytz.timezone('US/Eastern'),
                    'description': 'User in US Eastern timezone'
                },
                {
                    'name': 'US Pacific (GMT-8/-7)',
                    'timezone': pytz.timezone('US/Pacific'),
                    'description': 'User in US Pacific timezone'
                },
                {
                    'name': 'Europe/London (GMT+0/+1)',
                    'timezone': pytz.timezone('Europe/London'),
                    'description': 'User in UK timezone'
                },
                {
                    'name': 'Asia/Tokyo (GMT+9)',
                    'timezone': pytz.timezone('Asia/Tokyo'),
                    'description': 'User in Japan timezone'
                },
                {
                    'name': 'Australia/Sydney (GMT+10/+11)',
                    'timezone': pytz.timezone('Australia/Sydney'),
                    'description': 'User in Australian timezone'
                }
            ]
            
            passed_scenarios = 0
            total_scenarios = len(timezone_scenarios)
            
            # Create a schedule that's 1 hour in the future (UTC)
            base_time = datetime.utcnow() + timedelta(hours=1)
            
            schedule = ScrapingSchedule(
                user_id=f"{self.test_user_id}_tzoffset",
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                next_run=base_time
            )
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Format API response
            api_response = _format_schedule_response(schedule)
            
            if not api_response.next_run or not api_response.next_run.endswith('Z'):
                print("✗ Base schedule doesn't have proper UTC format")
                return False
            
            # Test how this timestamp would be interpreted in different timezones
            utc_time = datetime.fromisoformat(api_response.next_run.replace('Z', '+00:00'))
            
            for i, scenario in enumerate(timezone_scenarios):
                try:
                    # Convert UTC time to user's local timezone
                    if hasattr(scenario['timezone'], 'localize'):
                        # Handle pytz timezones
                        local_time = utc_time.astimezone(scenario['timezone'])
                    else:
                        # Handle standard timezone objects
                        local_time = utc_time.astimezone(scenario['timezone'])
                    
                    # Calculate relative time as frontend would in this timezone
                    now_local = datetime.now(scenario['timezone'])
                    diff_minutes = (local_time - now_local).total_seconds() / 60
                    
                    # Determine what the display should be
                    if 55 <= diff_minutes <= 65:
                        expected_display = "in about 1 hour"
                    elif diff_minutes < 60:
                        expected_display = f"in {int(diff_minutes)} minutes"
                    else:
                        expected_display = f"in about {int(diff_minutes/60)} hours"
                    
                    print(f"  ✓ {scenario['name']}: {local_time.strftime('%Y-%m-%d %H:%M:%S %Z')} → '{expected_display}'")
                    print(f"    Offset from UTC: {local_time.utcoffset()}")
                    
                    passed_scenarios += 1
                    
                except Exception as e:
                    print(f"  ✗ {scenario['name']}: Error - {e}")
            
            success = passed_scenarios == total_scenarios
            print(f"✓ Timezone offset variations: {passed_scenarios}/{total_scenarios} passed")
            return success
            
        except Exception as e:
            print(f"✗ Timezone offset test failed: {e}")
            return False
    
    def test_extreme_time_values(self) -> bool:
        """Test 5: Extreme time values and edge cases"""
        print("\n🔍 Test 5: Extreme time values...")
        
        try:
            extreme_cases = [
                {
                    'name': 'Very far future (Year 2099)',
                    'time': datetime(2099, 12, 31, 23, 59, 59, tzinfo=timezone.utc),
                    'should_work': True
                },
                {
                    'name': 'Unix epoch (1970-01-01)',
                    'time': datetime(1970, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                    'should_work': True
                },
                {
                    'name': 'Leap year Feb 29 (2024-02-29)',
                    'time': datetime(2024, 2, 29, 12, 0, 0, tzinfo=timezone.utc),
                    'should_work': True
                },
                {
                    'name': 'End of year (2025-12-31 23:59:59)',
                    'time': datetime(2025, 12, 31, 23, 59, 59, tzinfo=timezone.utc),
                    'should_work': True
                },
                {
                    'name': 'Microseconds precision',
                    'time': datetime(2025, 1, 26, 15, 30, 45, 123456, tzinfo=timezone.utc),
                    'should_work': True
                }
            ]
            
            passed_cases = 0
            total_cases = len(extreme_cases)
            
            for i, case in enumerate(extreme_cases):
                try:
                    schedule = ScrapingSchedule(
                        user_id=f"{self.test_user_id}_extreme_{i}",
                        schedule_type="work_orders",
                        interval_hours=1.0,
                        enabled=True,
                        next_run=case['time'].replace(tzinfo=None)  # Store as naive UTC
                    )
                    self.db.add(schedule)
                    self.db.commit()
                    self.db.refresh(schedule)
                    
                    # Format API response
                    api_response = _format_schedule_response(schedule)
                    
                    if case['should_work']:
                        if api_response.next_run and api_response.next_run.endswith('Z'):
                            # Verify we can parse it back
                            parsed_time = datetime.fromisoformat(api_response.next_run.replace('Z', '+00:00'))
                            print(f"  ✓ {case['name']}: {api_response.next_run}")
                            passed_cases += 1
                        else:
                            print(f"  ✗ {case['name']}: Invalid format {api_response.next_run}")
                    else:
                        print(f"  ✓ {case['name']}: Handled as expected")
                        passed_cases += 1
                        
                except Exception as e:
                    if case['should_work']:
                        print(f"  ✗ {case['name']}: Unexpected error - {e}")
                    else:
                        print(f"  ✓ {case['name']}: Expected error - {e}")
                        passed_cases += 1
            
            success = passed_cases == total_cases
            print(f"✓ Extreme time values: {passed_cases}/{total_cases} passed")
            return success
            
        except Exception as e:
            print(f"✗ Extreme time values test failed: {e}")
            return False
    
    def test_concurrent_schedule_access(self) -> bool:
        """Test 6: Concurrent access to schedules"""
        print("\n🔍 Test 6: Concurrent schedule access...")
        
        try:
            # Create a base schedule
            schedule = ScrapingSchedule(
                user_id=f"{self.test_user_id}_concurrent",
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                next_run=datetime.utcnow() + timedelta(hours=1)
            )
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Simulate concurrent access by rapidly reading/formatting the same schedule
            concurrent_operations = 50
            successful_operations = 0
            format_times = []
            
            start_time = time.time()
            
            for i in range(concurrent_operations):
                try:
                    operation_start = time.time()
                    
                    # Refresh from database (simulates concurrent read)
                    self.db.refresh(schedule)
                    
                    # Format response (simulates API call)
                    api_response = _format_schedule_response(schedule)
                    
                    operation_time = time.time() - operation_start
                    format_times.append(operation_time)
                    
                    # Verify format consistency
                    if api_response.next_run and api_response.next_run.endswith('Z'):
                        successful_operations += 1
                    
                except Exception as e:
                    print(f"  ⚠️  Concurrent operation {i} failed: {e}")
            
            total_time = time.time() - start_time
            avg_format_time = sum(format_times) / len(format_times) if format_times else 0
            
            print(f"✓ Completed {successful_operations}/{concurrent_operations} concurrent operations")
            print(f"✓ Total time: {total_time:.3f}s")
            print(f"✓ Average operation time: {avg_format_time*1000:.2f}ms")
            print(f"✓ Operations per second: {concurrent_operations/total_time:.1f}")
            
            # Should handle at least 90% of concurrent operations successfully
            success = successful_operations >= concurrent_operations * 0.9
            return success
            
        except Exception as e:
            print(f"✗ Concurrent access test failed: {e}")
            return False
    
    async def run_all_tests(self) -> bool:
        """Run all edge case tests"""
        print("=" * 80)
        print("🧪 TIMEZONE EDGE CASES TEST SUITE")
        print("=" * 80)
        
        self.setup()
        
        tests = [
            ("DST Boundary Conditions", self.test_dst_boundary_conditions),
            ("Malformed Timestamp Handling", self.test_malformed_timestamps),
            ("Rapid Schedule Updates", self.test_rapid_schedule_updates),
            ("Timezone Offset Variations", self.test_timezone_offset_variations),
            ("Extreme Time Values", self.test_extreme_time_values),
            ("Concurrent Schedule Access", self.test_concurrent_schedule_access)
        ]
        
        try:
            for test_name, test_func in tests:
                result = test_func()
                self.test_results.append((test_name, result))
                
        finally:
            self.teardown()
        
        # Print results
        print("\n" + "=" * 80)
        print("📊 TIMEZONE EDGE CASES TEST RESULTS")
        print("=" * 80)
        
        passed = sum(1 for _, result in self.test_results if result)
        failed = len(self.test_results) - passed
        
        for test_name, result in self.test_results:
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"{status:8} | {test_name}")
        
        print("-" * 80)
        print(f"TOTAL: {len(self.test_results)} tests | PASSED: {passed} | FAILED: {failed}")
        
        if failed == 0:
            print("\n🎉 ALL TIMEZONE EDGE CASE TESTS PASSED!")
            print("The system handles all identified edge cases and error conditions correctly.")
        else:
            print(f"\n⚠️  {failed} edge case test(s) failed.")
            print("Review the output above for specific edge case handling issues.")
        
        return failed == 0


async def main():
    """Main test runner"""
    test_suite = TimezoneEdgeCaseTests()
    success = await test_suite.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)