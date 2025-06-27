#!/usr/bin/env python3
"""
Comprehensive Filter Data Flow Integration Test

Tests the complete pipeline from work orders to filter calculations:
1. Work Orders API endpoint with date filtering
2. Filter calculation API with real work order data  
3. Data formatting between frontend and backend
4. Complete end-to-end pipeline verification

This test verifies that filter data flows correctly from backend to frontend
and identifies where data might be getting lost in the pipeline.
"""

import asyncio
import json
import pytest
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
import sys
import os

# Add backend to path for imports
sys.path.append('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')

from app.services.filter_calculator import FilterCalculator
from app.models import WorkOrder, Dispenser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_USER_ID = "test-user-filter-flow"
TEST_TOKEN = None  # Will be populated if auth is needed


class FilterDataFlowTester:
    """Comprehensive filter data flow testing class."""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_work_orders = []
        self.test_dispensers = []
        
    def setup_auth(self, token: Optional[str] = None):
        """Set up authentication headers if needed."""
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            logger.info("✅ Authentication configured")
        else:
            logger.info("⚠️ No authentication token provided - testing without auth")
    
    def generate_test_work_orders(self, count: int = 5) -> List[Dict[str, Any]]:
        """Generate realistic test work orders for filter calculation testing."""
        logger.info(f"🔧 Generating {count} test work orders...")
        
        # Sample store chains and service codes
        store_chains = ['7-Eleven', 'Speedway', 'Marathon', 'Wawa', 'Circle K']
        service_codes = ['2861', '2862', '3002', '3146']
        service_names = {
            '2861': 'AccuMeasure - All Dispensers',
            '2862': 'AccuMeasure - Specific Dispensers', 
            '3002': 'AccuMeasure - All Dispensers',
            '3146': 'Open Neck Prover'
        }
        
        work_orders = []
        base_date = datetime.now()
        
        for i in range(count):
            store_chain = store_chains[i % len(store_chains)]
            service_code = service_codes[i % len(service_codes)]
            store_number = f"{1000 + i}"
            
            work_order = {
                "id": f"test-wo-{i+1}",
                "external_id": f"W-{12345 + i}",
                "jobId": f"W-{12345 + i}",
                "site_name": f"{store_chain} #{store_number}",
                "storeNumber": store_number,
                "customerName": store_chain,
                "address": f"{100 + i} Test Street, Test City, TX 7500{i}",
                "service_code": service_code,
                "serviceCode": service_code,
                "service_name": service_names[service_code],
                "serviceName": service_names[service_code],
                "scheduled_date": (base_date + timedelta(days=i)).isoformat(),
                "scheduledDate": (base_date + timedelta(days=i)).isoformat(),
                "created_date": base_date.isoformat(),
                "visit_url": f"/visits/test-visit-{i+1}",
                "customer_url": f"/customers/locations/test-location-{i+1}/",
                "instructions": f"Test work order {i+1} for filter calculation testing",
                "user_id": TEST_USER_ID
            }
            
            work_orders.append(work_order)
        
        self.test_work_orders = work_orders
        logger.info(f"✅ Generated {len(work_orders)} test work orders")
        logger.info(f"📋 Service codes: {list(set([wo['service_code'] for wo in work_orders]))}")
        logger.info(f"🏪 Store chains: {list(set([wo['customerName'] for wo in work_orders]))}")
        
        return work_orders
    
    def generate_test_dispensers(self, count: int = 10) -> List[Dict[str, Any]]:
        """Generate realistic test dispenser data."""
        logger.info(f"🔧 Generating {count} test dispensers...")
        
        meter_types = ['Electronic', 'HD Meter', 'Ecometer']
        fuel_grades = ['Regular', 'Plus', 'Premium', 'Diesel', 'DEF']
        
        dispensers = []
        
        for i in range(count):
            store_number = f"{1000 + (i % 5)}"  # Associate with test work orders
            
            dispenser = {
                "id": f"test-dispenser-{i+1}",
                "dispenser_number": str(i + 1),
                "store_number": store_number,
                "storeNumber": store_number,
                "meter_type": meter_types[i % len(meter_types)],
                "fuel_grades": fuel_grades[:3 + (i % 3)],  # Variable number of grades
                "make": "Test Make",
                "model": "Test Model",
                "serial_number": f"SN{10000 + i}",
                "nozzles": 2 + (i % 2),  # 2 or 3 nozzles
                "status": "Active"
            }
            
            dispensers.append(dispenser)
        
        self.test_dispensers = dispensers
        logger.info(f"✅ Generated {len(dispensers)} test dispensers")
        logger.info(f"🔧 Meter types: {list(set([d['meter_type'] for d in dispensers]))}")
        
        return dispensers
    
    def test_work_orders_api(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        """Test the work orders API endpoint with date filtering."""
        logger.info("🧪 Testing Work Orders API...")
        
        # Build API URL with parameters
        params = {
            "user_id": TEST_USER_ID,
            "skip": 0,
            "limit": 100
        }
        
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        try:
            url = f"{self.base_url}/api/v1/work-orders/"
            logger.info(f"📤 GET {url}")
            logger.info(f"📋 Parameters: {params}")
            
            response = self.session.get(url, params=params)
            
            logger.info(f"📥 Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Work Orders API successful")
                logger.info(f"📊 Returned {len(data)} work orders")
                
                # Log sample data structure
                if data:
                    sample = data[0]
                    logger.info(f"📋 Sample work order keys: {list(sample.keys())}")
                    logger.info(f"📋 Sample work order: {json.dumps(sample, indent=2)[:500]}...")
                
                return {
                    "success": True,
                    "data": data,
                    "count": len(data),
                    "status_code": response.status_code
                }
            else:
                logger.error(f"❌ Work Orders API failed: {response.status_code}")
                logger.error(f"📋 Response: {response.text}")
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code
                }
                
        except Exception as e:
            logger.error(f"❌ Work Orders API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status_code": None
            }
    
    def test_filter_calculation_api(self, work_orders: List[Dict[str, Any]], dispensers: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Test the filter calculation API with real work order data."""
        logger.info("🧪 Testing Filter Calculation API...")
        
        if dispensers is None:
            dispensers = self.test_dispensers or []
        
        # Prepare request data in the format expected by the API
        request_data = {
            "workOrders": work_orders,
            "dispensers": dispensers,
            "overrides": {}
        }
        
        try:
            url = f"{self.base_url}/api/v1/filters/calculate"
            logger.info(f"📤 POST {url}")
            logger.info(f"📋 Request data structure:")
            logger.info(f"   - Work Orders: {len(request_data['workOrders'])}")
            logger.info(f"   - Dispensers: {len(request_data['dispensers'])}")
            logger.info(f"   - Overrides: {len(request_data['overrides'])}")
            
            # Log sample work order data being sent
            if request_data['workOrders']:
                sample_wo = request_data['workOrders'][0]
                logger.info(f"📋 Sample work order data sent:")
                logger.info(f"   - Job ID: {sample_wo.get('jobId', 'N/A')}")
                logger.info(f"   - Store Number: {sample_wo.get('storeNumber', 'N/A')}")
                logger.info(f"   - Service Code: {sample_wo.get('serviceCode', 'N/A')}")
                logger.info(f"   - Customer Name: {sample_wo.get('customerName', 'N/A')}")
            
            response = self.session.post(url, json=request_data)
            
            logger.info(f"📥 Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Filter Calculation API successful")
                logger.info(f"📊 Response structure:")
                logger.info(f"   - Total Filters: {data.get('totalFilters', 'N/A')}")
                logger.info(f"   - Total Boxes: {data.get('totalBoxes', 'N/A')}")
                logger.info(f"   - Summary Items: {len(data.get('summary', []))}")
                logger.info(f"   - Detail Items: {len(data.get('details', []))}")
                logger.info(f"   - Warnings: {len(data.get('warnings', []))}")
                
                # Log summary details
                if data.get('summary'):
                    logger.info("📋 Filter Summary:")
                    for item in data['summary']:
                        logger.info(f"   - {item.get('partNumber', 'N/A')}: {item.get('quantity', 0)} units, {item.get('boxes', 0)} boxes")
                
                # Log warnings if any
                if data.get('warnings'):
                    logger.warning("⚠️ Filter Calculation Warnings:")
                    for warning in data['warnings']:
                        logger.warning(f"   - {warning.get('message', 'Unknown warning')}")
                
                return {
                    "success": True,
                    "data": data,
                    "status_code": response.status_code
                }
            else:
                logger.error(f"❌ Filter Calculation API failed: {response.status_code}")
                logger.error(f"📋 Response: {response.text}")
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code
                }
                
        except Exception as e:
            logger.error(f"❌ Filter Calculation API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status_code": None
            }
    
    def test_data_formatting(self, work_orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Test data formatting between frontend and backend expectations."""
        logger.info("🧪 Testing Data Formatting...")
        
        formatting_issues = []
        corrected_data = []
        
        required_fields = ['jobId', 'storeNumber', 'customerName', 'serviceCode', 'scheduledDate']
        
        for i, wo in enumerate(work_orders):
            logger.debug(f"🔍 Checking work order {i+1}: {wo.get('jobId', 'N/A')}")
            
            issues = []
            corrected_wo = wo.copy()
            
            # Check required fields
            for field in required_fields:
                if field not in wo or not wo[field]:
                    issues.append(f"Missing required field: {field}")
                    
                    # Attempt to correct common mapping issues
                    if field == 'jobId' and 'external_id' in wo:
                        corrected_wo['jobId'] = wo['external_id']
                        logger.debug(f"   ✅ Corrected jobId: {wo['external_id']}")
                    elif field == 'storeNumber' and 'site_name' in wo:
                        # Extract store number from site_name like "7-Eleven #1234"
                        import re
                        match = re.search(r'#(\d+)', wo['site_name'])
                        if match:
                            corrected_wo['storeNumber'] = match.group(1)
                            logger.debug(f"   ✅ Extracted storeNumber: {match.group(1)}")
                    elif field == 'customerName' and 'site_name' in wo:
                        # Extract customer name from site_name
                        customer = wo['site_name'].split('#')[0].strip()
                        corrected_wo['customerName'] = customer
                        logger.debug(f"   ✅ Extracted customerName: {customer}")
                    elif field == 'serviceCode' and 'service_code' in wo:
                        corrected_wo['serviceCode'] = wo['service_code']
                        logger.debug(f"   ✅ Corrected serviceCode: {wo['service_code']}")
                    elif field == 'scheduledDate' and 'scheduled_date' in wo:
                        corrected_wo['scheduledDate'] = wo['scheduled_date']
                        logger.debug(f"   ✅ Corrected scheduledDate: {wo['scheduled_date']}")
            
            # Validate date format
            if 'scheduledDate' in corrected_wo:
                try:
                    datetime.fromisoformat(corrected_wo['scheduledDate'].replace('Z', '+00:00'))
                except ValueError:
                    issues.append(f"Invalid date format: {corrected_wo['scheduledDate']}")
            
            # Validate service code
            valid_service_codes = ['2861', '2862', '3002', '3146']
            if corrected_wo.get('serviceCode') not in valid_service_codes:
                issues.append(f"Invalid service code: {corrected_wo.get('serviceCode')}")
            
            if issues:
                formatting_issues.append({
                    "work_order_index": i,
                    "jobId": wo.get('jobId', 'N/A'),
                    "issues": issues
                })
                logger.warning(f"   ⚠️ Found {len(issues)} formatting issues")
            else:
                logger.debug(f"   ✅ Work order formatting OK")
            
            corrected_data.append(corrected_wo)
        
        result = {
            "total_work_orders": len(work_orders),
            "formatting_issues": formatting_issues,
            "corrected_data": corrected_data,
            "success": len(formatting_issues) == 0
        }
        
        if formatting_issues:
            logger.warning(f"⚠️ Found formatting issues in {len(formatting_issues)} work orders")
        else:
            logger.info("✅ All work orders have correct formatting")
        
        return result
    
    def test_end_to_end_pipeline(self) -> Dict[str, Any]:
        """Test the complete end-to-end pipeline."""
        logger.info("🧪 Testing End-to-End Filter Data Pipeline...")
        
        results = {
            "pipeline_steps": [],
            "overall_success": True,
            "error_summary": []
        }
        
        # Step 1: Generate test data
        logger.info("📋 Step 1: Generating test data...")
        work_orders = self.generate_test_work_orders(5)
        dispensers = self.generate_test_dispensers(10)
        
        results["pipeline_steps"].append({
            "step": "data_generation",
            "success": True,
            "details": f"Generated {len(work_orders)} work orders and {len(dispensers)} dispensers"
        })
        
        # Step 2: Test work orders API
        logger.info("📋 Step 2: Testing work orders API...")
        wo_result = self.test_work_orders_api()
        
        results["pipeline_steps"].append({
            "step": "work_orders_api",
            "success": wo_result["success"],
            "details": wo_result.get("error", f"Returned {wo_result.get('count', 0)} work orders")
        })
        
        if not wo_result["success"]:
            results["overall_success"] = False
            results["error_summary"].append("Work Orders API failed")
        
        # Step 3: Test data formatting
        logger.info("📋 Step 3: Testing data formatting...")
        format_result = self.test_data_formatting(work_orders)
        
        results["pipeline_steps"].append({
            "step": "data_formatting",
            "success": format_result["success"],
            "details": f"Found {len(format_result['formatting_issues'])} formatting issues"
        })
        
        if not format_result["success"]:
            results["overall_success"] = False
            results["error_summary"].append("Data formatting issues found")
        
        # Step 4: Test filter calculation API
        logger.info("📋 Step 4: Testing filter calculation API...")
        calc_result = self.test_filter_calculation_api(format_result["corrected_data"], dispensers)
        
        results["pipeline_steps"].append({
            "step": "filter_calculation_api",
            "success": calc_result["success"],
            "details": calc_result.get("error", "Filter calculation completed")
        })
        
        if not calc_result["success"]:
            results["overall_success"] = False
            results["error_summary"].append("Filter Calculation API failed")
        
        # Step 5: Validate filter data completeness
        if calc_result["success"]:
            logger.info("📋 Step 5: Validating filter data completeness...")
            filter_data = calc_result["data"]
            
            validation_issues = []
            
            # Check for required fields in response
            if not filter_data.get("totalFilters"):
                validation_issues.append("Missing totalFilters in response")
            if not filter_data.get("totalBoxes"):
                validation_issues.append("Missing totalBoxes in response")
            if not filter_data.get("summary"):
                validation_issues.append("Missing summary in response")
            
            # Check if summary data makes sense
            if filter_data.get("summary"):
                total_from_summary = sum(item.get("quantity", 0) for item in filter_data["summary"])
                if total_from_summary != filter_data.get("totalFilters", 0):
                    validation_issues.append(f"Summary total ({total_from_summary}) doesn't match totalFilters ({filter_data.get('totalFilters')})")
            
            validation_success = len(validation_issues) == 0
            
            results["pipeline_steps"].append({
                "step": "filter_data_validation",
                "success": validation_success,
                "details": f"Found {len(validation_issues)} validation issues: {', '.join(validation_issues)}"
            })
            
            if not validation_success:
                results["overall_success"] = False
                results["error_summary"].extend(validation_issues)
        
        # Summary
        if results["overall_success"]:
            logger.info("✅ End-to-End Pipeline Test PASSED")
        else:
            logger.error("❌ End-to-End Pipeline Test FAILED")
            logger.error(f"💥 Errors: {', '.join(results['error_summary'])}")
        
        return results
    
    def run_comprehensive_test(self):
        """Run all tests and provide a comprehensive report."""
        logger.info("🚀 Starting Comprehensive Filter Data Flow Test")
        logger.info("=" * 80)
        
        # Test individual components
        logger.info("🧪 Testing Individual Components...")
        
        # Generate test data
        work_orders = self.generate_test_work_orders(5)
        dispensers = self.generate_test_dispensers(10)
        
        # Test work orders API
        wo_result = self.test_work_orders_api()
        
        # Test filter calculation with test data
        calc_result = self.test_filter_calculation_api(work_orders, dispensers)
        
        # Test data formatting
        format_result = self.test_data_formatting(work_orders)
        
        # Test complete pipeline
        pipeline_result = self.test_end_to_end_pipeline()
        
        # Generate comprehensive report
        logger.info("=" * 80)
        logger.info("📊 COMPREHENSIVE TEST RESULTS")
        logger.info("=" * 80)
        
        logger.info("🔍 Component Test Results:")
        logger.info(f"   ✅ Work Orders API: {'PASS' if wo_result['success'] else 'FAIL'}")
        logger.info(f"   ✅ Filter Calculation API: {'PASS' if calc_result['success'] else 'FAIL'}")
        logger.info(f"   ✅ Data Formatting: {'PASS' if format_result['success'] else 'FAIL'}")
        logger.info(f"   ✅ End-to-End Pipeline: {'PASS' if pipeline_result['overall_success'] else 'FAIL'}")
        
        logger.info("📋 Detailed Results:")
        if not wo_result['success']:
            logger.error(f"   ❌ Work Orders API Error: {wo_result.get('error', 'Unknown error')}")
        
        if not calc_result['success']:
            logger.error(f"   ❌ Filter Calculation Error: {calc_result.get('error', 'Unknown error')}")
        
        if not format_result['success']:
            logger.error(f"   ❌ Data Formatting Issues: {len(format_result['formatting_issues'])} problems found")
        
        if not pipeline_result['overall_success']:
            logger.error(f"   ❌ Pipeline Errors: {', '.join(pipeline_result['error_summary'])}")
        
        # Recommendations
        logger.info("💡 Recommendations:")
        if not wo_result['success']:
            logger.info("   🔧 Check work orders API endpoint configuration and authentication")
        if not calc_result['success']:
            logger.info("   🔧 Verify filter calculation service and data formatting")
        if not format_result['success']:
            logger.info("   🔧 Fix data mapping between frontend and backend models")
        if pipeline_result['overall_success']:
            logger.info("   ✅ Filter data pipeline is working correctly!")
        
        logger.info("=" * 80)
        
        return {
            "work_orders_api": wo_result,
            "filter_calculation_api": calc_result,
            "data_formatting": format_result,
            "end_to_end_pipeline": pipeline_result
        }


def main():
    """Main test runner function."""
    print("🚀 Filter Data Flow Integration Test")
    print("=" * 60)
    
    # Initialize tester
    tester = FilterDataFlowTester()
    
    # Set up authentication if needed
    # tester.setup_auth(TEST_TOKEN)
    
    # Run comprehensive test
    results = tester.run_comprehensive_test()
    
    # Return exit code based on overall success
    overall_success = all([
        results["work_orders_api"]["success"],
        results["filter_calculation_api"]["success"], 
        results["data_formatting"]["success"],
        results["end_to_end_pipeline"]["overall_success"]
    ])
    
    if overall_success:
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed!")
        return 1


if __name__ == "__main__":
    exit(main())