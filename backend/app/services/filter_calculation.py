#!/usr/bin/env python3
"""
Filter Calculation Service

V1-compatible fuel filter calculation system with business logic for
filter requirements, inventory tracking, scheduling, and cost management.

Based on V1's sophisticated filter calculation algorithms that handle:
- Fuel grade to filter mapping
- Station-specific part numbers
- Box quantity calculations
- Multi-day job handling
- Special fuel type detection
"""

import re
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional, Set, Tuple
from dataclasses import dataclass
from enum import Enum
from collections import defaultdict
import logging
from sqlalchemy.orm import Session

from ..services.logging_service import LoggingService
from ..services.user_management import UserManagementService
from ..database import get_db

logger = logging.getLogger(__name__)


class FilterType(Enum):
    """Types of fuel filters"""
    GAS = "gas"
    DIESEL = "diesel"
    DEF = "def"  # Diesel Exhaust Fluid
    HIGH_FLOW = "high_flow"


class FilterSeries(Enum):
    """Filter series groupings"""
    SERIES_450 = "450"  # Wawa filters
    SERIES_400 = "400"  # 7-Eleven/Speedway filters
    SERIES_405 = "405"  # Circle K filters
    PREMIER = "premier"  # Default filters


@dataclass
class FilterRequirement:
    """Filter requirement for a fuel grade"""
    fuel_grade: str
    filter_type: FilterType
    needs_filter: bool
    reason: str
    part_number: Optional[str] = None


@dataclass
class FilterPartNumber:
    """Filter part number with metadata"""
    part_number: str
    filter_type: FilterType
    description: str
    filters_per_box: int = 12
    series: FilterSeries = FilterSeries.PREMIER


@dataclass
class FilterCalculationResult:
    """Result of filter calculation"""
    dispenser_id: str
    station_name: str
    visit_date: date
    filters_needed: List[FilterRequirement]
    part_numbers: Dict[str, FilterPartNumber]
    total_quantities: Dict[str, int]
    boxes_needed: Dict[str, int]
    warnings: List[Dict[str, Any]]
    is_multi_day_continuation: bool = False


