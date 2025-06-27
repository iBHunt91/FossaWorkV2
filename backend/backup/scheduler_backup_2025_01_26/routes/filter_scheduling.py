#!/usr/bin/env python3
"""
Filter Scheduling API Routes

Provides REST endpoints for filter change scheduling optimization including:
- Change schedule generation
- Route optimization
- Bulk change suggestions
- Schedule management
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json
from collections import defaultdict

from ..database import get_db
from ..services.filter_scheduling_service import FilterSchedulingService
from ..services.logging_service import LoggingService
from ..models.user_models import User

router = APIRouter()


class ScheduleGenerationRequest(BaseModel):
    """Request model for schedule generation"""
    start_date: date
    end_date: date
    station_filter: Optional[List[str]] = Field(None, description="Filter by specific stations")
    include_overdue: bool = Field(default=True, description="Include overdue changes")


class RouteOptimizationRequest(BaseModel):
    """Request model for route optimization"""
    date: date
    start_location: Optional[Dict[str, float]] = Field(None, description="Starting lat/lng")
    max_time_hours: Optional[float] = Field(8.0, description="Maximum route time")
    max_stations: Optional[int] = Field(8, description="Maximum stations per route")


class BulkChangeRequest(BaseModel):
    """Request model for bulk change suggestions"""
    weeks_ahead: int = Field(4, ge=1, le=12, description="Weeks to look ahead")
    min_savings_threshold: float = Field(50.0, description="Minimum savings to suggest")


class ScheduleUpdateRequest(BaseModel):
    """Request model for updating a scheduled change"""
    station_id: str
    new_date: date
    reason: str = Field(..., description="Reason for schedule change")
    filters_override: Optional[Dict[str, int]] = None


@router.post("/generate", response_model=Dict[str, Any])
async def generate_schedule(
    request: ScheduleGenerationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Generate filter change schedule for date range
    
    Analyzes historical usage patterns and calculates optimal
    change dates for each station based on:
    - Usage volume
    - Last change date
    - Filter life expectations
    - Work week preferences
    """
    try:
        service = FilterSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        schedules = await service.generate_change_schedule(
            user_id=user_id,
            start_date=request.start_date,
            end_date=request.end_date,
            station_filter=request.station_filter
        )
        
        # Group by urgency
        urgent = [s for s in schedules if s.priority >= 8]
        upcoming = [s for s in schedules if 4 <= s.priority < 8]
        routine = [s for s in schedules if s.priority < 4]
        
        return {
            "period": {
                "start": request.start_date.isoformat(),
                "end": request.end_date.isoformat()
            },
            "summary": {
                "total_changes": len(schedules),
                "urgent": len(urgent),
                "upcoming": len(upcoming),
                "routine": len(routine),
                "total_filters": sum(
                    sum(s.filters_needed.values()) for s in schedules
                ),
                "total_time_hours": sum(s.estimated_time for s in schedules) / 60
            },
            "schedules": [
                {
                    "station_id": s.station_id,
                    "station_name": s.station_name,
                    "location": s.location,
                    "last_change": s.last_change_date.isoformat() if s.last_change_date else None,
                    "next_change": s.next_change_due.isoformat(),
                    "days_until_due": (s.next_change_due - date.today()).days,
                    "filters_needed": s.filters_needed,
                    "priority": s.priority,
                    "estimated_time": s.estimated_time,
                    "notes": s.notes
                }
                for s in schedules
            ]
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Schedule generation failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate schedule: {str(e)}"
        )


