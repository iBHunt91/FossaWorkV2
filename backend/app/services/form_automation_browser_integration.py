#!/usr/bin/env python3
"""
Form Automation Browser Integration

Integration layer connecting V1-compatible form automation service
with the browser automation engine for actual form filling operations.

This bridges the gap between business logic analysis and browser automation,
enabling real form filling with V1 patterns and error recovery.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum
from fastapi import Depends

from ..services.form_automation_v1 import (
    FormAutomationV1Service, 
    FormAutomationJob, 
    ServiceCode, 
    AutomationTemplate
)
from ..services.browser_automation import (
    BrowserAutomationService, 
    AutomationPhase, 
    AutomationProgress,
    FuelGrade
)
from ..services.logging_service import LoggingService
from ..services.notification_manager import NotificationManager, NotificationTrigger
from ..services.email_notification import EmailSettings
from ..services.pushover_notification import PushoverSettings
from ..database import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class AutomationJobStatus(Enum):
    """Status tracking for integrated automation jobs"""
    PENDING = "pending"
    ANALYZING = "analyzing"
    BROWSER_STARTING = "browser_starting"
    LOGGING_IN = "logging_in"
    NAVIGATING = "navigating"
    FILLING_FORMS = "filling_forms"
    SUBMITTING = "submitting"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class IntegratedAutomationJob:
    """Combined automation job with both form analysis and browser execution"""
    job_id: str
    form_job: FormAutomationJob
    browser_session_id: str
    status: AutomationJobStatus
    progress_percentage: float
    current_phase: str
    current_dispenser: Optional[int]
    current_iteration: int
    total_iterations: int
    errors: List[str]
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class FormAutomationBrowserIntegration:
    """Integration service connecting form automation with browser automation"""
    
    def __init__(self, db: Session):
        self.db = db
        self.form_service = FormAutomationV1Service(db)
        self.browser_service = BrowserAutomationService()
        self.logging_service = LoggingService(db)
        self.active_jobs: Dict[str, IntegratedAutomationJob] = {}
        self.progress_callbacks: List[Callable] = []
        
        # Initialize notification manager (optional - will work without it)
        try:
            email_settings = EmailSettings(
                smtp_server="smtp.gmail.com",
                smtp_port=587,
                username="fossawork@example.com",
                password="app_password"
            )
            pushover_settings = PushoverSettings(
                api_token="pushover_token",
                user_key="pushover_user"
            )
            self.notification_manager = NotificationManager(db, email_settings, pushover_settings)
            self.notifications_enabled = True
        except Exception as e:
            logger.warning(f"Notifications not available: {e}")
            self.notification_manager = None
            self.notifications_enabled = False
        
        # Set up browser progress callback
        self.browser_service.add_progress_callback(self._handle_browser_progress)
    
    async def initialize(self) -> bool:
        """Initialize the integration service"""
        try:
            # Initialize browser automation
            success = await self.browser_service.initialize()
            if not success:
                logger.error("Failed to initialize browser automation service")
                return False
            
            # Initialize notification manager if available
            if self.notifications_enabled and self.notification_manager:
                await self.notification_manager.initialize()
            
            await self.logging_service.log_info("Form automation browser integration initialized")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize integration service: {e}")
            return False
    
    async def create_and_execute_automation_job(
        self,
        user_id: str,
        work_order_data: Dict[str, Any],
        credentials: Dict[str, str],
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create and execute complete automation job
        
        This combines V1 business logic analysis with actual browser automation
        """
        try:
            # Generate unique job ID
            job_id = f"auto_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            await self.logging_service.log_info(
                f"Creating integrated automation job {job_id} for user {user_id}"
            )
            
            # Create form automation job (business logic analysis)
            form_job = await self.form_service.create_automation_job(
                user_id, work_order_data, user_preferences
            )
            
            # Create browser session
            browser_session_id = f"session_{job_id}"
            session_created = await self.browser_service.create_session(browser_session_id)
            if not session_created:
                raise Exception("Failed to create browser automation session")
            
            # Create integrated job
            integrated_job = IntegratedAutomationJob(
                job_id=job_id,
                form_job=form_job,
                browser_session_id=browser_session_id,
                status=AutomationJobStatus.PENDING,
                progress_percentage=0.0,
                current_phase="initialization",
                current_dispenser=None,
                current_iteration=0,
                total_iterations=form_job.dispenser_strategy.total_iterations,
                errors=[],
                created_at=datetime.utcnow()
            )
            
            # Store job
            self.active_jobs[job_id] = integrated_job
            
            # Send automation started notification
            if self.notifications_enabled and self.notification_manager:
                await self._send_automation_notification(
                    user_id, NotificationTrigger.AUTOMATION_STARTED, {
                        "station_name": form_job.station_info.get("name", "Unknown Station"),
                        "job_id": job_id,
                        "work_order_id": form_job.work_order_id,
                        "service_code": form_job.service_code.value,
                        "dispenser_count": len(form_job.dispenser_strategy.dispenser_numbers),
                        "total_iterations": form_job.dispenser_strategy.total_iterations,
                        "estimated_duration": max(form_job.dispenser_strategy.total_iterations * 2, 10),
                        "start_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                    }
                )
            
            # Start automation in background
            asyncio.create_task(self._execute_automation_workflow(job_id, credentials))
            
            await self.logging_service.log_info(
                f"Integrated automation job {job_id} created and started"
            )
            
            return job_id
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to create automation job for user {user_id}: {str(e)}"
            )
            raise
    
    async def _execute_automation_workflow(self, job_id: str, credentials: Dict[str, str]):
        """Execute the complete automation workflow"""
        try:
            job = self.active_jobs[job_id]
            job.started_at = datetime.utcnow()
            
            await self._update_job_status(job_id, AutomationJobStatus.BROWSER_STARTING, 5)
            
            # Phase 1: Login to WorkFossa
            await self._update_job_status(job_id, AutomationJobStatus.LOGGING_IN, 10)
            login_success = await self.browser_service.navigate_to_workfossa(
                job.browser_session_id, credentials
            )
            
            if not login_success:
                raise Exception("Failed to login to WorkFossa")
            
            # Phase 2: Navigate to visit page
            await self._update_job_status(job_id, AutomationJobStatus.NAVIGATING, 20)
            visit_url = await self._construct_visit_url(job.form_job)
            
            # Phase 3: Execute V1-compatible form automation
            await self._update_job_status(job_id, AutomationJobStatus.FILLING_FORMS, 30)
            await self._execute_v1_form_automation(job_id, visit_url)
            
            # Mark as completed
            await self._update_job_status(job_id, AutomationJobStatus.COMPLETED, 100)
            job.completed_at = datetime.utcnow()
            
            # Send completion notification
            if self.notifications_enabled and self.notification_manager:
                duration = (job.completed_at - job.started_at).total_seconds() / 60 if job.started_at else 0
                await self._send_automation_notification(
                    job.form_job.user_id, NotificationTrigger.AUTOMATION_COMPLETED, {
                        "station_name": job.form_job.station_info.get("name", "Unknown Station"),
                        "job_id": job_id,
                        "work_order_id": job.form_job.work_order_id,
                        "duration": f"{int(duration)} minutes",
                        "forms_completed": len(job.form_job.dispenser_strategy.dispenser_numbers),
                        "dispensers_processed": len(job.form_job.dispenser_strategy.dispenser_numbers),
                        "total_iterations": job.form_job.dispenser_strategy.total_iterations,
                        "success_rate": 100,
                        "completion_time": job.completed_at.strftime("%Y-%m-%d %H:%M:%S UTC")
                    }
                )
            
            await self.logging_service.log_info(
                f"Automation job {job_id} completed successfully"
            )
            
        except Exception as e:
            await self._handle_job_error(job_id, str(e))
    
    async def _execute_v1_form_automation(self, job_id: str, visit_url: str):
        """Execute V1-compatible form automation with business logic"""
        try:
            job = self.active_jobs[job_id]
            form_job = job.form_job
            strategy = form_job.dispenser_strategy
            
            # Convert V1 strategy to browser automation format
            dispensers = []
            for dispenser_num in strategy.dispenser_numbers:
                # Get fuel grades for this dispenser
                metered_grades = strategy.metered_grades.get(dispenser_num, [])
                non_metered_grades = strategy.non_metered_grades.get(dispenser_num, [])
                all_grades = metered_grades + non_metered_grades
                
                dispenser_config = {
                    "dispenser_number": str(dispenser_num),
                    "fuel_grades": all_grades,
                    "metered_grades": metered_grades,
                    "non_metered_grades": non_metered_grades,
                    "automation_template": strategy.automation_template.value,
                    "service_code": strategy.service_code.value
                }
                dispensers.append(dispenser_config)
            
            # Execute browser automation with V1 patterns
            automation_result = await self.browser_service.process_visit_automation(
                job.browser_session_id, visit_url, dispensers
            )
            
            # Update job with results
            if automation_result["success"]:
                await self._update_job_status(job_id, AutomationJobStatus.VERIFYING, 95)
                await self._verify_automation_results(job_id, automation_result)
            else:
                raise Exception(f"Browser automation failed: {automation_result.get('errors', [])}")
            
        except Exception as e:
            logger.error(f"V1 form automation failed for job {job_id}: {e}")
            raise
    
    async def _construct_visit_url(self, form_job: FormAutomationJob) -> str:
        """Construct visit URL from form job data"""
        try:
            # Extract visit information from form job
            visit_id = form_job.visit_id
            work_order_id = form_job.work_order_id
            
            if visit_id:
                # Direct visit URL
                return f"https://app.workfossa.com/visits/{visit_id}"
            elif work_order_id:
                # Construct from work order
                return f"https://app.workfossa.com/work-orders/{work_order_id}/visits/create"
            else:
                # Fallback to dashboard
                return "https://app.workfossa.com/dashboard"
                
        except Exception as e:
            logger.warning(f"Failed to construct visit URL: {e}")
            return "https://app.workfossa.com/dashboard"
    
    async def _verify_automation_results(self, job_id: str, automation_result: Dict[str, Any]):
        """Verify automation results match V1 expectations"""
        try:
            job = self.active_jobs[job_id]
            
            dispensers_processed = automation_result.get("dispensers_processed", 0)
            expected_dispensers = len(job.form_job.dispenser_strategy.dispenser_numbers)
            
            if dispensers_processed != expected_dispensers:
                await self.logging_service.log_warning(
                    f"Job {job_id}: Expected {expected_dispensers} dispensers, "
                    f"processed {dispensers_processed}"
                )
            
            # Log automation summary
            await self.logging_service.log_info(
                f"Job {job_id} automation summary: "
                f"{dispensers_processed} dispensers processed, "
                f"{automation_result.get('dispensers_failed', 0)} failed, "
                f"{len(automation_result.get('errors', []))} errors"
            )
            
        except Exception as e:
            logger.warning(f"Error verifying automation results: {e}")
    
    async def _handle_browser_progress(self, progress: AutomationProgress):
        """Handle progress updates from browser automation"""
        try:
            # Find job by session ID
            job_id = None
            for jid, job in self.active_jobs.items():
                if job.browser_session_id == progress.session_id:
                    job_id = jid
                    break
            
            if not job_id:
                return
            
            # Update job progress
            job = self.active_jobs[job_id]
            job.progress_percentage = progress.percentage
            job.current_phase = progress.phase.value
            
            if progress.dispenser_id:
                job.current_dispenser = int(progress.dispenser_id)
            
            # Update form automation service progress
            await self.form_service.update_job_progress(
                job.form_job.job_id,
                phase=progress.phase.value,
                current_dispenser=job.current_dispenser,
                current_iteration=job.current_iteration,
                fuel_grade=progress.fuel_grades[0] if progress.fuel_grades else None
            )
            
            # Emit to registered callbacks
            for callback in self.progress_callbacks:
                try:
                    await callback(job_id, job)
                except Exception as e:
                    logger.warning(f"Progress callback error: {e}")
                    
        except Exception as e:
            logger.warning(f"Error handling browser progress: {e}")
    
    async def _update_job_status(self, job_id: str, status: AutomationJobStatus, progress: float):
        """Update job status and progress"""
        try:
            job = self.active_jobs[job_id]
            job.status = status
            job.progress_percentage = progress
            job.current_phase = status.value
            
            await self.logging_service.log_info(
                f"Job {job_id} status updated: {status.value} ({progress}%)"
            )
            
        except Exception as e:
            logger.warning(f"Error updating job status: {e}")
    
    async def _handle_job_error(self, job_id: str, error_message: str):
        """Handle job error with cleanup"""
        try:
            job = self.active_jobs[job_id]
            job.status = AutomationJobStatus.FAILED
            job.errors.append(error_message)
            job.completed_at = datetime.utcnow()
            
            # Send failure notification
            if self.notifications_enabled and self.notification_manager:
                await self._send_automation_notification(
                    job.form_job.user_id, NotificationTrigger.AUTOMATION_FAILED, {
                        "station_name": job.form_job.station_info.get("name", "Unknown Station"),
                        "job_id": job_id,
                        "work_order_id": job.form_job.work_order_id,
                        "error_message": error_message,
                        "failure_time": job.completed_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
                        "progress_percentage": job.progress_percentage,
                        "retry_available": True
                    }
                )
            
            # Close browser session
            await self.browser_service.close_session(job.browser_session_id)
            
            await self.logging_service.log_error(
                f"Job {job_id} failed: {error_message}"
            )
            
        except Exception as e:
            logger.error(f"Error handling job failure: {e}")
    
    async def _send_automation_notification(
        self,
        user_id: str,
        trigger: NotificationTrigger,
        data: Dict[str, Any]
    ):
        """Helper method to send automation notifications"""
        try:
            if self.notification_manager:
                await self.notification_manager.send_automation_notification(
                    user_id, trigger, data
                )
        except Exception as e:
            logger.warning(f"Failed to send notification: {e}")
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive job status"""
        try:
            job = self.active_jobs.get(job_id)
            if not job:
                return None
            
            # Get form automation status
            form_status = await self.form_service.get_job_status(job.form_job.job_id)
            
            return {
                "job_id": job_id,
                "status": job.status.value,
                "progress_percentage": job.progress_percentage,
                "current_phase": job.current_phase,
                "current_dispenser": job.current_dispenser,
                "current_iteration": job.current_iteration,
                "total_iterations": job.total_iterations,
                "errors": job.errors,
                "created_at": job.created_at.isoformat(),
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "form_automation": form_status,
                "strategy": {
                    "service_code": job.form_job.service_code.value,
                    "dispenser_count": len(job.form_job.dispenser_strategy.dispenser_numbers),
                    "automation_template": job.form_job.dispenser_strategy.automation_template.value,
                    "station_type": job.form_job.station_info.get("station_type")
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting job status: {e}")
            return None
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel running automation job"""
        try:
            job = self.active_jobs.get(job_id)
            if not job:
                return False
            
            # Update status
            job.status = AutomationJobStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            
            # Close browser session
            await self.browser_service.close_session(job.browser_session_id)
            
            await self.logging_service.log_info(f"Job {job_id} cancelled")
            return True
            
        except Exception as e:
            logger.error(f"Error cancelling job {job_id}: {e}")
            return False
    
    def add_progress_callback(self, callback: Callable):
        """Add progress callback"""
        self.progress_callbacks.append(callback)
    
    def remove_progress_callback(self, callback: Callable):
        """Remove progress callback"""
        if callback in self.progress_callbacks:
            self.progress_callbacks.remove(callback)
    
    async def cleanup(self):
        """Cleanup integration service"""
        try:
            # Cancel all active jobs
            for job_id in list(self.active_jobs.keys()):
                await self.cancel_job(job_id)
            
            # Cleanup browser service
            await self.browser_service.cleanup()
            
            await self.logging_service.log_info("Form automation browser integration cleaned up")
            
        except Exception as e:
            logger.error(f"Error during integration cleanup: {e}")


# Factory function for dependency injection
def get_form_automation_browser_integration(db: Session = Depends(get_db)) -> FormAutomationBrowserIntegration:
    """Factory function for creating form automation browser integration"""
    return FormAutomationBrowserIntegration(db)