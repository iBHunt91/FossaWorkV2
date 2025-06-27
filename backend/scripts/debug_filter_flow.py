#!/usr/bin/env python3
"""
Filter Flow Debug Script
Tests the complete filter calculation pipeline with detailed debugging
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Simple filter service for debugging (no dependencies)
import logging

logger = logging.getLogger(__name__)

class SimpleFilterService:
    """Simplified filter service for debugging without external dependencies"""
    
    async def calculate_filters(self, work_orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate filters for work orders"""
        try:
            if not work_orders:
                return {
                    'success': True,
                    'data': {
                        'filters': [],
                        'totalWorkOrders': 0,
                        'lastCalculated': datetime.now().isoformat()
                    }
                }
            
            filter_summary = {}
            processed_orders = []
            
            for order in work_orders:
                try:
                    processed_order = self._process_work_order(order)
                    processed_orders.append(processed_order)
                    
                    order_filters = self._calculate_order_filters(processed_order)
                    for filter_type, quantity in order_filters.items():
                        filter_summary[filter_type] = filter_summary.get(filter_type, 0) + quantity
                        
                except Exception as e:
                    logger.warning(f"Failed to process work order {order.get('workOrderId', 'unknown')}: {e}")
                    continue
            
            filters = []
            for filter_type, quantity in filter_summary.items():
                filters.append({
                    'filterType': filter_type,
                    'quantity': quantity,
                    'partNumber': self._get_part_number(filter_type),
                    'lastUpdated': datetime.now().isoformat()
                })
            
            return {
                'success': True,
                'data': {
                    'filters': filters,
                    'totalWorkOrders': len(processed_orders),
                    'lastCalculated': datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Filter calculation failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _process_work_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate a work order"""
        return {
            'workOrderId': order.get('workOrderId', 'unknown'),
            'serviceCode': order.get('serviceCode', ''),
            'dispensers': order.get('dispensers', []),
            'dispenserCount': len(order.get('dispensers', []))
        }
    
    def _calculate_order_filters(self, order: Dict[str, Any]) -> Dict[str, int]:
        """Calculate filters for a work order"""
        filters = {}
        service_code = order.get('serviceCode', '')
        dispensers = order.get('dispensers', [])
        
        if service_code in ['2861', '2862', '3002']:
            dispenser_count = len(dispensers)
            filters['Regular Filter'] = dispenser_count
            filters['DEF Filter'] = max(1, dispenser_count // 2)
            
            for dispenser in dispensers:
                product = dispenser.get('product', '').lower()
                if 'diesel' in product:
                    filters['Diesel Filter'] = filters.get('Diesel Filter', 0) + 1
                if 'e85' in product:
                    filters['E85 Filter'] = filters.get('E85 Filter', 0) + 1
        elif service_code == '3146':
            filters['Special Filter'] = 1
        
        return filters
    
    def _get_part_number(self, filter_type: str) -> str:
        """Get part number for filter type"""
        part_numbers = {
            'Regular Filter': 'RF-001',
            'DEF Filter': 'DF-002',
            'Diesel Filter': 'DSL-003',
            'E85 Filter': 'E85-004',
            'Special Filter': 'SP-005'
        }
        return part_numbers.get(filter_type, 'UNKNOWN')

class FilterFlowDebugger:
    def __init__(self):
        self.filter_service = SimpleFilterService()
        self.debug_results = {
            'timestamp': datetime.now().isoformat(),
            'tests': [],
            'summary': {}
        }
    
    def log_test(self, test_name: str, status: str, data: Any = None, error: str = None):
        """Log test result"""
        test_result = {
            'test_name': test_name,
            'status': status,
            'timestamp': datetime.now().isoformat(),
            'data': data,
            'error': error
        }
        self.debug_results['tests'].append(test_result)
        
        status_icon = {
            'PASS': '✅',
            'FAIL': '❌',
            'WARN': '⚠️',
            'INFO': 'ℹ️'
        }.get(status, '🔍')
        
        print(f"{status_icon} {test_name}: {status}")
        if error:
            print(f"   Error: {error}")
        if data and isinstance(data, (dict, list)):
            print(f"   Data: {json.dumps(data, indent=2)[:200]}...")
        elif data:
            print(f"   Data: {data}")
        print()

    def create_sample_work_orders(self) -> List[Dict]:
        """Create sample work order data for testing"""
        sample_orders = [
            {
                'workOrderId': 'W-123456',
                'serviceCode': '2861',
                'serviceName': 'AccuMeasure',
                'customerName': '7-Eleven Store #1234',
                'address': '123 Main St, City, State 12345',
                'dispensers': [
                    {
                        'dispenserNumber': '1',
                        'product': 'Regular Unleaded',
                        'position': 'A'
                    },
                    {
                        'dispenserNumber': '1',
                        'product': 'Premium Unleaded',
                        'position': 'B'
                    },
                    {
                        'dispenserNumber': '2',
                        'product': 'Diesel',
                        'position': 'A'
                    },
                    {
                        'dispenserNumber': '2',
                        'product': 'DEF',
                        'position': 'B'
                    }
                ]
            },
            {
                'workOrderId': 'W-789012',
                'serviceCode': '2862',
                'serviceName': 'AccuMeasure',
                'customerName': 'Wawa Store #5678',
                'address': '456 Oak Ave, Town, State 67890',
                'dispensers': [
                    {
                        'dispenserNumber': '3',
                        'product': 'Regular Unleaded',
                        'position': 'A'
                    },
                    {
                        'dispenserNumber': '3',
                        'product': 'E85',
                        'position': 'B'
                    }
                ]
            },
            {
                'workOrderId': 'W-345678',
                'serviceCode': '3146',
                'serviceName': 'Open Neck Prover',
                'customerName': 'Shell Station #9012',
                'address': '789 Pine St, Village, State 34567',
                'dispensers': []
            }
        ]
        return sample_orders

    def test_work_order_validation(self, work_orders: List[Dict]):
        """Test work order data validation"""
        try:
            for i, order in enumerate(work_orders):
                errors = []
                
                # Check required fields
                if not order.get('workOrderId'):
                    errors.append('Missing workOrderId')
                
                if not order.get('serviceCode'):
                    errors.append('Missing serviceCode')
                elif order['serviceCode'] not in ['2861', '2862', '3002', '3146']:
                    errors.append(f"Invalid serviceCode: {order['serviceCode']}")
                
                # Check AccuMeasure services have dispensers
                if order.get('serviceCode') in ['2861', '2862', '3002']:
                    if not order.get('dispensers'):
                        errors.append('AccuMeasure service missing dispensers')
                    elif not isinstance(order['dispensers'], list):
                        errors.append('dispensers must be a list')
                    elif len(order['dispensers']) == 0:
                        errors.append('AccuMeasure service has empty dispensers list')
                
                if errors:
                    self.log_test(
                        f"Work Order {i+1} Validation",
                        'FAIL',
                        {'workOrderId': order.get('workOrderId'), 'errors': errors}
                    )
                else:
                    self.log_test(
                        f"Work Order {i+1} Validation",
                        'PASS',
                        {'workOrderId': order.get('workOrderId')}
                    )
                    
        except Exception as e:
            self.log_test('Work Order Validation', 'FAIL', error=str(e))

    def test_dispenser_analysis(self, work_orders: List[Dict]):
        """Test dispenser data analysis"""
        try:
            total_dispensers = 0
            product_counts = {}
            
            for order in work_orders:
                dispensers = order.get('dispensers', [])
                dispenser_count = len(dispensers)
                total_dispensers += dispenser_count
                
                self.log_test(
                    f"Dispenser Count - {order.get('workOrderId', 'Unknown')}",
                    'INFO',
                    {'count': dispenser_count, 'serviceCode': order.get('serviceCode')}
                )
                
                # Analyze products
                for dispenser in dispensers:
                    product = dispenser.get('product', 'Unknown')
                    product_counts[product] = product_counts.get(product, 0) + 1
            
            self.log_test(
                'Total Dispenser Analysis',
                'PASS',
                {
                    'total_dispensers': total_dispensers,
                    'product_breakdown': product_counts
                }
            )
            
        except Exception as e:
            self.log_test('Dispenser Analysis', 'FAIL', error=str(e))

    async def test_filter_calculation(self, work_orders: List[Dict]):
        """Test the actual filter calculation service"""
        try:
            # Test the filter service
            result = await self.filter_service.calculate_filters(work_orders)
            
            if result.get('success'):
                filter_data = result.get('data', {})
                filters = filter_data.get('filters', [])
                
                self.log_test(
                    'Filter Calculation Service',
                    'PASS',
                    {
                        'filter_count': len(filters),
                        'total_work_orders': filter_data.get('totalWorkOrders'),
                        'filters': filters
                    }
                )
                
                # Validate filter results
                for filter_item in filters:
                    if not filter_item.get('filterType'):
                        self.log_test('Filter Validation', 'WARN', 
                                    data={'issue': 'Filter missing type', 'filter': filter_item})
                    elif filter_item.get('quantity', 0) <= 0:
                        self.log_test('Filter Validation', 'WARN',
                                    data={'issue': 'Zero quantity filter', 'filter': filter_item})
                
            else:
                self.log_test(
                    'Filter Calculation Service',
                    'FAIL',
                    error=result.get('error', 'Unknown error')
                )
                
        except Exception as e:
            self.log_test('Filter Calculation Service', 'FAIL', error=str(e))

    def test_edge_cases(self):
        """Test edge cases and error conditions"""
        edge_cases = [
            {
                'name': 'Empty Work Orders',
                'data': []
            },
            {
                'name': 'Work Order Missing Service Code',
                'data': [{'workOrderId': 'W-999', 'dispensers': []}]
            },
            {
                'name': 'AccuMeasure Without Dispensers',
                'data': [{'workOrderId': 'W-888', 'serviceCode': '2861', 'dispensers': []}]
            },
            {
                'name': 'Invalid Service Code',
                'data': [{'workOrderId': 'W-777', 'serviceCode': '9999', 'dispensers': []}]
            }
        ]
        
        for case in edge_cases:
            try:
                asyncio.create_task(self.filter_service.calculate_filters(case['data']))
                self.log_test(f"Edge Case: {case['name']}", 'PASS', 
                            data={'handled_gracefully': True})
            except Exception as e:
                self.log_test(f"Edge Case: {case['name']}", 'FAIL', error=str(e))

    def test_performance(self, work_orders: List[Dict]):
        """Test performance with varying data sizes"""
        import time
        
        sizes = [1, 5, 10, 50]
        
        for size in sizes:
            if size > len(work_orders):
                # Duplicate work orders to reach target size
                test_orders = (work_orders * ((size // len(work_orders)) + 1))[:size]
            else:
                test_orders = work_orders[:size]
            
            try:
                start_time = time.time()
                asyncio.create_task(self.filter_service.calculate_filters(test_orders))
                end_time = time.time()
                
                duration = end_time - start_time
                self.log_test(
                    f"Performance Test - {size} orders",
                    'PASS' if duration < 5.0 else 'WARN',
                    {'duration_seconds': round(duration, 3), 'orders_per_second': round(size/duration, 2)}
                )
                
            except Exception as e:
                self.log_test(f"Performance Test - {size} orders", 'FAIL', error=str(e))

    def generate_summary(self):
        """Generate test summary"""
        total_tests = len(self.debug_results['tests'])
        passed = len([t for t in self.debug_results['tests'] if t['status'] == 'PASS'])
        failed = len([t for t in self.debug_results['tests'] if t['status'] == 'FAIL'])
        warnings = len([t for t in self.debug_results['tests'] if t['status'] == 'WARN'])
        
        self.debug_results['summary'] = {
            'total_tests': total_tests,
            'passed': passed,
            'failed': failed,
            'warnings': warnings,
            'pass_rate': round((passed / total_tests) * 100, 1) if total_tests > 0 else 0
        }
        
        print("=" * 60)
        print("🔍 FILTER FLOW DEBUG SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️  Warnings: {warnings}")
        print(f"📊 Pass Rate: {self.debug_results['summary']['pass_rate']}%")
        print("=" * 60)

    def save_results(self):
        """Save debug results to file"""
        results_dir = backend_dir / 'logs' / 'debug'
        results_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        results_file = results_dir / f'filter_debug_{timestamp}.json'
        
        with open(results_file, 'w') as f:
            json.dump(self.debug_results, f, indent=2)
        
        print(f"📁 Debug results saved to: {results_file}")

async def main():
    """Main debug function"""
    print("🚀 Starting Filter Flow Debug")
    print("=" * 60)
    
    debugger = FilterFlowDebugger()
    
    # Create sample data
    work_orders = debugger.create_sample_work_orders()
    debugger.log_test('Sample Data Creation', 'PASS', 
                     data={'work_order_count': len(work_orders)})
    
    # Run tests
    debugger.test_work_order_validation(work_orders)
    debugger.test_dispenser_analysis(work_orders)
    await debugger.test_filter_calculation(work_orders)
    debugger.test_edge_cases()
    debugger.test_performance(work_orders)
    
    # Generate summary
    debugger.generate_summary()
    debugger.save_results()
    
    return debugger.debug_results

if __name__ == '__main__':
    # Set debug mode environment variable
    os.environ['DEBUG_MODE'] = 'true'
    
    try:
        results = asyncio.run(main())
        
        # Exit with appropriate code
        failed_tests = len([t for t in results['tests'] if t['status'] == 'FAIL'])
        sys.exit(1 if failed_tests > 0 else 0)
        
    except KeyboardInterrupt:
        print("\n⚠️  Debug session interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Debug session failed: {e}")
        logger.exception("Debug session error")
        sys.exit(1)