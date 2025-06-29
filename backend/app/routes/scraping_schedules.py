#!/usr/bin/env python3
"""
Scraping Schedule API Routes (Simplified)

Handles schedule configuration for the standalone scheduler daemon.
No direct APScheduler integration - schedules are stored in database
and processed by the separate scheduler_daemon.py process.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel, Field
from pathlib import Path
import json

from ..database import get_db
from ..auth.dependencies import get_current_user
from ..models.user_models import User
from ..models.scraping_models import ScrapingSchedule, ScrapingHistory
from ..services.simple_scheduler_service import SimpleSchedulerService
from ..services.logging_service import get_logger, log_automation_event

router = APIRouter(prefix="/api/scraping-schedules", tags=["scraping-schedules"])
logger = get_logger("api.scraping_schedules")


class CreateScheduleRequest(BaseModel):
    schedule_type: str = Field(..., description="Type of schedule (e.g., 'work_orders')")
    interval_hours: float = Field(1.0, ge=0.5, le=24, description="Interval between runs in hours")
    active_hours: Optional[Dict[str, int]] = Field(None, description="Active hours (start/end)")
    enabled: bool = Field(True, description="Whether schedule is enabled")


class UpdateScheduleRequest(BaseModel):
    interval_hours: Optional[float] = Field(None, ge=0.5, le=24)
    active_hours: Optional[Dict[str, int]] = None
    enabled: Optional[bool] = None


class ScheduleResponse(BaseModel):
    id: int
    user_id: str
    schedule_type: str
    interval_hours: float
    active_hours: Optional[Dict[str, int]]
    enabled: bool
    last_run: Optional[str]
    next_run: Optional[str]
    consecutive_failures: int
    created_at: str
    updated_at: str
    status: str  # "active", "paused", "failed"


@router.post("/", response_model=ScheduleResponse)
async def create_schedule(
    request: CreateScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new scraping schedule"""
    try:
        logger.info(f"Creating {request.schedule_type} schedule for user {current_user.id}")
        
        # Check if schedule already exists
        existing = db.query(ScrapingSchedule).filter(
            and_(
                ScrapingSchedule.user_id == current_user.id,
                ScrapingSchedule.schedule_type == request.schedule_type
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Schedule for {request.schedule_type} already exists"
            )
        
        # Create new schedule
        schedule = ScrapingSchedule(
            user_id=current_user.id,
            schedule_type=request.schedule_type,
            interval_hours=request.interval_hours,
            active_hours=request.active_hours,
            enabled=request.enabled,
            next_run=datetime.utcnow() if request.enabled else None
        )
        
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        
        log_automation_event("schedule_created", {
            "user_id": current_user.id,
            "schedule_id": schedule.id,
            "schedule_type": request.schedule_type,
            "interval_hours": request.interval_hours,
            "enabled": request.enabled
        })
        
        return _format_schedule_response(schedule)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating schedule: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create schedule")


@router.get("/", response_model=List[ScheduleResponse])
async def get_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all schedules for the current user"""
    schedules = db.query(ScrapingSchedule).filter(
        ScrapingSchedule.user_id == current_user.id
    ).all()
    
    return [_format_schedule_response(s) for s in schedules]


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific schedule"""
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.id == schedule_id,
            ScrapingSchedule.user_id == current_user.id
        )
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return _format_schedule_response(schedule)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    request: UpdateScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a schedule"""
    logger.info(f"=== API UPDATE SCHEDULE REQUEST ===")
    logger.info(f"Schedule ID: {schedule_id}, User: {current_user.id}")
    logger.info(f"Request data: interval_hours={request.interval_hours}, active_hours={request.active_hours}, enabled={request.enabled}")
    
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.id == schedule_id,
            ScrapingSchedule.user_id == current_user.id
        )
    ).first()
    
    if not schedule:
        logger.error(f"Schedule {schedule_id} not found for user {current_user.id}")
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Use the service to update the schedule
    scheduler_service = SimpleSchedulerService()
    schedule = scheduler_service.update_schedule(
        db=db,
        schedule_id=schedule_id,
        interval_hours=request.interval_hours,
        active_hours=request.active_hours,
        enabled=request.enabled
    )
    
    log_automation_event("schedule_updated", {
        "user_id": current_user.id,
        "schedule_id": schedule.id,
        "changes": request.dict(exclude_unset=True)
    })
    
    response = _format_schedule_response(schedule)
    logger.info(f"=== API RESPONSE ===")
    logger.info(f"Schedule ID: {response.id}")
    logger.info(f"Enabled: {response.enabled}")
    logger.info(f"Next Run: {response.next_run}")
    logger.info(f"Status: {response.status}")
    
    return response


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a schedule"""
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.id == schedule_id,
            ScrapingSchedule.user_id == current_user.id
        )
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(schedule)
    db.commit()
    
    log_automation_event("schedule_deleted", {
        "user_id": current_user.id,
        "schedule_id": schedule_id,
        "schedule_type": schedule.schedule_type
    })
    
    return {"message": "Schedule deleted successfully"}


