"""Filter calculation service for determining filter requirements based on work orders and dispensers."""

import logging
import re
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from collections import defaultdict

from app.core_models import WorkOrder, Dispenser

logger = logging.getLogger(__name__)


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
        logger.info(f"[FILTER_CALC_SERVICE] Starting filter calculation")
        logger.info(f"[FILTER_CALC_SERVICE] Input: {len(work_orders)} work orders, {len(dispensers)} dispensers")
        logger.debug(f"[FILTER_CALC_SERVICE] Overrides: {overrides}")
        
        # Validate inputs
        if not work_orders:
            logger.warning("[FILTER_CALC_SERVICE] No work orders provided - returning empty result")
            return {
                'summary': [],
                'details': [],
                'warnings': [{'message': 'No work orders provided', 'severity': 5, 'type': 'validation'}],
                'totalFilters': 0,
                'totalBoxes': 0,
                'metadata': {
                    'calculatedAt': datetime.utcnow().isoformat(),
                    'jobCount': 0,
                    'storeCount': 0
                }
            }
        
        self.warnings = []
        self.filter_details = []
        self.filter_summary = defaultdict(lambda: {'quantity': 0, 'stores': set()})
        
        # Log work order validation
        logger.info("[FILTER_CALC_SERVICE] Validating work order data...")
        required_fields = ['jobId', 'storeNumber', 'serviceCode', 'customerName']
        valid_work_orders = []
        
        for i, wo in enumerate(work_orders):
            missing_fields = [field for field in required_fields if not wo.get(field)]
            if missing_fields:
                logger.warning(f"[FILTER_CALC_SERVICE] Work order {i} missing fields: {missing_fields}")
                logger.debug(f"[FILTER_CALC_SERVICE] Invalid work order data: {wo}")
            else:
                valid_work_orders.append(wo)
        
        logger.info(f"[FILTER_CALC_SERVICE] Valid work orders: {len(valid_work_orders)}/{len(work_orders)}")
        
        # Group dispensers by store
        logger.info("[FILTER_CALC_SERVICE] Grouping dispensers by store...")
        dispensers_by_store = self._group_dispensers_by_store(dispensers)
        logger.info(f"[FILTER_CALC_SERVICE] Dispensers grouped for {len(dispensers_by_store)} stores")
        
        for store_num, store_dispensers in dispensers_by_store.items():
            logger.debug(f"[FILTER_CALC_SERVICE] Store {store_num}: {len(store_dispensers)} dispensers")
        
        # Process each work order
        logger.info("[FILTER_CALC_SERVICE] Processing work orders...")
        for i, work_order in enumerate(valid_work_orders):
            logger.debug(f"[FILTER_CALC_SERVICE] Processing work order {i+1}/{len(valid_work_orders)}: {work_order.get('jobId')}")
            self._process_work_order(work_order, dispensers_by_store, overrides or {})
        
        # Generate summary
        logger.info("[FILTER_CALC_SERVICE] Generating summary...")
        summary = self._generate_summary()
        
        result = {
            'summary': summary,
            'details': self.filter_details,
            'warnings': self.warnings,
            'totalFilters': sum(item['quantity'] for item in summary),
            'totalBoxes': sum(item['boxes'] for item in summary),
            'metadata': {
                'calculatedAt': datetime.utcnow().isoformat(),
                'jobCount': len(valid_work_orders),
                'storeCount': len(set(wo['storeNumber'] for wo in valid_work_orders))
            }
        }
        
        logger.info(f"[FILTER_CALC_SERVICE] Calculation completed")
        logger.info(f"[FILTER_CALC_SERVICE] Final results: {result['totalFilters']} filters, {result['totalBoxes']} boxes")
        logger.info(f"[FILTER_CALC_SERVICE] Generated {len(summary)} summary items and {len(self.filter_details)} detail items")
        
        return result
    
    def _group_dispensers_by_store(self, dispensers: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
        """Group dispensers by store number."""
        logger.debug(f"[FILTER_CALC_SERVICE] Grouping {len(dispensers)} dispensers by store")
        
        grouped = defaultdict(list)
        dispenser_count = 0
        
        for dispenser in dispensers:
            store_number = dispenser.get('storeNumber')
            if store_number:
                grouped[store_number].append(dispenser)
                dispenser_count += 1
                logger.debug(f"[FILTER_CALC_SERVICE] Added dispenser {dispenser.get('dispenserNumber')} to store '{store_number}'")
            else:
                logger.warning(f"[FILTER_CALC_SERVICE] Dispenser missing storeNumber: {dispenser}")
        
        result = dict(grouped)
        logger.debug(f"[FILTER_CALC_SERVICE] Grouped {dispenser_count} dispensers into {len(result)} stores")
        logger.debug(f"[FILTER_CALC_SERVICE] Store keys: {list(result.keys())}")
        
        return result
    
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
        customer_name = work_order['customerName']
        
        logger.debug(f"[FILTER_CALC_SERVICE] Processing job {job_id}, store {store_number}, service {service_code}")
        
        # Check if this service requires filters
        requires_filters = True
        if service_code in self.SPECIAL_CODES:
            requires_filters = self.SPECIAL_CODES[service_code]['requires_filters']
            logger.debug(f"[FILTER_CALC_SERVICE] Service {service_code} requires filters: {requires_filters}")
        else:
            logger.warning(f"[FILTER_CALC_SERVICE] Unknown service code {service_code} for job {job_id}")
        
        # Check for multi-day job
        if work_order.get('isMultiDay') and work_order.get('dayNumber', 1) > 1:
            logger.info(f"[FILTER_CALC_SERVICE] Skipping multi-day job {job_id} day {work_order.get('dayNumber')}")
            self._add_warning(
                severity=2,
                type='multi_day',
                message=f"Multi-day job {job_id} - Day {work_order.get('dayNumber')}. Filters counted on Day 1 only.",
                affected_jobs=[job_id]
            )
            return
        
        # Get store dispensers - handle store number formats
        store_dispensers = dispensers_by_store.get(store_number, [])
        
        # If no match, try cleaning the store number (remove # prefix)
        if not store_dispensers and store_number and store_number.startswith('#'):
            clean_store_number = store_number[1:]  # Remove # prefix
            store_dispensers = dispensers_by_store.get(clean_store_number, [])
            if store_dispensers:
                logger.debug(f"[FILTER_CALC_SERVICE] Found dispensers using cleaned store number: {store_number} -> {clean_store_number}")
        
        # If still no match, try adding # prefix
        if not store_dispensers and store_number and not store_number.startswith('#'):
            prefixed_store_number = f"#{store_number}"
            store_dispensers = dispensers_by_store.get(prefixed_store_number, [])
            if store_dispensers:
                logger.debug(f"[FILTER_CALC_SERVICE] Found dispensers using prefixed store number: {store_number} -> {prefixed_store_number}")
        
        logger.debug(f"[FILTER_CALC_SERVICE] Found {len(store_dispensers)} dispensers for store {store_number}")
        
        # Determine chain
        chain = self._get_store_chain(customer_name)
        logger.debug(f"[FILTER_CALC_SERVICE] Determined chain: {chain} from customer: {customer_name}")
        
        # Filter dispensers if specific ones are mentioned
        original_dispenser_count = len(store_dispensers)
        if service_code == '2862' and work_order.get('instructions'):
            dispenser_refs = self._parse_dispenser_references(work_order['instructions'])
            logger.debug(f"[FILTER_CALC_SERVICE] Parsed dispenser references: {dispenser_refs}")
            if dispenser_refs:
                store_dispensers = [d for d in store_dispensers if d['dispenserNumber'] in dispenser_refs]
                logger.info(f"[FILTER_CALC_SERVICE] Filtered dispensers from {original_dispenser_count} to {len(store_dispensers)} based on instructions")
        
        # Calculate filters for each dispenser
        job_filters = {}
        job_warnings = []
        
        # Only calculate filters if this service requires them
        if requires_filters and store_dispensers:
            logger.debug(f"[FILTER_CALC_SERVICE] Calculating filters for {len(store_dispensers)} dispensers")
            for i, dispenser in enumerate(store_dispensers):
                logger.debug(f"[FILTER_CALC_SERVICE] Processing dispenser {i+1}/{len(store_dispensers)}: {dispenser.get('dispenserNumber')}")
                dispenser_filters = self._calculate_dispenser_filters(dispenser, chain, job_id)
                logger.debug(f"[FILTER_CALC_SERVICE] Dispenser {dispenser.get('dispenserNumber')} needs filters: {dispenser_filters}")
                
                for part_number, quantity in dispenser_filters.items():
                    if part_number not in job_filters:
                        job_filters[part_number] = 0
                    job_filters[part_number] += quantity
                    
            logger.info(f"[FILTER_CALC_SERVICE] Job {job_id} total filters: {job_filters}")
            
        elif requires_filters and not store_dispensers:
            # Add warning if filters are required but no dispensers found
            logger.warning(f"[FILTER_CALC_SERVICE] No dispenser data found for store {store_number} (job {job_id})")
            self._add_warning(
                severity=6,
                type='missing_data',
                message=f"No dispenser data found for store {store_number}",
                affected_jobs=[job_id],
                suggestions=["Scrape dispenser data for this store", "Check if store number is correct"]
            )
        elif not requires_filters:
            logger.debug(f"[FILTER_CALC_SERVICE] Job {job_id} service {service_code} does not require filters")
        
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
        dispenser_number = dispenser.get('dispenserNumber', 'Unknown')
        fuel_grades_raw = dispenser.get('fuelGrades', [])
        meter_type = dispenser.get('meterType', 'Electronic')
        
        logger.debug(f"[FILTER_CALC_SERVICE] Calculating filters for dispenser {dispenser_number}")
        logger.debug(f"[FILTER_CALC_SERVICE] Raw fuel grades: {fuel_grades_raw} (type: {type(fuel_grades_raw)})")
        
        # Transform fuel grades to expected format if needed
        fuel_grades = self._transform_fuel_grades(fuel_grades_raw)
        
        logger.debug(f"[FILTER_CALC_SERVICE] Transformed fuel grades: {fuel_grades}")
        logger.debug(f"[FILTER_CALC_SERVICE] Dispenser has {len(fuel_grades)} fuel grades, meter type: {meter_type}")
        
        filters = {}
        
        # Get all grade names
        grade_names = [grade['grade'] for grade in fuel_grades]
        logger.debug(f"[FILTER_CALC_SERVICE] Fuel grades: {grade_names}")
        
        for i, fuel_grade in enumerate(fuel_grades):
            grade = fuel_grade['grade'].lower()
            logger.debug(f"[FILTER_CALC_SERVICE] Processing fuel grade {i+1}/{len(fuel_grades)}: {grade}")
            
            if self._should_filter_grade(grade, grade_names, job_id):
                filter_type = self._determine_filter_type(grade)
                part_number = self._get_part_number(chain, filter_type, meter_type)
                
                logger.debug(f"[FILTER_CALC_SERVICE] Grade '{grade}' -> type '{filter_type}' -> part '{part_number}'")
                
                if part_number:
                    if part_number not in filters:
                        filters[part_number] = 0
                    filters[part_number] += 1
                    logger.debug(f"[FILTER_CALC_SERVICE] Added filter {part_number} (now {filters[part_number]})")
                else:
                    logger.debug(f"[FILTER_CALC_SERVICE] No filter required for {filter_type} at {chain}")
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
            else:
                logger.debug(f"[FILTER_CALC_SERVICE] Grade '{grade}' should not be filtered")
        
        logger.debug(f"[FILTER_CALC_SERVICE] Dispenser {dispenser_number} final filters: {filters}")
        return filters
    
    def _should_filter_grade(self, grade: str, all_grades: List[str], job_id: str) -> bool:
        """Determine if a fuel grade should get a filter."""
        grade_lower = grade.lower()
        
        logger.debug(f"[FILTER_CALC_SERVICE] Checking if grade '{grade}' should be filtered")
        
        # Check always filter list
        if any(always in grade_lower for always in self.ALWAYS_FILTER):
            logger.debug(f"[FILTER_CALC_SERVICE] Grade '{grade}' matches always filter rule")
            return True
        
        # Check never filter list
        if any(never in grade_lower for never in self.NEVER_FILTER):
            logger.debug(f"[FILTER_CALC_SERVICE] Grade '{grade}' matches never filter rule")
            return False
        
        # Special case for premium
        if 'premium' in grade_lower:
            # Premium only gets filter if no higher grade exists
            higher_grades = ['super', 'ultra', 'supreme']
            all_grades_lower = [g.lower() for g in all_grades]
            has_higher_grade = any(higher in g for higher in higher_grades for g in all_grades_lower)
            logger.debug(f"[FILTER_CALC_SERVICE] Premium grade - has higher grade: {has_higher_grade}")
            return not has_higher_grade
        
        # Unknown grade - filter it but add warning
        logger.warning(f"[FILTER_CALC_SERVICE] Unknown fuel grade '{grade}' for job {job_id} - will filter by default")
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
        logger.debug(f"[FILTER_CALC_SERVICE] Generating summary from {len(self.filter_summary)} part numbers")
        
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
            
            logger.debug(f"[FILTER_CALC_SERVICE] Summary item: {part_number} - {data['quantity']} units, {summary_item['boxes']} boxes, {len(data['stores'])} stores")
        
        # Sort by quantity descending
        summary.sort(key=lambda x: x['quantity'], reverse=True)
        
        logger.info(f"[FILTER_CALC_SERVICE] Generated summary with {len(summary)} items, total filters: {sum(item['quantity'] for item in summary)}")
        
        return summary
    
    def _transform_fuel_grades(self, fuel_grades_raw: Any) -> List[Dict[str, str]]:
        """
        Transform fuel grades from database format to filter calculator format.
        
        Handles various input formats:
        - Dict format: {"regular": {"name": "Regular"}, "plus": {"name": "Plus"}}
        - List format: [{"grade": "Regular"}, {"grade": "Plus"}] (already correct)
        - None/empty: returns empty list
        """
        if fuel_grades_raw is None:
            logger.debug("[FILTER_CALC_SERVICE] fuel_grades is None, returning empty list")
            return []
        
        if isinstance(fuel_grades_raw, list):
            # Already in list format, check if it's correctly structured
            if not fuel_grades_raw:
                logger.debug("[FILTER_CALC_SERVICE] fuel_grades is empty list")
                return []
            
            # Check if first item has 'grade' key (expected format)
            if isinstance(fuel_grades_raw[0], dict) and 'grade' in fuel_grades_raw[0]:
                logger.debug("[FILTER_CALC_SERVICE] fuel_grades already in correct format")
                return fuel_grades_raw
            
            # If list but wrong structure, log warning and try to convert
            logger.warning(f"[FILTER_CALC_SERVICE] Unexpected list structure: {fuel_grades_raw}")
            return []
        
        if isinstance(fuel_grades_raw, dict):
            logger.debug("[FILTER_CALC_SERVICE] Converting dict format to list format")
            transformed = []
            
            for fuel_type, fuel_data in fuel_grades_raw.items():
                if isinstance(fuel_data, dict) and 'name' in fuel_data:
                    # Standard format: {"regular": {"name": "Regular"}}
                    transformed.append({"grade": fuel_data['name']})
                    logger.debug(f"[FILTER_CALC_SERVICE] Converted {fuel_type} -> {fuel_data['name']}")
                else:
                    # Fallback: use the key as grade name
                    grade_name = fuel_type.replace('_', ' ').title()
                    transformed.append({"grade": grade_name})
                    logger.debug(f"[FILTER_CALC_SERVICE] Fallback conversion {fuel_type} -> {grade_name}")
            
            logger.info(f"[FILTER_CALC_SERVICE] Transformed {len(fuel_grades_raw)} dict entries to {len(transformed)} grade entries")
            return transformed
        
        if isinstance(fuel_grades_raw, str):
            # Try to parse as JSON
            import json
            try:
                parsed = json.loads(fuel_grades_raw)
                logger.debug("[FILTER_CALC_SERVICE] Parsed JSON string, recursing")
                return self._transform_fuel_grades(parsed)
            except json.JSONDecodeError:
                logger.warning(f"[FILTER_CALC_SERVICE] Failed to parse fuel_grades JSON string: {fuel_grades_raw}")
                return []
        
        logger.warning(f"[FILTER_CALC_SERVICE] Unknown fuel_grades type: {type(fuel_grades_raw)}, value: {fuel_grades_raw}")
        return []