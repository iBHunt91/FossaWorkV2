#!/usr/bin/env python3
"""
Dashboard Filter Integration Test

Simulates the exact dashboard filter fetching logic to test 
the complete integration between frontend and backend.

This test replicates what the Dashboard.tsx component does:
1. Fetch work orders with date filtering
2. Calculate filters for current week and next week
3. Verify data flow and formatting
4. Test error handling and edge cases
"""

import asyncio
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_USER_ID = "test-user-filter-data"


class DashboardFilterIntegrationTester:
    """Test class that simulates Dashboard.tsx filter logic."""
    
    def __init__(self, base_url: str = BASE_URL, user_id: str = TEST_USER_ID):
        self.base_url = base_url
        self.user_id = user_id
        self.session = requests.Session()
        
    def get_week_range(self, week_offset: int) -> Dict[str, str]:
        """
        Calculate week range like the Dashboard component.
        
        Args:
            week_offset: 0 for current week, 1 for next week, etc.
        
        Returns:
            Dictionary with start and end dates in ISO format
        """
        logger.info(f"📅 Calculating week range for offset {week_offset}")
        
        # Get today's date
        today = datetime.now()
        
        # Calculate start of current week (Monday)
        days_since_monday = today.weekday()
        current_week_start = today - timedelta(days=days_since_monday)
        
        # Calculate target week
        target_week_start = current_week_start + timedelta(weeks=week_offset)
        target_week_end = target_week_start + timedelta(days=6)  # Sunday
        
        # Set to start/end of day
        start_date = target_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = target_week_end.replace(hour=23, minute=59, second=59, microsecond=999000)
        
        result = {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "week_offset": week_offset
        }
        
        logger.info(f"   📅 Week {week_offset}: {start_date.date()} to {end_date.date()}")
        
        return result
    
    def fetch_work_orders_for_date_range(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """
        Fetch work orders for a date range, simulating frontend API call.
        
        Args:
            start_date: ISO format start date
            end_date: ISO format end date
        
        Returns:
            API response with work orders data
        """
        logger.info(f"📡 Fetching work orders for date range: {start_date} to {end_date}")
        
        params = {
            "user_id": self.user_id,
            "skip": 0,
            "limit": 100,
            "start_date": start_date,
            "end_date": end_date
        }
        
        try:
            url = f"{self.base_url}/api/v1/work-orders/"
            logger.debug(f"   🌐 GET {url}")
            logger.debug(f"   📋 Params: {params}")
            
            response = self.session.get(url, params=params)
            
            logger.info(f"   📥 Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"   ✅ Fetched {len(data)} work orders")
                
                # Log service code breakdown
                if data:
                    service_codes = list(set([wo.get('service_code', 'N/A') for wo in data]))
                    logger.info(f"   📋 Service codes: {service_codes}")
                    
                    # Log sample work order structure
                    sample = data[0]
                    logger.debug(f"   📝 Sample work order keys: {list(sample.keys())}")
                
                return {
                    "success": True,
                    "data": data,
                    "count": len(data),
                    "metadata": {
                        "start_date": start_date,
                        "end_date": end_date,
                        "user_id": self.user_id
                    }
                }
            else:
                logger.error(f"   ❌ API error: {response.status_code}")
                logger.error(f"   📋 Response: {response.text}")
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code
                }
                
        except Exception as e:
            logger.error(f"   ❌ Exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status_code": None
            }
    
    def map_work_orders_for_filters(self, work_orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Map work orders to the format expected by filter calculation API.
        
        This replicates the mapping logic in Dashboard.tsx calculateFilters function.
        """
        logger.info(f"🔄 Mapping {len(work_orders)} work orders for filter calculation")
        
        mapped_work_orders = []
        
        for i, wo in enumerate(work_orders):
            logger.debug(f"   🔄 Mapping work order {i+1}: {wo.get('external_id', 'N/A')}")
            
            # Extract store number from site_name (e.g., "7-Eleven #1234" -> "1234")
            store_number = ""
            if wo.get('site_name'):
                import re
                match = re.search(r'#(\d+)', wo['site_name'])
                if match:
                    store_number = match.group(1)
            
            # Extract customer name from site_name (everything before #)
            customer_name = ""
            if wo.get('site_name'):
                customer_name = wo['site_name'].split('#')[0].strip()
            
            mapped_wo = {
                # Use external_id as jobId (matches frontend mapping)
                "jobId": wo.get('external_id') or wo.get('id'),
                "storeNumber": store_number,
                "customerName": customer_name or wo.get('site_name', ''),
                "serviceCode": wo.get('service_code', ''),
                "serviceName": wo.get('service_name', ''),
                "scheduledDate": wo.get('scheduled_date', ''),
                "address": wo.get('address', ''),
                # Include original data for reference
                "originalData": {
                    "id": wo.get('id'),
                    "external_id": wo.get('external_id'),
                    "site_name": wo.get('site_name'),
                    "service_code": wo.get('service_code'),
                    "service_name": wo.get('service_name')
                }
            }
            
            mapped_work_orders.append(mapped_wo)
            
            logger.debug(f"     ✅ Mapped: {mapped_wo['customerName']} #{mapped_wo['storeNumber']} - {mapped_wo['serviceCode']}")
        
        logger.info(f"   ✅ Mapped {len(mapped_work_orders)} work orders successfully")
        
        # Log mapping summary
        service_codes = list(set([wo['serviceCode'] for wo in mapped_work_orders if wo['serviceCode']]))
        customer_names = list(set([wo['customerName'] for wo in mapped_work_orders if wo['customerName']]))
        
        logger.info(f"   📋 Mapped service codes: {service_codes}")
        logger.info(f"   🏪 Mapped customer names: {customer_names}")
        
        return mapped_work_orders
    
    def calculate_filters_for_work_orders(self, work_orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate filters for work orders using the filter calculation API.
        
        This replicates the calculateFilters function from Dashboard.tsx.
        """
        logger.info(f"🧮 Calculating filters for {len(work_orders)} work orders")
        
        if not work_orders:
            logger.warning("   ⚠️ No work orders provided for filter calculation")
            return {
                "success": False,
                "error": "No work orders provided",
                "data": None
            }
        
        # Map work orders for API
        mapped_work_orders = self.map_work_orders_for_filters(work_orders)
        
        # Prepare request data
        request_data = {
            "workOrders": mapped_work_orders,
            "dispensers": [],  # Dashboard doesn't send dispensers currently
            "overrides": {}
        }
        
        logger.info(f"   📤 Sending filter calculation request")
        logger.info(f"   📋 Request structure:")
        logger.info(f"     - Work Orders: {len(request_data['workOrders'])}")
        logger.info(f"     - Dispensers: {len(request_data['dispensers'])}")
        logger.info(f"     - Overrides: {len(request_data['overrides'])}")
        
        try:
            url = f"{self.base_url}/api/v1/filters/calculate"
            response = self.session.post(url, json=request_data)
            
            logger.info(f"   📥 Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"   ✅ Filter calculation successful")
                logger.info(f"   📊 Results:")
                logger.info(f"     - Total Filters: {data.get('totalFilters', 0)}")
                logger.info(f"     - Total Boxes: {data.get('totalBoxes', 0)}")
                logger.info(f"     - Summary Items: {len(data.get('summary', []))}")
                logger.info(f"     - Warnings: {len(data.get('warnings', []))}")
                
                # Log filter summary
                if data.get('summary'):
                    logger.info(f"   📋 Filter Summary:")
                    for item in data['summary']:
                        logger.info(f"     - {item.get('partNumber', 'N/A')}: {item.get('quantity', 0)} units, {item.get('boxes', 0)} boxes")
                
                return {
                    "success": True,
                    "data": data,
                    "request_data": request_data,
                    "metadata": {
                        "work_orders_count": len(work_orders),
                        "mapped_count": len(mapped_work_orders)
                    }
                }
            else:
                logger.error(f"   ❌ Filter calculation failed: {response.status_code}")
                logger.error(f"   📋 Response: {response.text}")
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code,
                    "request_data": request_data
                }
                
        except Exception as e:
            logger.error(f"   ❌ Exception during filter calculation: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status_code": None,
                "request_data": request_data
            }
    
    def test_current_week_filters(self) -> Dict[str, Any]:
        """Test current week filter calculation like Dashboard.tsx."""
        logger.info("🧪 Testing Current Week Filter Calculation")
        logger.info("-" * 50)
        
        # Get current week date range
        current_week = self.get_week_range(0)
        
        # Fetch work orders for current week
        work_orders_result = self.fetch_work_orders_for_date_range(
            current_week["start"], 
            current_week["end"]
        )
        
        if not work_orders_result["success"]:
            logger.error("❌ Failed to fetch work orders for current week")
            return {
                "success": False,
                "error": "Failed to fetch work orders",
                "details": work_orders_result
            }
        
        work_orders = work_orders_result["data"]
        
        if not work_orders:
            logger.warning("⚠️ No work orders found for current week")
            return {
                "success": True,
                "data": {
                    "totalFilters": 0,
                    "totalBoxes": 0,
                    "summary": [],
                    "message": "No work orders for current week"
                },
                "week_range": current_week
            }
        
        # Calculate filters
        filter_result = self.calculate_filters_for_work_orders(work_orders)
        
        if filter_result["success"]:
            logger.info("✅ Current week filter calculation successful")
        else:
            logger.error("❌ Current week filter calculation failed")
        
        return {
            "success": filter_result["success"],
            "data": filter_result.get("data"),
            "error": filter_result.get("error"),
            "week_range": current_week,
            "work_orders_count": len(work_orders),
            "details": filter_result
        }
    
    def test_next_week_filters(self) -> Dict[str, Any]:
        """Test next week filter calculation like Dashboard.tsx."""
        logger.info("🧪 Testing Next Week Filter Calculation")
        logger.info("-" * 50)
        
        # Get next week date range
        next_week = self.get_week_range(1)
        
        # Fetch work orders for next week
        work_orders_result = self.fetch_work_orders_for_date_range(
            next_week["start"], 
            next_week["end"]
        )
        
        if not work_orders_result["success"]:
            logger.error("❌ Failed to fetch work orders for next week")
            return {
                "success": False,
                "error": "Failed to fetch work orders",
                "details": work_orders_result
            }
        
        work_orders = work_orders_result["data"]
        
        if not work_orders:
            logger.warning("⚠️ No work orders found for next week")
            return {
                "success": True,
                "data": {
                    "totalFilters": 0,
                    "totalBoxes": 0,
                    "summary": [],
                    "message": "No work orders for next week"
                },
                "week_range": next_week
            }
        
        # Calculate filters
        filter_result = self.calculate_filters_for_work_orders(work_orders)
        
        if filter_result["success"]:
            logger.info("✅ Next week filter calculation successful")
        else:
            logger.error("❌ Next week filter calculation failed")
        
        return {
            "success": filter_result["success"],
            "data": filter_result.get("data"),
            "error": filter_result.get("error"),
            "week_range": next_week,
            "work_orders_count": len(work_orders),
            "details": filter_result
        }
    
    def test_dashboard_filter_flow(self) -> Dict[str, Any]:
        """Test the complete dashboard filter flow."""
        logger.info("🚀 Testing Complete Dashboard Filter Flow")
        logger.info("=" * 60)
        
        results = {
            "overall_success": True,
            "current_week": None,
            "next_week": None,
            "summary": {},
            "issues": []
        }
        
        # Test current week
        logger.info("\n📅 TESTING CURRENT WEEK")
        current_week_result = self.test_current_week_filters()
        results["current_week"] = current_week_result
        
        if not current_week_result["success"]:
            results["overall_success"] = False
            results["issues"].append("Current week filter calculation failed")
        
        # Test next week
        logger.info("\n📅 TESTING NEXT WEEK")
        next_week_result = self.test_next_week_filters()
        results["next_week"] = next_week_result
        
        if not next_week_result["success"]:
            results["overall_success"] = False
            results["issues"].append("Next week filter calculation failed")
        
        # Generate summary
        results["summary"] = {
            "current_week_filters": current_week_result.get("data", {}).get("totalFilters", 0),
            "current_week_boxes": current_week_result.get("data", {}).get("totalBoxes", 0),
            "next_week_filters": next_week_result.get("data", {}).get("totalFilters", 0),
            "next_week_boxes": next_week_result.get("data", {}).get("totalBoxes", 0),
            "current_week_work_orders": current_week_result.get("work_orders_count", 0),
            "next_week_work_orders": next_week_result.get("work_orders_count", 0)
        }
        
        # Log final results
        logger.info("\n" + "=" * 60)
        logger.info("📊 DASHBOARD FILTER FLOW TEST RESULTS")
        logger.info("=" * 60)
        
        if results["overall_success"]:
            logger.info("✅ Overall Status: PASSED")
        else:
            logger.error("❌ Overall Status: FAILED")
            logger.error(f"💥 Issues: {', '.join(results['issues'])}")
        
        logger.info(f"📋 Summary:")
        logger.info(f"   🗓️ Current Week: {results['summary']['current_week_work_orders']} work orders → {results['summary']['current_week_filters']} filters ({results['summary']['current_week_boxes']} boxes)")
        logger.info(f"   🗓️ Next Week: {results['summary']['next_week_work_orders']} work orders → {results['summary']['next_week_filters']} filters ({results['summary']['next_week_boxes']} boxes)")
        
        # Data validation
        if results["overall_success"]:
            logger.info("✅ Dashboard filter integration is working correctly!")
            logger.info("💡 The frontend should receive proper filter data from the backend")
        else:
            logger.error("❌ Dashboard filter integration has issues")
            logger.error("💡 Check the specific error messages above for troubleshooting")
        
        return results
    
    def test_edge_cases(self) -> Dict[str, Any]:
        """Test edge cases and error scenarios."""
        logger.info("🧪 Testing Edge Cases and Error Scenarios")
        logger.info("-" * 50)
        
        edge_case_results = []
        
        # Test 1: Empty work orders
        logger.info("📋 Test 1: Empty work orders list")
        empty_result = self.calculate_filters_for_work_orders([])
        edge_case_results.append({
            "test": "empty_work_orders",
            "success": not empty_result["success"],  # Should fail gracefully
            "details": "Should handle empty work orders gracefully"
        })
        
        # Test 2: Invalid date range
        logger.info("📋 Test 2: Invalid date range")
        invalid_date_result = self.fetch_work_orders_for_date_range(
            "invalid-date", 
            "also-invalid"
        )
        edge_case_results.append({
            "test": "invalid_dates",
            "success": not invalid_date_result["success"],  # Should fail
            "details": "Should reject invalid date formats"
        })
        
        # Test 3: Future date range (should return empty)
        logger.info("📋 Test 3: Far future date range")
        future_start = (datetime.now() + timedelta(days=365)).isoformat()
        future_end = (datetime.now() + timedelta(days=372)).isoformat()
        future_result = self.fetch_work_orders_for_date_range(future_start, future_end)
        edge_case_results.append({
            "test": "future_dates",
            "success": future_result["success"] and len(future_result.get("data", [])) == 0,
            "details": "Should return empty results for far future dates"
        })
        
        logger.info("📊 Edge Case Test Results:")
        for result in edge_case_results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            logger.info(f"   {status} {result['test']}: {result['details']}")
        
        return {
            "success": all(result["success"] for result in edge_case_results),
            "tests": edge_case_results
        }


def main():
    """Main test runner."""
    print("🚀 Dashboard Filter Integration Test")
    print("=" * 60)
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print("❌ Backend not running or not healthy. Please start the backend first.")
            return 1
        print("✅ Backend is running and healthy")
    except:
        print("❌ Cannot connect to backend. Please start the backend first.")
        return 1
    
    # Initialize tester
    tester = DashboardFilterIntegrationTester()
    
    # Run tests
    print("\n🧪 Running dashboard filter integration tests...")
    
    # Test main dashboard flow
    main_results = tester.test_dashboard_filter_flow()
    
    # Test edge cases
    print("\n🧪 Running edge case tests...")
    edge_results = tester.test_edge_cases()
    
    # Overall results
    overall_success = main_results["overall_success"] and edge_results["success"]
    
    print("\n" + "=" * 60)
    print("🏁 FINAL TEST RESULTS")
    print("=" * 60)
    
    if overall_success:
        print("✅ All tests PASSED!")
        print("💡 Dashboard filter integration is working correctly")
        return 0
    else:
        print("❌ Some tests FAILED!")
        print("💡 Check the error messages above for troubleshooting")
        return 1


if __name__ == "__main__":
    exit(main())