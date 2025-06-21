"""
Schedule Detection API Routes

V1-compatible endpoints for schedule change detection and analysis.
Provides real-time change detection, historical analysis, and notification triggers.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..services.schedule_detection import ScheduleDetectionService, get_schedule_detection_service
from ..services.user_management import UserManagementService
from ..services.logging_service import LoggingService
from ..models.user_schemas import APIResponse
from ..models.user_models import UserScheduleChanges
from ..auth.dependencies import require_auth
from ..models import User

router = APIRouter(prefix="/api/schedule", tags=["schedule_detection"])

def get_user_service(db: Session = Depends(get_db)) -> UserManagementService:
    return UserManagementService()

def get_logging_service(db: Session = Depends(get_db)) -> LoggingService:
    return LoggingService()


@router.post("/analyze", response_model=None)
async def analyze_schedule_changes(
    schedule_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    include_preferences: bool = Query(True, description="Apply user notification preferences"),
    schedule_service: ScheduleDetectionService = Depends(get_schedule_detection_service),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """
    Analyze schedule changes for a user
    
    V1-compatible endpoint that performs comprehensive schedule change detection
    including removed/added/modified/swapped jobs with intelligent filtering.
    """
    try:
        # User is already verified through authentication
        user = current_user
        
        # Get user preferences for filtering
        user_preferences = None
        if include_preferences:
            notification_prefs = user_service.get_user_preference(user_id, "notification")
            if notification_prefs:
                user_preferences = {"notifications": notification_prefs}
        
        # Perform schedule analysis
        changes = await schedule_service.analyze_schedule_changes(
            user_id, 
            schedule_data, 
            user_preferences
        )
        
        if changes is None:
            # No previous data for comparison
            background_tasks.add_task(
                logging_service.log_info,
                f"Schedule analysis baseline created for user {user.email}"
            )
            
            return {
                "success": True,
                "message": "Schedule baseline created - no previous data for comparison",
                "user_id": user_id,
                "changes": None,
                "baseline_created": True
            }
        
        # Check if significant changes were detected
        has_changes = any([
            changes["summary"]["added"] > 0,
            changes["summary"]["removed"] > 0,
            changes["summary"]["modified"] > 0,
            changes["summary"]["swapped"] > 0
        ])
        
        if has_changes:
            # Log the detection
            background_tasks.add_task(
                logging_service.log_info,
                f"Schedule changes detected for {user.email}: "
                f"A:{changes['summary']['added']} R:{changes['summary']['removed']} "
                f"M:{changes['summary']['modified']} S:{changes['summary']['swapped']}"
            )
            
            # Track activity
            background_tasks.add_task(
                user_service.track_activity,
                user_id,
                user.email,
                "schedule_changes_detected",
                {
                    "changes_summary": changes["summary"],
                    "total_changes": len(changes["allChanges"]),
                    "analysis_timestamp": datetime.utcnow().isoformat()
                }
            )
        
        return {
            "success": True,
            "message": f"Schedule analysis completed - {len(changes['allChanges'])} changes detected",
            "user_id": user_id,
            "changes": changes,
            "has_significant_changes": has_changes,
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await logging_service.log_error(
            f"Schedule analysis failed for user {user_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Schedule analysis failed: {str(e)}"
        )


@router.get("/history")
async def get_schedule_change_history(
    limit: int = Query(50, description="Maximum number of changes to return", le=200),
    days_back: int = Query(30, description="Number of days to look back", le=365),
    change_types: Optional[List[str]] = Query(None, description="Filter by change types"),
    user_service: UserManagementService = Depends(get_user_service),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """Get historical schedule changes for a user"""
    try:
        # User is already verified through authentication
        user = current_user
        
        # Calculate date range
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Query schedule changes
        query = db.query(UserScheduleChanges).filter(
            UserScheduleChanges.user_id == user_id,
            UserScheduleChanges.detected_at >= start_date
        )
        
        # Filter by change types if specified
        if change_types:
            query = query.filter(UserScheduleChanges.change_type.in_(change_types))
        
        changes = query.order_by(UserScheduleChanges.detected_at.desc()).limit(limit).all()
        
        # Format response
        history = []
        for change in changes:
            history.append({
                "id": change.id,
                "change_type": change.change_type,
                "detected_at": change.detected_at.isoformat(),
                "summary": change.changes_data.get("summary", {}) if change.changes_data else {},
                "total_changes": len(change.changes_data.get("allChanges", [])) if change.changes_data else 0,
                "summary_text": change.summary_text[:200] + "..." if len(change.summary_text or "") > 200 else change.summary_text
            })
        
        return {
            "success": True,
            "user_id": user_id,
            "history": history,
            "total_returned": len(history),
            "date_range": {
                "start": start_date.isoformat(),
                "end": datetime.utcnow().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get schedule history: {str(e)}"
        )


@router.get("/changes/{change_id}")
async def get_schedule_change_details(
    change_id: int,
    user_service: UserManagementService = Depends(get_user_service),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get detailed information about a specific schedule change"""
    try:
        change = db.query(UserScheduleChanges).filter(UserScheduleChanges.id == change_id).first()
        
        if not change:
            raise HTTPException(
                status_code=404,
                detail="Schedule change not found"
            )
        
        # Verify the current user owns this change record
        if change.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this schedule change"
            )
        
        user = current_user
        
        return {
            "success": True,
            "change": {
                "id": change.id,
                "user_id": change.user_id,
                "user_email": user.email,
                "change_type": change.change_type,
                "detected_at": change.detected_at.isoformat(),
                "changes_data": change.changes_data,
                "summary_text": change.summary_text,
                "summary": change.changes_data.get("summary", {}) if change.changes_data else {},
                "all_changes": change.changes_data.get("allChanges", []) if change.changes_data else []
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get change details: {str(e)}"
        )


@router.post("/test-detection")
async def test_schedule_detection(
    test_data: Dict[str, Any],
    schedule_service: ScheduleDetectionService = Depends(get_schedule_detection_service),
    current_user: User = Depends(require_auth)
):
    """
    Test schedule detection with sample data
    
    Useful for testing the detection algorithms without affecting user data.
    Expects test_data with 'current' and 'previous' schedule objects.
    """
    try:
        current_schedule = test_data.get("current")
        previous_schedule = test_data.get("previous")
        user_preferences = test_data.get("user_preferences")
        
        if not current_schedule or not previous_schedule:
            raise HTTPException(
                status_code=400,
                detail="Test data must include 'current' and 'previous' schedule objects"
            )
        
        # Use the comparison method directly for testing
        changes = await schedule_service._compare_schedules(
            current_schedule,
            previous_schedule,
            user_preferences,
            "test_user"
        )
        
        return {
            "success": True,
            "message": "Schedule detection test completed",
            "test_results": changes,
            "total_changes": len(changes.get("allChanges", [])),
            "summary": changes.get("summary", {}),
            "test_timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Schedule detection test failed: {str(e)}"
        )


@router.get("/statistics")
async def get_schedule_statistics(
    days_back: int = Query(30, description="Number of days for statistics", le=365),
    user_service: UserManagementService = Depends(get_user_service),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """Get schedule change statistics for a user"""
    try:
        # User is already verified through authentication
        user = current_user
        
        # Calculate date range
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Get all changes in the period
        changes = db.query(UserScheduleChanges).filter(
            UserScheduleChanges.user_id == user_id,
            UserScheduleChanges.detected_at >= start_date
        ).all()
        
        # Calculate statistics
        stats = {
            "total_detections": len(changes),
            "change_type_counts": {},
            "summary_totals": {
                "added": 0,
                "removed": 0,
                "modified": 0,
                "swapped": 0
            },
            "daily_activity": {},
            "most_active_days": [],
            "average_changes_per_detection": 0
        }
        
        total_individual_changes = 0
        
        for change in changes:
            # Count by change type
            change_type = change.change_type
            stats["change_type_counts"][change_type] = stats["change_type_counts"].get(change_type, 0) + 1
            
            # Sum up individual changes
            if change.changes_data and "summary" in change.changes_data:
                summary = change.changes_data["summary"]
                for key in stats["summary_totals"]:
                    stats["summary_totals"][key] += summary.get(key, 0)
                
                # Count total individual changes
                all_changes = change.changes_data.get("allChanges", [])
                total_individual_changes += len(all_changes)
            
            # Daily activity
            date_key = change.detected_at.strftime("%Y-%m-%d")
            stats["daily_activity"][date_key] = stats["daily_activity"].get(date_key, 0) + 1
        
        # Calculate averages
        if len(changes) > 0:
            stats["average_changes_per_detection"] = round(total_individual_changes / len(changes), 2)
        
        # Find most active days
        if stats["daily_activity"]:
            sorted_days = sorted(stats["daily_activity"].items(), key=lambda x: x[1], reverse=True)
            stats["most_active_days"] = sorted_days[:5]
        
        return {
            "success": True,
            "user_id": user_id,
            "user_email": user.email,
            "statistics": stats,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": datetime.utcnow().isoformat(),
                "days": days_back
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get schedule statistics: {str(e)}"
        )


@router.delete("/history")
async def clear_schedule_history(
    background_tasks: BackgroundTasks,
    days_older_than: int = Query(90, description="Delete changes older than X days"),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    user_id = current_user.id
    """Clear old schedule change history for a user"""
    try:
        # User is already verified through authentication
        user = current_user
        
        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=days_older_than)
        
        # Count changes to be deleted
        changes_to_delete = db.query(UserScheduleChanges).filter(
            UserScheduleChanges.user_id == user_id,
            UserScheduleChanges.detected_at < cutoff_date
        ).count()
        
        if changes_to_delete == 0:
            return {
                "success": True,
                "message": "No old schedule changes found to delete",
                "user_id": user_id,
                "deleted_count": 0
            }
        
        # Delete old changes
        deleted_count = db.query(UserScheduleChanges).filter(
            UserScheduleChanges.user_id == user_id,
            UserScheduleChanges.detected_at < cutoff_date
        ).delete()
        
        db.commit()
        
        # Log the cleanup
        background_tasks.add_task(
            logging_service.log_info,
            f"Schedule history cleanup for {user.email}: {deleted_count} records deleted (older than {days_older_than} days)"
        )
        
        return {
            "success": True,
            "message": f"Schedule history cleanup completed",
            "user_id": user_id,
            "deleted_count": deleted_count,
            "cutoff_date": cutoff_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear schedule history: {str(e)}"
        )