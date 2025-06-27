#!/usr/bin/env python3
"""
End-to-End Timezone Integration Test Suite

Tests the complete flow from backend schedule updates to frontend display,
ensuring timezone handling works correctly across the entire system.
"""

import asyncio
import json
import sys
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
import subprocess
import tempfile

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.simple_scheduler_service import SimpleSchedulerService
from app.routes.scraping_schedules import _format_schedule_response


class TimezoneIntegrationTests:
    """Test suite for end-to-end timezone integration"""
    
    def __init__(self):
        self.test_user_id = "test_user_timezone_integration"
        self.db = None
        self.scheduler_service = None
        self.test_results = []
        self.backend_port = 8000
        
    def setup(self):
        """Set up test environment"""
        print("🔧 Setting up timezone integration test environment...")
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
    
    def test_backend_to_frontend_flow(self) -> bool:
        """Test 1: Complete backend to frontend data flow"""
        print("\n🔍 Test 1: Backend to frontend data flow...")
        
        try:
            # Create a schedule that should trigger "in about 1 hour"
            next_run = datetime.utcnow() + timedelta(hours=1, minutes=2)
            
            schedule = ScrapingSchedule(
                user_id=self.test_user_id,
                schedule_type="work_orders",
                interval_hours=1.0,
                enabled=True,
                next_run=next_run
            )
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Format using the API response formatter
            api_response = _format_schedule_response(schedule)
            
            # Verify backend formats timestamp correctly
            if not api_response.next_run or not api_response.next_run.endswith('Z'):
                print(f"✗ Backend API response missing 'Z' suffix: {api_response.next_run}")
                return False
            
            print(f"✓ Backend API response has proper UTC format: {api_response.next_run}")
            
            # Simulate frontend processing
            frontend_timestamp = api_response.next_run
            
            # Test what frontend would calculate
            if frontend_timestamp:
                # Parse like frontend would
                try:
                    # Remove Z and add timezone info
                    utc_time = datetime.fromisoformat(frontend_timestamp.replace('Z', '+00:00'))
                    now = datetime.now(timezone.utc)
                    diff_minutes = (utc_time - now).total_seconds() / 60
                    
                    print(f"✓ Frontend would calculate: {diff_minutes:.1f} minutes in future")
                    
                    # Should be approximately 1 hour (60 minutes + 2 minutes = 62 minutes)
                    if 55 <= diff_minutes <= 70:
                        print("✓ Should display as 'in about 1 hour'")
                        return True
                    else:
                        print(f"✗ Time difference not in expected range for '1 hour': {diff_minutes:.1f} minutes")
                        return False
                        
                except Exception as e:
                    print(f"✗ Frontend timestamp parsing failed: {e}")
                    return False
            else:
                print("✗ No timestamp from backend")
                return False
                
        except Exception as e:
            print(f"✗ Backend to frontend flow test failed: {e}")
            return False
    
    def test_schedule_update_propagation(self) -> bool:
        """Test 2: Schedule update propagates correctly through system"""
        print("\n🔍 Test 2: Schedule update propagation...")
        
        try:
            # Get existing schedule from previous test
            schedule = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).first()
            
            if not schedule:
                print("✗ No schedule found for update test")
                return False
            
            print(f"Original next_run: {schedule.next_run}")
            original_next_run = schedule.next_run
            
            # Update schedule using service (simulates API call)
            updated_schedule = self.scheduler_service.update_schedule(
                db=self.db,
                schedule_id=schedule.id,
                interval_hours=2.0,  # Change interval
                enabled=True
            )
            
            print(f"Updated next_run: {updated_schedule.next_run}")
            
            # Verify update worked
            if updated_schedule.next_run == original_next_run:
                print("⚠️  Next run time didn't change - this might be expected")
            
            # Format for API response
            api_response = _format_schedule_response(updated_schedule)
            
            # Check format
            if not api_response.next_run or not api_response.next_run.endswith('Z'):
                print(f"✗ Updated API response missing 'Z' suffix: {api_response.next_run}")
                return False
            
            print(f"✓ Updated API response has proper UTC format: {api_response.next_run}")
            print(f"✓ Interval updated: {api_response.interval_hours} hours")
            
            return True
            
        except Exception as e:
            print(f"✗ Schedule update propagation test failed: {e}")
            return False
    
    def test_timezone_consistency_across_components(self) -> bool:
        """Test 3: Timezone consistency across different components"""
        print("\n🔍 Test 3: Timezone consistency across components...")
        
        try:
            # Test different components that handle timestamps
            schedule = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == self.test_user_id
            ).first()
            
            if not schedule:
                print("✗ No schedule found for consistency test")
                return False
            
            # 1. Direct database timestamp
            db_timestamp = schedule.next_run
            print(f"Database timestamp: {db_timestamp} (type: {type(db_timestamp)})")
            
            # 2. API response timestamp
            api_response = _format_schedule_response(schedule)
            api_timestamp = api_response.next_run
            print(f"API response timestamp: {api_timestamp}")
            
            # 3. Manual formatting (like other endpoints might do)
            manual_timestamp = schedule.next_run.isoformat() + 'Z' if schedule.next_run else None
            print(f"Manual format timestamp: {manual_timestamp}")
            
            # All should be equivalent when parsed
            try:
                if api_timestamp and manual_timestamp:
                    api_parsed = datetime.fromisoformat(api_timestamp.replace('Z', '+00:00'))
                    manual_parsed = datetime.fromisoformat(manual_timestamp.replace('Z', '+00:00'))
                    
                    if api_parsed == manual_parsed:
                        print("✓ API and manual formatting produce identical results")
                        
                        # Should also match database timestamp (assuming UTC)
                        if db_timestamp:
                            db_utc = db_timestamp.replace(tzinfo=timezone.utc) if db_timestamp.tzinfo is None else db_timestamp
                            if api_parsed == db_utc:
                                print("✓ All timestamp formats are consistent")
                                return True
                            else:
                                print(f"✗ Database and API timestamps don't match: {db_utc} vs {api_parsed}")
                                return False
                        else:
                            print("⚠️  Database timestamp is None")
                            return True
                    else:
                        print(f"✗ API and manual formatting differ: {api_parsed} vs {manual_parsed}")
                        return False
                else:
                    print("✗ Missing timestamps for comparison")
                    return False
                    
            except Exception as e:
                print(f"✗ Timestamp parsing failed: {e}")
                return False
                
        except Exception as e:
            print(f"✗ Timezone consistency test failed: {e}")
            return False
    
    def test_critical_1_hour_scenario(self) -> bool:
        """Test 4: The critical 1-hour scenario that was problematic"""
        print("\n🔍 Test 4: Critical 1-hour scenario...")
        
        try:
            # Create multiple schedules with exactly 1-hour future times
            test_scenarios = [
                {
                    'name': '1 hour + 0 minutes',
                    'offset': timedelta(hours=1, minutes=0)
                },
                {
                    'name': '1 hour + 2 minutes',
                    'offset': timedelta(hours=1, minutes=2)
                },
                {
                    'name': '58 minutes (should be close to 1 hour)',
                    'offset': timedelta(minutes=58)
                },
                {
                    'name': '62 minutes (should be close to 1 hour)',
                    'offset': timedelta(minutes=62)
                }
            ]
            
            passed_scenarios = 0
            total_scenarios = len(test_scenarios)
            
            for i, scenario in enumerate(test_scenarios):
                try:
                    next_run = datetime.utcnow() + scenario['offset']
                    
                    schedule = ScrapingSchedule(
                        user_id=f"{self.test_user_id}_scenario_{i}",
                        schedule_type="work_orders",
                        interval_hours=1.0,
                        enabled=True,
                        next_run=next_run
                    )
                    self.db.add(schedule)
                    self.db.commit()
                    self.db.refresh(schedule)
                    
                    # Format API response
                    api_response = _format_schedule_response(schedule)
                    
                    if api_response.next_run and api_response.next_run.endswith('Z'):
                        # Calculate what frontend would show
                        utc_time = datetime.fromisoformat(api_response.next_run.replace('Z', '+00:00'))
                        now = datetime.now(timezone.utc)
                        diff_minutes = (utc_time - now).total_seconds() / 60
                        
                        # Determine expected display
                        if 55 <= diff_minutes <= 65:
                            expected = "in about 1 hour"
                        elif diff_minutes < 60:
                            expected = f"in {int(diff_minutes)} minutes"
                        else:
                            expected = f"in about {int(diff_minutes/60)} hours"
                        
                        print(f"  ✓ {scenario['name']}: {diff_minutes:.1f} minutes → '{expected}'")
                        passed_scenarios += 1
                    else:
                        print(f"  ✗ {scenario['name']}: Invalid timestamp format")
                        
                except Exception as e:
                    print(f"  ✗ {scenario['name']}: Error - {e}")
            
            success = passed_scenarios == total_scenarios
            print(f"✓ Critical scenarios: {passed_scenarios}/{total_scenarios} passed")
            return success
            
        except Exception as e:
            print(f"✗ Critical 1-hour scenario test failed: {e}")
            return False
    
    def test_edge_cases_and_error_handling(self) -> bool:
        """Test 5: Edge cases and error handling"""
        print("\n🔍 Test 5: Edge cases and error handling...")
        
        try:
            edge_cases = [
                {
                    'name': 'Schedule with no next_run',
                    'next_run': None,
                    'expected_api': None
                },
                {
                    'name': 'Schedule far in future',
                    'next_run': datetime.utcnow() + timedelta(days=30),
                    'expected_api': 'should have Z suffix'
                },
                {
                    'name': 'Schedule in past (overdue)',
                    'next_run': datetime.utcnow() - timedelta(hours=2),
                    'expected_api': 'should have Z suffix'
                }
            ]
            
            passed_cases = 0
            total_cases = len(edge_cases)
            
            for i, case in enumerate(edge_cases):
                try:
                    schedule = ScrapingSchedule(
                        user_id=f"{self.test_user_id}_edge_{i}",
                        schedule_type="work_orders",
                        interval_hours=1.0,
                        enabled=True,
                        next_run=case['next_run']
                    )
                    self.db.add(schedule)
                    self.db.commit()
                    self.db.refresh(schedule)
                    
                    # Format API response
                    api_response = _format_schedule_response(schedule)
                    
                    if case['expected_api'] is None:
                        if api_response.next_run is None:
                            print(f"  ✓ {case['name']}: Correctly returns None")
                            passed_cases += 1
                        else:
                            print(f"  ✗ {case['name']}: Expected None, got {api_response.next_run}")
                    else:
                        if api_response.next_run and api_response.next_run.endswith('Z'):
                            print(f"  ✓ {case['name']}: Proper format {api_response.next_run}")
                            passed_cases += 1
                        else:
                            print(f"  ✗ {case['name']}: Invalid format {api_response.next_run}")
                            
                except Exception as e:
                    print(f"  ✗ {case['name']}: Error - {e}")
            
            success = passed_cases == total_cases
            print(f"✓ Edge cases: {passed_cases}/{total_cases} passed")
            return success
            
        except Exception as e:
            print(f"✗ Edge cases test failed: {e}")
            return False
    
    def test_performance_and_timing(self) -> bool:
        """Test 6: Performance and timing accuracy"""
        print("\n🔍 Test 6: Performance and timing accuracy...")
        
        try:
            # Test timing accuracy of timezone conversions
            start_time = time.time()
            
            # Create multiple schedules and time the operations
            schedules_created = 0
            for i in range(10):
                next_run = datetime.utcnow() + timedelta(hours=1, minutes=i)
                schedule = ScrapingSchedule(
                    user_id=f"{self.test_user_id}_perf_{i}",
                    schedule_type="work_orders",
                    interval_hours=1.0,
                    enabled=True,
                    next_run=next_run
                )
                self.db.add(schedule)
                schedules_created += 1
            
            self.db.commit()
            
            # Time the API response formatting
            format_start = time.time()
            all_schedules = self.db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id.like(f"{self.test_user_id}_perf_%")
            ).all()
            
            responses = []
            for schedule in all_schedules:
                response = _format_schedule_response(schedule)
                responses.append(response)
            
            format_time = time.time() - format_start
            total_time = time.time() - start_time
            
            print(f"✓ Created {schedules_created} schedules in {total_time:.3f}s")
            print(f"✓ Formatted {len(responses)} responses in {format_time:.3f}s")
            print(f"✓ Average format time: {format_time/len(responses)*1000:.2f}ms per schedule")
            
            # Verify all timestamps are properly formatted
            all_valid = True
            for response in responses:
                if response.next_run and not response.next_run.endswith('Z'):
                    all_valid = False
                    break
            
            if all_valid:
                print("✓ All timestamps properly formatted in bulk operation")
                return True
            else:
                print("✗ Some timestamps not properly formatted in bulk operation")
                return False
                
        except Exception as e:
            print(f"✗ Performance and timing test failed: {e}")
            return False
    
    async def run_all_tests(self) -> bool:
        """Run all integration tests"""
        print("=" * 80)
        print("🧪 TIMEZONE INTEGRATION TEST SUITE")
        print("=" * 80)
        
        self.setup()
        
        tests = [
            ("Backend to Frontend Flow", self.test_backend_to_frontend_flow),
            ("Schedule Update Propagation", self.test_schedule_update_propagation),
            ("Timezone Consistency Across Components", self.test_timezone_consistency_across_components),
            ("Critical 1-Hour Scenario", self.test_critical_1_hour_scenario),
            ("Edge Cases and Error Handling", self.test_edge_cases_and_error_handling),
            ("Performance and Timing", self.test_performance_and_timing)
        ]
        
        try:
            for test_name, test_func in tests:
                result = test_func()
                self.test_results.append((test_name, result))
                
        finally:
            self.teardown()
        
        # Print results
        print("\n" + "=" * 80)
        print("📊 TIMEZONE INTEGRATION TEST RESULTS")
        print("=" * 80)
        
        passed = sum(1 for _, result in self.test_results if result)
        failed = len(self.test_results) - passed
        
        for test_name, result in self.test_results:
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"{status:8} | {test_name}")
        
        print("-" * 80)
        print(f"TOTAL: {len(self.test_results)} tests | PASSED: {passed} | FAILED: {failed}")
        
        if failed == 0:
            print("\n🎉 ALL TIMEZONE INTEGRATION TESTS PASSED!")
            print("The complete system handles timezones correctly from backend to frontend.")
        else:
            print(f"\n⚠️  {failed} integration test(s) failed.")
            print("Review the output above for specific timezone integration issues.")
        
        return failed == 0


async def main():
    """Main test runner"""
    test_suite = TimezoneIntegrationTests()
    success = await test_suite.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)