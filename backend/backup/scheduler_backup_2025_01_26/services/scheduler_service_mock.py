#!/usr/bin/env python3
"""
Mock Scheduler Service for when APScheduler is not available
Provides the same interface but stores schedules in database only
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json
import uuid

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..services.logging_service import get_logger
from ..models.scraping_models import ScrapingSchedule, ScrapingHistory

logger = get_logger("fossawork.scheduler.mock")

class MockSchedulerService:
    """Mock scheduler service that stores schedules without actual scheduling"""
    
    def __init__(self):
        self.is_initialized = False
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        logger.info("Using mock scheduler service (APScheduler not available)")
    
    async def initialize(self, database_url: str):
        """Initialize the mock scheduler"""
        if self.is_initialized:
            logger.warning("Mock scheduler already initialized")
            return
        
        try:
            # Load active schedules from database
            await self._restore_schedules()
            self.is_initialized = True
            logger.info("Mock scheduler service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize mock scheduler: {e}")
            raise
    
    async def shutdown(self):
        """Shutdown the mock scheduler"""
        if self.is_initialized:
            self.is_initialized = False
            self.active_jobs.clear()
            logger.info("Mock scheduler service shut down")
    
    async def add_work_order_scraping_schedule(
        self,
        user_id: str,
        interval_hours: float = 1.0,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: bool = True
    ) -> str:
        """Add a scheduled work order scraping job (mock)"""
        
        if not self.is_initialized:
            raise RuntimeError("Mock scheduler service not initialized")
        
        job_id = f"work_order_scrape_{user_id}"
        
        # Don't set default active hours - respect None
        # if active_hours is None:
        #     active_hours = {"start": 6, "end": 22}
        
        # Calculate next run time
        now = datetime.utcnow()
        if active_hours:
            current_hour = now.hour
            if active_hours['start'] <= current_hour < active_hours['end']:
                # Within active hours, next run in interval_hours
                next_run = now + timedelta(hours=interval_hours)
            else:
                # Outside active hours, next run at start of active hours
                next_day = now + timedelta(days=1)
                next_run = next_day.replace(
                    hour=active_hours['start'], 
                    minute=0, 
                    second=0, 
                    microsecond=0
                )
        else:
            next_run = now + timedelta(hours=interval_hours)
        
        # Store schedule in database
        db = SessionLocal()
        try:
            # Check if schedule already exists
            existing = db.query(ScrapingSchedule).filter(
                ScrapingSchedule.user_id == user_id,
                ScrapingSchedule.schedule_type == "work_orders"
            ).first()
            
            if existing:
                # Update existing schedule
                existing.interval_hours = interval_hours
                existing.active_hours = active_hours
                existing.enabled = enabled
                existing.next_run = next_run
                existing.updated_at = datetime.utcnow()
            else:
                # Create new schedule
                schedule = ScrapingSchedule(
                    user_id=user_id,
                    schedule_type="work_orders",
                    interval_hours=interval_hours,
                    active_hours=active_hours,
                    enabled=enabled,
                    next_run=next_run
                )
                db.add(schedule)
            
            db.commit()
        finally:
            db.close()
        
        # Track in memory
        self.active_jobs[job_id] = {
            "user_id": user_id,
            "type": "work_orders",
            "enabled": enabled,
            "created_at": datetime.utcnow(),
            "interval_hours": interval_hours,
            "active_hours": active_hours,
            "next_run": next_run
        }
        
        logger.info(f"Added mock work order scraping schedule for user {user_id}")
        return job_id
    
    async def update_schedule(
        self,
        job_id: str,
        interval_hours: Optional[float] = None,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: Optional[bool] = None
    ) -> bool:
        """Update an existing schedule (mock)"""
        
        if not self.is_initialized:
            logger.error("Mock scheduler service not initialized")
            return False
        
        if job_id not in self.active_jobs:
            logger.error(f"Job {job_id} not found")
            return False
        
        try:
            # Update in memory
            job_info = self.active_jobs[job_id]
            if interval_hours is not None:
                job_info["interval_hours"] = interval_hours
            if active_hours is not None:
                job_info["active_hours"] = active_hours
            if enabled is not None:
                job_info["enabled"] = enabled
            
            # Recalculate next run time
            now = datetime.utcnow()
            hours = job_info.get("interval_hours", 1.0)
            active = job_info.get("active_hours")
            
            if active:
                current_hour = now.hour
                if active['start'] <= current_hour < active['end']:
                    next_run = now + timedelta(hours=hours)
                else:
                    next_day = now + timedelta(days=1)
                    next_run = next_day.replace(
                        hour=active['start'], 
                        minute=0, 
                        second=0, 
                        microsecond=0
                    )
            else:
                next_run = now + timedelta(hours=hours)
            
            job_info["next_run"] = next_run
            
            # Update database
            user_id = job_info["user_id"]
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
                    schedule.next_run = next_run
                    schedule.updated_at = datetime.utcnow()
                    db.commit()
            finally:
                db.close()
            
            logger.info(f"Updated mock schedule {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update mock schedule: {e}")
            return False
    
    async def remove_schedule(self, job_id: str) -> bool:
        """Remove a scheduled job (mock)"""
        
        if not self.is_initialized:
            logger.error("Mock scheduler service not initialized")
            return False
        
        if job_id not in self.active_jobs:
            return False
        
        try:
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
            
            # Remove from memory
            del self.active_jobs[job_id]
            logger.info(f"Removed mock schedule {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove mock schedule: {e}")
            return False
    
    async def get_schedule_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a scheduled job (mock)"""
        
        if not self.is_initialized:
            return None
        
        if job_id not in self.active_jobs:
            return None
        
        job_info = self.active_jobs[job_id]
        
        return {
            "job_id": job_id,
            "user_id": job_info["user_id"],
            "type": job_info["type"],
            "enabled": job_info["enabled"],
            "next_run": job_info["next_run"].isoformat() if job_info.get("next_run") else None,
            "pending": False  # Mock scheduler doesn't track pending state
        }
    
    async def get_all_schedules(self) -> List[Dict[str, Any]]:
        """Get all active schedules (mock)"""
        
        if not self.is_initialized:
            return []
        
        schedules = []
        for job_id in self.active_jobs:
            status = await self.get_schedule_status(job_id)
            if status:
                schedules.append(status)
        
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
            history_items = db.query(ScrapingHistory).filter(
                ScrapingHistory.user_id == user_id
            ).order_by(
                ScrapingHistory.started_at.desc()
            ).limit(limit).offset(offset).all()
            
            return [
                {
                    "id": item.id,
                    "started_at": item.started_at.isoformat(),
                    "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                    "success": item.success,
                    "items_processed": item.items_processed,
                    "error_message": item.error_message,
                    "duration_seconds": (
                        (item.completed_at - item.started_at).total_seconds() 
                        if item.completed_at else None
                    )
                }
                for item in history_items
            ]
        finally:
            db.close()
    
    async def _execute_work_order_scraping(self, user_id: str):
        """Mock execution - just logs that it would run"""
        logger.info(f"Mock scheduler would execute work order scraping for user {user_id}")
    
    async def _restore_schedules(self):
        """Restore schedules from database on startup"""
        
        try:
            db = SessionLocal()
            try:
                schedules = db.query(ScrapingSchedule).filter(
                    ScrapingSchedule.enabled == True
                ).all()
                
                for schedule in schedules:
                    job_id = f"work_order_scrape_{schedule.user_id}"
                    self.active_jobs[job_id] = {
                        "user_id": schedule.user_id,
                        "type": schedule.schedule_type,
                        "enabled": schedule.enabled,
                        "created_at": schedule.created_at,
                        "interval_hours": schedule.interval_hours,
                        "active_hours": schedule.active_hours,
                        "next_run": schedule.next_run
                    }
                
                logger.info(f"Restored {len(self.active_jobs)} schedules from database")
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Failed to restore schedules: {e}")

# Global mock scheduler instance
mock_scheduler_service = MockSchedulerService()