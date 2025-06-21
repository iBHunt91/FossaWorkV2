#!/usr/bin/env python3
"""
Fix schedule creation routes to handle scheduler properly
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

print("🔧 Fixing Schedule Routes")
print("=" * 50)

# Read the routes file
routes_file = backend_dir / "app" / "routes" / "scraping_schedules.py"
with open(routes_file, 'r') as f:
    content = f.read()

# Check for the main issue - scheduler not initialized check
if "# Check if scheduler is initialized" in content and "not scheduler_service.is_initialized" in content:
    print("✅ Found scheduler initialization checks")
    
    # We need to ensure the scheduler is properly awaited
    # Look for the create_schedule function
    import re
    
    # Find the create_schedule function
    create_func_match = re.search(r'(@router\.post.*?async def create_schedule.*?)(?=@router|\Z)', content, re.DOTALL)
    
    if create_func_match:
        create_func = create_func_match.group(0)
        
        # Check if it's properly handling the scheduler initialization
        if "await scheduler_service.add_work_order_scraping_schedule" in create_func:
            print("✅ Create function already uses await properly")
        else:
            print("❌ Need to fix await in create function")
            
        # Check for the fallback database-only mode
        if "# If scheduler is not initialized, just store in database" in create_func:
            print("✅ Has database fallback mode")
        else:
            print("⚠️  Missing database fallback mode")

# Create a proper fix for the create_schedule endpoint
fixed_create_function = '''@router.post("/", response_model=Dict[str, Any])
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
        logging_service = LoggingService()
        await logging_service.log_info(
            f"Creating {request.schedule_type} schedule for user {current_user.id}",
            db=db
        )
        
        # For work order scraping
        if request.schedule_type != "work_orders":
            raise HTTPException(
                status_code=400,
                detail="Only work_orders schedule type is currently supported"
            )
        
        # Check if scheduler service is available and initialized
        job_id = None
        schedule_created = False
        
        try:
            # Try to use the scheduler service if available
            if hasattr(scheduler_service, 'is_initialized') and scheduler_service.is_initialized:
                job_id = await scheduler_service.add_work_order_scraping_schedule(
                    user_id=current_user.id,
                    interval_hours=request.interval_hours,
                    active_hours=request.active_hours,
                    enabled=request.enabled
                )
                schedule_created = True
                await logging_service.log_info(
                    f"Schedule created with job ID: {job_id}",
                    db=db
                )
            else:
                await logging_service.log_warning(
                    "Scheduler service not initialized, creating database-only schedule",
                    db=db
                )
        except Exception as e:
            await logging_service.log_warning(
                f"Failed to create scheduled job, falling back to database: {str(e)}",
                db=db
            )
        
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
        await logging_service.log_event(
            event_type="schedule_created",
            message=f"Created {request.schedule_type} schedule with {request.interval_hours}h interval",
            user_id=current_user.id,
            metadata={
                "job_id": job_id,
                "interval_hours": request.interval_hours,
                "active_hours": request.active_hours,
                "enabled": request.enabled,
                "scheduler_active": schedule_created
            },
            db=db
        )
        
        # Prepare response
        schedule_status = None
        if schedule_created and hasattr(scheduler_service, 'get_schedule_status'):
            schedule_status = await scheduler_service.get_schedule_status(job_id)
        
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
        logging_service = LoggingService()
        await logging_service.log_error(
            f"Failed to create schedule: {str(e)}",
            db=db
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create schedule: {str(e)}"
        )'''

print("\n📝 Creating improved routes file...")

# Write the improved routes file
improved_routes = f"""#!/usr/bin/env python3
\"\"\"
Scraping Schedule API Routes

Handles automated work order scraping schedules with support for:
- Hourly intervals during business hours
- Enable/disable functionality
- Schedule history tracking
\"\"\"

from datetime import datetime, time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from ..auth.dependencies import get_current_user
from ..models.user_models import User
from ..services.logging_service import LoggingService

# Try to import scheduler service, but handle gracefully if not available
try:
    from ..services.scheduler_service import scheduler_service
