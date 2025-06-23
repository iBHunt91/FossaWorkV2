#!/usr/bin/env python3
"""
Background Task Scheduler Service
Manages automated scheduled tasks using APScheduler
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Callable
from functools import wraps
import json
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import (
    EVENT_JOB_EXECUTED,
    EVENT_JOB_ERROR,
    EVENT_JOB_MISSED,
    EVENT_JOB_SUBMITTED,
    EVENT_JOB_REMOVED
)

from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db, SessionLocal
from ..services.logging_service import get_logger
from ..services.workfossa_scraper import WorkFossaScraper
from ..services.notification_manager import NotificationManager, NotificationTrigger
from ..models.scraping_models import ScrapingSchedule, ScrapingHistory

logger = get_logger("fossawork.scheduler")


# Standalone job functions to avoid serialization issues
async def execute_work_order_scraping(user_id: str, trigger_type: str = "scheduled"):
    """Execute work order scraping task - standalone function for scheduler"""
    from datetime import datetime
    from ..database import SessionLocal
    from ..services.logging_service import get_logger, log_automation_event
    from ..models import UserCredential
    import base64
    
    # Ensure environment variables are loaded for background tasks
    from dotenv import load_dotenv
    load_dotenv()
    
    logger = get_logger("scheduler.jobs")
    start_time = datetime.utcnow()
    success = False
    error_message = None
    items_processed = 0
    
    logger.info("=" * 50)
    logger.info(f"🚀 SCHEDULED JOB STARTING")
    logger.info(f"Job: Work Order Scraping")
    logger.info(f"User: {user_id}")
    logger.info(f"Start time: {start_time}")
    logger.info(f"Process ID: {os.getpid()}")
    logger.info("=" * 50)
    
    # Log to automation events
    log_automation_event("scheduled_scrape_started", {
        "user_id": user_id,
        "start_time": start_time.isoformat(),
        "trigger": "scheduler"
    })
    
    try:
        logger.info(f"Starting scheduled work order scraping for user {user_id}")
        
        # Get user credentials from database
        from ..models.user_models import UserCredential
        
        db = SessionLocal()
        try:
            user_credential = db.query(UserCredential).filter(
                UserCredential.user_id == user_id,
                UserCredential.service_name == 'workfossa'
            ).first()
            
            if not user_credential:
                raise Exception("No WorkFossa credentials found")
            
            # Convert to expected format
            credentials = {
                'username': user_credential.username,
                'password': user_credential.password
            }
        finally:
            db.close()
        logger.info(f"Successfully retrieved WorkFossa credentials for user {user_id}")
        
        # Initialize progress tracking for UI
        # Import the shared progress dictionary from work_orders route
        try:
            from ..routes.work_orders import scraping_progress
            scraping_progress[user_id] = {
                "status": "in_progress",
                "phase": "initializing",
                "percentage": 0,
                "message": "Starting scheduled work order scraping...",
                "work_orders_found": 0,
                "work_orders_processed": 0,
                "started_at": datetime.now().isoformat(),
                "completed_at": None,
                "error": None
            }
            
            # Update progress function
            def update_progress(phase: str, percentage: float, message: str, work_orders_found: int = 0):
                if user_id in scraping_progress:
                    scraping_progress[user_id].update({
                        "phase": phase,
                        "percentage": percentage,
                        "message": message,
                        "work_orders_found": work_orders_found
                    })
                    logger.info(f"[PROGRESS] {phase} ({percentage}%) - {message}")
        except ImportError:
            logger.warning("Could not import scraping_progress, progress tracking disabled")
            update_progress = lambda *args, **kwargs: None
        
        # Run the scraping in a more direct way to avoid import issues
        logger.info("Starting work order scraping...")
        
        # Import what we need
        from ..services.workfossa_automation import WorkFossaAutomationService
        from ..services.workfossa_scraper import workfossa_scraper
        from ..core_models import WorkOrder
        import json
        from pathlib import Path
        
        session_id = f"scrape_{user_id}_{datetime.now().timestamp()}"
        
        # Load browser settings
        browser_settings = {}
        try:
            settings_path = Path(f"data/users/{user_id}/settings/browser_settings.json")
            if settings_path.exists():
                with open(settings_path, 'r') as f:
                    browser_settings = json.load(f)
        except Exception as e:
            logger.warning(f"Could not load browser settings: {e}")
        
        # Create WorkFossa automation service
        workfossa_automation = WorkFossaAutomationService(
            headless=browser_settings.get('headless', True),
            user_settings={'browser_settings': browser_settings}
        )
        
        try:
            # Create session
            update_progress("initializing", 5, "Creating browser session...")
            await workfossa_automation.create_session(
                session_id=session_id,
                user_id=user_id,
                credentials=credentials
            )
            
            # Login
            update_progress("logging_in", 15, "Logging into WorkFossa...")
            login_success = await workfossa_automation.login_to_workfossa(session_id)
            if not login_success:
                raise Exception("Failed to login to WorkFossa")
            
            # Get the page
            session_data = workfossa_automation.sessions.get(session_id)
            if not session_data or 'page' not in session_data:
                raise Exception("No page found in session")
            
            page = session_data['page']
            
            # Add progress callback to scraper
            async def scraping_progress_callback(progress):
                if hasattr(progress, 'percentage') and hasattr(progress, 'message'):
                    # Map scraper's 0-100% to our 25-90% range
                    mapped_percentage = 25 + (progress.percentage * 0.65)
                    work_orders_found = getattr(progress, 'work_orders_found', 0)
                    update_progress("scraping", mapped_percentage, progress.message, work_orders_found)
            
            workfossa_scraper.add_progress_callback(scraping_progress_callback)
            
            # Scrape work orders
            update_progress("scraping", 25, "Starting work order scraping...")
            work_order_data_list = await workfossa_scraper.scrape_work_orders(session_id, page=page)
            
            # Save to database
            update_progress("saving", 90, f"Saving {len(work_order_data_list)} work orders to database...")
            db = SessionLocal()
            try:
                saved_count = 0
                updated_count = 0
                removed_count = 0
                
                # Get all current work order external IDs from the scrape
                current_external_ids = {wo_data.external_id for wo_data in work_order_data_list}
                logger.info(f"Current scrape found {len(current_external_ids)} work orders")
                
                # Get all existing work orders for this user
                existing_work_orders = db.query(WorkOrder).filter(
                    WorkOrder.user_id == user_id
                ).all()
                logger.info(f"Database has {len(existing_work_orders)} work orders for user")
                
                # Find work orders that are no longer present (completed/removed)
                work_orders_to_remove = []
                for existing_wo in existing_work_orders:
                    if existing_wo.external_id not in current_external_ids:
                        work_orders_to_remove.append(existing_wo)
                        logger.info(f"Work order {existing_wo.external_id} ({existing_wo.site_name}) no longer present - will be removed")
                
                # Remove dispensers and work orders that are no longer present
                from ..models import Dispenser
                for wo_to_remove in work_orders_to_remove:
                    # Log the removal
                    logger.info(f"Removing completed work order: {wo_to_remove.external_id} - {wo_to_remove.site_name}")
                    
                    # First, delete associated dispensers to avoid foreign key constraint violations
                    dispensers_to_delete = db.query(Dispenser).filter(
                        Dispenser.work_order_id == wo_to_remove.id
                    ).all()
                    
                    for dispenser in dispensers_to_delete:
                        logger.debug(f"  Deleting dispenser {dispenser.dispenser_number} for work order {wo_to_remove.external_id}")
                        db.delete(dispenser)
                    
                    # Then delete the work order
                    db.delete(wo_to_remove)
                    removed_count += 1
                
                # Now process the current work orders
                for wo_data in work_order_data_list:
                    existing = db.query(WorkOrder).filter(
                        WorkOrder.user_id == user_id,
                        WorkOrder.external_id == wo_data.external_id
                    ).first()
                    
                    if existing:
                        # Update existing
                        existing.site_name = wo_data.site_name
                        existing.address = wo_data.address
                        existing.status = wo_data.status
                        if wo_data.scheduled_date:
                            existing.scheduled_date = wo_data.scheduled_date
                        existing.updated_at = datetime.utcnow()
                        updated_count += 1
                    else:
                        # Create new
                        work_order = WorkOrder(
                            user_id=user_id,
                            external_id=wo_data.external_id,
                            site_name=wo_data.site_name,
                            address=wo_data.address,
                            status=wo_data.status,
                            scheduled_date=wo_data.scheduled_date,
                            customer_name=wo_data.customer_name,
                            visit_url=wo_data.visit_url,
                            store_number=wo_data.store_number,
                            job_code=wo_data.job_code,
                            service_code=wo_data.service_code,
                            service_description=wo_data.service_description,
                            service_name=wo_data.service_name,
                            service_items=wo_data.service_items,
                            street=wo_data.street,
                            city_state=wo_data.city_state,
                            county=wo_data.county,
                            created_date=wo_data.created_date,
                            created_by=wo_data.created_by,
                            scraped_data={
                                'dispensers': wo_data.dispensers,
                                'customer_url': wo_data.customer_url,
                                'instructions': wo_data.instructions
                            }
                        )
                        db.add(work_order)
                        saved_count += 1
                
                db.commit()
                items_processed = len(work_order_data_list)
                logger.info(f"Saved {saved_count} new, updated {updated_count} existing, removed {removed_count} completed work orders")
                
                # Update progress to completed
                update_progress("completed", 100, f"Successfully scraped {items_processed} work orders ({saved_count} new, {updated_count} updated, {removed_count} removed)")
                
            finally:
                db.close()
                
        finally:
            # Cleanup
            await workfossa_automation.cleanup_session(session_id)
            
            # Mark progress as completed
            try:
                from ..routes.work_orders import scraping_progress
                if user_id in scraping_progress:
                    scraping_progress[user_id]["status"] = "completed"
                    scraping_progress[user_id]["completed_at"] = datetime.now().isoformat()
            except:
                pass
            
            logger.info("Session cleanup completed")
        
        success = True
        logger.info("Work order scraping completed successfully")
        
        # Get count of work orders for logging
        db = SessionLocal()
        try:
            from ..core_models import WorkOrder
            items_processed = db.query(WorkOrder).filter(
                WorkOrder.user_id == user_id
            ).count()
        finally:
            db.close()
            
    except Exception as e:
        error_message = str(e)
        logger.exception(f"Error during scheduled work order scraping: {e}")
        
        # Update progress to failed
        try:
            from ..routes.work_orders import scraping_progress
            if user_id in scraping_progress:
                scraping_progress[user_id]["status"] = "failed"
                scraping_progress[user_id]["error"] = str(e)
                scraping_progress[user_id]["completed_at"] = datetime.now().isoformat()
        except:
            pass
    
    # Log execution stats
    duration = (datetime.utcnow() - start_time).total_seconds()
    logger.info(f"Work order scraping completed - Success: {success}, "
                f"Items: {items_processed}, Duration: {duration:.1f}s")
    
    # Create history record for UI tracking
    db = SessionLocal()
    try:
        from ..models.scraping_models import ScrapingSchedule, ScrapingHistory
        
        # Create history record
        history = ScrapingHistory(
            user_id=user_id,
            schedule_type="work_orders",
            started_at=start_time,
            completed_at=datetime.utcnow(),
            success=success,
            items_processed=items_processed,
            error_message=error_message,
            trigger_type=trigger_type  # Use the provided trigger type
        )
        db.add(history)
        logger.info(f"Created ScrapingHistory record - success: {success}, items: {items_processed}")
        
        # Update schedule info
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            schedule.last_run = datetime.utcnow()
            if not success:
                schedule.consecutive_failures = (schedule.consecutive_failures or 0) + 1
            else:
                schedule.consecutive_failures = 0
            logger.debug(f"Updated schedule last run info - success: {success}, failures: {schedule.consecutive_failures}")
            
        db.commit()
        logger.info(f"Database updates committed successfully")
    except Exception as e:
        logger.error(f"Failed to save history/schedule updates: {e}")
        db.rollback()
    finally:
        db.close()

class SchedulerService:
    """Manages background scheduled tasks"""
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.is_initialized = False
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        
    async def initialize(self, database_url: str):
        """Initialize the scheduler with persistent job storage"""
        if self.is_initialized:
            logger.warning("Scheduler already initialized")
            return
            
        logger.info(f"Initializing scheduler service with database: {database_url}")
        try:
            # Configure job stores
            jobstores = {
                'default': SQLAlchemyJobStore(url=database_url)
            }
            
            # Configure executors
            executors = {
                'default': AsyncIOExecutor()
            }
            
            # Configure job defaults with more generous misfire grace time
            job_defaults = {
                'coalesce': True,  # Combine multiple pending executions of same job
                'max_instances': 1,  # Only one instance of each job at a time
                'misfire_grace_time': 3600  # 60 minutes grace time for misfired jobs
            }
            
            # Create scheduler
            self.scheduler = AsyncIOScheduler(
                jobstores=jobstores,
                executors=executors,
                job_defaults=job_defaults,
                timezone='UTC'
            )
            logger.debug("Scheduler instance created")
            
            # Add event listeners
            self.scheduler.add_listener(
                self._handle_job_event,
                EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_MISSED | EVENT_JOB_SUBMITTED | EVENT_JOB_REMOVED
            )
            logger.info("Event listeners added for job execution tracking")
            
            # Start scheduler
            self.scheduler.start()
            self.is_initialized = True
            logger.info("Scheduler started successfully")
            
            # Log scheduler state
            logger.info(f"Scheduler state: {self.scheduler.state}")
            logger.info(f"Scheduler running: {self.scheduler.running}")
            
            # Restore active schedules from database
            logger.info("Restoring schedules from database")
            await self._restore_schedules()
            
            # Check for severely overdue jobs
            jobs = self.scheduler.get_jobs()
            for job in jobs:
                if job.next_run_time:
                    time_diff = (datetime.now(timezone.utc) - job.next_run_time).total_seconds()
                    if time_diff > 3600:  # More than 1 hour overdue
                        logger.warning(f"Job {job.id} is severely overdue by {time_diff/60:.1f} minutes!")
                        logger.warning(f"Consider triggering immediate execution")
            
            logger.info(f"Scheduler service initialized successfully with {len(self.active_jobs)} active jobs")
            
        except Exception as e:
            logger.error(f"Failed to initialize scheduler: {e}")
            raise
    
    async def shutdown(self):
        """Gracefully shutdown the scheduler"""
        logger.info("Shutting down scheduler service")
        if self.scheduler and self.scheduler.running:
            logger.debug(f"Stopping scheduler with {len(self.active_jobs)} active jobs")
            self.scheduler.shutdown(wait=True)
            self.is_initialized = False
            logger.info("Scheduler service shut down successfully")
        else:
            logger.warning("Scheduler not running, nothing to shut down")
    
    async def add_work_order_scraping_schedule(
        self,
        user_id: str,
        interval_hours: float = 1.0,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: bool = True,
        is_restore: bool = False
    ) -> str:
        """Add a scheduled work order scraping job"""
        
        logger.info(f"Adding work order scraping schedule for user {user_id}")
        logger.debug(f"Schedule params: interval_hours={interval_hours}, active_hours={active_hours}, enabled={enabled}, is_restore={is_restore}")
        
        # Check if scheduler is initialized
        if not self.is_initialized or not self.scheduler:
            logger.error("Scheduler service not initialized")
            raise RuntimeError("Scheduler service not initialized. Please ensure the scheduler is initialized before adding jobs.")
        
        job_id = f"work_order_scrape_{user_id}"
        
        # Don't set default active hours - respect what's passed in
        logger.info(f"Active hours passed to add_schedule: {active_hours}")
        logger.info(f"Active hours type: {type(active_hours)}")
        logger.info(f"Active hours is None: {active_hours is None}")
        
        # Create trigger based on configuration
        if active_hours is not None and active_hours:
            # Use cron trigger for specific hours
            logger.debug(f"Creating cron trigger for hours {active_hours['start']}-{active_hours['end']-1}")
            trigger = CronTrigger(
                hour=f"{active_hours['start']}-{active_hours['end']-1}",
                minute=30,  # Run at 30 minutes past each hour
                timezone='UTC'
            )
        else:
            # Use cron trigger for consistent timing (every hour at :30)
            logger.debug(f"Creating cron trigger for every {interval_hours} hours at :30")
            if interval_hours == 1:
                # Every hour at 30 minutes past
                trigger = CronTrigger(
                    minute=30,
                    timezone='UTC'
                )
            else:
                # For other intervals, use specific hours
                hours = []
                hour = 0
                while hour < 24:
                    hours.append(str(hour))
                    hour += int(interval_hours)
                trigger = CronTrigger(
                    hour=','.join(hours),
                    minute=30,
                    timezone='UTC'
                )
        
        # Add job to scheduler
        logger.debug(f"Adding job {job_id} to scheduler")
        job = self.scheduler.add_job(
            func=execute_work_order_scraping,
            trigger=trigger,
            id=job_id,
            args=[user_id],
            replace_existing=True,
            name=f"Work Order Scraping - User {user_id}",
            misfire_grace_time=300
        )
        logger.info(f"Job {job_id} added to scheduler, next run: {job.next_run_time}")
        
        # Store schedule configuration in database
        db = SessionLocal()
        try:
            # Check if schedule already exists
            existing = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == user_id,
                ScrapingSchedule.schedule_type == "work_orders"
            ).first()
            
            if existing:
                # Update existing schedule
                logger.warning(f"=== UPDATING EXISTING SCHEDULE IN DB ===")
                logger.warning(f"Previous values:")
                logger.warning(f"  - interval_hours: {existing.interval_hours}")
                logger.warning(f"  - active_hours: {existing.active_hours}")
                logger.warning(f"  - enabled: {existing.enabled}")
                logger.warning(f"New values being set:")
                logger.warning(f"  - interval_hours: {interval_hours}")
                logger.warning(f"  - active_hours: {active_hours}")
                logger.warning(f"  - enabled: {enabled}")
                logger.warning(f"  - is_restore: {is_restore}")
                
                # During restore, don't update database values - just sync scheduler
                if not is_restore:
                    existing.interval_hours = interval_hours
                    existing.active_hours = active_hours
                    existing.enabled = enabled
                    existing.next_run = job.next_run_time
                    existing.updated_at = datetime.utcnow()
                    logger.warning(f"Updated existing schedule record for user {user_id}")
                else:
                    # In restore mode, still update next_run if it's missing
                    if not existing.next_run and job.next_run_time:
                        existing.next_run = job.next_run_time
                        existing.updated_at = datetime.utcnow()
                        logger.info(f"Restore mode - updated missing next_run to: {job.next_run_time}")
                    else:
                        logger.info(f"Restore mode - keeping existing database values")
            else:
                # Create new schedule
                schedule = ScrapingSchedule(
                    user_id=user_id,
                    schedule_type="work_orders",
                    interval_hours=interval_hours,
                    active_hours=active_hours,
                    enabled=enabled,
                    next_run=job.next_run_time
                )
                db.add(schedule)
                logger.debug(f"Created new schedule record for user {user_id}")
            
            db.commit()
        finally:
            db.close()
        
        # Track active job
        self.active_jobs[job_id] = {
            "user_id": user_id,
            "type": "work_orders",
            "enabled": enabled,
            "created_at": datetime.utcnow()
        }
        
        if not enabled:
            logger.debug(f"Pausing job {job_id} as enabled=False")
            self.scheduler.pause_job(job_id)
        
        logger.info(f"Successfully added work order scraping schedule for user {user_id} with job ID {job_id}")
        return job_id
    
    async def _execute_work_order_scraping(self, user_id: str, trigger_type: str = "scheduled"):
        """Execute work order scraping task"""
        start_time = datetime.utcnow()
        success = False
        error_message = None
        items_processed = 0
        
        try:
            logger.info(f"Starting scheduled work order scraping for user {user_id}")
            
            # Get database session
            db = SessionLocal()
            try:
                # Get user credentials from database
                from ..models.user_models import UserCredential
                user_credential = db.query(UserCredential).filter(
                    UserCredential.user_id == user_id,
                    UserCredential.service_name == 'workfossa'
                ).first()
                
                if not user_credential:
                    raise Exception("No WorkFossa credentials found")
                
                # Convert to expected format
                credentials = {
                    'username': user_credential.username,
                    'password': user_credential.password
                }
                
                # Initialize automation service
                from ..services.workfossa_automation import WorkFossaAutomationService
                automation_service = WorkFossaAutomationService(headless=True)
                
                # Initialize scraper
                scraper = WorkFossaScraper(automation_service)
                
                # Create a session and login
                session_id = f"scheduler_scrape_{user_id}_{datetime.utcnow().timestamp()}"
                
                # TODO: This section needs to be properly implemented using the WorkFossaAutomationService
                # For now, return a placeholder result to avoid the method breaking
                result = {"success": False, "error": "Scheduler scraping needs proper implementation with WorkFossaAutomationService"}
                
                if result.get("success"):
                    items_processed = len(result.get("work_orders", []))
                    success = True
                    
                    # Check for new work orders and send notifications
                    new_orders = result.get("new_work_orders", [])
                    if new_orders:
                        # For now, just log the new orders
                        # TODO: Integrate with notification manager properly
                        logger.info(f"Found {len(new_orders)} new work orders for user {user_id}")
                else:
                    error_message = result.get("error", "Unknown error")
                    
                # Log scraping history
                history = ScrapingHistory(
                    user_id=user_id,
                    schedule_type="work_orders",
                    started_at=start_time,
                    completed_at=datetime.utcnow(),
                    success=success,
                    items_processed=items_processed,
                    error_message=error_message,
                    trigger_type=trigger_type
                )
                db.add(history)
                db.commit()
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in scheduled work order scraping: {e}")
            error_message = str(e)
            
            # Log failure
            db = SessionLocal()
            try:
                history = ScrapingHistory(
                    user_id=user_id,
                    schedule_type="work_orders",
                    started_at=start_time,
                    completed_at=datetime.utcnow(),
                    success=False,
                    error_message=error_message,
                    trigger_type=trigger_type
                )
                db.add(history)
                db.commit()
            finally:
                db.close()
    
    async def update_schedule(
        self,
        job_id: str,
        interval_hours: Optional[float] = None,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: Optional[bool] = None
    ) -> bool:
        """Update an existing schedule"""
        
        logger.info(f"=== SCHEDULER SERVICE UPDATE ===")
        logger.info(f"Job ID: {job_id}")
        logger.info(f"Interval hours: {interval_hours}")
        logger.info(f"Active hours: {active_hours}")
        logger.info(f"Active hours type: {type(active_hours)}")
        logger.info(f"Enabled: {enabled}")
        logger.info(f"Active jobs: {list(self.active_jobs.keys())}")
        
        if job_id not in self.active_jobs:
            logger.error(f"Job {job_id} not found in active jobs. Available jobs: {list(self.active_jobs.keys())}")
            return False
        
        try:
            job = self.scheduler.get_job(job_id)
            logger.info(f"Got job from scheduler: {job is not None}")
            if not job:
                logger.error(f"Job {job_id} not found in scheduler")
                return False
            
            logger.info(f"Current job trigger: {job.trigger}")
            logger.info(f"Current next run: {job.next_run_time}")
            
            # Update trigger if interval changed
            if interval_hours is not None or active_hours is not None:
                logger.info(f"Trigger update needed")
                logger.info(f"Checking active_hours condition:")
                logger.info(f"  - active_hours is not None: {active_hours is not None}")
                logger.info(f"  - active_hours truthiness: {bool(active_hours)}")
                logger.info(f"  - has 'start' key: {'start' in active_hours if active_hours else False}")
                logger.info(f"  - has 'end' key: {'end' in active_hours if active_hours else False}")
                
                # Check if active_hours is explicitly set (not None) and has values
                if active_hours is not None and active_hours and 'start' in active_hours and 'end' in active_hours:
                    logger.info(f"Creating CronTrigger with hours {active_hours['start']}-{active_hours['end']-1}")
                    trigger = CronTrigger(
                        hour=f"{active_hours['start']}-{active_hours['end']-1}",
                        minute=30,  # Run at 30 minutes past each hour
                        timezone='UTC'
                    )
                else:
                    logger.info(f"Creating CronTrigger for consistent timing")
                    # Get the current interval if not provided
                    if interval_hours is None:
                        # Get current interval from database
                        user_id = self.active_jobs[job_id]["user_id"]
                        db = SessionLocal()
                        try:
                            schedule = db.query(ScrapingSchedule).filter(
                                ScrapingSchedule.user_id == user_id,
                                ScrapingSchedule.schedule_type == "work_orders"
                            ).first()
                            interval_hours = schedule.interval_hours if schedule else 1.0
                        finally:
                            db.close()
                    
                    # Use cron trigger for consistent timing
                    if interval_hours == 1:
                        trigger = CronTrigger(minute=30, timezone='UTC')
                    else:
                        hours = []
                        hour = 0
                        while hour < 24:
                            hours.append(str(hour))
                            hour += int(interval_hours)
                        trigger = CronTrigger(
                            hour=','.join(hours),
                            minute=30,
                            timezone='UTC'
                        )
                
                logger.info(f"Rescheduling job with new trigger: {trigger}")
                job.reschedule(trigger=trigger)
                logger.info(f"Job rescheduled successfully")
                logger.info(f"New next run time: {job.next_run_time}")
                logger.info(f"New trigger: {job.trigger}")
            
            # Update enabled state
            if enabled is not None:
                if enabled:
                    logger.debug(f"Resuming job {job_id}")
                    self.scheduler.resume_job(job_id)
                else:
                    logger.debug(f"Pausing job {job_id}")
                    self.scheduler.pause_job(job_id)
                
                self.active_jobs[job_id]["enabled"] = enabled
            
            # Update database
            user_id = self.active_jobs[job_id]["user_id"]
            db = SessionLocal()
            try:
                schedule = db.query(ScrapingSchedule).filter(
                    ScrapingSchedule.user_id == user_id,
                    ScrapingSchedule.schedule_type == "work_orders"
                ).first()
                
                if schedule:
                    if interval_hours is not None:
                        schedule.interval_hours = interval_hours
                    if active_hours is not None:
                        schedule.active_hours = active_hours
                    if enabled is not None:
                        schedule.enabled = enabled
                    
                    # Update next_run time from the rescheduled job
                    job = self.scheduler.get_job(job_id)
                    if job and job.next_run_time:
                        schedule.next_run = job.next_run_time
                        logger.info(f"Updated next_run in database to: {job.next_run_time}")
                    
                    schedule.updated_at = datetime.utcnow()
                    db.commit()
            finally:
                db.close()
            
            logger.info(f"=== DATABASE UPDATE ===")
            logger.info(f"Updating database record for schedule")
            
            logger.info(f"=== SCHEDULE UPDATE COMPLETE ===")
            logger.info(f"Successfully updated schedule {job_id}")
            logger.info(f"Final state:")
            logger.info(f"  - Enabled: {self.active_jobs[job_id]['enabled']}")
            logger.info(f"  - Next run: {self.scheduler.get_job(job_id).next_run_time if self.scheduler.get_job(job_id) else 'N/A'}")
            return True
            
        except Exception as e:
            logger.error(f"Exception in update_schedule: {e}", exc_info=True)
            return False
    
    async def remove_schedule(self, job_id: str) -> bool:
        """Remove a scheduled job"""
        
        logger.info(f"Removing schedule {job_id}")
        
        if job_id not in self.active_jobs:
            logger.warning(f"Job {job_id} not found in active jobs")
            return False
        
        try:
            self.scheduler.remove_job(job_id)
            
            # Remove from database
            user_id = self.active_jobs[job_id]["user_id"]
            db = SessionLocal()
            try:
                schedule = db.query(ScrapingSchedule).filter(
                    ScrapingSchedule.user_id == user_id,
                    ScrapingSchedule.schedule_type == "work_orders"
                ).first()
                if schedule:
                    db.delete(schedule)
                    db.commit()
            finally:
                db.close()
            
            del self.active_jobs[job_id]
            logger.info(f"Successfully removed schedule {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove schedule: {e}")
            return False
    
    async def get_schedule_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a scheduled job"""
        
        logger.debug(f"Getting status for schedule {job_id}")
        
        if job_id not in self.active_jobs:
            logger.debug(f"Job {job_id} not found in active jobs")
            return None
        
        job = self.scheduler.get_job(job_id)
        if not job:
            return None
        
        return {
            "job_id": job_id,
            "user_id": self.active_jobs[job_id]["user_id"],
            "type": self.active_jobs[job_id]["type"],
            "enabled": self.active_jobs[job_id]["enabled"],
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "pending": job.pending
        }
    
    async def get_all_schedules(self) -> List[Dict[str, Any]]:
        """Get all active schedules"""
        
        logger.debug("Getting all active schedules")
        
        if not self.is_initialized:
            logger.warning("Scheduler not initialized, returning empty list")
            return []
        
        schedules = []
        for job_id in self.active_jobs:
            status = await self.get_schedule_status(job_id)
            if status:
                schedules.append(status)
        
        logger.debug(f"Found {len(schedules)} active schedules")
        return schedules
    
    async def get_scraping_history(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get scraping history for a user"""
        
        db = SessionLocal()
        try:
            records = db.query(ScrapingHistory).filter(
                ScrapingHistory.user_id == user_id
            ).order_by(ScrapingHistory.started_at.desc()).limit(limit).offset(offset).all()
            
            history = []
            for record in records:
                # Ensure timestamps have timezone info (UTC)
                started_at = record.started_at
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                
                completed_at = record.completed_at
                if completed_at and completed_at.tzinfo is None:
                    completed_at = completed_at.replace(tzinfo=timezone.utc)
                
                history.append({
                    "id": record.id,
                    "started_at": started_at.isoformat(),
                    "completed_at": completed_at.isoformat() if completed_at else None,
                    "success": record.success,
                    "items_processed": record.items_processed,
                    "error_message": record.error_message,
                    "duration_seconds": (
                        record.completed_at - record.started_at
                    ).total_seconds() if record.completed_at else None,
                    "trigger_type": getattr(record, 'trigger_type', 'scheduled')  # Default to 'scheduled' for old records
                })
            
            return history
        finally:
            db.close()
    
    async def _restore_schedules(self):
        """Restore schedules from database on startup"""
        
        logger.info("Starting schedule restoration from database")
        try:
            db = SessionLocal()
            try:
                schedules = db.query(ScrapingSchedule).filter(
                    ScrapingSchedule.enabled == True
                ).all()
                
                logger.info(f"Found {len(schedules)} enabled schedules in database")
                
                for schedule in schedules:
                    if schedule.schedule_type == "work_orders":
                        logger.info(f"=== RESTORING SCHEDULE ===")
                        logger.info(f"User ID: {schedule.user_id}")
                        logger.info(f"Interval hours from DB: {schedule.interval_hours}")
                        logger.info(f"Active hours from DB: {schedule.active_hours}")
                        logger.info(f"Enabled from DB: {schedule.enabled}")
                        try:
                            await self.add_work_order_scraping_schedule(
                                user_id=schedule.user_id,
                                interval_hours=schedule.interval_hours,
                                active_hours=schedule.active_hours,
                                enabled=True,
                                is_restore=True
                            )
                        except Exception as e:
                            logger.error(f"Failed to restore schedule for user {schedule.user_id}: {e}")
                
                logger.info(f"Schedule restoration complete. Restored {len(self.active_jobs)} schedules")
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Failed to restore schedules: {e}", exc_info=True)
    
    def _handle_job_event(self, event):
        """Handle job execution events"""
        
        logger.info(f"=== JOB EVENT ===")
        logger.info(f"Event type: {event.code}")
        logger.info(f"Job ID: {event.job_id}")
        if hasattr(event, 'scheduled_run_time'):
            logger.info(f"Scheduled time: {event.scheduled_run_time}")
        
        if event.exception:
            logger.error(f"Job {event.job_id} crashed: {event.exception}", exc_info=event.exception)
            # Log to automation logger as well for visibility
            from ..services.logging_service import log_automation_event
            log_automation_event("job_error", {
                "job_id": event.job_id,
                "error": str(event.exception),
                "event_code": event.code
            })
        elif event.code == EVENT_JOB_MISSED:
            logger.warning(f"Job {event.job_id} missed scheduled run time")
            logger.warning(f"Was scheduled for: {event.scheduled_run_time}")
            logger.warning(f"Current time: {datetime.utcnow()}")
            from ..services.logging_service import log_automation_event
            log_automation_event("job_missed", {
                "job_id": event.job_id,
                "scheduled_run_time": str(event.scheduled_run_time)
            })
        elif event.code == EVENT_JOB_SUBMITTED:
            logger.info(f"Job {event.job_id} submitted for execution")
            
            # Update next_run when job is submitted (in case it was missed)
            if event.job_id.startswith('work_order_scrape_'):
                try:
                    user_id = event.job_id.replace('work_order_scrape_', '')
                    job = self.scheduler.get_job(event.job_id)
                    if job and job.next_run_time:
                        db = SessionLocal()
                        try:
                            from ..models.scraping_models import ScrapingSchedule
                            schedule = db.query(ScrapingSchedule).filter(
                                ScrapingSchedule.user_id == user_id,
                                ScrapingSchedule.schedule_type == "work_orders"
                            ).first()
                            
                            if schedule and job.next_run_time:
                                # Update next_run to reflect when this job will run next
                                next_run = job.next_run_time.replace(tzinfo=None) if job.next_run_time else None
                                if next_run and next_run != schedule.next_run:
                                    schedule.next_run = next_run
                                    db.commit()
                                    logger.info(f"Updated next_run for user {user_id} at job submission")
                        finally:
                            db.close()
                except Exception as e:
                    logger.error(f"Failed to update next_run at job submission: {e}")
        elif event.code == EVENT_JOB_EXECUTED:
            logger.info(f"Job {event.job_id} executed successfully")
            from ..services.logging_service import log_automation_event
            log_automation_event("job_executed", {
                "job_id": event.job_id,
                "run_time": str(event.scheduled_run_time)
            })
            
            # Update next_run in database after successful execution
            if event.job_id.startswith('work_order_scrape_'):
                try:
                    user_id = event.job_id.replace('work_order_scrape_', '')
                    job = self.scheduler.get_job(event.job_id)
                    if job and job.next_run_time:
                        db = SessionLocal()
                        try:
                            from ..models.scraping_models import ScrapingSchedule
                            schedule = db.query(ScrapingSchedule).filter(
                                ScrapingSchedule.user_id == user_id,
                                ScrapingSchedule.schedule_type == "work_orders"
                            ).first()
                            
                            if schedule:
                                # Update next_run to the job's next scheduled time
                                schedule.next_run = job.next_run_time.replace(tzinfo=None)
                                db.commit()
                                logger.info(f"Updated next_run for user {user_id} to {job.next_run_time}")
                        finally:
                            db.close()
                except Exception as e:
                    logger.error(f"Failed to update next_run after job execution: {e}")

# Global scheduler instance
scheduler_service = SchedulerService()