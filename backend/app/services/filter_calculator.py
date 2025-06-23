"""Filter calculation service for determining filter requirements based on work orders and dispensers."""

import re
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from collections import defaultdict

from app.core_models import WorkOrder, Dispenser


class FilterCalculator:
    """Service for calculating filter requirements based on work orders and dispensers."""
    
    # Store chain mappings
    CHAIN_MAPPINGS = {
        '7-Eleven': ['7-eleven', '7-11', 'seven eleven'],
        'Speedway': ['speedway'],
        'Marathon': ['marathon'],
        'Wawa': ['wawa'],
        'Circle K': ['circle k', 'circlek']
    }
    
    # Filter part numbers by chain
    FILTER_CONFIGS = {
        '7-Eleven': {
            'gas': {
                'Electronic': '400MB-10',
                'HD Meter': '400MB-10',
                'Ecometer': '40510A-AD'
            },
            'diesel': '400HS-10',
            'diesel_high_flow': '800HS-30',  # High flow diesel uses 800HS-30
            'def': None  # No filter for DEF
        },
        'Speedway': {
            'gas': {
                'Electronic': '400MB-10',
                'HD Meter': '400MB-10',
                'Ecometer': '40510A-AD'
            },
            'diesel': '400HS-10',
            'diesel_high_flow': '800HS-30',  # High flow diesel uses 800HS-30
            'def': None  # No filter for DEF
        },
        'Marathon': {
            'gas': {
                'Electronic': '400MB-10',
                'HD Meter': '400MB-10',
                'Ecometer': '40510A-AD'
            },
            'diesel': '400HS-10',
            'diesel_high_flow': '800HS-30',  # High flow diesel uses 800HS-30
            'def': None  # No filter for DEF
        },
        'Wawa': {
            'gas': {
                'Electronic': '450MB-10',
                'HD Meter': '450MB-10',
                'Ecometer': '450MB-10'
            },
            'diesel': '450MG-10'
        },
        'Circle K': {
            'gas': {
                'Electronic': '40510D-AD',
                'HD Meter': '40510D-AD',
                'Ecometer': '40510D-AD'
            },
            'diesel': '40530W-AD',
            'diesel_high_flow': None,  # No filter for high flow
            'def': None  # No filter for DEF
        }
    }
    
    # Fuel grade rules
    ALWAYS_FILTER = [
        'regular', 'diesel', 'super', 'ultra', 'supreme',
        'ethanol-free', 'e-85', 'kerosene', 'def'
    ]
    
    NEVER_FILTER = ['plus', 'midgrade', 'mid-grade', 'mid grade']
    
    # Box sizes
    STANDARD_BOX_SIZE = 12
    DEF_BOX_SIZE = 6
    
    # Service codes
    SPECIAL_CODES = {
        '2861': {'name': 'AccuMeasure - All Dispensers', 'requires_filters': True, 'parse_instructions': False},
        '2862': {'name': 'AccuMeasure - Specific Dispensers', 'requires_filters': True, 'parse_instructions': True},
        '3002': {'name': 'AccuMeasure - All Dispensers', 'requires_filters': True, 'parse_instructions': False},
        '3146': {'name': 'Open Neck Prover', 'requires_filters': True, 'parse_instructions': False}
    }
    
    def __init__(self):
        self.warnings = []
        self.filter_details = []
        self.filter_summary = defaultdict(lambda: {'quantity': 0, 'stores': set()})
        
    def calculate_filters(
        self,
        work_orders: List[Dict[str, Any]],
        dispensers: List[Dict[str, Any]],
        overrides: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """Calculate filter requirements for given work orders and dispensers."""
        self.warnings = []
        self.filter_details = []
        self.filter_summary = defaultdict(lambda: {'quantity': 0, 'stores': set()})
        
        # Group dispensers by store
        dispensers_by_store = self._group_dispensers_by_store(dispensers)
        
        # Process each work order
        for work_order in work_orders:
            self._process_work_order(work_order, dispensers_by_store, overrides or {})
        
        # Generate summary
        summary = self._generate_summary()
        
        return {
            'summary': summary,
            'details': self.filter_details,
            'warnings': self.warnings,
            'totalFilters': sum(item['quantity'] for item in summary),
            'totalBoxes': sum(item['boxes'] for item in summary),
            'metadata': {
                'calculatedAt': datetime.utcnow().isoformat(),
                'jobCount': len(work_orders),
                'storeCount': len(set(wo['storeNumber'] for wo in work_orders))
            }
        }
    
    def _group_dispensers_by_store(self, dispensers: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
        """Group dispensers by store number."""
        grouped = defaultdict(list)
        for dispenser in dispensers:
            grouped[dispenser['storeNumber']].append(dispenser)
        return dict(grouped)
    
    def _process_work_order(
        self,
        work_order: Dict[str, Any],
        dispensers_by_store: Dict[str, List[Dict]],
        overrides: Dict[str, int]
    ):
        """Process a single work order."""
        job_id = work_order['jobId']
        store_number = work_order['storeNumber']
        service_code = work_order['serviceCode']
        
        # Check if this service requires filters
        requires_filters = True
        if service_code in self.SPECIAL_CODES:
            requires_filters = self.SPECIAL_CODES[service_code]['requires_filters']
        
        # Check for multi-day job
        if work_order.get('isMultiDay') and work_order.get('dayNumber', 1) > 1:
            self._add_warning(
                severity=2,
                type='multi_day',
                message=f"Multi-day job {job_id} - Day {work_order.get('dayNumber')}. Filters counted on Day 1 only.",
                affected_jobs=[job_id]
            )
            return
        
        # Get store dispensers
        store_dispensers = dispensers_by_store.get(store_number, [])
        
        # Determine chain
        chain = self._get_store_chain(work_order['customerName'])
        
        # Filter dispensers if specific ones are mentioned
        if service_code == '2862' and work_order.get('instructions'):
            dispenser_refs = self._parse_dispenser_references(work_order['instructions'])
            if dispenser_refs:
                store_dispensers = [d for d in store_dispensers if d['dispenserNumber'] in dispenser_refs]
        
        # Calculate filters for each dispenser
        job_filters = {}
        job_warnings = []
        
        # Only calculate filters if this service requires them
        if requires_filters and store_dispensers:
            for dispenser in store_dispensers:
                dispenser_filters = self._calculate_dispenser_filters(dispenser, chain, job_id)
                for part_number, quantity in dispenser_filters.items():
                    if part_number not in job_filters:
                        job_filters[part_number] = 0
                    job_filters[part_number] += quantity
        elif requires_filters and not store_dispensers:
            # Add warning if filters are required but no dispensers found
            self._add_warning(
                severity=6,
                type='missing_data',
                message=f"No dispenser data found for store {store_number}",
                affected_jobs=[job_id],
                suggestions=["Scrape dispenser data for this store", "Check if store number is correct"]
            )
        
        # Apply overrides
        for part_number in job_filters:
            override_key = f"{job_id}-{part_number}"
            if override_key in overrides:
                job_filters[part_number] = overrides[override_key]
        
        # Create filter detail - include ALL jobs, even those that don't require filters
        filter_detail = {
            'jobId': job_id,
            'storeNumber': store_number,
            'storeName': work_order.get('storeName', ''),
            'scheduledDate': work_order['scheduledDate'],
            'customerName': work_order['customerName'],
            'serviceCode': service_code,
            'serviceName': work_order.get('serviceName', ''),
            'address': work_order.get('address', ''),
            'filters': {},
            'warnings': job_warnings,
            'dispenserCount': len(store_dispensers),
            'dispensers': store_dispensers,
            'requiresFilters': requires_filters
        }
        
        # Add filter details if any filters are needed
        for part_number, quantity in job_filters.items():
            filter_detail['filters'][part_number] = {
                'quantity': quantity,
                'description': self._get_filter_description(part_number, chain),
                'filterType': self._get_filter_type(part_number),
                'isEdited': f"{job_id}-{part_number}" in overrides
            }
            
            # Update summary
            self.filter_summary[part_number]['quantity'] += quantity
            self.filter_summary[part_number]['stores'].add(store_number)
        
        
        self.filter_details.append(filter_detail)
    
    def _calculate_dispenser_filters(self, dispenser: Dict[str, Any], chain: str, job_id: str) -> Dict[str, int]:
        """Calculate filters needed for a single dispenser."""
        filters = {}
        fuel_grades = dispenser.get('fuelGrades', [])
        meter_type = dispenser.get('meterType', 'Electronic')
        
        # Get all grade names
        grade_names = [grade['grade'] for grade in fuel_grades]
        
        for fuel_grade in fuel_grades:
            grade = fuel_grade['grade'].lower()
            
            if self._should_filter_grade(grade, grade_names, job_id):
                filter_type = self._determine_filter_type(grade)
                part_number = self._get_part_number(chain, filter_type, meter_type)
                
                if part_number:
                    if part_number not in filters:
                        filters[part_number] = 0
                    filters[part_number] += 1
                else:
                    # Add warning for fuel types that don't require filters but should be noted
                    if filter_type == 'def' and chain in ['7-Eleven', 'Speedway', 'Marathon', 'Circle K']:
                        self._add_warning(
                            severity=2,
                            type='info',
                            message=f"DEF present at {chain} - no filter required",
                            affected_jobs=[job_id],
                            suggestions=["DEF does not require filters for this chain"]
                        )
                    elif filter_type == 'diesel_high_flow' and chain == 'Circle K':
                        self._add_warning(
                            severity=2,
                            type='info',
                            message=f"High Flow Diesel present at {chain} - no filter required",
                            affected_jobs=[job_id],
                            suggestions=["High Flow Diesel does not require filters for Circle K"]
                        )
        
        return filters
    
    def _should_filter_grade(self, grade: str, all_grades: List[str], job_id: str) -> bool:
        """Determine if a fuel grade should get a filter."""
        grade_lower = grade.lower()
        
        # Check always filter list
        if any(always in grade_lower for always in self.ALWAYS_FILTER):
            return True
        
        # Check never filter list
        if any(never in grade_lower for never in self.NEVER_FILTER):
            return False
        
        # Special case for premium
        if 'premium' in grade_lower:
            # Premium only gets filter if no higher grade exists
            higher_grades = ['super', 'ultra', 'supreme']
            all_grades_lower = [g.lower() for g in all_grades]
            return not any(higher in g for higher in higher_grades for g in all_grades_lower)
        
        # Unknown grade - filter it but add warning
        self._add_warning(
            severity=5,
            type='unknown_grade',
            message=f"Unknown fuel grade: {grade}",
            affected_jobs=[job_id],
            suggestions=["Review fuel grade configuration", "Update filter rules if needed"]
        )
        
        return True
    
    def _determine_filter_type(self, grade: str) -> str:
        """Determine filter type based on fuel grade."""
        grade_lower = grade.lower()
        
        if 'def' in grade_lower:
            return 'def'
        elif 'diesel' in grade_lower:
            # Check if it's high flow diesel
            if any(term in grade_lower for term in ['high flow', 'hi flow', 'hi-flow', 'high-flow']):
                return 'diesel_high_flow'
            return 'diesel'
        else:
            return 'gas'
    
    def _get_part_number(self, chain: str, filter_type: str, meter_type: str) -> Optional[str]:
        """Get part number for given chain, filter type, and meter type."""
        chain_config = self.FILTER_CONFIGS.get(chain, self.FILTER_CONFIGS['7-Eleven'])
        
        if filter_type == 'gas':
            gas_filters = chain_config.get('gas', {})
            return gas_filters.get(meter_type, gas_filters.get('Electronic'))
        elif filter_type == 'diesel':
            return chain_config.get('diesel')
        elif filter_type == 'diesel_high_flow':
            return chain_config.get('diesel_high_flow')
        elif filter_type == 'def':
            return chain_config.get('def')
        
        return None
    
    def _get_store_chain(self, customer_name: str) -> str:
        """Determine store chain from customer name."""
        customer_lower = customer_name.lower()
        
        for chain, variations in self.CHAIN_MAPPINGS.items():
            if any(variation in customer_lower for variation in variations):
                return chain
        
        return '7-Eleven'  # Default
    
    def _parse_dispenser_references(self, instructions: str) -> List[str]:
        """Parse dispenser references from instructions."""
        if not instructions:
            return []
        
        dispenser_refs = []
        
        # Match patterns like "Dispenser 1", "Disp #2", "Dispensers 1-3", etc.
        patterns = [
            r'dispenser\s*#?\s*(\d+)',
            r'disp\s*#?\s*(\d+)',
            r'pump\s*#?\s*(\d+)',
            r'dispensers?\s*(\d+)\s*-\s*(\d+)',
            r'dispensers?\s*(\d+)\s*,\s*(\d+)'
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, instructions, re.IGNORECASE)
            for match in matches:
                if len(match.groups()) == 2:
                    # Range pattern
                    start = int(match.group(1))
                    end = int(match.group(2))
                    dispenser_refs.extend(str(i) for i in range(start, end + 1))
                else:
                    # Single dispenser
                    dispenser_refs.append(match.group(1))
        
        return list(set(dispenser_refs))  # Remove duplicates
    
    def _get_filter_description(self, part_number: str, chain: str) -> str:
        """Get description for a filter part number."""
        descriptions = {
            '400MB-10': f'{chain} Gas Filter',
            '40510A-AD': f'{chain} Gas Filter (Ecometer)',
            '400HS-10': f'{chain} Diesel Filter',
            '800HS-30': f'{chain} High Flow Diesel Filter',  # Now used for high flow diesel
            '450MB-10': 'Wawa Gas Filter',
            '450MG-10': 'Wawa Diesel Filter',
            '40510D-AD': 'Circle K Gas Filter',
            '40530W-AD': 'Circle K Diesel Filter'
        }
        
        return descriptions.get(part_number, f'{chain} Filter')
    
    def _get_filter_type(self, part_number: str) -> str:
        """Determine filter type from part number."""
        if part_number in ['400MB-10', '40510A-AD', '450MB-10', '40510D-AD']:
            return 'gas'
        elif part_number in ['400HS-10', '450MG-10', '40530W-AD']:
            return 'diesel'
        elif part_number == '800HS-30':
            return 'diesel'  # High flow diesel filter
        else:
            return 'other'
    
    def _add_warning(
        self,
        severity: int,
        type: str,
        message: str,
        affected_jobs: Optional[List[str]] = None,
        suggestions: Optional[List[str]] = None
    ):
        """Add a warning to the list."""
        warning = {
            'id': f"warn_{len(self.warnings) + 1}",
            'severity': severity,
            'type': type,
            'message': message,
            'affectedJobs': affected_jobs or [],
            'suggestions': suggestions,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.warnings.append(warning)
    
    def _generate_summary(self) -> List[Dict[str, Any]]:
        """Generate filter summary with box calculations."""
        summary = []
        
        for part_number, data in self.filter_summary.items():
            filter_type = self._get_filter_type(part_number)
            box_size = self.DEF_BOX_SIZE if filter_type == 'def' else self.STANDARD_BOX_SIZE
            
            summary_item = {
                'partNumber': part_number,
                'description': self._get_filter_description(part_number, ''),
                'quantity': data['quantity'],
                'boxes': (data['quantity'] + box_size - 1) // box_size,  # Round up
                'storeCount': len(data['stores']),
                'filterType': filter_type
            }
            summary.append(summary_item)
        
        # Sort by quantity descending
        summary.sort(key=lambda x: x['quantity'], reverse=True)
        
        return summary