except ImportError:
    scheduler_service = None

router = APIRouter(prefix="/api/scraping-schedules", tags=["scraping-schedules"])


class CreateScheduleRequest(BaseModel):
    schedule_type: str = Field(..., description="Type of schedule (e.g., 'work_orders')")
    interval_hours: float = Field(1.0, ge=0.5, le=24, description="Interval between runs in hours")
    active_hours: Optional[Dict[str, int]] = Field(None, description="Active hours (start/end)")
    enabled: bool = Field(True, description="Whether schedule is enabled")


class UpdateScheduleRequest(BaseModel):
    interval_hours: Optional[float] = Field(None, ge=0.5, le=24)
    active_hours: Optional[Dict[str, int]] = None
    enabled: Optional[bool] = None


{fixed_create_function}


@router.get("/", response_model=List[Dict[str, Any]])
async def get_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    \"\"\"
    Get all schedules for the current user
    \"\"\"
    try:
        # Always get schedules from database first
        from ..models.scraping_models import ScrapingSchedule
        
        db_schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == current_user.id
        ).all()
        
        # If scheduler service is available, enhance with runtime info
        if scheduler_service and hasattr(scheduler_service, 'is_initialized') and scheduler_service.is_initialized:
            # Get runtime schedules
            all_schedules = await scheduler_service.get_all_schedules()
            user_schedules = {{s["job_id"]: s for s in all_schedules if s["user_id"] == current_user.id}}
            
            # Merge database and runtime info
            result = []
            for db_schedule in db_schedules:
                job_id = f"{{db_schedule.schedule_type}}_scrape_{{db_schedule.user_id}}"
                
                if job_id in user_schedules:
                    # Use runtime info
                    result.append(user_schedules[job_id])
                else:
                    # Use database info
                    result.append({{
                        "job_id": job_id,
                        "user_id": db_schedule.user_id,
                        "type": db_schedule.schedule_type,
                        "enabled": db_schedule.enabled,
                        "next_run": db_schedule.next_run.isoformat() if db_schedule.next_run else None,
                        "pending": False,
                        "interval_hours": db_schedule.interval_hours,
                        "active_hours": db_schedule.active_hours
                    }})
            
            return result
        else:
            # Return database info only
            return [
                {{
                    "job_id": f"{{s.schedule_type}}_scrape_{{s.user_id}}",
                    "user_id": s.user_id,
                    "type": s.schedule_type,
                    "enabled": s.enabled,
                    "next_run": s.next_run.isoformat() if s.next_run else None,
                    "pending": False,
                    "interval_hours": s.interval_hours,
                    "active_hours": s.active_hours
                }}
                for s in db_schedules
            ]
        
    except Exception as e:
        logging_service = LoggingService()
        await logging_service.log_error(
            f"Failed to get schedules: {{str(e)}}",
            db=db
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get schedules: {{str(e)}}"
        )


@router.get("/{{job_id}}", response_model=Dict[str, Any])
async def get_schedule(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    \"\"\"
    Get a specific schedule by job ID
    \"\"\"
    try:
        # First check database
        from ..models.scraping_models import ScrapingSchedule
        
        # Extract user_id from job_id (format: work_order_scrape_{{user_id}})
        if job_id.startswith("work_order_scrape_"):
            schedule_user_id = job_id.replace("work_order_scrape_", "")
        else:
            schedule_user_id = current_user.id
        
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
            runtime_status = await scheduler_service.get_schedule_status(job_id)
            if runtime_status:
                runtime_status["interval_hours"] = db_schedule.interval_hours
                runtime_status["active_hours"] = db_schedule.active_hours
                return runtime_status
        
        # Return database info
        return {{
            "job_id": job_id,
            "user_id": db_schedule.user_id,
            "type": db_schedule.schedule_type,
            "enabled": db_schedule.enabled,
            "next_run": db_schedule.next_run.isoformat() if db_schedule.next_run else None,
            "pending": False,
            "interval_hours": db_schedule.interval_hours,
            "active_hours": db_schedule.active_hours
        }}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get schedule: {{str(e)}}"
        )