@router.get("/{schedule_id}/history", response_model=List[Dict[str, Any]])
async def get_schedule_history(
    schedule_id: int,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get execution history for a schedule"""
    # Verify schedule ownership
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.id == schedule_id,
            ScrapingSchedule.user_id == current_user.id
        )
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Get history
    history = db.query(ScrapingHistory).filter(
        and_(
            ScrapingHistory.user_id == current_user.id,
            ScrapingHistory.schedule_type == schedule.schedule_type
        )
    ).order_by(ScrapingHistory.started_at.desc()).limit(limit).all()
    
    return [h.to_dict() for h in history]


@router.post("/{schedule_id}/run")
async def run_schedule_now(
    schedule_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger a schedule to run immediately"""
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.id == schedule_id,
            ScrapingSchedule.user_id == current_user.id
        )
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Import the scheduler service to trigger the job
    from ..services.scheduler_service import scheduler_service
    
    # If scheduler is initialized, trigger the job immediately
    if scheduler_service.scheduler and scheduler_service.is_initialized:
        job_id = f"work_order_scrape_{current_user.id}"
        job = scheduler_service.scheduler.get_job(job_id)
        
        if job:
            # Reschedule job to run immediately
            job.modify(next_run_time=datetime.now(timezone.utc))
            message = "Work order sync started"
        else:
            # Job doesn't exist, return error
            raise HTTPException(status_code=400, detail="Schedule job not found in scheduler")
    else:
        # Fallback: Just run the scraping directly in background
        from ..routes.work_orders import trigger_scrape_background
        background_tasks.add_task(
            trigger_scrape_background,
            user_id=current_user.id,
            db_session=db
        )
        message = "Work order sync triggered in background"
    
    log_automation_event("schedule_manual_run", {
        "user_id": current_user.id,
        "schedule_id": schedule_id,
        "schedule_type": schedule.schedule_type
    })
    
    return {
        "message": message,
        "schedule_id": schedule_id
    }


