#!/usr/bin/env python3
"""
Test script for edge cases in dispenser scraping functionality
Tests various scenarios to ensure proper handling of edge cases
"""
import asyncio
import requests
import json
import time
from pathlib import Path
import sys

# Add backend directory to Python path
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal
from app.models.work_order import WorkOrder, Dispenser

# API configuration
API_BASE_URL = "http://localhost:8000"
TEST_USER_ID = "bruce"  # Replace with actual test user ID

class EdgeCaseTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        
    def add_result(self, test_name: str, passed: bool, details: str):
        """Add a test result"""
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        
    def test_all_jobs_have_dispensers(self):
        """Test: All jobs already have dispensers (without force refresh)"""
        print("\n🧪 Test 1: All jobs have dispensers (no force refresh)")
        
        # Trigger batch scraping without force refresh
        response = self.session.post(
            f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers-batch",
            params={"user_id": TEST_USER_ID}
        )
        
        result = response.json()
        print(f"   Response status: {result.get('status')}")
        print(f"   Message: {result.get('message')}")
        
        # Check progress endpoint (should return not_found or idle)
        time.sleep(1)
        progress_response = self.session.get(
            f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers/progress/{TEST_USER_ID}"
        )
        progress = progress_response.json()
        print(f"   Progress status: {progress.get('status')}")
        
        passed = result.get('status') == 'all_skipped'
        self.add_result(
            "All jobs have dispensers (no force)",
            passed,
            f"Expected 'all_skipped', got '{result.get('status')}'"
        )
        
    def test_force_refresh_all_jobs(self):
        """Test: Force refresh when all jobs have dispensers"""
        print("\n🧪 Test 2: Force refresh all jobs")
        
        # Trigger batch scraping with force refresh
        response = self.session.post(
            f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers-batch",
            params={"user_id": TEST_USER_ID, "force_refresh": "true"}
        )
        
        result = response.json()
        print(f"   Response status: {result.get('status')}")
        print(f"   Work orders to process: {result.get('work_order_count')}")
        
        passed = result.get('status') == 'scraping_started'
        self.add_result(
            "Force refresh all jobs",
            passed,
            f"Expected 'scraping_started', got '{result.get('status')}'"
        )
        
    def test_single_job_with_dispensers(self):
        """Test: Single job that already has dispensers"""
        print("\n🧪 Test 3: Single job with dispensers (no force)")
        
        # Get a work order with dispensers
        db = SessionLocal()
        try:
            wo_with_dispensers = db.query(WorkOrder).join(Dispenser).filter(
                WorkOrder.user_id == TEST_USER_ID
            ).first()
            
            if wo_with_dispensers:
                response = self.session.post(
                    f"{API_BASE_URL}/api/v1/work-orders/{wo_with_dispensers.id}/scrape-dispensers",
                    params={"user_id": TEST_USER_ID}
                )
                
                result = response.json()
                print(f"   Work order: {wo_with_dispensers.external_id}")
                print(f"   Response status: {result.get('status')}")
                print(f"   Message: {result.get('message')}")
                
                passed = result.get('status') == 'skipped'
                self.add_result(
                    "Single job with dispensers",
                    passed,
                    f"Expected 'skipped', got '{result.get('status')}'"
                )
            else:
                self.add_result(
                    "Single job with dispensers",
                    False,
                    "No work orders with dispensers found for testing"
                )
        finally:
            db.close()
            
    def test_no_work_orders(self):
        """Test: User has no work orders"""
        print("\n🧪 Test 4: User with no work orders")
        
        # Use a fake user ID that shouldn't have work orders
        fake_user = "test_user_no_data_12345"
        
        response = self.session.post(
            f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers-batch",
            params={"user_id": fake_user}
        )
        
        result = response.json()
        print(f"   Response status: {result.get('status')}")
        print(f"   Message: {result.get('message')}")
        
        passed = result.get('status') == 'no_work_orders'
        self.add_result(
            "User with no work orders",
            passed,
            f"Expected 'no_work_orders', got '{result.get('status')}'"
        )
        
    def test_progress_polling_edge_cases(self):
        """Test: Progress polling with non-existent session"""
        print("\n🧪 Test 5: Progress polling edge cases")
        
        # Test 404 response for non-existent progress
        response = self.session.get(
            f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers/progress/fake_user_123"
        )
        
        if response.status_code == 404:
            print("   ✓ 404 response for non-existent user")
            self.add_result("Progress 404 handling", True, "Correctly returns 404")
        else:
            print(f"   ✗ Expected 404, got {response.status_code}")
            self.add_result("Progress 404 handling", False, f"Got {response.status_code}")
            
    def test_mixed_work_orders(self):
        """Test: Some work orders have dispensers, some don't"""
        print("\n🧪 Test 6: Mixed work orders (some with, some without dispensers)")
        
        db = SessionLocal()
        try:
            # Count work orders with and without dispensers
            total_wos = db.query(WorkOrder).filter(WorkOrder.user_id == TEST_USER_ID).count()
            wos_with_dispensers = db.query(WorkOrder).join(Dispenser).filter(
                WorkOrder.user_id == TEST_USER_ID
            ).distinct().count()
            wos_without_dispensers = total_wos - wos_with_dispensers
            
            print(f"   Total work orders: {total_wos}")
            print(f"   With dispensers: {wos_with_dispensers}")
            print(f"   Without dispensers: {wos_without_dispensers}")
            
            if wos_without_dispensers > 0:
                response = self.session.post(
                    f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers-batch",
                    params={"user_id": TEST_USER_ID}
                )
                
                result = response.json()
                print(f"   Response status: {result.get('status')}")
                print(f"   Work orders to process: {result.get('work_order_count')}")
                print(f"   Skipped: {result.get('skipped_count', 0)}")
                
                passed = (result.get('status') == 'scraping_started' and 
                         result.get('work_order_count') == wos_without_dispensers)
                self.add_result(
                    "Mixed work orders",
                    passed,
                    f"Expected to process {wos_without_dispensers}, got {result.get('work_order_count')}"
                )
            else:
                self.add_result(
                    "Mixed work orders",
                    True,
                    "All work orders have dispensers (test scenario not applicable)"
                )
        finally:
            db.close()
            
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("TEST SUMMARY")
        print("=" * 50)
        
        passed_count = sum(1 for r in self.test_results if r['passed'])
        total_count = len(self.test_results)
        
        for result in self.test_results:
            status = "✅ PASS" if result['passed'] else "❌ FAIL"
            print(f"{status} - {result['test']}")
            if not result['passed']:
                print(f"     Details: {result['details']}")
                
        print(f"\nTotal: {passed_count}/{total_count} tests passed")
        
        if passed_count == total_count:
            print("\n🎉 All edge case tests passed!")
        else:
            print(f"\n⚠️  {total_count - passed_count} tests failed")
            
    def run_all_tests(self):
        """Run all edge case tests"""
        print("🧪 Edge Case Test Suite for Dispenser Scraping")
        print("=" * 50)
        
        # Run tests
        self.test_all_jobs_have_dispensers()
        self.test_force_refresh_all_jobs()
        self.test_single_job_with_dispensers()
        self.test_no_work_orders()
        self.test_progress_polling_edge_cases()
        self.test_mixed_work_orders()
        
        # Print summary
        self.print_summary()

def main():
    tester = EdgeCaseTester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()