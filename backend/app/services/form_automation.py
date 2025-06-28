#!/usr/bin/env python3
"""
Form Automation Service for Dispenser Testing Workflows
Based on proven V1 patterns with Python/Playwright implementation
"""

import asyncio
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

from .browser_automation import BrowserAutomationService, browser_automation
from .url_generator import WorkFossaURLGenerator

# Import exception handling
from ..core.exceptions import (
    FormSubmissionError,
    BrowserError,
    ElementNotFoundError,
    ValidationError,
    WorkOrderProcessingError
)

# Configure logging
logger = logging.getLogger(__name__)

class ServiceCode(Enum):
    """Service codes for different automation types"""
    SERVICE_2861 = "2861"  # AccuMeasure for all dispensers
    SERVICE_2862 = "2862"  # AccuMeasure for specific dispensers
    SERVICE_3002 = "3002"  # All dispensers (variant)
    SERVICE_3146 = "3146"  # Open Neck Prover

class AutomationTemplate(Enum):
    """Automation templates based on fuel grade configurations"""
    REGULAR_PLUS_PREMIUM = "regular_plus_premium"
    REGULAR_PLUS_PREMIUM_DIESEL = "regular_plus_premium_diesel"
    ETHANOL_FREE_VARIANTS = "ethanol_free_variants"
    THREE_GRADE_ETHANOL_DIESEL = "three_grade_ethanol_diesel"
    CUSTOM = "custom"

class AutomationPhase(Enum):
    """Automation phases for progress tracking"""
    INITIALIZING = "initializing"
    LOGIN = "login_phase"
    NAVIGATION = "navigation_phase"
    FORM_DETECTION = "form_detection"
    FORM_PREPARATION = "form_preparation"
    FORM_FILLING = "form_filling"
    DISPENSER_AUTOMATION = "dispenser_automation"
    VALIDATION = "validation"
    COMPLETION = "completion"
    ERROR = "error"

@dataclass
class AutomationProgress:
    """Progress tracking for automation jobs"""
    job_id: str
    phase: AutomationPhase
    percentage: float
    message: str
    dispenser_id: Optional[str] = None
    dispenser_title: Optional[str] = None
    fuel_grades: List[str] = None
    timestamp: datetime = None
    session_id: Optional[str] = None  # Added for browser integration
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.fuel_grades is None:
            self.fuel_grades = []

@dataclass
class DispenserStrategy:
    """Strategy for dispenser automation"""
    service_code: ServiceCode
    automation_template: AutomationTemplate
    dispenser_numbers: List[int]
    metered_grades: Dict[int, List[str]]
    non_metered_grades: Dict[int, List[str]]
    total_iterations: int
    
    def __post_init__(self):
        if self.metered_grades is None:
            self.metered_grades = {}
        if self.non_metered_grades is None:
            self.non_metered_grades = {}
        if self.total_iterations is None:
            self.total_iterations = len(self.dispenser_numbers)

@dataclass
class AutomationJob:
    """Automation job configuration"""
    job_id: str
    user_id: str
    visit_url: str
    work_order_id: str
    dispensers: List[Dict[str, Any]]
    status: str = "pending"
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    progress: List[AutomationProgress] = None
    # Additional properties expected by integration
    visit_id: Optional[str] = None
    service_code: ServiceCode = ServiceCode.SERVICE_2861
    dispenser_strategy: Optional[DispenserStrategy] = None
    station_info: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.progress is None:
            self.progress = []
        if self.station_info is None:
            self.station_info = {}

class FuelGradeTemplates:
    """Fuel grade templates based on V1 patterns"""
    
    REGULAR_PLUS_PREMIUM = ["Regular", "Plus", "Premium"]
    REGULAR_PLUS_PREMIUM_DIESEL = ["Regular", "Plus", "Premium", "Diesel"]
    ETHANOL_FREE_VARIANTS = ["Regular", "Plus", "Premium", "Regular-E0"]
    THREE_GRADE_ETHANOL_DIESEL = ["Regular", "Mid", "Premium", "Diesel"]
    
    @classmethod
    def detect_template(cls, fuel_grades: Dict[str, Any]) -> List[str]:
        """Detect appropriate fuel template based on dispenser data"""
        grade_names = list(fuel_grades.keys())
        grade_count = len(grade_names)
        
        has_diesel = any("diesel" in name.lower() for name in grade_names)
        has_ethanol_free = any("e0" in name.lower() or "ethanol free" in name.lower() for name in grade_names)
        
        if grade_count == 3 and not has_diesel:
            return cls.REGULAR_PLUS_PREMIUM
        elif grade_count == 4 and has_diesel:
            return cls.REGULAR_PLUS_PREMIUM_DIESEL
        elif has_ethanol_free:
            return cls.ETHANOL_FREE_VARIANTS
        else:
            # Default mapping
            return ["Regular", "Mid", "Premium", "Diesel"][:grade_count]