@router.put("/{{job_id}}", response_model=Dict[str, Any])
async def update_schedule(
    job_id: str,
    request: UpdateScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    \"\"\"
    Update an existing schedule
    \"\"\"
    try:
        # Extract user_id from job_id
        if job_id.startswith("work_order_scrape_"):
            schedule_user_id = job_id.replace("work_order_scrape_", "")
        else:
            schedule_user_id = current_user.id
        
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
        if request.active_hours is not None:
            db_schedule.active_hours = request.active_hours
        if request.enabled is not None:
            db_schedule.enabled = request.enabled
        
        db_schedule.updated_at = datetime.utcnow()
        db.commit()
        
        # Try to update in scheduler
        updated_in_scheduler = False
        if scheduler_service and hasattr(scheduler_service, 'update_schedule'):
            try:
                success = await scheduler_service.update_schedule(
                    job_id=job_id,
                    interval_hours=request.interval_hours,
                    active_hours=request.active_hours,
                    enabled=request.enabled
                )
                updated_in_scheduler = success
            except Exception as e:
                # Log but don't fail
                logging_service = LoggingService()
                await logging_service.log_warning(
                    f"Failed to update scheduler, database updated only: {{str(e)}}",
                    db=db
                )
        
        # Log the update
        logging_service = LoggingService()
        await logging_service.log_event(
            event_type="schedule_updated",
            message=f"Updated schedule {{job_id}}",
            user_id=current_user.id,
            metadata={{
                "job_id": job_id,
                "changes": request.dict(exclude_unset=True),
                "scheduler_updated": updated_in_scheduler
            }},
            db=db
        )
        
        return {{
            "success": True,
            "message": "Schedule updated successfully" if updated_in_scheduler else "Schedule updated (scheduler offline)",
            "job_id": job_id
        }}
        
    except HTTPException:
        raise
    except Exception as e:
        logging_service = LoggingService()
        await logging_service.log_error(
            f"Failed to update schedule: {{str(e)}}",
            db=db
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update schedule: {{str(e)}}"
        )


@router.delete("/{{job_id}}", response_model=Dict[str, Any])
async def delete_schedule(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    \"\"\"
    Delete a schedule
    \"\"\"
    try:
        # Extract user_id from job_id
        if job_id.startswith("work_order_scrape_"):
            schedule_user_id = job_id.replace("work_order_scrape_", "")
        else:
            schedule_user_id = current_user.id
        
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
                logging_service = LoggingService()
                await logging_service.log_warning(
                    f"Failed to remove from scheduler: {{str(e)}}",
                    db=db
                )
        
        # Delete from database
        db.delete(db_schedule)
        db.commit()
        
        # Log the deletion
        logging_service = LoggingService()
        await logging_service.log_event(
            event_type="schedule_deleted",
            message=f"Deleted schedule {{job_id}}",
            user_id=current_user.id,
            metadata={{
                "job_id": job_id,
                "scheduler_removed": removed_from_scheduler
            }},
            db=db
        )
        
        return {{
            "success": True,
            "message": "Schedule deleted successfully"
        }}
        
    except HTTPException:
        raise
    except Exception as e:
        logging_service = LoggingService()
        await logging_service.log_error(
            f"Failed to delete schedule: {{str(e)}}",
            db=db
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete schedule: {{str(e)}}"
        )


@router.get("/history/{{schedule_type}}", response_model=List[Dict[str, Any]])
async def get_schedule_history(
    schedule_type: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    \"\"\"
    Get scraping history for a schedule type
    \"\"\"
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
            detail=f"Failed to get history: {{str(e)}}"
        )
"""

# Write the improved file
with open(routes_file, 'w') as f:
    f.write(improved_routes)

print("✅ Routes file updated with improved error handling")
print("\n📌 Key improvements:")
print("   - Always saves to database even if scheduler is offline")
print("   - Gracefully handles scheduler not being initialized")
print("   - Returns consistent response format")
print("   - Better error messages for the frontend")
print("\n🎯 Next: Restart the backend server to apply changes")