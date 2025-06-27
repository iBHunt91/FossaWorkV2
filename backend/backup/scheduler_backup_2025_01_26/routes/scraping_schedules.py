#!/usr/bin/env python3
"""
Scraping Schedule API Routes

Handles automated work order scraping schedules with support for:
- Hourly intervals during business hours
- Enable/disable functionality
- Schedule history tracking
"""

from datetime import datetime, time, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from ..auth.dependencies import get_current_user
from ..models.user_models import User
from ..services.logging_service import get_logger, log_automation_event, log_error

def format_datetime_for_api(dt: Optional[datetime]) -> Optional[str]:
    """Format datetime for API response, handling timezone properly"""
    if not dt:
        return None
    
    # If datetime has timezone info, use it directly
    if dt.tzinfo is not None:
        return dt.isoformat().replace('+00:00', 'Z')
    else:
        # Assume UTC if no timezone
        return dt.isoformat() + 'Z'

# Try to import scheduler service, but handle gracefully if not available
try:
    from ..services.scheduler_service import scheduler_service
except ImportError:
    scheduler_service = None

router = APIRouter(prefix="/api/scraping-schedules", tags=["scraping-schedules"])

# Initialize logger for this module
logger = get_logger("api.scraping_schedules")


def extract_user_id_from_job_id(job_id: str, current_user_id: str) -> str:
    """Extract user_id from job_id, handling both format variations"""
    if job_id.startswith("work_order_scrape_"):
        return job_id.replace("work_order_scrape_", "")
    elif job_id.startswith("work_orders_scrape_"):
        return job_id.replace("work_orders_scrape_", "")
    else:
        return current_user_id


class CreateScheduleRequest(BaseModel):
    schedule_type: str = Field(..., description="Type of schedule (e.g., 'work_orders')")
    interval_hours: float = Field(1.0, ge=0.5, le=24, description="Interval between runs in hours")
    active_hours: Optional[Dict[str, int]] = Field(None, description="Active hours (start/end)")
    enabled: bool = Field(True, description="Whether schedule is enabled")


class UpdateScheduleRequest(BaseModel):
    interval_hours: Optional[float] = Field(None, ge=0.5, le=24)
    active_hours: Optional[Dict[str, int]] = None
    enabled: Optional[bool] = None
    
    def __init__(self, **data):
        logger.info(f"=== UpdateScheduleRequest INIT ===")
        logger.info(f"Raw data received: {data}")
        super().__init__(**data)
        logger.info(f"Parsed values:")
        logger.info(f"  - interval_hours: {self.interval_hours}")
        logger.info(f"  - active_hours: {self.active_hours}")
        logger.info(f"  - enabled: {self.enabled}")


