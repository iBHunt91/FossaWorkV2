#!/usr/bin/env python3
"""
Advanced Scheduling API Routes

Provides REST endpoints for comprehensive scheduling management including:
- Calendar views (day, week, month, agenda)
- Work order scheduling with conflict detection
- Drag-and-drop rescheduling
- Route optimization
- Capacity planning
- Mobile-friendly views
"""

from datetime import datetime, date, timedelta, time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json

from ..database import get_db
from ..services.advanced_scheduling_service import AdvancedSchedulingService
from ..services.logging_service import LoggingService
from ..models.user_models import User

router = APIRouter()


class ScheduleWorkOrderRequest(BaseModel):
    """Request model for scheduling a work order"""
    work_order_id: str
    requested_date: date
    requested_time: Optional[str] = Field(None, pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    duration_minutes: Optional[int] = Field(None, ge=15, le=480)
    
    @property
    def time_obj(self) -> Optional[time]:
        """Convert time string to time object"""
        if self.requested_time:
            hours, minutes = map(int, self.requested_time.split(':'))
            return time(hours, minutes)
        return None


class RescheduleEventRequest(BaseModel):
    """Request model for rescheduling an event"""
    event_id: str
    new_date: date
    new_time: Optional[str] = Field(None, pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    check_conflicts: bool = Field(default=True)
    
    @property
    def time_obj(self) -> Optional[time]:
        """Convert time string to time object"""
        if self.new_time:
            hours, minutes = map(int, self.new_time.split(':'))
            return time(hours, minutes)
        return None


class BulkScheduleRequest(BaseModel):
    """Request model for bulk scheduling"""
    schedules: List[Dict[str, Any]]
    optimize_routes: bool = Field(default=True)


class AvailabilityRequest(BaseModel):
    """Request model for finding availability"""
    start_date: date
    end_date: date
    duration_minutes: int = Field(..., ge=15, le=480)


@router.get("/calendar/{view_type}", response_model=Dict[str, Any])
async def get_calendar_view(
    view_type: str,
    start_date: date = Query(..., description="Start date for the view"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Get calendar view with events
    
    Supports multiple view types:
    - day: Single day view with hourly slots
    - week: Weekly view with daily columns
    - month: Monthly calendar grid
    - agenda: List view of upcoming events
    
    Returns formatted events with summary statistics.
    """
    try:
        # Validate view type
        valid_views = ["day", "week", "month", "agenda"]
        if view_type not in valid_views:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid view type. Must be one of: {', '.join(valid_views)}"
            )
        
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        # Build filters
        filters = {}
        if event_type:
            filters["event_type"] = event_type
        if status:
            filters["status"] = status
        
        # Get calendar view
        view = await service.get_calendar_view(
            user_id=user_id,
            view_type=view_type,
            start_date=start_date,
            filters=filters
        )
        
        return {
            "view": {
                "type": view.view_type,
                "start": view.start_date.isoformat(),
                "end": view.end_date.isoformat()
            },
            "filters": view.filters,
            "summary": view.summary,
            "events": [
                {
                    "id": event.event_id,
                    "type": event.event_type,
                    "title": event.title,
                    "description": event.description,
                    "start": event.start_time.isoformat(),
                    "end": event.end_time.isoformat(),
                    "location": event.location,
                    "priority": event.priority,
                    "status": event.status,
                    "color": event.color,
                    "assignee": event.assignee,
                    "metadata": event.metadata
                }
                for event in view.events
            ],
            "navigation": {
                "previous": (start_date - timedelta(days=1 if view_type == "day" else 7)).isoformat(),
                "next": (start_date + timedelta(days=1 if view_type == "day" else 7)).isoformat(),
                "today": date.today().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to get calendar view: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get calendar view: {str(e)}"
        )


@router.post("/schedule/work-order", response_model=Dict[str, Any])
async def schedule_work_order(
    request: ScheduleWorkOrderRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Schedule a work order with conflict detection
    
    Attempts to schedule at the requested time, or finds
    the next available slot. Returns conflicts and alternatives
    if the requested time is not available.
    """
    try:
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        result = await service.schedule_work_order(
            user_id=user_id,
            work_order_id=request.work_order_id,
            requested_date=request.requested_date,
            requested_time=request.time_obj,
            duration_minutes=request.duration_minutes
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to schedule work order: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to schedule work order: {str(e)}"
        )


@router.put("/reschedule", response_model=Dict[str, Any])
async def reschedule_event(
    request: RescheduleEventRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Reschedule an existing event
    
    Supports drag-and-drop rescheduling with optional
    conflict checking. Returns success or conflict details.
    """
    try:
        service = AdvancedSchedulingService(db)
        
        result = await service.reschedule_event(
            event_id=request.event_id,
            new_date=request.new_date,
            new_time=request.time_obj,
            check_conflicts=request.check_conflicts
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to reschedule event: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reschedule: {str(e)}"
        )


@router.post("/optimize/daily", response_model=Dict[str, Any])
async def optimize_daily_schedule(
    target_date: date = Query(..., description="Date to optimize"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Optimize schedule for a specific day
    
    Reorders appointments to minimize travel time and
    maximize efficiency. Returns optimized schedule with
    time savings calculation.
    """
    try:
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        result = await service.optimize_daily_schedule(
            user_id=user_id,
            target_date=target_date
        )
        
        return result
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to optimize schedule: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize schedule: {str(e)}"
        )


@router.post("/availability", response_model=List[Dict[str, Any]])
async def find_availability(
    request: AvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Find available time slots
    
    Returns list of available time slots that can
    accommodate the requested duration within the
    specified date range.
    """
    try:
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        slots = await service.get_availability(
            user_id=user_id,
            date_range_start=request.start_date,
            date_range_end=request.end_date,
            duration_minutes=request.duration_minutes
        )
        
        # Format response
        formatted_slots = []
        for slot in slots[:20]:  # Limit to 20 slots
            formatted_slots.append({
                "date": slot["start_time"].date().isoformat(),
                "start_time": slot["start_time"].strftime("%I:%M %p"),
                "end_time": slot["end_time"].strftime("%I:%M %p"),
                "duration_minutes": slot["duration"]
            })
        
        return formatted_slots
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to find availability: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to find availability: {str(e)}"
        )


@router.post("/bulk-schedule", response_model=Dict[str, Any])
async def bulk_schedule_events(
    request: BulkScheduleRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Schedule multiple events efficiently
    
    Supports bulk scheduling of filter changes or other
    events with optional route optimization to group
    nearby locations.
    """
    try:
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        # Validate schedules
        if not request.schedules:
            raise HTTPException(
                status_code=400,
                detail="No schedules provided"
            )
        
        # For now, assume these are filter changes
        result = await service.bulk_schedule_filter_changes(
            user_id=user_id,
            filter_schedules=request.schedules,
            optimize_routes=request.optimize_routes
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to bulk schedule: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to bulk schedule: {str(e)}"
        )


@router.get("/workload/analysis", response_model=Dict[str, Any])
async def analyze_workload(
    start_date: date = Query(..., description="Start of analysis period"),
    end_date: date = Query(..., description="End of analysis period"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Analyze workload distribution and capacity
    
    Provides insights into scheduling efficiency,
    identifies over/under-utilized periods, and
    calculates efficiency metrics.
    """
    try:
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        analysis = await service.get_workload_analysis(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return analysis
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to analyze workload: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze workload: {str(e)}"
        )


@router.get("/upcoming", response_model=Dict[str, Any])
async def get_upcoming_events(
    days_ahead: int = Query(7, ge=1, le=30, description="Days to look ahead"),
    limit: int = Query(10, ge=1, le=50, description="Maximum events to return"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Get upcoming scheduled events
    
    Quick access to next scheduled items for
    dashboard widgets and mobile views.
    """
    try:
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        # Get events for next N days
        start_date = date.today()
        end_date = start_date + timedelta(days=days_ahead)
        
        view = await service.get_calendar_view(
            user_id=user_id,
            view_type="agenda",
            start_date=start_date,
            filters={"status": ["scheduled", "in_progress"]}
        )
        
        # Format upcoming events
        upcoming = []
        for event in view.events[:limit]:
            # Calculate relative time
            time_until = event.start_time - datetime.now()
            
            if time_until.days > 0:
                relative_time = f"in {time_until.days} days"
            elif time_until.seconds > 3600:
                hours = time_until.seconds // 3600
                relative_time = f"in {hours} hours"
            else:
                relative_time = "soon"
            
            upcoming.append({
                "id": event.event_id,
                "type": event.event_type,
                "title": event.title,
                "start": event.start_time.isoformat(),
                "relative_time": relative_time,
                "location": event.location,
                "priority": event.priority
            })
        
        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "count": len(upcoming),
            "events": upcoming
        }
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to get upcoming events: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get upcoming events: {str(e)}"
        )


@router.get("/conflicts/check", response_model=Dict[str, Any])
async def check_conflicts(
    date: date = Query(..., description="Date to check"),
    start_time: str = Query(..., pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"),
    duration_minutes: int = Query(..., ge=15, le=480),
    exclude_event_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Check for scheduling conflicts
    
    Validates if a time slot is available before
    committing to a schedule change.
    """
    try:
        service = AdvancedSchedulingService(db)
        user_id = current_user.id if current_user else "system"
        
        # Parse time
        hours, minutes = map(int, start_time.split(':'))
        start_datetime = datetime.combine(date, time(hours, minutes))
        
        # Check conflicts
        conflicts = await service._check_time_conflicts(
            user_id=user_id,
            start_time=start_datetime,
            duration_minutes=duration_minutes,
            exclude_event_id=exclude_event_id
        )
        
        return {
            "has_conflicts": len(conflicts) > 0,
            "conflicts": [
                {
                    "type": c.conflict_type,
                    "severity": c.severity,
                    "message": c.message,
                    "conflicting_events": [
                        {
                            "id": e.event_id,
                            "title": e.title,
                            "start": e.start_time.isoformat(),
                            "end": e.end_time.isoformat()
                        }
                        for e in c.events
                    ],
                    "resolution_options": c.resolution_options
                }
                for c in conflicts
            ]
        }
        
    except Exception as e:
        await LoggingService(db).log_error(
            f"Failed to check conflicts: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check conflicts: {str(e)}"
        )