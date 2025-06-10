#!/usr/bin/env python3
"""
Filter Calculation API Routes

Provides REST endpoints for V1-compatible filter calculation functionality including:
- Single work order filter calculation
- Weekly filter aggregation  
- Filter inventory tracking
- Export capabilities
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json

from ..database import get_db
from ..services.filter_calculation import FilterCalculationService, FilterType
from ..services.logging_service import LoggingService
from ..services.user_management import UserManagementService
from ..models.user_models import User

router = APIRouter()


class FilterCalculationRequest(BaseModel):
    """Request model for single work order filter calculation"""
    work_order_id: str
    work_order_data: Dict[str, Any] = Field(..., description="Work order data including dispensers")
    include_warnings: bool = Field(default=True, description="Include warning messages")


class WeeklyFilterRequest(BaseModel):
    """Request model for weekly filter calculation"""
    user_id: str
    start_date: Optional[date] = Field(None, description="Start date for calculation")
    end_date: Optional[date] = Field(None, description="End date for calculation")
    include_details: bool = Field(default=True, description="Include detailed breakdown")


class FilterInventoryUpdate(BaseModel):
    """Request model for updating filter inventory"""
    part_number: str
    quantity_change: int = Field(..., description="Positive for adding, negative for using")
    reason: str = Field(..., description="Reason for inventory change")
    
    
class FilterExportRequest(BaseModel):
    """Request model for exporting filter data"""
    format: str = Field("csv", pattern="^(csv|json)$")
    date_range: Optional[Dict[str, date]] = None
    include_warnings: bool = Field(default=False)


@router.post("/calculate-single", response_model=Dict[str, Any])
async def calculate_single_work_order(
    request: FilterCalculationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Calculate filter requirements for a single work order
    
    This endpoint implements V1's business logic for determining:
    - Which fuel grades need filters
    - Premium conditional logic based on Super/Ultra presence
    - Station-specific part number selection
    - Multi-day job handling
    """
    try:
        service = FilterCalculationService(db)
        
        # Log the calculation request
        await LoggingService(db).log_info(
            f"Filter calculation requested for work order {request.work_order_id}"
        )
        
        # Calculate filters
        result = await service.calculate_filters_for_work_order(
            request.work_order_data,
            current_user.id if current_user else "system"
        )
        
        # Convert result to response format
        response = {
            "work_order_id": request.work_order_id,
            "station_name": result.station_name,
            "visit_date": result.visit_date.isoformat(),
            "is_multi_day_continuation": result.is_multi_day_continuation,
            "filters_needed": [
                {
                    "fuel_grade": req.fuel_grade,
                    "filter_type": req.filter_type.value,
                    "needs_filter": req.needs_filter,
                    "reason": req.reason,
                    "part_number": req.part_number
                }
                for req in result.filters_needed
            ],
            "part_numbers": {
                pn: {
                    "description": info.description,
                    "filters_per_box": info.filters_per_box,
                    "series": info.series.value
                }
                for pn, info in result.part_numbers.items()
            },
            "total_quantities": dict(result.total_quantities),
            "boxes_needed": result.boxes_needed,
            "warnings": result.warnings if request.include_warnings else []
        }
        
        return response
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Filter calculation failed for {request.work_order_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Filter calculation failed: {str(e)}"
        )


@router.post("/calculate-weekly", response_model=Dict[str, Any])
async def calculate_weekly_filters(
    request: WeeklyFilterRequest,
    db: Session = Depends(get_db)
):
    """
    Calculate filter requirements for a user's work week
    
    Aggregates filter needs across all work orders in the specified period,
    respecting user work week preferences and multi-day job rules.
    """
    try:
        service = FilterCalculationService(db)
        
        # Calculate weekly filters
        result = await service.calculate_weekly_filters(
            request.user_id,
            request.start_date,
            request.end_date
        )
        
        return result
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Weekly filter calculation failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Weekly filter calculation failed: {str(e)}"
        )