@router.post("/", response_model=Dict[str, Any])
async def create_schedule(
    request: CreateScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new scraping schedule
    """
    try:
        # Log the request
        logger.info(f"Creating {request.schedule_type} schedule for user {current_user.id}")
        log_automation_event("schedule_create_request", {
            "user_id": current_user.id,
            "schedule_type": request.schedule_type,
            "interval_hours": request.interval_hours,
            "enabled": request.enabled
        })
        
        # For work order scraping
        if request.schedule_type != "work_orders":
            raise HTTPException(
                status_code=400,
                detail="Only work_orders schedule type is currently supported"
            )
        
        # Check if scheduler service is available and initialized
        job_id = None
        schedule_created = False
        scheduler_available = False
        
        # Check scheduler service availability more robustly
        if scheduler_service is not None:
            try:
                # Check if it's initialized
                if hasattr(scheduler_service, 'is_initialized') and scheduler_service.is_initialized:
                    scheduler_available = True
                elif hasattr(scheduler_service, 'is_initialized') and not scheduler_service.is_initialized:
                    # Try to initialize if not already done
                    logger.info("Attempting to initialize scheduler service...")
                    import os
                    database_url = os.getenv("DATABASE_URL", "sqlite:///./fossawork_v2.db")
                    await scheduler_service.initialize(database_url)
                    scheduler_available = scheduler_service.is_initialized
                else:
                    # Simple scheduler service - always available
                    scheduler_available = True
            except Exception as e:
                logger.warning(f"Scheduler service initialization failed: {str(e)}")
                scheduler_available = False
        
        # Try to create scheduler job if available
        if scheduler_available:
            try:
                job_id = await scheduler_service.add_work_order_scraping_schedule(
                    user_id=current_user.id,
                    interval_hours=request.interval_hours,
                    active_hours=request.active_hours,
                    enabled=request.enabled
                )
                schedule_created = True
                logger.info(f"Schedule created with job ID: {job_id}")
            except Exception as e:
                logger.warning(f"Failed to create scheduled job, falling back to database: {str(e)}")
        else:
            logger.warning("Scheduler service not available, creating database-only schedule")
        
        # Always ensure database record exists
        from ..models.scraping_models import ScrapingSchedule
        
        # Check if schedule already exists
        existing = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == current_user.id,
            ScrapingSchedule.schedule_type == request.schedule_type
        ).first()
        
        if existing:
            # Update existing schedule
            existing.interval_hours = request.interval_hours
            existing.active_hours = request.active_hours
            existing.enabled = request.enabled
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            
            if not job_id:
                job_id = f"work_order_scrape_{current_user.id}"
        else:
            # Create new schedule record
            schedule = ScrapingSchedule(
                user_id=current_user.id,
                schedule_type=request.schedule_type,
                interval_hours=request.interval_hours,
                active_hours=request.active_hours,
                enabled=request.enabled,
                next_run=None
            )
            db.add(schedule)
            db.commit()
            db.refresh(schedule)
            
            if not job_id:
                job_id = f"work_order_scrape_{current_user.id}"
        
        # Log the creation
        log_automation_event("schedule_created", {
            "user_id": current_user.id,
            "job_id": job_id,
            "schedule_type": request.schedule_type,
            "interval_hours": request.interval_hours,
            "active_hours": request.active_hours,
            "enabled": request.enabled,
            "scheduler_active": schedule_created
        })
        logger.info(f"Created {request.schedule_type} schedule with {request.interval_hours}h interval")
        
        # Prepare response
        schedule_status = None
        if schedule_created and hasattr(scheduler_service, 'get_schedule_status'):
            try:
                schedule_status = await scheduler_service.get_schedule_status(job_id)
            except Exception as e:
                logger.error(f"Failed to get schedule status for {job_id}: {e}", exc_info=True)
                schedule_status = None
        
        if not schedule_status:
            # Create a mock status from database
            schedule_status = {
                "job_id": job_id,
                "user_id": current_user.id,
                "type": request.schedule_type,
                "enabled": request.enabled,
                "next_run": None,
                "pending": False
            }
        
        return {
            "success": True,
            "job_id": job_id,
            "message": "Schedule created successfully" if schedule_created else "Schedule saved (scheduler offline)",
            "schedule": schedule_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, "Failed to create schedule")
        logger.error(f"Failed to create schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create schedule: {str(e)}"
        )


@router.get("/", response_model=List[Dict[str, Any]])
async def get_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all schedules for the current user
    """
    logger.info(f"=== GET SCHEDULES REQUEST ===")
    logger.info(f"User ID: {current_user.id}")
    try:
        # Always get schedules from database first
        from ..models.scraping_models import ScrapingSchedule
        
        db_schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == current_user.id
        ).all()
        
        logger.info(f"Found {len(db_schedules)} schedules in database")
        for schedule in db_schedules:
            logger.info(f"  - Type: {schedule.schedule_type}, Interval: {schedule.interval_hours}h, Active hours: {schedule.active_hours}, Enabled: {schedule.enabled}")
            logger.info(f"    Active hours type: {type(schedule.active_hours)}")
            logger.info(f"    Active hours is None: {schedule.active_hours is None}")
        
        # Check if scheduler service is available and has runtime info
        scheduler_available = False
        user_schedules = {}
        
        if scheduler_service is not None:
            try:
                # Check various scheduler service types
                if hasattr(scheduler_service, 'is_initialized') and scheduler_service.is_initialized:
                    # Full scheduler with APScheduler
                    if hasattr(scheduler_service, 'get_all_schedules'):
                        all_schedules = await scheduler_service.get_all_schedules()
                        user_schedules = {s["job_id"]: s for s in all_schedules if s["user_id"] == current_user.id}
                        scheduler_available = True
                elif hasattr(scheduler_service, 'is_initialized'):
                    # Simple scheduler - database only, but still available
                    scheduler_available = True
                    logger.debug("Using simple scheduler service (database-only)")
                else:
                    # Unknown scheduler type
                    logger.warning("Unknown scheduler service type")
            except Exception as e:
                logger.error(f"Failed to get runtime schedules from scheduler: {e}", exc_info=True)
                scheduler_available = False
            
        # Merge database and runtime info if scheduler is available
        if scheduler_available and user_schedules:
            result = []
            for db_schedule in db_schedules:
                job_id = f"{db_schedule.schedule_type}_scrape_{db_schedule.user_id}"
                
                if job_id in user_schedules:
                    # Use runtime info
                    runtime_schedule = user_schedules[job_id]
                    logger.info(f"Using runtime info for {job_id}:")
                    logger.info(f"  - Next run: {runtime_schedule.get('next_run')}")
                    logger.info(f"  - Enabled: {runtime_schedule.get('enabled')}")
                    logger.info(f"  - Runtime schedule keys: {list(runtime_schedule.keys())}")
                    
                    # Check if runtime has active_hours
                    if 'active_hours' in runtime_schedule:
                        logger.warning(f"  - Runtime has active_hours: {runtime_schedule['active_hours']}")
                    
                    # Add database values that might be missing from runtime
                    logger.info(f"  - DB interval_hours: {db_schedule.interval_hours}")
                    logger.info(f"  - DB active_hours: {db_schedule.active_hours}")
                    runtime_schedule['interval_hours'] = db_schedule.interval_hours
                    runtime_schedule['active_hours'] = db_schedule.active_hours
                    # Ensure next_run has timezone suffix if present
                    if runtime_schedule.get('next_run') and not runtime_schedule['next_run'].endswith('Z'):
                        runtime_schedule['next_run'] = runtime_schedule['next_run'] + 'Z'
                    result.append(runtime_schedule)
                else:
                    # Use database info
                    logger.info(f"No runtime info for {job_id}, using database values")
                    logger.info(f"  - DB active_hours: {db_schedule.active_hours}")
                    result.append({
                        "job_id": job_id,
                        "user_id": db_schedule.user_id,
                        "type": db_schedule.schedule_type,
                        "enabled": db_schedule.enabled,
                        "next_run": format_datetime_for_api(db_schedule.next_run),
                        "pending": False,
                        "interval_hours": db_schedule.interval_hours,
                        "active_hours": db_schedule.active_hours
                    })
            
            return result
        else:
            # Return database info only (scheduler not available or no runtime data)
            logger.debug("Returning database-only schedule information")
            return [
                {
                    "job_id": f"{s.schedule_type}_scrape_{s.user_id}",
                    "user_id": s.user_id,
                    "type": s.schedule_type,
                    "enabled": s.enabled,
                    "next_run": format_datetime_for_api(s.next_run),
                    "pending": False,
                    "interval_hours": s.interval_hours,
                    "active_hours": s.active_hours,
                    "scheduler_available": scheduler_available
                }
                for s in db_schedules
            ]
        
    except Exception as e:
        log_error(e, "Failed to get schedules")
        logger.error(f"Failed to get schedules: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get schedules: {str(e)}"
        )


