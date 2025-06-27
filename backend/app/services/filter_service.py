#!/usr/bin/env python3
"""
Filter Service
Simplified interface for filter calculations and debugging
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .filter_calculation import FilterCalculationService

logger = logging.getLogger(__name__)

class FilterService:
    """Simplified filter service for debugging and testing"""
    
    def __init__(self):
        self.filter_calc_service = FilterCalculationService()
    
    async def calculate_filters(self, work_orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate filters for work orders
        Returns a standardized response format
        """
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
            
            # Process work orders and calculate filters
            filter_summary = {}
            processed_orders = []
            
            for order in work_orders:
                try:
                    processed_order = self._process_work_order(order)
                    processed_orders.append(processed_order)
                    
                    # Add filters to summary
                    order_filters = self._calculate_order_filters(processed_order)
                    for filter_type, quantity in order_filters.items():
                        filter_summary[filter_type] = filter_summary.get(filter_type, 0) + quantity
                        
                except Exception as e:
                    logger.warning(f"Failed to process work order {order.get('workOrderId', 'unknown')}: {e}")
                    continue
            
            # Convert summary to filter list
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
                    'lastCalculated': datetime.now().isoformat(),
                    'processedOrders': processed_orders
                }
            }
            
        except Exception as e:
            logger.error(f"Filter calculation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'data': {
                    'filters': [],
                    'totalWorkOrders': 0,
                    'lastCalculated': datetime.now().isoformat()
                }
            }
    
    def _process_work_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate a work order"""
        processed = {
            'workOrderId': order.get('workOrderId', order.get('id', 'unknown')),
            'serviceCode': order.get('serviceCode', ''),
            'serviceName': order.get('serviceName', ''),
            'customerName': order.get('customerName', ''),
            'address': order.get('address', ''),
            'dispensers': order.get('dispensers', []),
            'dispenserCount': len(order.get('dispensers', []))
        }
        
        return processed
    
    def _calculate_order_filters(self, order: Dict[str, Any]) -> Dict[str, int]:
        """Calculate filters needed for a single work order"""
        filters = {}
        service_code = order.get('serviceCode', '')
        dispensers = order.get('dispensers', [])
        
        # AccuMeasure services (2861, 2862, 3002)
        if service_code in ['2861', '2862', '3002']:
            dispenser_count = len(dispensers)
            
            # Standard filters - one per dispenser
            filters['Regular Filter'] = dispenser_count
            
            # DEF filters - approximately half the dispensers
            filters['DEF Filter'] = max(1, dispenser_count // 2)
            
            # Product-specific filters
            for dispenser in dispensers:
                product = dispenser.get('product', '').lower()
                
                if 'diesel' in product:
                    filters['Diesel Filter'] = filters.get('Diesel Filter', 0) + 1
                
                if 'e85' in product or 'ethanol' in product:
                    filters['E85 Filter'] = filters.get('E85 Filter', 0) + 1
                
                if 'premium' in product or 'plus' in product:
                    filters['Premium Filter'] = filters.get('Premium Filter', 0) + 1
        
        # Open Neck Prover (3146)
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
            'Premium Filter': 'PRM-005',
            'Special Filter': 'SP-006'
        }
        return part_numbers.get(filter_type, 'UNKNOWN')
    
    def validate_work_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a single work order for filter calculation"""
        errors = []
        warnings = []
        
        # Required fields
        if not order.get('workOrderId') and not order.get('id'):
            errors.append('Missing work order ID')
        
        if not order.get('serviceCode'):
            errors.append('Missing service code')
        elif order['serviceCode'] not in ['2861', '2862', '3002', '3146']:
            warnings.append(f"Unknown service code: {order['serviceCode']}")
        
        # AccuMeasure services should have dispensers
        if order.get('serviceCode') in ['2861', '2862', '3002']:
            dispensers = order.get('dispensers', [])
            if not dispensers:
                errors.append('AccuMeasure service missing dispensers')
            elif not isinstance(dispensers, list):
                errors.append('Dispensers must be a list')
            else:
                # Validate each dispenser
                for i, dispenser in enumerate(dispensers):
                    if not dispenser.get('dispenserNumber') and not dispenser.get('dispenser_number'):
                        warnings.append(f"Dispenser {i+1} missing number")
                    if not dispenser.get('product'):
                        warnings.append(f"Dispenser {i+1} missing product")
        
        return {
            'isValid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }