#!/usr/bin/env python3
"""
Standalone Scheduler Daemon for FossaWork V2

This is a simplified scheduler that runs as a separate process, checking the database
for scheduled tasks and executing them at the appropriate times.
"""

import asyncio
import signal
import sys
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set
import json
from pathlib import Path

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import DATABASE_URL, Base
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.models.user_models import UserCredential
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.notification_manager import NotificationManager, NotificationTrigger, get_notification_manager
from app.services.logging_service import get_logger

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

logger = get_logger("scheduler.daemon")
# Set logging level based on environment
import logging
if os.getenv("DEBUG", "").lower() in ("true", "1", "yes"):
    logger.setLevel(logging.DEBUG)

# Create database engine for daemon
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class SchedulerDaemon:
    """Standalone scheduler daemon that polls database and executes jobs"""
    
    def __init__(self):
        self.running = False
        self.active_jobs: Set[str] = set()
        self.check_interval = 60  # Check every 60 seconds
        
    async def execute_work_order_scraping(self, user_id: str, schedule_id: int):
        """Execute work order scraping for a user"""
        job_key = f"{user_id}_{schedule_id}"
        
        # Prevent duplicate executions
        if job_key in self.active_jobs:
            logger.warning(f"Job {job_key} is already running, skipping")
            return
            
        self.active_jobs.add(job_key)
        start_time = datetime.now(timezone.utc)
        
        # Create history entry
        db = SessionLocal()
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
            logger.info(f"Starting work order scraping for user {user_id}")
            
            # Get user credentials using the new encrypted credential system
            from app.services.credential_manager_deprecated import CredentialManager
            credential_manager = CredentialManager()
            
            credentials_obj = credential_manager.retrieve_credentials(user_id)
            if not credentials_obj:
                raise Exception("No WorkFossa credentials found for user")
            
            credentials = {
                'username': credentials_obj.username,
                'password': credentials_obj.password
            }
            
            logger.info(f"✅ [DEBUG] Credentials loaded for user {user_id[:8]}... - Username: {credentials_obj.username}")
            
            # Initialize WorkFossa automation service (not just browser automation)
            from app.services.workfossa_automation import WorkFossaAutomationService
            from app.services.browser_automation import browser_automation
            
            # Get user's browser visibility preference from JSON settings file
            headless = True  # Default to headless
            try:
                # Read browser settings from JSON file
                settings_path = Path(f"data/users/{user_id}/settings/browser_settings.json")
                if settings_path.exists():
                    with open(settings_path, 'r') as f:
                        browser_settings = json.load(f)
                        # Check for show_browser_during_sync flag or inverse of headless
                        if 'show_browser_during_sync' in browser_settings:
                            headless = not browser_settings.get('show_browser_during_sync', False)
                        else:
                            # Use the headless setting from browser settings
                            headless = browser_settings.get('headless', True)
                        logger.info(f"Browser visibility setting for user {user_id[:8]}...: show_browser={not headless}")
                else:
                    logger.info(f"No browser settings file found for user {user_id[:8]}..., using default headless=True")
            except Exception as e:
                logger.warning(f"Failed to get browser settings: {e}, using default headless=True")
            
            # Create WorkFossa automation service instance with user's preference
            workfossa_automation = WorkFossaAutomationService(headless=headless)
            scraper = WorkFossaScraper(browser_automation=browser_automation)
            
            # Get existing work orders to check for updates
            from sqlalchemy import text
            existing_count_query = text("""
                SELECT COUNT(*) FROM work_orders WHERE user_id = :user_id
            """)
            existing_count = db.execute(existing_count_query, {"user_id": user_id}).scalar()
            
            # Create a session for this scheduled scraping
            session_id = f"scheduled_{user_id}_{schedule_id}_{int(start_time.timestamp())}"
            
            logger.info(f"🔧 [SCHEDULER] Creating WorkFossa session: {session_id}")
            
            # Create authenticated WorkFossa session (this handles both browser and auth)
            success = await workfossa_automation.create_session(session_id, user_id, credentials)
            if not success:
                raise Exception("Failed to create WorkFossa automation session")
            
            # Login to WorkFossa (this sets logged_in=True in the session)
            login_success = await workfossa_automation.login_to_workfossa(session_id)
            if not login_success:
                raise Exception("Failed to login to WorkFossa")
            
            logger.info(f"✅ [SCHEDULER] Successfully authenticated session: {session_id}")
            
            # Get the page from the WorkFossa automation service session
            session_data = workfossa_automation.sessions.get(session_id)
            if not session_data or 'page' not in session_data:
                raise Exception("No browser page found in WorkFossa session")
            
            page = session_data['page']
            
            # Now scrape work orders with authenticated session and page
            work_orders = await scraper.scrape_work_orders(session_id, page=page)
            
            # Update history with results
            history = db.query(ScrapingHistory).filter_by(id=history_id).first()
            history.completed_at = datetime.now(timezone.utc)
            history.success = True
            history.items_processed = len(work_orders)
            history.duration_seconds = (history.completed_at - start_time).total_seconds()
            
            # Reset consecutive failures on schedule
            schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
            if schedule:
                schedule.consecutive_failures = 0
                schedule.last_run = datetime.now(timezone.utc)
            
            db.commit()
            
            logger.info(f"Successfully scraped {len(work_orders)} work orders for user {user_id}")
            
            # Send notification if configured
            # Use the factory function to get notification manager
            from app.services.notification_manager import get_notification_manager
            notification_manager = get_notification_manager(db)
            
            # Check if user has notifications enabled
            try:
                await notification_manager.send_automation_notification(
                    user_id,
                    NotificationTrigger.AUTOMATION_COMPLETED,
                    {
                        "station_name": "Scheduled Scraping",
                        "job_id": f"SCHED_{schedule_id}",
                        "work_order_id": "SCHEDULED",
                        "service_code": "SCRAPE",
                        "items_found": len(work_orders),
                        "existing_items": existing_count,
                        "duration_seconds": history.duration_seconds,
                        "success_rate": 100,
                        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                    }
                )
            except Exception as notif_error:
                logger.warning(f"Failed to send notification: {notif_error}")
            
        except Exception as e:
            logger.error(f"Error in scheduled scraping for user {user_id}: {str(e)}")
            
            # Update history with error
            history = db.query(ScrapingHistory).filter_by(id=history_id).first()
            if history:
                history.completed_at = datetime.now(timezone.utc)
                history.success = False
                history.error_message = str(e)
                history.duration_seconds = (history.completed_at - start_time).total_seconds()
            
            # Increment consecutive failures
            schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
            if schedule:
                schedule.consecutive_failures += 1
                schedule.last_run = datetime.now(timezone.utc)
            
            db.commit()
            
        finally:
            # Clean up WorkFossa automation session
            try:
                if 'workfossa_automation' in locals():
                    await workfossa_automation.close_session(session_id)
                    logger.info(f"🧹 [SCHEDULER] Closed WorkFossa session: {session_id}")
            except Exception as e:
                logger.warning(f"Error closing WorkFossa session: {e}")
            
            # Clean up browser session
            try:
                await browser_automation.close_session(session_id)
            except Exception as e:
                logger.warning(f"Error closing browser session: {e}")
            
            db.close()
            self.active_jobs.remove(job_key)
    
    def should_run_schedule(self, schedule: ScrapingSchedule) -> bool:
        """Check if a schedule should run now"""
        if not schedule.enabled:
            logger.debug(f"Schedule {schedule.id} is disabled, skipping")
            return False
            
        # Skip if too many consecutive failures
        if schedule.consecutive_failures >= 5:
            logger.warning(f"Schedule {schedule.id} has too many failures ({schedule.consecutive_failures}), skipping")
            return False
            
        now = datetime.now(timezone.utc)
        
        # PRIORITY 1: Check if manual run is triggered (next_run is set and in the past)
        if schedule.next_run:
            # Handle timezone-aware datetime comparison
            next_run_utc = schedule.next_run
            if next_run_utc.tzinfo is not None:
                # Convert to naive UTC if timezone-aware
                next_run_utc = next_run_utc.replace(tzinfo=None)
            
            # Make sure now is also naive for comparison
            now_naive = now.replace(tzinfo=None) if now.tzinfo else now
            
            if next_run_utc <= now_naive:
                logger.info(f"Schedule {schedule.id} triggered manually (next_run: {next_run_utc}, now: {now})")
                return True
        
        # Check active hours (for automatic runs)
        if schedule.active_hours:
            current_hour = now.hour
            start_hour = schedule.active_hours.get('start', 0)
            end_hour = schedule.active_hours.get('end', 24)
            
            if not (start_hour <= current_hour < end_hour):
                logger.debug(f"Schedule {schedule.id} outside active hours ({current_hour} not in {start_hour}-{end_hour})")
                return False
        
        # Check interval-based automatic scheduling
        if not schedule.last_run:
            logger.info(f"Schedule {schedule.id} has never run before, running now")
            return True  # Never run before
            
        # Make sure last_run is timezone-aware for comparison
        last_run = schedule.last_run
        if last_run.tzinfo is None:
            # Assume naive datetime is UTC
            last_run = last_run.replace(tzinfo=timezone.utc)
            
        hours_since_last_run = (now - last_run).total_seconds() / 3600
        should_run = hours_since_last_run >= schedule.interval_hours
        
        if should_run:
            logger.info(f"Schedule {schedule.id} interval reached ({hours_since_last_run:.1f} >= {schedule.interval_hours} hours)")
        else:
            logger.debug(f"Schedule {schedule.id} not ready ({hours_since_last_run:.1f} < {schedule.interval_hours} hours)")
            
        return should_run
    
    async def check_and_run_schedules(self):
        """Check database for schedules that need to run"""
        db = SessionLocal()
        try:
            # Get all enabled schedules
            schedules = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.enabled == True
            ).all()
            
            logger.debug(f"Checking {len(schedules)} enabled schedules")
            
            for schedule in schedules:
                if self.should_run_schedule(schedule):
                    logger.info(f"Running schedule {schedule.id} for user {schedule.user_id} (type: {schedule.schedule_type})")
                    
                    # Determine if this was a manual run
                    now = datetime.now(timezone.utc)
                    was_manual_run = False
                    
                    if schedule.next_run:
                        # Handle timezone-aware datetime
                        next_run_utc = schedule.next_run
                        if next_run_utc.tzinfo is not None:
                            next_run_utc = next_run_utc.replace(tzinfo=None)
                        
                        # Make sure now is also naive for comparison
                        now_naive = now.replace(tzinfo=None) if now.tzinfo else now
                        
                        if next_run_utc <= now_naive:
                            was_manual_run = True
                            logger.info(f"This is a manual run for schedule {schedule.id}")
                    
                    # Update next_run based on whether this was manual or automatic
                    if was_manual_run:
                        # For manual runs, calculate next automatic run based on interval
                        if schedule.last_run:
                            # Calculate next run from last run + interval
                            schedule.next_run = schedule.last_run + timedelta(hours=schedule.interval_hours)
                        else:
                            # First run, set next run based on current time + interval
                            schedule.next_run = now + timedelta(hours=schedule.interval_hours)
                    else:
                        # For automatic runs, set next run based on current time + interval
                        schedule.next_run = now + timedelta(hours=schedule.interval_hours)
                    
                    logger.info(f"Next automatic run for schedule {schedule.id} set to: {schedule.next_run}")
                    db.commit()
                    
                    # Execute based on schedule type
                    if schedule.schedule_type == "work_orders":
                        asyncio.create_task(
                            self.execute_work_order_scraping(schedule.user_id, schedule.id)
                        )
                    else:
                        logger.warning(f"Unknown schedule type: {schedule.schedule_type}")
                else:
                    # Log why schedule didn't run (for debugging)
                    if schedule.next_run:
                        logger.debug(f"Schedule {schedule.id} not ready - next_run: {schedule.next_run}, interval: {schedule.interval_hours}h")
                        
        except Exception as e:
            logger.error(f"Error checking schedules: {str(e)}", exc_info=True)
        finally:
            db.close()
    
    async def run(self):
        """Main daemon loop"""
        self.running = True
        logger.info("Scheduler daemon started")
        
        while self.running:
            try:
                await self.check_and_run_schedules()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in scheduler loop: {str(e)}")
                await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """Stop the daemon"""
        logger.info("Stopping scheduler daemon...")
        self.running = False