class FilterCalculationService:
    """V1-compatible filter calculation service"""
    
    # V1 Business Rules for Filter Requirements (exact preservation)
    ALWAYS_GETS_FILTER = {
        "regular", "unleaded", "87",
        "diesel", "dsl", "ulsd", "b5", "b10", "b20", "biodiesel",
        "ethanol-free", "ethanol free", "e0", "e-0", "non-ethanol", "recreation",
        "super", "super premium", "93", "94",
        "ultra", "ultra 93", "ultra 94",  # but NOT "ultra low"
        "e85", "e-85", "flex fuel",
        "kerosene", "k1", "k-1"
    }
    
    NEVER_GETS_FILTER = {
        "plus", "midgrade", "mid", "89", "88", "special 88",
        "ultra low"  # Special case
    }
    
    PREMIUM_KEYWORDS = {
        "premium", "91", "92", "supreme"
    }
    
    # Station-specific part numbers (V1 business logic)
    STATION_PART_NUMBERS = {
        "7-eleven": {
            FilterType.GAS: {
                "electronic": "400MB-10",
                "hd meter": "400MB-10",
                "ecometer": "40510A-AD",
                "default": "400MB-10"
            },
            FilterType.DIESEL: {
                "electronic": "400HS-10",
                "hd meter": "400HS-10",
                "ecometer": "40510W-AD",
                "default": "400HS-10"
            },
            FilterType.DEF: "800HS-30"
        },
        "speedway": {
            FilterType.GAS: {
                "electronic": "400MB-10",
                "hd meter": "400MB-10",
                "ecometer": "40510A-AD",
                "default": "400MB-10"
            },
            FilterType.DIESEL: {
                "electronic": "400HS-10",
                "hd meter": "400HS-10",
                "ecometer": "40510W-AD",
                "default": "400HS-10"
            },
            FilterType.DEF: "800HS-30"
        },
        "wawa": {
            FilterType.GAS: {"default": "450MB-10"},
            FilterType.DIESEL: {"default": "450MG-10"}
        },
        "circle k": {
            FilterType.GAS: {"default": "40510D-AD"},
            FilterType.DIESEL: {"default": "40530W-AD"}
        },
        "ck": {  # Alias for Circle K
            FilterType.GAS: {"default": "40510D-AD"},
            FilterType.DIESEL: {"default": "40530W-AD"}
        }
    }
    
    # Default part numbers when station not recognized
    DEFAULT_PART_NUMBERS = {
        FilterType.GAS: "PCP-2-1",  # Premier Plus
        FilterType.DIESEL: "PCN-2-1",  # Phase Coalescer
        FilterType.DEF: "800HS-30",
        FilterType.HIGH_FLOW: "800HS-30"
    }
    
    # Part number metadata
    PART_NUMBER_INFO = {
        # 450 Series (Wawa)
        "450MB-10": FilterPartNumber("450MB-10", FilterType.GAS, "Wawa Gas Filter", 12, FilterSeries.SERIES_450),
        "450MG-10": FilterPartNumber("450MG-10", FilterType.DIESEL, "Wawa Diesel Filter", 12, FilterSeries.SERIES_450),
        
        # 400 Series (7-Eleven/Speedway)
        "400MB-10": FilterPartNumber("400MB-10", FilterType.GAS, "400 Series Gas Filter", 12, FilterSeries.SERIES_400),
        "400HS-10": FilterPartNumber("400HS-10", FilterType.DIESEL, "400 Series Diesel Filter", 12, FilterSeries.SERIES_400),
        "800HS-30": FilterPartNumber("800HS-30", FilterType.DEF, "DEF/High Flow Filter", 6, FilterSeries.SERIES_400),  # Special: 6 per box
        
        # 405 Series (Circle K)
        "40510D-AD": FilterPartNumber("40510D-AD", FilterType.GAS, "Circle K Gas Filter", 12, FilterSeries.SERIES_405),
        "40530W-AD": FilterPartNumber("40530W-AD", FilterType.DIESEL, "Circle K Diesel Filter", 12, FilterSeries.SERIES_405),
        "40510A-AD": FilterPartNumber("40510A-AD", FilterType.GAS, "Ecometer Gas Filter", 12, FilterSeries.SERIES_405),
        "40510W-AD": FilterPartNumber("40510W-AD", FilterType.DIESEL, "Ecometer Diesel Filter", 12, FilterSeries.SERIES_405),
        
        # Premier Series (Default)
        "PCP-2-1": FilterPartNumber("PCP-2-1", FilterType.GAS, "Premier Plus Gas", 12, FilterSeries.PREMIER),
        "PCN-2-1": FilterPartNumber("PCN-2-1", FilterType.DIESEL, "Phase Coalescer Diesel", 12, FilterSeries.PREMIER)
    }
    
    def __init__(self, db: Session):
        self.db = db
        self.logging_service = LoggingService(db)
        self.user_service = UserManagementService(db)
    
    async def calculate_filters_for_work_order(
        self,
        work_order_data: Dict[str, Any],
        user_id: str
    ) -> FilterCalculationResult:
        """
        Calculate filter requirements for a work order
        
        Implements V1 business logic for determining filter needs based on
        fuel grades, station type, and dispenser configuration.
        """
        try:
            # Extract basic information
            station_name = work_order_data.get("customer", {}).get("name", "Unknown Station")
            visit_date = self._parse_visit_date(work_order_data.get("visitDate", datetime.now()))
            dispenser_data = work_order_data.get("dispensers", {})
            
            # Check if this is a multi-day continuation
            is_multi_day = self._is_multi_day_continuation(work_order_data)
            
            # Initialize result
            result = FilterCalculationResult(
                dispenser_id=work_order_data.get("id", "unknown"),
                station_name=station_name,
                visit_date=visit_date,
                filters_needed=[],
                part_numbers={},
                total_quantities=defaultdict(int),
                boxes_needed={},
                warnings=[],
                is_multi_day_continuation=is_multi_day
            )
            
            # Skip calculation if multi-day continuation
            if is_multi_day:
                result.warnings.append({
                    "severity": 2,
                    "message": "Multi-day job continuation - filters counted on first day only"
                })
                return result
            
            # Get station type for part number selection
            station_type = self._detect_station_type(station_name)
            
            # Process each dispenser
            for dispenser_num, dispenser_info in dispenser_data.items():
                fuel_grades = dispenser_info.get("fuel_grades", [])
                
                # Calculate filter requirements for each fuel grade
                dispenser_filters = await self._calculate_dispenser_filters(
                    fuel_grades, station_type
                )
                
                result.filters_needed.extend(dispenser_filters)
                
                # Aggregate quantities by part number
                for req in dispenser_filters:
                    if req.needs_filter and req.part_number:
                        result.total_quantities[req.part_number] += 1
            
            # Calculate boxes needed
            for part_number, quantity in result.total_quantities.items():
                part_info = self.PART_NUMBER_INFO.get(part_number)
                if part_info:
                    boxes = self._calculate_boxes(quantity, part_info.filters_per_box)
                    result.boxes_needed[part_number] = boxes
                    result.part_numbers[part_number] = part_info
            
            # Add warnings for special fuel types
            await self._check_special_fuels(result, dispenser_data)
            
            await self.logging_service.log_info(
                f"Filter calculation completed for {station_name}: "
                f"{sum(result.total_quantities.values())} filters needed"
            )
            
            return result
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Filter calculation failed: {str(e)}"
            )
            raise
    
    async def _calculate_dispenser_filters(
        self,
        fuel_grades: List[str],
        station_type: str
    ) -> List[FilterRequirement]:
        """Calculate filter requirements for a dispenser's fuel grades"""
        requirements = []
        
        # V1 Premium logic: Check if Super or Ultra grades exist
        has_super_or_ultra = any(
            self._is_super_or_ultra(grade) for grade in fuel_grades
        )
        
        for grade in fuel_grades:
            grade_lower = grade.lower().strip()
            
            # Determine filter type
            filter_type = self._determine_filter_type(grade_lower)
            
            # Apply V1 business rules
            needs_filter = False
            reason = ""
            
            # Check always gets filter
            if any(keyword in grade_lower for keyword in self.ALWAYS_GETS_FILTER):
                needs_filter = True
                reason = "Standard fuel grade requiring filter"
            
            # Check never gets filter
            elif any(keyword in grade_lower for keyword in self.NEVER_GETS_FILTER):
                needs_filter = False
                reason = "Blended fuel - no filter required"
            
            # Special Premium logic (V1 business rule)
            elif any(keyword in grade_lower for keyword in self.PREMIUM_KEYWORDS):
                if has_super_or_ultra:
                    needs_filter = False
                    reason = "Premium without filter (Super/Ultra present)"
                else:
                    needs_filter = True
                    reason = "Premium with filter (no Super/Ultra)"
            
            # Unknown fuel grade
            else:
                needs_filter = False
                reason = f"Unknown fuel grade: {grade}"
            
            # Get part number if filter needed
            part_number = None
            if needs_filter:
                part_number = self._get_part_number(filter_type, station_type)
            
            requirements.append(FilterRequirement(
                fuel_grade=grade,
                filter_type=filter_type,
                needs_filter=needs_filter,
                reason=reason,
                part_number=part_number
            ))
        
        return requirements
    
    def _determine_filter_type(self, fuel_grade: str) -> FilterType:
        """Determine filter type based on fuel grade"""
        if any(diesel in fuel_grade for diesel in ["diesel", "dsl", "ulsd", "biodiesel"]):
            return FilterType.DIESEL
        elif "def" in fuel_grade:
            return FilterType.DEF
        elif any(hf in fuel_grade for hf in ["high flow", "hi flow", "hf"]):
            return FilterType.HIGH_FLOW
        elif "kerosene" in fuel_grade or "k1" in fuel_grade:
            return FilterType.DIESEL  # Kerosene uses diesel filters
        else:
            return FilterType.GAS
    
    def _is_super_or_ultra(self, fuel_grade: str) -> bool:
        """Check if fuel grade is Super or Ultra (but not Ultra Low)"""
        grade_lower = fuel_grade.lower()
        
        # Check for Ultra (but exclude Ultra Low)
        if "ultra" in grade_lower and "ultra low" not in grade_lower:
            return True
        
        # Check for Super
        if "super" in grade_lower:
            return True
        
        return False
    
    def _detect_station_type(self, station_name: str) -> str:
        """Detect station type from name"""
        name_lower = station_name.lower()
        
        for station_key in self.STATION_PART_NUMBERS:
            if station_key in name_lower:
                return station_key
        
        return "default"
    
    def _get_part_number(
        self,
        filter_type: FilterType,
        station_type: str,
        meter_type: str = "default"
    ) -> str:
        """Get part number based on filter type and station"""
        # Try station-specific part numbers
        if station_type in self.STATION_PART_NUMBERS:
            station_parts = self.STATION_PART_NUMBERS[station_type]
            
            if filter_type in station_parts:
                filter_parts = station_parts[filter_type]
                
                # Handle dict (multiple meter types) vs string (single part)
                if isinstance(filter_parts, dict):
                    return filter_parts.get(meter_type, filter_parts.get("default", ""))
                else:
                    return filter_parts
        
        # Fall back to default part numbers
        return self.DEFAULT_PART_NUMBERS.get(filter_type, "PCP-2-1")
    
    def _calculate_boxes(self, quantity: int, filters_per_box: int) -> int:
        """Calculate number of boxes needed"""
        if quantity == 0:
            return 0
        
        # Use ceiling division
        return (quantity + filters_per_box - 1) // filters_per_box
    
    def _is_multi_day_continuation(self, work_order_data: Dict[str, Any]) -> bool:
        """Check if this is a continuation of a multi-day job"""
        # Check for multi-day flag
        if work_order_data.get("isMultiDayNonFirst", False):
            return True
        
        # Check visit metadata
        visit_meta = work_order_data.get("visitMetadata", {})
        if visit_meta.get("dayNumber", 1) > 1:
            return True
        
        return False
    
    def _parse_visit_date(self, date_input: Any) -> date:
        """Parse visit date from various formats"""
        if isinstance(date_input, date):
            return date_input
        elif isinstance(date_input, datetime):
            return date_input.date()
        elif isinstance(date_input, str):
            try:
                return datetime.fromisoformat(date_input.replace("Z", "+00:00")).date()
            except:
                return date.today()
        else:
            return date.today()
    
    async def _check_special_fuels(
        self,
        result: FilterCalculationResult,
        dispenser_data: Dict[str, Any]
    ):
        """Check for special fuel types and add warnings"""
        all_fuels = []
        for dispenser_info in dispenser_data.values():
            all_fuels.extend(dispenser_info.get("fuel_grades", []))
        
        # Check for DEF
        if any("def" in fuel.lower() for fuel in all_fuels):
            result.warnings.append({
                "severity": 5,
                "message": "DEF (Diesel Exhaust Fluid) detected - special handling required",
                "type": "special_fuel"
            })
        
        # Check for high flow diesel
        if any("high flow" in fuel.lower() or "hi flow" in fuel.lower() for fuel in all_fuels):
            result.warnings.append({
                "severity": 5,
                "message": "High Flow Diesel detected - ensure proper filter selection",
                "type": "special_fuel"
            })
        
        # Check for unknown fuels
        unknown_fuels = []
        for fuel in all_fuels:
            fuel_lower = fuel.lower()
            if not any(known in fuel_lower for known in self.ALWAYS_GETS_FILTER | self.NEVER_GETS_FILTER | self.PREMIUM_KEYWORDS):
                unknown_fuels.append(fuel)
        
        if unknown_fuels:
            result.warnings.append({
                "severity": 8,
                "message": f"Unknown fuel grades detected: {', '.join(unknown_fuels)}",
                "type": "unknown_fuel",
                "fuels": unknown_fuels
            })
    
    async def calculate_weekly_filters(
        self,
        user_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate filter requirements for a user's work week
        
        Aggregates filter needs across all work orders in the specified period.
        """
        try:
            # Get user work week preferences
            work_week_prefs = self.user_service.get_user_preference(user_id, "work_week")
            if not work_week_prefs:
                work_week_prefs = {"start_day": 1, "end_day": 5}  # Mon-Fri default
            
            # Calculate date range if not provided
            if not start_date:
                today = date.today()
                days_since_start = (today.weekday() - work_week_prefs["start_day"]) % 7
                start_date = today - timedelta(days=days_since_start)
            
            if not end_date:
                days_to_end = (work_week_prefs["end_day"] - start_date.weekday()) % 7
                end_date = start_date + timedelta(days=days_to_end)
            
            # Aggregate results
            total_quantities = defaultdict(int)
            total_boxes = defaultdict(int)
            all_warnings = []
            station_summary = defaultdict(lambda: defaultdict(int))
            
            # Get work orders for date range (placeholder - needs integration)
            work_orders = []  # TODO: Get from work order service
            
            for work_order in work_orders:
                result = await self.calculate_filters_for_work_order(work_order, user_id)
                
                # Skip multi-day continuations
                if result.is_multi_day_continuation:
                    continue
                
                # Aggregate quantities
                for part_number, quantity in result.total_quantities.items():
                    total_quantities[part_number] += quantity
                    station_summary[result.station_name][part_number] += quantity
                
                # Aggregate boxes
                for part_number, boxes in result.boxes_needed.items():
                    total_boxes[part_number] += boxes
                
                # Collect warnings
                all_warnings.extend(result.warnings)
            
            # Build summary
            summary = {
                "user_id": user_id,
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "total_filters": sum(total_quantities.values()),
                "by_part_number": dict(total_quantities),
                "boxes_needed": dict(total_boxes),
                "by_station": dict(station_summary),
                "warnings": all_warnings,
                "filter_series_summary": self._summarize_by_series(total_quantities)
            }
            
            await self.logging_service.log_info(
                f"Weekly filter calculation for user {user_id}: "
                f"{summary['total_filters']} filters needed"
            )
            
            return summary
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Weekly filter calculation failed: {str(e)}"
            )
            raise
    
    def _summarize_by_series(self, quantities: Dict[str, int]) -> Dict[str, Dict[str, Any]]:
        """Summarize filter quantities by series"""
        series_summary = defaultdict(lambda: {"quantity": 0, "part_numbers": []})
        
        for part_number, quantity in quantities.items():
            part_info = self.PART_NUMBER_INFO.get(part_number)
            if part_info:
                series_key = part_info.series.value
                series_summary[series_key]["quantity"] += quantity
                series_summary[series_key]["part_numbers"].append(part_number)
        
        return dict(series_summary)
    
    async def export_filter_data(
        self,
        filter_results: List[FilterCalculationResult],
        format: str = "csv"
    ) -> str:
        """Export filter calculation results"""
        if format == "csv":
            return self._export_csv(filter_results)
        elif format == "json":
            return self._export_json(filter_results)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_csv(self, results: List[FilterCalculationResult]) -> str:
        """Export results as CSV"""
        csv_lines = ["Part Number,Quantity,Boxes,Station,Visit Date,Visit ID"]
        
        for result in results:
            for part_number, quantity in result.total_quantities.items():
                boxes = result.boxes_needed.get(part_number, 0)
                csv_lines.append(
                    f'"{part_number}",{quantity},{boxes},"{result.station_name}",'
                    f'"{result.visit_date.isoformat()}","{result.dispenser_id}"'
                )
        
        return "\n".join(csv_lines)
    
    def _export_json(self, results: List[FilterCalculationResult]) -> str:
        """Export results as JSON"""
        import json
        
        export_data = []
        for result in results:
            export_data.append({
                "visit_id": result.dispenser_id,
                "station": result.station_name,
                "date": result.visit_date.isoformat(),
                "filters": [
                    {
                        "part_number": part_number,
                        "quantity": quantity,
                        "boxes": result.boxes_needed.get(part_number, 0),
                        "description": result.part_numbers.get(part_number, {}).description
                    }
                    for part_number, quantity in result.total_quantities.items()
                ],
                "warnings": result.warnings
            })
        
        return json.dumps(export_data, indent=2)


# Factory function for dependency injection
def get_filter_calculation_service(db: Session = None) -> FilterCalculationService:
    """Factory function for creating filter calculation service"""
    if db is None:
        db = next(get_db())
    return FilterCalculationService(db)