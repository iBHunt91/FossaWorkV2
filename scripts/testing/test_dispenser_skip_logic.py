#!/usr/bin/env python3
"""
Test script for dispenser scraping skip logic and force refresh functionality
"""
import asyncio
import requests
import json
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

class DispenserSkipLogicTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        
    def login(self):
        """Login to get auth token"""
        print("🔐 Logging in...")
        # For testing, you might need to update this based on your auth setup
        # This is a placeholder - update with actual login logic
        return True
        
    def get_work_orders(self):
        """Get all work orders"""
        response = self.session.get(
            f"{API_BASE_URL}/api/v1/work-orders/",
            params={"user_id": TEST_USER_ID}
        )
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Failed to get work orders: {response.status_code}")
            return []
            
    def get_dispenser_count(self):
        """Get count of work orders with dispensers"""
        db = SessionLocal()
        try:
            # Count work orders with dispensers
            work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == TEST_USER_ID).all()
            with_dispensers = 0
            without_dispensers = 0
            
            for wo in work_orders:
                dispenser_count = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).count()
                if dispenser_count > 0:
                    with_dispensers += 1
                else:
                    without_dispensers += 1
                    
            return with_dispensers, without_dispensers
        finally:
            db.close()
            
    def test_single_work_order_skip(self, work_order_id: str):
        """Test single work order dispenser scraping with skip logic"""
        print(f"\n📋 Testing single work order scrape for {work_order_id}")
        
        # First attempt - should skip if dispensers exist
        print("🔄 Attempt 1: Without force_refresh")
        response = self.session.post(
            f"{API_BASE_URL}/api/v1/work-orders/{work_order_id}/scrape-dispensers",
            params={"user_id": TEST_USER_ID}
        )
        
        result = response.json()
        print(f"   Status: {result.get('status')}")
        print(f"   Message: {result.get('message')}")
        
        # Second attempt - with force_refresh
        print("\n🔄 Attempt 2: With force_refresh=true")
        response = self.session.post(
            f"{API_BASE_URL}/api/v1/work-orders/{work_order_id}/scrape-dispensers",
            params={"user_id": TEST_USER_ID, "force_refresh": "true"}
        )
        
        result = response.json()
        print(f"   Status: {result.get('status')}")
        print(f"   Message: {result.get('message')}")
        
    def test_batch_scraping_skip(self):
        """Test batch dispenser scraping with skip logic"""
        print("\n📋 Testing batch dispenser scraping")
        
        # Get initial counts
        with_dispensers, without_dispensers = self.get_dispenser_count()
        print(f"   Initial state: {with_dispensers} with dispensers, {without_dispensers} without")
        
        # First attempt - should skip work orders with dispensers
        print("\n🔄 Attempt 1: Without force_refresh")
        response = self.session.post(
            f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers-batch",
            params={"user_id": TEST_USER_ID}
        )
        
        result = response.json()
        print(f"   Status: {result.get('status')}")
        print(f"   Message: {result.get('message')}")
        print(f"   Work orders to process: {result.get('work_order_count', 0)}")
        print(f"   Skipped: {result.get('skipped_count', 0)}")
        
        # Second attempt - with force_refresh
        print("\n🔄 Attempt 2: With force_refresh=true")
        response = self.session.post(
            f"{API_BASE_URL}/api/v1/work-orders/scrape-dispensers-batch",
            params={"user_id": TEST_USER_ID, "force_refresh": "true"}
        )
        
        result = response.json()
        print(f"   Status: {result.get('status')}")
        print(f"   Message: {result.get('message')}")
        print(f"   Work orders to process: {result.get('work_order_count', 0)}")
        
    def run_tests(self):
        """Run all tests"""
        print("🧪 Dispenser Skip Logic Test Suite")
        print("=" * 50)
        
        # Login
        if not self.login():
            print("❌ Failed to login")
            return
            
        # Get work orders
        work_orders = self.get_work_orders()
        if not work_orders:
            print("❌ No work orders found")
            return
            
        print(f"✅ Found {len(work_orders)} work orders")
        
        # Find a work order with dispensers for testing
        wo_with_dispensers = None
        wo_without_dispensers = None
        
        for wo in work_orders:
            if wo.get('dispensers') and len(wo['dispensers']) > 0:
                if not wo_with_dispensers:
                    wo_with_dispensers = wo
            else:
                if not wo_without_dispensers:
                    wo_without_dispensers = wo
                    
            if wo_with_dispensers and wo_without_dispensers:
                break
                
        # Test single work order scraping
        if wo_with_dispensers:
            print(f"\n🔍 Testing with work order that HAS dispensers: {wo_with_dispensers['external_id']}")
            self.test_single_work_order_skip(wo_with_dispensers['id'])
        else:
            print("\n⚠️  No work orders with dispensers found for testing")
            
        if wo_without_dispensers:
            print(f"\n🔍 Testing with work order that has NO dispensers: {wo_without_dispensers['external_id']}")
            self.test_single_work_order_skip(wo_without_dispensers['id'])
        else:
            print("\n⚠️  No work orders without dispensers found for testing")
            
        # Test batch scraping
        self.test_batch_scraping_skip()
        
        print("\n✅ Test suite completed!")

def main():
    tester = DispenserSkipLogicTester()
    tester.run_tests()

if __name__ == "__main__":
    main()