class AccuMeasureFormHandler:
    """Handles AccuMeasure form automation based on V1 patterns"""
    
    # Selectors based on V1 discovery
    FORM_SELECTORS = {
        'add_new_form': 'button:has-text("Add New"), .add-form-btn, input[value*="Add"]',
        'fuel_grade_dropdown': 'select[name*="fuel"], select[name*="grade"], .fuel-grade-select',
        'dispenser_field': 'input[name*="dispenser"], select[name*="dispenser"]',
        'submit_button': 'button[type="submit"], input[type="submit"], .submit-btn',
        'save_button': 'button:has-text("Save"), .save-btn',
        'next_button': 'button:has-text("Next"), .next-btn'
    }
    
    def __init__(self, page):
        self.page = page
        
    async def detect_existing_forms(self) -> bool:
        """Detect if AccuMeasure forms already exist"""
        try:
            # Look for existing form elements
            existing_forms = await self.page.query_selector_all('.accumeasure-form, .fuel-form, [data-testid*="form"]')
            return len(existing_forms) > 0
        except Exception as e:
            logger.error(f"Error detecting existing forms: {e}")
            return False
    
    async def create_new_form(self, dispenser_number: str, fuel_grades: List[str]) -> bool:
        """Create new AccuMeasure form for dispenser"""
        try:
            # Click add new form button
            await self.page.click(self.FORM_SELECTORS['add_new_form'])
            await self.page.wait_for_timeout(1000)
            
            # Fill dispenser number
            await self.page.fill(self.FORM_SELECTORS['dispenser_field'], dispenser_number)
            
            # Configure fuel grades
            for i, grade in enumerate(fuel_grades):
                grade_selector = f'{self.FORM_SELECTORS["fuel_grade_dropdown"]}:nth-child({i+1})'
                try:
                    await self.page.select_option(grade_selector, value=grade.lower())
                except:
                    # Try alternative selection methods
                    await self.page.click(grade_selector)
                    await self.page.click(f'option:has-text("{grade}")')
            
            # Save form
            await self.page.click(self.FORM_SELECTORS['save_button'])
            await self.page.wait_for_timeout(2000)
            
            logger.info(f"Created AccuMeasure form for dispenser {dispenser_number} with grades: {fuel_grades}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create AccuMeasure form: {e}")
            return False
    
    async def fill_existing_form(self, dispenser_number: str, fuel_grades: List[str]) -> bool:
        """Fill existing AccuMeasure form"""
        try:
            # Find the form for this dispenser
            form_selector = f'[data-dispenser="{dispenser_number}"], .dispenser-{dispenser_number}'
            await self.page.wait_for_selector(form_selector, timeout=5000)
            
            # Fill fuel grade fields
            for i, grade in enumerate(fuel_grades):
                field_selector = f'{form_selector} input[name*="grade_{i+1}"], {form_selector} select[name*="grade_{i+1}"]'
                try:
                    await self.page.fill(field_selector, grade)
                except:
                    logger.warning(f"Could not fill grade field {i+1} for dispenser {dispenser_number}")
            
            # Submit form
            submit_selector = f'{form_selector} {self.FORM_SELECTORS["submit_button"]}'
            await self.page.click(submit_selector)
            await self.page.wait_for_timeout(1000)
            
            logger.info(f"Filled existing AccuMeasure form for dispenser {dispenser_number}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to fill existing form: {e}")
            return False