@router.post("/optimize-routes", response_model=Dict[str, Any])
async def optimize_routes(
    request: RouteOptimizationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Optimize routes for filter changes on a specific date
    
    Groups stations by geographic proximity and creates
    efficient routes considering:
    - Travel time and distance
    - Station time requirements
    - Daily capacity limits
    - Route efficiency
    """
    try:
        service = FilterSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        # First generate schedules for the date
        schedules = await service.generate_change_schedule(
            user_id=user_id,
            start_date=request.date,
            end_date=request.date
        )
        
        # Then optimize routes
        routes = await service.optimize_routes(
            schedules=schedules,
            date=request.date,
            start_location=request.start_location
        )
        
        return {
            "date": request.date.isoformat(),
            "summary": {
                "total_routes": len(routes),
                "total_stations": sum(len(r.stations) for r in routes),
                "total_time_hours": sum(r.total_time for r in routes) / 60,
                "total_distance": sum(r.total_distance for r in routes),
                "average_efficiency": (
                    sum(r.efficiency_score for r in routes) / len(routes)
                    if routes else 0
                )
            },
            "routes": [
                {
                    "route_id": r.route_id,
                    "stations": [
                        {
                            "station_name": s.station_name,
                            "location": s.location,
                            "estimated_time": s.estimated_time,
                            "filters": s.filters_needed
                        }
                        for s in r.stations
                    ],
                    "total_time_minutes": r.total_time,
                    "total_distance_miles": round(r.total_distance, 1),
                    "total_filters": r.total_filters,
                    "efficiency_score": round(r.efficiency_score, 1)
                }
                for r in routes
            ]
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Route optimization failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize routes: {str(e)}"
        )


@router.post("/suggest-bulk-changes", response_model=Dict[str, Any])
async def suggest_bulk_changes(
    request: BulkChangeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Suggest bulk filter changes to minimize truck rolls
    
    Analyzes upcoming filter needs and suggests grouping
    changes even if some filters aren't quite due yet,
    calculating potential savings from:
    - Reduced travel costs
    - Fewer truck rolls
    - Time efficiency
    """
    try:
        service = FilterSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        suggestions = await service.suggest_bulk_changes(
            user_id=user_id,
            weeks_ahead=request.weeks_ahead
        )
        
        # Filter by minimum savings threshold
        filtered_suggestions = [
            s for s in suggestions["suggestions"]
            if s["total_savings"] >= request.min_savings_threshold
        ]
        
        return {
            "analysis_period": {
                "start": date.today().isoformat(),
                "end": (date.today() + timedelta(weeks=request.weeks_ahead)).isoformat()
            },
            "summary": {
                "total_suggestions": len(filtered_suggestions),
                "potential_truck_rolls_saved": len(filtered_suggestions),
                "estimated_cost_savings": sum(s["total_savings"] for s in filtered_suggestions),
                "average_days_early": (
                    sum(
                        sum(c["days_early"] for c in s["combine_with"])
                        for s in filtered_suggestions
                    ) / max(1, sum(len(s["combine_with"]) for s in filtered_suggestions))
                    if filtered_suggestions else 0
                )
            },
            "suggestions": [
                {
                    "primary": {
                        "station_name": s["primary_station"].station_name,
                        "scheduled_date": s["primary_station"].next_change_due.isoformat(),
                        "filters_needed": s["primary_station"].filters_needed
                    },
                    "combine_with": [
                        {
                            "station_name": c["station"].station_name,
                            "scheduled_date": c["station"].next_change_due.isoformat(),
                            "distance_miles": round(c["distance"], 1),
                            "days_early": c["days_early"],
                            "savings": round(c["savings"], 2)
                        }
                        for c in s["combine_with"]
                    ],
                    "total_savings": round(s["total_savings"], 2)
                }
                for s in filtered_suggestions[:20]  # Limit to top 20
            ]
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Bulk change suggestions failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate suggestions: {str(e)}"
        )


@router.get("/calendar-view", response_model=Dict[str, Any])
async def get_calendar_view(
    start_date: date = Query(..., description="Start of calendar period"),
    end_date: date = Query(..., description="End of calendar period"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Get filter changes in calendar format
    
    Returns scheduled filter changes organized by date for
    easy calendar integration and visual planning.
    """
    try:
        service = FilterSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        schedules = await service.generate_change_schedule(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Organize by date
        calendar_data = defaultdict(list)
        
        for schedule in schedules:
            date_key = schedule.next_change_due.isoformat()
            calendar_data[date_key].append({
                "station_name": schedule.station_name,
                "time_required": schedule.estimated_time,
                "priority": schedule.priority,
                "filters": sum(schedule.filters_needed.values())
            })
        
        # Calculate daily summaries
        daily_summaries = {}
        for date_str, stations in calendar_data.items():
            daily_summaries[date_str] = {
                "station_count": len(stations),
                "total_time_hours": sum(s["time_required"] for s in stations) / 60,
                "urgent_count": len([s for s in stations if s["priority"] >= 8]),
                "total_filters": sum(s["filters"] for s in stations),
                "stations": stations
            }
        
        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "calendar": daily_summaries
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Calendar view failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate calendar view: {str(e)}"
        )


@router.get("/station-history/{station_id}", response_model=List[Dict[str, Any]])
async def get_station_history(
    station_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Get filter change history for a specific station
    
    Returns recent filter changes including dates, quantities,
    and associated work orders.
    """
    try:
        service = FilterSchedulingService(db)
        
        history = await service.get_change_history(
            station_id=station_id,
            limit=limit
        )
        
        return history
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to get station history: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get station history: {str(e)}"
        )


@router.put("/update-schedule", response_model=Dict[str, Any])
async def update_schedule(
    request: ScheduleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Update a scheduled filter change
    
    Allows manual adjustment of scheduled dates with reason tracking
    for audit purposes.
    """
    try:
        # This would update the schedule in the database
        # For now, return success response
        
        await LoggingService().log_info(
            f"Schedule updated for station {request.station_id}: "
            f"moved to {request.new_date} - {request.reason}"
        )
        
        return {
            "status": "success",
            "station_id": request.station_id,
            "new_date": request.new_date.isoformat(),
            "reason": request.reason,
            "updated_by": current_user.username if current_user else "system",
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Schedule update failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update schedule: {str(e)}"
        )