@router.get("/status/daemon")
async def get_daemon_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get scheduler daemon status"""
    # Check for recent executions to determine if daemon is running
    recent_execution = db.query(ScrapingHistory).filter(
        ScrapingHistory.started_at >= datetime.utcnow() - timedelta(minutes=5)
    ).first()
    
    # Get schedule counts
    total_schedules = db.query(ScrapingSchedule).count()
    active_schedules = db.query(ScrapingSchedule).filter(
        ScrapingSchedule.enabled == True
    ).count()
    
    return {
        "daemon_status": "running" if recent_execution else "unknown",
        "last_execution": recent_execution.started_at.isoformat() if recent_execution else None,
        "total_schedules": total_schedules,
        "active_schedules": active_schedules,
        "message": "Scheduler daemon runs as a separate process. Check system logs for details."
    }


@router.get("/{schedule_id}/history/{history_id}/error-log")
async def get_error_log(
    schedule_id: int,
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get error log for a failed scraping attempt"""
    # Verify schedule ownership
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.id == schedule_id,
            ScrapingSchedule.user_id == current_user.id
        )
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Get history record
    history = db.query(ScrapingHistory).filter(
        and_(
            ScrapingHistory.id == history_id,
            ScrapingHistory.user_id == current_user.id,
            ScrapingHistory.schedule_type == schedule.schedule_type
        )
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="History record not found")
    
    # Check if there's an error log path
    if not history.error_details or 'error_log_path' not in history.error_details:
        raise HTTPException(status_code=404, detail="No error log available for this run")
    
    error_log_path = Path(history.error_details['error_log_path'])
    
    # Verify the file exists
    if not error_log_path.exists():
        raise HTTPException(status_code=404, detail="Error log file not found")
    
    # Read and return the error log
    try:
        with open(error_log_path, 'r') as f:
            error_data = json.load(f)
        
        return JSONResponse(content={
            "success": True,
            "error_log": error_data,
            "history_id": history_id,
            "timestamp": history.started_at.isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to read error log: {e}")
        raise HTTPException(status_code=500, detail="Failed to read error log")


def _format_schedule_response(schedule: ScrapingSchedule) -> ScheduleResponse:
    """Format schedule for API response"""
    status = "active" if schedule.enabled else "paused"
    if schedule.consecutive_failures >= 5:
        status = "failed"
    
    # Ensure UTC timezone suffix for datetime fields
    def format_datetime_utc(dt):
        if dt:
            # If datetime is naive, we know it's stored as UTC in the database
            iso_str = dt.isoformat()
            # Add 'Z' suffix if not already present to indicate UTC
            if not iso_str.endswith('Z') and '+' not in iso_str:
                iso_str += 'Z'
            return iso_str
        return None
    
    return ScheduleResponse(
        id=schedule.id,
        user_id=schedule.user_id,
        schedule_type=schedule.schedule_type,
        interval_hours=schedule.interval_hours,
        active_hours=schedule.active_hours,
        enabled=schedule.enabled,
        last_run=format_datetime_utc(schedule.last_run),
        next_run=format_datetime_utc(schedule.next_run),
        consecutive_failures=schedule.consecutive_failures,
        created_at=format_datetime_utc(schedule.created_at),
        updated_at=format_datetime_utc(schedule.updated_at),
        status=status
    )


@router.get("/simple-status")
async def get_simple_scheduler_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get simple scheduler status for UI display"""
    # Get user's work order schedule
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.user_id == current_user.id,
            ScrapingSchedule.schedule_type == "work_orders"
        )
    ).first()
    
    if not schedule:
        return {
            "status": "not_configured",
            "message": "No sync schedule configured"
        }
    
    # Check if scheduler service is running
    from ..services.scheduler_service import scheduler_service
    scheduler_running = scheduler_service.is_initialized and scheduler_service.scheduler is not None
    
    # Determine status based on schedule state
    if not schedule.enabled:
        status = "paused"
        message = "Sync paused"
    elif schedule.consecutive_failures >= 5:
        status = "failed"
        message = f"Failed • {schedule.consecutive_failures} errors"
    elif not scheduler_running:
        status = "starting"
        message = "Starting scheduler..."
    else:
        # Check if there's a recent successful run
        recent_success = db.query(ScrapingHistory).filter(
            and_(
                ScrapingHistory.user_id == current_user.id,
                ScrapingHistory.schedule_type == "work_orders",
                ScrapingHistory.success == True,
                ScrapingHistory.completed_at >= datetime.utcnow() - timedelta(hours=2)
            )
        ).first()
        
        if recent_success:
            status = "active"
            message = f"Active • Last sync {recent_success.items_processed or 0} items"
        else:
            status = "active"
            message = "Active • Waiting for next sync"
    
    return {
        "status": status,
        "message": message,
        "enabled": schedule.enabled,
        "next_run": schedule.next_run.isoformat() if schedule.next_run else None
    }


@router.get("/{schedule_id}/sync-progress")
async def get_sync_progress(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get real-time progress of work order sync"""
    # Verify schedule ownership
    schedule = db.query(ScrapingSchedule).filter(
        and_(
            ScrapingSchedule.id == schedule_id,
            ScrapingSchedule.user_id == current_user.id
        )
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Import the shared progress dictionary from work_orders route
    try:
        from ..routes.work_orders import scraping_progress
        
        # Check if there's any progress for this user
        progress = scraping_progress.get(current_user.id)
        
        if progress:
            # Add schedule context to the progress
            logger.info(f"Found sync progress for user {current_user.id}: status={progress.get('status')}, percentage={progress.get('percentage')}")
            return {
                **progress,
                "schedule_id": schedule_id,
                "schedule_type": schedule.schedule_type
            }
        else:
            # No progress data at all
            logger.info(f"No sync progress found for user {current_user.id}")
            return {
                "status": "not_found",
                "phase": "not_started",
                "percentage": 0,
                "message": "No sync data available",
                "schedule_id": schedule_id,
                "schedule_type": schedule.schedule_type
            }
    except ImportError:
        logger.error("Failed to import scraping_progress from work_orders")
        return {
            "status": "error",
            "message": "Progress tracking unavailable",
            "schedule_id": schedule_id
        }