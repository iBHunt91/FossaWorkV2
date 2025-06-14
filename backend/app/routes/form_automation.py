"""
Form Automation API Routes

V1-compatible endpoints for form automation with advanced business logic.
Provides work order analysis, job creation, progress tracking, and automation control.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime

from ..database import get_db
from ..services.form_automation import FormAutomationService
from ..services.form_automation_browser_integration import FormAutomationBrowserIntegration, get_form_automation_browser_integration
from ..services.user_management import UserManagementService
from ..services.logging_service import LoggingService
from ..models.user_schemas import APIResponse
from ..services.browser_automation import browser_automation
# V1 import removed - no longer needed after migration

router = APIRouter(prefix="/api/form-automation", tags=["form_automation"])

# Alias for compatibility
FormAutomationV1Service = FormAutomationService

def get_form_automation_v1_service():
    """Get form automation service instance"""
    return FormAutomationService(browser_automation)

def get_user_service(db: Session = Depends(get_db)):
    return UserManagementService(db)

def get_logging_service(db: Session = Depends(get_db)):
    return LoggingService(db)


@router.post("/analyze-work-order", response_model=None)
async def analyze_work_order(
    work_order_data: Dict[str, Any],
    user_id: str = Query(..., description="User ID for preferences"),
    include_user_preferences: bool = Query(True, description="Apply user automation preferences"),
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """
    Analyze work order to determine automation strategy
    
    V1-compatible analysis including service code detection, fuel grade classification,
    and automation template selection based on sophisticated business logic.
    """
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} not found"
            )
        
        # Get user preferences if requested
        user_preferences = None
        if include_user_preferences:
            automation_prefs = user_service.get_user_preference(user_id, "automation")
            if automation_prefs:
                user_preferences = {"automation": automation_prefs}
        
        # Perform work order analysis
        strategy = await form_service.analyze_work_order(work_order_data, user_preferences)
        
        # Convert strategy to response format
        strategy_response = {
            "service_code": strategy.service_code.value,
            "service_description": form_service.SERVICE_CODE_PATTERNS[strategy.service_code.value]["description"],
            "dispenser_numbers": strategy.dispenser_numbers,
            "dispenser_count": len(strategy.dispenser_numbers),
            "fuel_grades": strategy.fuel_grades,
            "metered_grades": strategy.metered_grades,
            "non_metered_grades": strategy.non_metered_grades,
            "automation_template": strategy.automation_template.value,
            "total_iterations": strategy.total_iterations,
            "estimated_duration_minutes": strategy.total_iterations * 2,  # ~2 minutes per iteration
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
        
        await logging_service.log_info(
            f"Work order analysis completed for user {user.email}: "
            f"{strategy.service_code.value}, {len(strategy.dispenser_numbers)} dispensers, "
            f"{strategy.total_iterations} iterations"
        )
        
        return {
            "success": True,
            "message": "Work order analysis completed",
            "user_id": user_id,
            "strategy": strategy_response,
            "work_order_info": {
                "id": work_order_data.get("id", "unknown"),
                "customer": work_order_data.get("customer", {}),
                "services": work_order_data.get("services", [])
            }
        }
        
    except Exception as e:
        await logging_service.log_error(
            f"Work order analysis failed for user {user_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Work order analysis failed: {str(e)}"
        )


@router.post("/create-job", response_model=None)
async def create_automation_job(
    user_id: str,
    work_order_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    include_user_preferences: bool = Query(True, description="Apply user automation preferences"),
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """
    Create new form automation job
    
    Creates a complete automation job with V1-compatible strategy analysis,
    progress tracking setup, and error recovery state initialization.
    """
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} not found"
            )
        
        # Get user preferences if requested
        user_preferences = None
        if include_user_preferences:
            automation_prefs = user_service.get_user_preference(user_id, "automation")
            if automation_prefs:
                user_preferences = {"automation": automation_prefs}
        
        # Create automation job
        job = await form_service.create_automation_job(
            user_id, 
            work_order_data, 
            user_preferences
        )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user_id,
            user.email,
            "form_automation_job_created",
            {
                "job_id": job.job_id,
                "work_order_id": job.work_order_id,
                "service_code": job.service_code.value,
                "dispenser_count": len(job.dispenser_strategy.dispenser_numbers),
                "total_iterations": job.dispenser_strategy.total_iterations,
                "station_type": job.station_info.get("station_type"),
                "creation_timestamp": job.created_at.isoformat()
            }
        )
        
        return {
            "success": True,
            "message": "Form automation job created successfully",
            "job": {
                "job_id": job.job_id,
                "work_order_id": job.work_order_id,
                "visit_id": job.visit_id,
                "status": job.status,
                "strategy": {
                    "service_code": job.service_code.value,
                    "dispenser_count": len(job.dispenser_strategy.dispenser_numbers),
                    "automation_template": job.dispenser_strategy.automation_template.value,
                    "total_iterations": job.dispenser_strategy.total_iterations
                },
                "station_info": job.station_info,
                "progress": job.progress_tracker,
                "created_at": job.created_at.isoformat()
            }
        }
        
    except Exception as e:
        await logging_service.log_error(
            f"Job creation failed for user {user_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Job creation failed: {str(e)}"
        )


@router.get("/job/{job_id}")
async def get_job_status(
    job_id: str,
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service)
):
    """Get current status and progress of automation job"""
    try:
        job_status = await form_service.get_job_status(job_id)
        
        if not job_status:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )
        
        return {
            "success": True,
            "job": job_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get job status: {str(e)}"
        )


@router.post("/job/{job_id}/update-progress", response_model=None)
async def update_job_progress(
    job_id: str,
    progress_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """
    Update job progress
    
    Updates automation job progress with real-time tracking data.
    Used by browser automation service to report progress.
    """
    try:
        # Verify job exists
        job_status = await form_service.get_job_status(job_id)
        if not job_status:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )
        
        # Update progress
        await form_service.update_job_progress(
            job_id=job_id,
            phase=progress_data.get("phase"),
            current_dispenser=progress_data.get("current_dispenser"),
            current_iteration=progress_data.get("current_iteration"),
            fuel_grade=progress_data.get("fuel_grade"),
            additional_data=progress_data.get("additional_data", {})
        )
        
        # Log progress update
        background_tasks.add_task(
            logging_service.log_info,
            f"Job {job_id} progress updated: {progress_data.get('phase', 'unknown')} - "
            f"{progress_data.get('current_iteration', 0)}/{job_status['progress']['total_iterations']}"
        )
        
        return {
            "success": True,
            "message": "Progress updated successfully",
            "job_id": job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update job progress: {str(e)}"
        )


@router.get("/jobs/user/{user_id}")
async def get_user_jobs(
    user_id: str,
    status_filter: Optional[str] = Query(None, description="Filter by job status"),
    limit: int = Query(50, description="Maximum number of jobs to return", le=200),
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service),
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get automation jobs for a user"""
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} not found"
            )
        
        # Get all jobs for user
        user_jobs = []
        for job_id, job in form_service.active_jobs.items():
            if job.user_id == user_id:
                if status_filter and job.status != status_filter:
                    continue
                
                job_info = {
                    "job_id": job.job_id,
                    "work_order_id": job.work_order_id,
                    "status": job.status,
                    "created_at": job.created_at.isoformat(),
                    "progress_percentage": job.progress_tracker.get("progress_percentage", 0),
                    "current_phase": job.progress_tracker.get("phase", "unknown"),
                    "station_info": job.station_info,
                    "service_code": job.service_code.value,
                    "total_iterations": job.dispenser_strategy.total_iterations
                }
                user_jobs.append(job_info)
        
        # Sort by creation time (newest first) and limit
        user_jobs.sort(key=lambda x: x["created_at"], reverse=True)
        user_jobs = user_jobs[:limit]
        
        return {
            "success": True,
            "user_id": user_id,
            "user_email": user.email,
            "jobs": user_jobs,
            "total_returned": len(user_jobs),
            "filter_applied": status_filter
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get user jobs: {str(e)}"
        )