# Global daemon instance
daemon = SchedulerDaemon()


def signal_handler(sig, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {sig}, shutting down...")
    daemon.stop()
    sys.exit(0)


async def main():
    """Main entry point"""
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Log startup information
    logger.info("=" * 60)
    logger.info("FossaWork V2 Scheduler Daemon - ENHANCED VERSION")
    logger.info(f"Process ID: {os.getpid()}")
    logger.info(f"Database: {DATABASE_URL}")
    logger.info(f"Check interval: {daemon.check_interval} seconds")
    logger.info(f"Current UTC time: {datetime.now(timezone.utc)}")
    logger.info("Features:")
    logger.info("  - Manual 'Run Now' support via next_run field")
    logger.info("  - Automatic interval-based scheduling")
    logger.info("  - Enhanced logging for debugging")
    logger.info("  - Timezone-aware datetime handling")
    logger.info("=" * 60)
    
    # Check current schedules at startup
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).all()
        logger.info(f"Found {len(schedules)} total schedules in database")
        for schedule in schedules:
            status = "ENABLED" if schedule.enabled else "DISABLED"
            logger.info(f"  Schedule {schedule.id}: {status}, interval={schedule.interval_hours}h, "
                       f"last_run={schedule.last_run}, next_run={schedule.next_run}")
    except Exception as e:
        logger.error(f"Error checking schedules at startup: {e}")
    finally:
        db.close()
    
    # Run the daemon
    await daemon.run()


if __name__ == "__main__":
    asyncio.run(main())