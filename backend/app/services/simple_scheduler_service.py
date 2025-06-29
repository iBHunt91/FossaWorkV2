#!/usr/bin/env python3
"""
Simplified Scheduler Service for Work Order Scraping
Uses APScheduler for accurate hourly execution
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Any
import json
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, EVENT_JOB_MISSED

from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db, SessionLocal
from ..models.scraping_models import ScrapingSchedule, ScrapingHistory
from ..services.credential_manager_deprecated import credential_manager
from ..services.workfossa_automation import WorkFossaAutomationService
from ..services.workfossa_scraper import WorkFossaScraper
from ..services.browser_automation import browser_automation
from ..services.notification_manager import get_notification_manager, NotificationTrigger
from ..services.logging_service import get_logger

logger = get_logger("scheduler.simple")


class SimpleSchedulerService:
    """Simplified scheduler using APScheduler for accurate timing"""
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.active_jobs: Dict[str, str] = {}  # user_id -> job_id mapping
        
    async def initialize(self):
        """Initialize the scheduler"""
        if self.scheduler is None:
            self.scheduler = AsyncIOScheduler(
                timezone='UTC',
                job_defaults={
                    'coalesce': True,  # Coalesce missed jobs
                    'max_instances': 1,  # Only one instance per job
                    'misfire_grace_time': 300  # 5 minutes grace period
                }
            )
            
            # Add event listeners
            self.scheduler.add_listener(
                self._on_job_executed,
                EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_MISSED
            )
            
            self.scheduler.start()
            logger.info("Simple scheduler initialized and started")
            
    def _on_job_executed(self, event):
        """Handle job execution events"""
        if event.exception:
            logger.error(f"Job {event.job_id} failed: {event.exception}")
        else:
            logger.info(f"Job {event.job_id} executed successfully")
            
    async def validate_credentials(self, user_id: str) -> bool:
        """Validate that credentials exist and are decryptable"""
        try:
            creds = credential_manager.retrieve_credentials(user_id)
            if not creds or not creds.username or not creds.password:
                logger.error(f"Missing or incomplete credentials for user {user_id}")
                return False
            logger.info(f"Credentials validated for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to validate credentials for user {user_id}: {e}")
            return False
            
    async def schedule_hourly_scraping(self, user_id: str, schedule_id: int) -> Dict[str, Any]:
        """Schedule hourly work order scraping"""
        
        # Validate credentials first
        if not await self.validate_credentials(user_id):
            raise ValueError("Invalid or missing credentials. Please update your WorkFossa credentials.")
            
        # Remove existing job if any
        if user_id in self.active_jobs:
            self.scheduler.remove_job(self.active_jobs[user_id])
            
        # Create job ID
        job_id = f"work_orders_{user_id}"
        
        # Schedule job to run every hour on the hour
        job = self.scheduler.add_job(
            self._execute_scraping,
            CronTrigger(minute=0),  # Run at :00 of every hour
            id=job_id,
            args=[user_id, schedule_id],
            name=f"Work Order Scraping - User {user_id[:8]}",
            replace_existing=True
        )
        
        self.active_jobs[user_id] = job_id
        
        # Update database with next run time
        db = SessionLocal()
        try:
            schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
            if schedule:
                schedule.next_run = job.next_run_time.replace(tzinfo=timezone.utc)
                schedule.enabled = True
                schedule.interval_hours = 1.0
                db.commit()
                
            return {
                "success": True,
                "job_id": job_id,
                "next_run": job.next_run_time.isoformat(),
                "message": f"Scheduled to run every hour at :00"
            }
        finally:
            db.close()
            
    async def _execute_scraping(self, user_id: str, schedule_id: int):
        """Execute the actual scraping job"""
        start_time = datetime.now(timezone.utc)
        db = SessionLocal()
        
        # Create history entry
        history = ScrapingHistory(
            user_id=user_id,
            schedule_type="work_orders",
            started_at=start_time,
            trigger_type="scheduled"
        )
        db.add(history)
        db.commit()
        history_id = history.id
        
        try:
            logger.info(f"Starting scheduled work order scraping for user {user_id}")
            
            # Get credentials
            creds = credential_manager.retrieve_credentials(user_id)
            if not creds:
                raise Exception("Credentials not found")
                
            credentials = {
                'username': creds.username,
                'password': creds.password
            }
            
            # Get browser visibility preference
            headless = True
            settings_path = Path(f"data/users/{user_id}/settings/browser_settings.json")
            if settings_path.exists():
                with open(settings_path, 'r') as f:
                    settings = json.load(f)
                    headless = not settings.get('show_browser_during_sync', False)
                    
            # Create session
            session_id = f"scheduled_{user_id}_{int(start_time.timestamp())}"
            workfossa = WorkFossaAutomationService(headless=headless)
            
            # Login and scrape
            if not await workfossa.create_session(session_id, user_id, credentials):
                raise Exception("Failed to create session")
                
            if not await workfossa.login_to_workfossa(session_id):
                raise Exception("Failed to login")
                
            # Scrape work orders
            scraper = WorkFossaScraper(browser_automation=browser_automation)
            work_orders = await scraper.scrape_work_orders(
                session_id=session_id,
                user_id=user_id,
                progress_callback=None  # No progress for scheduled runs
            )
            
            # Update history
            history.completed_at = datetime.now(timezone.utc)
            history.success = True
            history.items_processed = len(work_orders)
            history.notes = f"Successfully scraped {len(work_orders)} work orders"
            
            # Update schedule
            schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
            if schedule:
                schedule.last_run = start_time
                schedule.consecutive_failures = 0
                # Calculate next run (next hour)
                next_job = self.scheduler.get_job(self.active_jobs.get(user_id))
                if next_job:
                    schedule.next_run = next_job.next_run_time.replace(tzinfo=timezone.utc)
                    
            db.commit()
            
            # Send notification if configured
            notification_manager = get_notification_manager()
            if notification_manager:
                await notification_manager.send_notification(
                    user_id=user_id,
                    trigger=NotificationTrigger.SCRAPE_COMPLETE,
                    data={
                        'work_order_count': len(work_orders),
                        'duration': int((datetime.now(timezone.utc) - start_time).total_seconds())
                    }
                )
                
            logger.info(f"Completed scheduled scraping for user {user_id}: {len(work_orders)} orders")
            
        except Exception as e:
            logger.error(f"Scheduled scraping failed for user {user_id}: {e}")
            
            # Update history
            history.completed_at = datetime.now(timezone.utc)
            history.success = False
            history.error_message = str(e)
            
            # Update schedule
            schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
            if schedule:
                schedule.consecutive_failures += 1
                
            db.commit()
            
            # Send error notification
            notification_manager = get_notification_manager()
            if notification_manager:
                await notification_manager.send_notification(
                    user_id=user_id,
                    trigger=NotificationTrigger.SCRAPE_ERROR,
                    data={'error': str(e)}
                )
                
        finally:
            # Cleanup
            try:
                if 'workfossa' in locals():
                    await workfossa.cleanup_session(session_id)
            except:
                pass
            db.close()
            
    async def pause_schedule(self, user_id: str, schedule_id: int) -> Dict[str, Any]:
        """Pause scheduled scraping"""
        if user_id in self.active_jobs:
            self.scheduler.pause_job(self.active_jobs[user_id])
            
            # Update database
            db = SessionLocal()
            try:
                schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
                if schedule:
                    schedule.enabled = False
                    db.commit()
                    
                return {"success": True, "message": "Schedule paused"}
            finally:
                db.close()
        else:
            return {"success": False, "message": "No active schedule found"}
            
    async def resume_schedule(self, user_id: str, schedule_id: int) -> Dict[str, Any]:
        """Resume scheduled scraping"""
        if user_id in self.active_jobs:
            self.scheduler.resume_job(self.active_jobs[user_id])
            
            # Update database
            db = SessionLocal()
            try:
                schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
                if schedule:
                    schedule.enabled = True
                    # Update next run time
                    job = self.scheduler.get_job(self.active_jobs[user_id])
                    if job:
                        schedule.next_run = job.next_run_time.replace(tzinfo=timezone.utc)
                    db.commit()
                    
                return {"success": True, "message": "Schedule resumed"}
            finally:
                db.close()
        else:
            # Need to reschedule
            return await self.schedule_hourly_scraping(user_id, schedule_id)
            
    async def get_schedule_status(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current schedule status"""
        db = SessionLocal()
        try:
            schedule = db.query(ScrapingSchedule).filter_by(
                user_id=user_id,
                schedule_type="work_orders"
            ).first()
            
            if not schedule:
                return None
                
            # Get job info if active
            job = None
            if user_id in self.active_jobs:
                job = self.scheduler.get_job(self.active_jobs[user_id])
                
            return {
                "enabled": schedule.enabled,
                "next_run": schedule.next_run.isoformat() if schedule.next_run else None,
                "last_run": schedule.last_run.isoformat() if schedule.last_run else None,
                "consecutive_failures": schedule.consecutive_failures,
                "is_running": job.pending if job else False,
                "interval_hours": schedule.interval_hours
            }
        finally:
            db.close()
            
    async def run_now(self, user_id: str, schedule_id: int) -> Dict[str, Any]:
        """Trigger immediate execution"""
        if user_id in self.active_jobs:
            # Run job immediately
            job = self.scheduler.get_job(self.active_jobs[user_id])
            if job:
                job.modify(next_run_time=datetime.now(timezone.utc))
                return {"success": True, "message": "Scraping triggered"}
        
        return {"success": False, "message": "No active schedule found"}


# Singleton instance
simple_scheduler = SimpleSchedulerService()


async def get_simple_scheduler() -> SimpleSchedulerService:
    """Get the singleton scheduler instance"""
    if simple_scheduler.scheduler is None:
        await simple_scheduler.initialize()
    return simple_scheduler