@router.post("/test-service-code-detection", response_model=None)
async def test_service_code_detection(
    test_data: Dict[str, Any],
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service)
):
    """
    Test service code detection with sample data
    
    Useful for testing the V1 service code detection algorithms without creating jobs.
    """
    try:
        services = test_data.get("services", [])
        if not services:
            raise HTTPException(
                status_code=400,
                detail="Test data must include 'services' array"
            )
        
        # Test service code detection
        detected_code = await form_service._detect_service_code(services)
        
        # Test dispenser count extraction
        dispenser_count = await form_service._extract_dispenser_count(services, detected_code)
        
        # Get pattern information
        pattern_info = form_service.SERVICE_CODE_PATTERNS.get(detected_code.value, {})
        
        return {
            "success": True,
            "message": "Service code detection test completed",
            "results": {
                "detected_service_code": detected_code.value,
                "service_description": pattern_info.get("description", "Unknown"),
                "strategy": pattern_info.get("strategy", "Unknown"),
                "detected_dispenser_count": dispenser_count,
                "test_services": services
            },
            "test_timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Service code detection test failed: {str(e)}"
        )


@router.post("/test-fuel-classification", response_model=None)
async def test_fuel_classification(
    test_data: Dict[str, Any],
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service)
):
    """
    Test fuel grade classification with sample data
    
    Tests V1's sophisticated fuel grade classification logic including
    the special Premium conditional logic based on Super variants.
    """
    try:
        fuel_grades = test_data.get("fuel_grades", {})
        if not fuel_grades:
            raise HTTPException(
                status_code=400,
                detail="Test data must include 'fuel_grades' dictionary"
            )
        
        # Test fuel classification
        metered_grades, non_metered_grades = await form_service._classify_fuel_grades(fuel_grades)
        
        # Calculate statistics
        total_metered = sum(len(grades) for grades in metered_grades.values())
        total_non_metered = sum(len(grades) for grades in non_metered_grades.values())
        total_grades = total_metered + total_non_metered
        
        return {
            "success": True,
            "message": "Fuel classification test completed",
            "results": {
                "input_fuel_grades": fuel_grades,
                "metered_grades": metered_grades,
                "non_metered_grades": non_metered_grades,
                "statistics": {
                    "total_grades": total_grades,
                    "total_metered": total_metered,
                    "total_non_metered": total_non_metered,
                    "metered_percentage": round((total_metered / total_grades * 100), 1) if total_grades > 0 else 0
                }
            },
            "classification_rules": {
                "always_metered": list(form_service.ALWAYS_METERED_FUELS),
                "never_metered": list(form_service.NEVER_METERED_FUELS),
                "premium_keywords": list(form_service.PREMIUM_KEYWORDS)
            },
            "test_timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Fuel classification test failed: {str(e)}"
        )