@router.get("/{job_id}", response_model=Dict[str, Any])
async def get_schedule(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific schedule by job ID
    """
    logger.debug(f"Getting schedule {job_id} for user {current_user.id}")
    try:
        # First check database
        from ..models.scraping_models import ScrapingSchedule
        
        # Extract user_id from job_id
        schedule_user_id = extract_user_id_from_job_id(job_id, current_user.id)
        
        # Security check
        if schedule_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        db_schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == schedule_user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not db_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Try to get runtime status
        if scheduler_service and hasattr(scheduler_service, 'get_schedule_status'):
            try:
                runtime_status = await scheduler_service.get_schedule_status(job_id)
                if runtime_status:
                    runtime_status["interval_hours"] = db_schedule.interval_hours
                    runtime_status["active_hours"] = db_schedule.active_hours
                    return runtime_status
            except Exception as e:
                logger.error(f"Failed to get runtime status for {job_id}: {e}", exc_info=True)
        
        # Return database info
        return {
            "job_id": job_id,
            "user_id": db_schedule.user_id,
            "type": db_schedule.schedule_type,
            "enabled": db_schedule.enabled,
            "next_run": format_datetime_for_api(db_schedule.next_run),
            "pending": False,
            "interval_hours": db_schedule.interval_hours,
            "active_hours": db_schedule.active_hours
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get schedule: {str(e)}"
        )


@router.put("/{job_id}", response_model=Dict[str, Any])
async def update_schedule(
    job_id: str,
    request: UpdateScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing schedule
    """
    logger.info(f"=== SCHEDULE UPDATE REQUEST ===")
    logger.info(f"Job ID: {job_id}")
    logger.info(f"User ID: {current_user.id}")
    logger.info(f"Request data: {request.dict()}")
    logger.info(f"Interval hours: {request.interval_hours}")
    logger.info(f"Active hours: {request.active_hours}")
    logger.info(f"Enabled: {request.enabled}")
    try:
        # Extract user_id from job_id
        schedule_user_id = extract_user_id_from_job_id(job_id, current_user.id)
        
        # Security check
        if schedule_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update in database first
        from ..models.scraping_models import ScrapingSchedule
        
        db_schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == schedule_user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not db_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Update database fields
        if request.interval_hours is not None:
            db_schedule.interval_hours = request.interval_hours
            logger.info(f"Updated interval_hours to: {request.interval_hours}")
        
        # Special handling for active_hours to ensure None is properly set
        if 'active_hours' in request.dict(exclude_unset=False):
            db_schedule.active_hours = request.active_hours
            logger.info(f"Updated active_hours to: {request.active_hours}")
            logger.info(f"Active hours is None: {request.active_hours is None}")
        
        if request.enabled is not None:
            db_schedule.enabled = request.enabled
            logger.info(f"Updated enabled to: {request.enabled}")
        
        db_schedule.updated_at = datetime.utcnow()
        
        logger.info("=== BEFORE DATABASE COMMIT ===")
        logger.info(f"Schedule in DB will have:")
        logger.info(f"  - interval_hours: {db_schedule.interval_hours}")
        logger.info(f"  - active_hours: {db_schedule.active_hours}")
        logger.info(f"  - enabled: {db_schedule.enabled}")
        
        db.commit()
        
        logger.info("=== AFTER DATABASE COMMIT ===")
        logger.info("Database commit successful")
        
        # Try to update in scheduler
        updated_in_scheduler = False
        logger.info(f"=== ATTEMPTING SCHEDULER UPDATE ===")
        logger.info(f"Scheduler service exists: {scheduler_service is not None}")
        
        if scheduler_service is not None:
            # Check if scheduler has update method
            has_update_method = hasattr(scheduler_service, 'update_schedule')
            logger.info(f"Has update_schedule method: {has_update_method}")
            
            # Check if scheduler is initialized
            is_initialized = getattr(scheduler_service, 'is_initialized', True)  # Simple scheduler is always "initialized"
            logger.info(f"Scheduler is initialized: {is_initialized}")
            
            if has_update_method and is_initialized:
                try:
                    logger.info(f"Calling scheduler_service.update_schedule with:")
                    logger.info(f"  - job_id: {job_id}")
                    logger.info(f"  - interval_hours: {request.interval_hours}")
                    logger.info(f"  - active_hours: {request.active_hours}")
                    logger.info(f"  - enabled: {request.enabled}")
                    
                    success = await scheduler_service.update_schedule(
                        job_id=job_id,
                        interval_hours=request.interval_hours,
                        active_hours=request.active_hours,
                        enabled=request.enabled
                    )
                    updated_in_scheduler = success
                    logger.info(f"Scheduler update result: {success}")
                except Exception as e:
                    # Log but don't fail
                    logger.error(f"Exception during scheduler update: {str(e)}", exc_info=True)
                    logger.warning(f"Failed to update scheduler, database updated only: {str(e)}")
            else:
                reason = "not initialized" if not is_initialized else "no update method"
                logger.warning(f"Scheduler service not available for update: {reason}")
        else:
            logger.warning("No scheduler service available for update")
        
        # Log the update
        log_automation_event("schedule_updated", {
            "user_id": current_user.id,
            "job_id": job_id,
            "changes": request.dict(exclude_unset=True),
            "scheduler_updated": updated_in_scheduler
        })
        logger.info(f"Updated schedule {job_id}")
        
        return {
            "success": True,
            "message": "Schedule updated successfully" if updated_in_scheduler else "Schedule updated (scheduler offline)",
            "job_id": job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, "Failed to update schedule")
        logger.error(f"Failed to update schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update schedule: {str(e)}"
        )


@router.delete("/{job_id}", response_model=Dict[str, Any])
async def delete_schedule(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a schedule
    """
    logger.info(f"Deleting schedule {job_id} for user {current_user.id}")
    try:
        # Extract user_id from job_id
        schedule_user_id = extract_user_id_from_job_id(job_id, current_user.id)
        
        # Security check
        if schedule_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete from database
        from ..models.scraping_models import ScrapingSchedule
        
        db_schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == schedule_user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if not db_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Try to remove from scheduler
        removed_from_scheduler = False
        if scheduler_service and hasattr(scheduler_service, 'remove_schedule'):
            try:
                success = await scheduler_service.remove_schedule(job_id)
                removed_from_scheduler = success
            except Exception as e:
                # Log but don't fail
                logger.warning(f"Failed to remove from scheduler: {str(e)}")
        
        # Delete from database
        db.delete(db_schedule)
        db.commit()
        
        # Log the deletion
        log_automation_event("schedule_deleted", {
            "user_id": current_user.id,
            "job_id": job_id,
            "scheduler_removed": removed_from_scheduler
        })
        logger.info(f"Deleted schedule {job_id}")
        
        return {
            "success": True,
            "message": "Schedule deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, "Failed to delete schedule")
        logger.error(f"Failed to delete schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete schedule: {str(e)}"
        )


@router.get("/history/{schedule_type}", response_model=List[Dict[str, Any]])
async def get_schedule_history(
    schedule_type: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get scraping history for a schedule type
    """
    logger.debug(f"Getting {schedule_type} history for user {current_user.id}, limit={limit}, offset={offset}")
    try:
        if scheduler_service and hasattr(scheduler_service, 'get_scraping_history'):
            return await scheduler_service.get_scraping_history(
                user_id=current_user.id,
                limit=limit,
                offset=offset
            )
        else:
            # Return empty history if scheduler not available
            return []
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get history: {str(e)}"
        )


@router.post("/trigger")
async def trigger_manual_scrape(
    request: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger a scheduled scrape immediately
    """
    schedule_type = request.get("schedule_type", "work_orders")
    ignore_schedule = request.get("ignore_schedule", True)
    
    logger.info(f"=== MANUAL TRIGGER REQUEST ===")
    logger.info(f"User: {current_user.id}")
    logger.info(f"Schedule type: {schedule_type}")
    logger.info(f"Ignore schedule: {ignore_schedule}")
    
    try:
        if schedule_type != "work_orders":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported schedule type: {schedule_type}"
            )
        
        # Check if user has a schedule
        from ..models.scraping_models import ScrapingSchedule
        
        db_schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == current_user.id,
            ScrapingSchedule.schedule_type == schedule_type
        ).first()
        
        if not db_schedule:
            raise HTTPException(
                status_code=404,
                detail="No schedule found. Please create a schedule first."
            )
        
        # Import and execute the job function directly
        from ..services.scheduler_service import execute_work_order_scraping
        import asyncio
        
        logger.info(f"Triggering immediate execution of {schedule_type} scraping")
        
        # Run the job in the background with manual trigger type
        asyncio.create_task(execute_work_order_scraping(current_user.id, trigger_type="manual"))
        
        return {
            "success": True,
            "message": f"Manual {schedule_type} scraping triggered successfully",
            "user_id": current_user.id,
            "timestamp": format_datetime_for_api(datetime.utcnow())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger manual scrape: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger manual scrape: {str(e)}"
        )


@router.delete("/history/{history_id}")
async def delete_scraping_history(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific scraping history record
    """
    logger.info(f"Deleting history record {history_id} for user {current_user.id}")
    
    try:
        from ..models.scraping_models import ScrapingHistory
        
        # Find the history record
        history_record = db.query(ScrapingHistory).filter(
            ScrapingHistory.id == history_id,
            ScrapingHistory.user_id == current_user.id  # Ensure user owns this record
        ).first()
        
        if not history_record:
            raise HTTPException(
                status_code=404,
                detail="History record not found"
            )
        
        # Delete the record
        db.delete(history_record)
        db.commit()
        
        logger.info(f"Successfully deleted history record {history_id}")
        
        return {
            "success": True,
            "message": f"History record {history_id} deleted successfully",
            "timestamp": format_datetime_for_api(datetime.utcnow())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete history record: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete history record: {str(e)}"
        )


@router.delete("/history")
async def delete_all_scraping_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete all scraping history records for the current user
    """
    logger.info(f"Deleting all history records for user {current_user.id}")
    
    try:
        from ..models.scraping_models import ScrapingHistory
        
        # Delete all history records for this user
        deleted_count = db.query(ScrapingHistory).filter(
            ScrapingHistory.user_id == current_user.id
        ).delete()
        
        db.commit()
        
        logger.info(f"Successfully deleted {deleted_count} history records")
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} history records",
            "timestamp": format_datetime_for_api(datetime.utcnow())
        }
        
    except Exception as e:
        logger.error(f"Failed to delete history records: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete history records: {str(e)}"
        )