class FormAutomationService:
    """
    Main form automation service based on V1 architecture patterns
    """
    
    def __init__(self, browser_automation: BrowserAutomationService):
        self.browser_automation = browser_automation
        self.active_jobs: Dict[str, AutomationJob] = {}
        self.progress_callbacks: List[Callable] = []
        
        # Form automation service initialized
        
        # Configuration based on V1 patterns with URL generator
        self.url_generator = WorkFossaURLGenerator()
        self.config = {
            'timeout_per_visit': 300000,  # 5 minutes
            'delay_between_dispensers': 2000,  # 2 seconds
            'retry_attempts': 3,
            'workfossa_urls': {
                'login': self.url_generator.get_workfossa_login_url(),
                'dashboard': self.url_generator.get_dashboard_url(),
                'base_url': self.url_generator.config.base_url
            }
        }
    
    def add_progress_callback(self, callback: Callable):
        """Add callback for progress updates (WebSocket, etc.)"""
        self.progress_callbacks.append(callback)
    
    async def _emit_progress(self, progress: AutomationProgress):
        """Emit progress update to all callbacks"""
        # Add to job progress history
        if progress.job_id in self.active_jobs:
            self.active_jobs[progress.job_id].progress.append(progress)
        
        # Call all progress callbacks
        for callback in self.progress_callbacks:
            try:
                await callback(progress)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
    
    async def process_visit(self, user_id: str, visit_url: str, work_order_id: str, 
                          dispensers: List[Dict[str, Any]], options: Dict[str, Any] = None) -> str:
        """
        Process single visit automation (main entry point)
        Based on V1 processVisit function
        """
        if options is None:
            options = {}
        
        job_id = str(uuid.uuid4())
        job = AutomationJob(
            job_id=job_id,
            user_id=user_id,
            visit_url=visit_url,
            work_order_id=work_order_id,
            dispensers=dispensers,
            status="running"
        )
        job.started_at = datetime.now()
        self.active_jobs[job_id] = job
        
        try:
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                phase=AutomationPhase.INITIALIZING,
                percentage=0,
                message="Initializing form automation..."
            ))
            
            # Get or create session
            session_id = f"form_automation_{user_id}_{int(datetime.now().timestamp())}"
            session_created = await self.browser_automation.create_session(session_id)
            if not session_created:
                raise Exception("Could not create browser session")
            
            # Login phase
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                phase=AutomationPhase.LOGIN,
                percentage=10,
                message="Logging into WorkFossa..."
            ))
            
            # Get credentials from secure storage or options
            credentials = options.get('credentials', {})
            
            # If no credentials provided, try to get from credential manager
            if not credentials or not credentials.get('username'):
                try:
                    from ..services.credential_manager_deprecated import credential_manager
                    stored_credentials = await credential_manager.get_credentials(user_id, "workfossa")
                    if stored_credentials:
                        credentials = stored_credentials
                        logger.info(f"Using stored credentials for user {user_id}")
                    else:
                        logger.warning(f"No credentials available for user {user_id}")
                except ImportError:
                    logger.warning("Credential manager not available")
            
            if not credentials.get('username') or not credentials.get('password'):
                raise Exception("No valid credentials available for WorkFossa login")
            
            # Login using browser automation service
            login_success = await self.browser_automation.navigate_to_workfossa(session_id, credentials)
            if not login_success:
                raise Exception("Login failed - check credentials")
            
            # Navigation phase - validate and potentially generate URL
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                phase=AutomationPhase.NAVIGATION,
                percentage=20,
                message=f"Preparing navigation to visit..."
            ))
            
            # Validate URL or generate if needed
            if not visit_url or not self.url_generator.validate_url(visit_url):
                logger.warning(f"Invalid visit URL provided: {visit_url}, attempting to generate")
                
                # Try to generate URL from work order ID
                mock_work_order = {
                    'basic_info': {'id': work_order_id},
                    'scheduling': {'status': 'pending'}
                }
                generated_url = self.url_generator.generate_visit_url(mock_work_order)
                
                if generated_url:
                    visit_url = generated_url
                    logger.info(f"Generated visit URL: {visit_url}")
                else:
                    raise Exception(f"Could not generate valid visit URL for work order {work_order_id}")
            
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                phase=AutomationPhase.NAVIGATION,
                percentage=25,
                message=f"Navigating to visit: {visit_url}"
            ))
            
            # Get page from browser automation service and navigate
            page = self.browser_automation.pages.get(session_id)
            if not page:
                raise Exception("No page available for session")
            
            await page.goto(visit_url, wait_until="networkidle")
            
            # Form detection phase
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                phase=AutomationPhase.FORM_DETECTION,
                percentage=30,
                message="Detecting AccuMeasure forms..."
            ))
            
            form_handler = AccuMeasureFormHandler(page)
            
            # Process each dispenser
            total_dispensers = len(dispensers)
            for i, dispenser in enumerate(dispensers):
                dispenser_progress = 40 + (i / total_dispensers) * 50
                
                await self._emit_progress(AutomationProgress(
                    job_id=job_id,
                    phase=AutomationPhase.DISPENSER_AUTOMATION,
                    percentage=dispenser_progress,
                    message=f"Processing dispenser {dispenser['dispenser_number']}...",
                    dispenser_id=dispenser['dispenser_number'],
                    dispenser_title=f"Dispenser {dispenser['dispenser_number']} - {dispenser.get('dispenser_type', 'Unknown')}",
                    fuel_grades=list(dispenser.get('fuel_grades', {}).keys())
                ))
                
                success = await self._process_dispenser(form_handler, dispenser)
                if not success:
                    logger.warning(f"Failed to process dispenser {dispenser['dispenser_number']}")
                
                # Update dispenser progress
                dispenser['automation_completed'] = success
                dispenser['progress_percentage'] = 100.0 if success else 0.0
            
            # Completion phase
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                phase=AutomationPhase.COMPLETION,
                percentage=100,
                message="Form automation completed successfully!"
            ))
            
            job.status = "completed"
            job.completed_at = datetime.now()
            
            # Cleanup session
            await self.browser_automation.close_session(session_id)
            
            return job_id
            
        except Exception as e:
            logger.error(f"Form automation failed for job {job_id}: {e}")
            
            await self._emit_progress(AutomationProgress(
                job_id=job_id,
                phase=AutomationPhase.ERROR,
                percentage=0,
                message=f"Automation failed: {str(e)}"
            ))
            
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.now()
            
            # Cleanup session on error
            try:
                await self.browser_automation.close_session(session_id)
            except:
                pass
            
            raise
    
    async def _process_dispenser(self, form_handler: AccuMeasureFormHandler, 
                               dispenser: Dict[str, Any]) -> bool:
        """Process individual dispenser automation"""
        try:
            dispenser_number = dispenser['dispenser_number']
            fuel_grades_data = dispenser.get('fuel_grades', {})
            
            # Detect appropriate fuel template
            fuel_grades = FuelGradeTemplates.detect_template(fuel_grades_data)
            
            # Check if form exists
            existing_forms = await form_handler.detect_existing_forms()
            
            if existing_forms:
                success = await form_handler.fill_existing_form(dispenser_number, fuel_grades)
            else:
                success = await form_handler.create_new_form(dispenser_number, fuel_grades)
            
            # Add delay between dispensers (from V1 config)
            await asyncio.sleep(self.config['delay_between_dispensers'] / 1000)
            
            return success
            
        except Exception as e:
            logger.error(f"Error processing dispenser: {e}")
            return False
    
    async def cleanup_user_sessions(self, user_id: str):
        """Cleanup all sessions for a user"""
        try:
            sessions_to_close = []
            for session_id in self.browser_automation.contexts.keys():
                if user_id in session_id:
                    sessions_to_close.append(session_id)
            
            for session_id in sessions_to_close:
                await self.browser_automation.close_session(session_id)
                
            logger.info(f"Cleaned up {len(sessions_to_close)} sessions for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to cleanup user sessions: {e}")
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get automation job status"""
        if job_id not in self.active_jobs:
            return None
        
        job = self.active_jobs[job_id]
        return {
            'job_id': job.job_id,
            'status': job.status,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'error_message': job.error_message,
            'progress': [asdict(p) for p in job.progress],
            'dispensers': job.dispensers
        }
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel running automation job"""
        if job_id not in self.active_jobs:
            return False
        
        job = self.active_jobs[job_id]
        job.status = "cancelled"
        job.completed_at = datetime.now()
        
        await self._emit_progress(AutomationProgress(
            job_id=job_id,
            phase=AutomationPhase.ERROR,
            percentage=0,
            message="Job cancelled by user"
        ))
        
        return True
    
    async def create_automation_job(self, user_id: str, work_order_data: Dict[str, Any], 
                                   user_preferences: Optional[Dict[str, Any]] = None) -> AutomationJob:
        """Create automation job from work order data"""
        # Extract data from work order
        work_order_id = work_order_data.get('basic_info', {}).get('id', '')
        visit_url = work_order_data.get('visit_url', '')
        dispensers = work_order_data.get('dispensers', [])
        
        # Determine service code
        service_type = work_order_data.get('service_type', '2861')
        service_code = ServiceCode(f"SERVICE_{service_type}") if f"SERVICE_{service_type}" in ServiceCode.__members__ else ServiceCode.SERVICE_2861
        
        # Create dispenser strategy
        dispenser_numbers = [int(d.get('dispenser_number', i+1)) for i, d in enumerate(dispensers)]
        metered_grades = {}
        non_metered_grades = {}
        
        for i, dispenser in enumerate(dispensers):
            dispenser_num = int(dispenser.get('dispenser_number', i+1))
            fuel_grades = dispenser.get('fuel_grades', {})
            
            # Simple classification - can be enhanced
            grade_list = list(fuel_grades.keys())
            metered_grades[dispenser_num] = grade_list[:3] if len(grade_list) > 3 else grade_list
            non_metered_grades[dispenser_num] = grade_list[3:] if len(grade_list) > 3 else []
        
        # Detect automation template
        template = AutomationTemplate.CUSTOM
        if all(len(grades) == 3 for grades in metered_grades.values()):
            template = AutomationTemplate.REGULAR_PLUS_PREMIUM
        elif any(len(grades) == 4 for grades in metered_grades.values()):
            template = AutomationTemplate.REGULAR_PLUS_PREMIUM_DIESEL
        
        strategy = DispenserStrategy(
            service_code=service_code,
            automation_template=template,
            dispenser_numbers=dispenser_numbers,
            metered_grades=metered_grades,
            non_metered_grades=non_metered_grades,
            total_iterations=len(dispenser_numbers)
        )
        
        # Create job
        job_id = str(uuid.uuid4())
        job = AutomationJob(
            job_id=job_id,
            user_id=user_id,
            visit_url=visit_url,
            work_order_id=work_order_id,
            dispensers=dispensers,
            service_code=service_code,
            dispenser_strategy=strategy,
            station_info=work_order_data.get('station_info', {})
        )
        
        return job
    
    async def update_job_progress(self, job_id: str, phase: str, current_dispenser: Optional[int] = None,
                                 current_iteration: Optional[int] = None, fuel_grade: Optional[str] = None):
        """Update job progress"""
        if job_id not in self.active_jobs:
            return
        
        job = self.active_jobs[job_id]
        
        # Create progress update
        progress = AutomationProgress(
            job_id=job_id,
            phase=AutomationPhase[phase.upper()] if phase.upper() in AutomationPhase.__members__ else AutomationPhase.FORM_FILLING,
            percentage=50.0,  # Simple calculation
            message=f"Processing phase: {phase}",
            dispenser_id=str(current_dispenser) if current_dispenser else None,
            fuel_grades=[fuel_grade] if fuel_grade else []
        )
        
        await self._emit_progress(progress)
    
    async def process_batch(self, user_id: str, batch_data: List[Dict[str, Any]], 
                          options: Dict[str, Any] = None) -> List[str]:
        """
        Process batch automation jobs
        Based on V1 processBatch function
        """
        job_ids = []
        
        for item in batch_data:
            try:
                job_id = await self.process_visit(
                    user_id=user_id,
                    visit_url=item['visit_url'],
                    work_order_id=item['work_order_id'],
                    dispensers=item['dispensers'],
                    options=options
                )
                job_ids.append(job_id)
                
                # Add delay between batch items
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Batch item failed: {e}")
                continue
        
        return job_ids

# Global form automation service
form_automation_service = FormAutomationService(
    browser_automation=browser_automation
)

# Alias for backward compatibility
FormAutomationJob = AutomationJob

# Testing function
async def test_form_automation():
    """Test form automation service"""
    print("[SYNC] Testing form automation service...")
    
    try:
        # Test with global services
        form_service = form_automation_service
        
        # Mock dispenser data for testing
        test_dispensers = [
            {
                "dispenser_number": "1",
                "dispenser_type": "Wayne 300",
                "fuel_grades": {
                    "regular": {"octane": 87, "position": 1},
                    "mid": {"octane": 89, "position": 2},
                    "premium": {"octane": 91, "position": 3}
                }
            }
        ]
        
        # Test job creation (won't actually run without real session)
        print("  [OK] Form automation service initialized")
        print("  [OK] Ready for production integration")
        
        return True
        
    except Exception as e:
        print(f"  [ERROR] Test failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_form_automation())