@router.get("/service-codes")
async def get_service_codes(
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service)
):
    """Get all available service codes and their patterns"""
    return {
        "success": True,
        "service_codes": form_service.SERVICE_CODE_PATTERNS,
        "fuel_classification_rules": {
            "always_metered": list(form_service.ALWAYS_METERED_FUELS),
            "never_metered": list(form_service.NEVER_METERED_FUELS),
            "premium_keywords": list(form_service.PREMIUM_KEYWORDS)
        }
    }


@router.delete("/job/{job_id}")
async def cancel_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    form_service: FormAutomationV1Service = Depends(get_form_automation_v1_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Cancel running automation job"""
    try:
        # Get job info before cancellation
        job_status = await form_service.get_job_status(job_id)
        if not job_status:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )
        
        # Cancel job (this would also trigger browser cleanup in full implementation)
        success = await form_service.cancel_job(job_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to cancel job"
            )
        
        # Log cancellation
        background_tasks.add_task(
            logging_service.log_info,
            f"Job {job_id} cancelled by user request"
        )
        
        return {
            "success": True,
            "message": f"Job {job_id} cancelled successfully",
            "job_id": job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel job: {str(e)}"
        )


# ================================
# INTEGRATED AUTOMATION ENDPOINTS
# ================================

@router.post("/execute-full-automation", response_model=None)
async def execute_full_automation(
    user_id: str,
    work_order_data: Dict[str, Any],
    credentials: Dict[str, str],
    background_tasks: BackgroundTasks,
    include_user_preferences: bool = Query(True, description="Apply user automation preferences"),
    integration_service: FormAutomationBrowserIntegration = Depends(get_form_automation_browser_integration),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """
    Execute complete automation workflow with browser integration
    
    This endpoint combines V1-compatible business logic analysis with actual
    browser automation to fill forms on WorkFossa automatically.
    
    Features:
    - V1 service code detection and fuel classification
    - Real browser automation with Playwright
    - Progress tracking with WebSocket updates
    - Error recovery and retry mechanisms
    - Screenshot capture for debugging
    """
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} not found"
            )
        
        # Get user preferences if requested
        user_preferences = None
        if include_user_preferences:
            automation_prefs = user_service.get_user_preference(user_id, "automation")
            if automation_prefs:
                user_preferences = {"automation": automation_prefs}
        
        # Initialize integration service if needed
        await integration_service.initialize()
        
        # Create and execute automation job
        job_id = await integration_service.create_and_execute_automation_job(
            user_id=user_id,
            work_order_data=work_order_data,
            credentials=credentials,
            user_preferences=user_preferences
        )
        
        # Track activity
        background_tasks.add_task(
            user_service.track_activity,
            user_id,
            user.email,
            "full_automation_executed",
            {
                "job_id": job_id,
                "work_order_id": work_order_data.get("id"),
                "automation_type": "integrated_v1_browser",
                "creation_timestamp": datetime.utcnow().isoformat()
            }
        )
        
        return {
            "success": True,
            "message": "Full automation job created and started",
            "job_id": job_id,
            "user_id": user_id,
            "work_order_id": work_order_data.get("id"),
            "automation_type": "integrated_v1_browser",
            "status": "started",
            "progress_url": f"/api/form-automation/integrated-job/{job_id}"
        }
        
    except Exception as e:
        await logging_service.log_error(
            f"Full automation execution failed for user {user_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Full automation execution failed: {str(e)}"
        )


@router.get("/integrated-job/{job_id}")
async def get_integrated_job_status(
    job_id: str,
    integration_service: FormAutomationBrowserIntegration = Depends(get_form_automation_browser_integration)
):
    """Get status of integrated automation job with comprehensive details"""
    try:
        job_status = await integration_service.get_job_status(job_id)
        
        if not job_status:
            raise HTTPException(
                status_code=404,
                detail=f"Integrated job {job_id} not found"
            )
        
        return {
            "success": True,
            "job": job_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get integrated job status: {str(e)}"
        )


@router.delete("/integrated-job/{job_id}")
async def cancel_integrated_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    integration_service: FormAutomationBrowserIntegration = Depends(get_form_automation_browser_integration),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Cancel running integrated automation job"""
    try:
        # Get job info before cancellation
        job_status = await integration_service.get_job_status(job_id)
        if not job_status:
            raise HTTPException(
                status_code=404,
                detail=f"Integrated job {job_id} not found"
            )
        
        # Cancel job
        success = await integration_service.cancel_job(job_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to cancel integrated job"
            )
        
        # Log cancellation
        background_tasks.add_task(
            logging_service.log_info,
            f"Integrated job {job_id} cancelled by user request"
        )
        
        return {
            "success": True,
            "message": f"Integrated job {job_id} cancelled successfully",
            "job_id": job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel integrated job: {str(e)}"
        )


@router.post("/test-integration", response_model=None)
async def test_integration_service(
    integration_service: FormAutomationBrowserIntegration = Depends(get_form_automation_browser_integration)
):
    """Test the form automation browser integration service"""
    try:
        # Initialize service
        success = await integration_service.initialize()
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize integration service"
            )
        
        return {
            "success": True,
            "message": "Integration service initialized successfully",
            "features": [
                "V1-compatible form automation analysis",
                "Browser automation with Playwright",
                "Real-time progress tracking",
                "Error recovery and retry mechanisms",
                "Screenshot capture for debugging"
            ],
            "capabilities": {
                "service_codes": ["2861", "2862", "3002", "3146"],
                "station_types": ["wawa", "circle_k", "speedway", "shell", "bp", "generic"],
                "automation_templates": ["metered_5", "non_metered_3", "open_neck"],
                "browser_automation": True,
                "progress_tracking": True,
                "error_recovery": True
            },
            "test_timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Integration service test failed: {str(e)}"
        )