@router.get("/summary/{user_id}", response_model=Dict[str, Any])
async def get_filter_summary(
    user_id: str,
    weeks_ahead: int = Query(default=1, ge=0, le=4),
    db: Session = Depends(get_db)
):
    """
    Get filter summary for upcoming weeks
    
    Provides a high-level overview of filter needs for planning purposes.
    """
    try:
        service = FilterCalculationService(db)
        user_service = UserManagementService(db)
        
        # Get user work week preferences
        work_week_prefs = user_service.get_user_preference(user_id, "work_week")
        if not work_week_prefs:
            work_week_prefs = {"start_day": 1, "end_day": 5}
        
        summaries = []
        today = date.today()
        
        for week in range(weeks_ahead + 1):
            # Calculate week boundaries
            week_start = today + timedelta(weeks=week)
            # Adjust to work week start day
            days_to_start = (work_week_prefs["start_day"] - week_start.weekday()) % 7
            week_start = week_start + timedelta(days=days_to_start)
            
            # Calculate week end based on preferences
            days_in_work_week = (work_week_prefs["end_day"] - work_week_prefs["start_day"]) % 7
            week_end = week_start + timedelta(days=days_in_work_week)
            
            # Get summary for this week
            weekly_result = await service.calculate_weekly_filters(
                user_id, week_start, week_end
            )
            
            summaries.append({
                "week_number": week,
                "start_date": week_start.isoformat(),
                "end_date": week_end.isoformat(),
                "total_filters": weekly_result["total_filters"],
                "filter_series_summary": weekly_result["filter_series_summary"]
            })
        
        return {
            "user_id": user_id,
            "weeks_ahead": weeks_ahead,
            "summaries": summaries
        }
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Filter summary failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Filter summary failed: {str(e)}"
        )


@router.post("/export", response_model=Dict[str, Any])
async def export_filter_data(
    request: FilterExportRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Export filter calculation data in various formats
    
    Supports CSV and JSON export formats for integration with
    inventory management systems.
    """
    try:
        service = FilterCalculationService(db)
        
        # For now, return a simple format indicator
        # In production, this would gather data and format it
        if request.format == "csv":
            content_type = "text/csv"
            filename = f"filters_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        else:
            content_type = "application/json"
            filename = f"filters_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # TODO: Implement actual data gathering and export
        # This would integrate with work order service to get data
        
        return {
            "format": request.format,
            "filename": filename,
            "content_type": content_type,
            "message": "Export functionality will be implemented with work order integration"
        }
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Filter export failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Filter export failed: {str(e)}"
        )


@router.get("/part-numbers", response_model=Dict[str, Any])
async def get_part_numbers(
    station_type: Optional[str] = Query(None, description="Filter by station type"),
    filter_type: Optional[str] = Query(None, description="Filter by type (gas/diesel/def)"),
    db: Session = Depends(get_db)
):
    """
    Get available filter part numbers with metadata
    
    Returns the complete catalog of filter part numbers used in the system,
    including station-specific mappings and box quantities.
    """
    try:
        service = FilterCalculationService(db)
        
        # Get all part numbers from the service
        all_parts = {}
        
        # Add station-specific parts
        for station, filters in service.STATION_PART_NUMBERS.items():
            if station_type and station != station_type.lower():
                continue
                
            for f_type, parts in filters.items():
                if filter_type and f_type.value != filter_type.lower():
                    continue
                    
                if isinstance(parts, dict):
                    for meter_type, part_num in parts.items():
                        if part_num and part_num in service.PART_NUMBER_INFO:
                            all_parts[part_num] = {
                                "info": service.PART_NUMBER_INFO[part_num],
                                "station": station,
                                "meter_type": meter_type if meter_type != "default" else None
                            }
                elif isinstance(parts, str) and parts in service.PART_NUMBER_INFO:
                    all_parts[parts] = {
                        "info": service.PART_NUMBER_INFO[parts],
                        "station": station,
                        "meter_type": None
                    }
        
        # Format response
        response = {
            "part_numbers": {
                pn: {
                    "part_number": pn,
                    "description": data["info"].description,
                    "filter_type": data["info"].filter_type.value,
                    "filters_per_box": data["info"].filters_per_box,
                    "series": data["info"].series.value,
                    "station": data["station"],
                    "meter_type": data["meter_type"]
                }
                for pn, data in all_parts.items()
            }
        }
        
        return response
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Part number retrieval failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve part numbers: {str(e)}"
        )


@router.get("/warnings/{user_id}", response_model=Dict[str, Any])
async def get_filter_warnings(
    user_id: str,
    severity_threshold: int = Query(default=5, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """
    Get filter-related warnings for a user's work orders
    
    Returns warnings about special fuel types (DEF, High Flow) and
    unknown fuel grades that may require manual verification.
    """
    try:
        # This would integrate with the work order service
        # to check all upcoming work orders for warnings
        
        # For now, return a placeholder structure
        return {
            "user_id": user_id,
            "severity_threshold": severity_threshold,
            "warnings": [],
            "message": "Warning system will be implemented with work order integration"
        }
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Warning retrieval failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve warnings: {str(e)}"
        )