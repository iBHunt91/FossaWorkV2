#!/usr/bin/env python3
"""
Simple Scheduler Service (No APScheduler)

This service provides a simple interface for managing schedules
without APScheduler. It only handles database operations and
relies on the standalone scheduler_daemon.py for execution.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.scraping_models import ScrapingSchedule, ScrapingHistory
from ..services.logging_service import get_logger

logger = get_logger("scheduler.simple")


class SimpleSchedulerService:
    """Simple scheduler service for managing schedule configurations"""
    
    def __init__(self):
        self.logger = logger
    
    def create_schedule(
        self,
        db: Session,
        user_id: str,
        schedule_type: str,
        interval_hours: float,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: bool = True
    ) -> ScrapingSchedule:
        """Create a new schedule in the database"""
        # Check if schedule already exists
        existing = db.query(ScrapingSchedule).filter(
            and_(
                ScrapingSchedule.user_id == user_id,
                ScrapingSchedule.schedule_type == schedule_type
            )
        ).first()
        
        if existing:
            raise ValueError(f"Schedule for {schedule_type} already exists")
        
        # Create new schedule
        schedule = ScrapingSchedule(
            user_id=user_id,
            schedule_type=schedule_type,
            interval_hours=interval_hours,
            active_hours=active_hours,
            enabled=enabled,
            next_run=datetime.utcnow() if enabled else None
        )
        
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        
        self.logger.info(f"Created schedule {schedule.id} for user {user_id}")
        return schedule
    
    def update_schedule(
        self,
        db: Session,
        schedule_id: int,
        interval_hours: Optional[float] = None,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: Optional[bool] = None
    ) -> ScrapingSchedule:
        """Update an existing schedule"""
        logger.info(f"=== UPDATE SCHEDULE {schedule_id} ===")
        logger.info(f"Parameters: interval_hours={interval_hours}, active_hours={active_hours}, enabled={enabled}")
        
        schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
        
        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            raise ValueError(f"Schedule {schedule_id} not found")
        
        logger.info(f"Current schedule state: enabled={schedule.enabled}, interval={schedule.interval_hours}h, last_run={schedule.last_run}, next_run={schedule.next_run}")
        
        # Update fields if provided
        if interval_hours is not None:
            old_interval = schedule.interval_hours
            schedule.interval_hours = interval_hours
            logger.info(f"Interval changed: {old_interval}h -> {interval_hours}h")
            # When interval changes, calculate next run from current time
            # This ensures the schedule runs soon after the change
            if schedule.enabled:  # Only update next_run if schedule is enabled
                current_time = datetime.utcnow()
                schedule.next_run = current_time + timedelta(hours=interval_hours)
                logger.info(f"Next run recalculated due to interval change: {schedule.next_run} (current time: {current_time})")
        
        if active_hours is not None:
            old_hours = schedule.active_hours
            schedule.active_hours = active_hours
            logger.info(f"Active hours changed: {old_hours} -> {active_hours}")
        
        if enabled is not None:
            old_enabled = schedule.enabled
            schedule.enabled = enabled
            logger.info(f"Enabled state changed: {old_enabled} -> {enabled}")
        
        # Always recalculate next run for enabled schedules when any field changes
        # This ensures the schedule reflects the latest settings
        if schedule.enabled:
            current_time = datetime.utcnow()
            old_next_run = schedule.next_run
            schedule.next_run = current_time + timedelta(hours=schedule.interval_hours)
            logger.info(f"=== NEXT RUN RECALCULATED ===")
            logger.info(f"Current UTC time: {current_time}")
            logger.info(f"Interval: {schedule.interval_hours} hours")
            logger.info(f"Old next run: {old_next_run}")
            logger.info(f"New next run: {schedule.next_run}")
            logger.info(f"Time difference: {(schedule.next_run - current_time).total_seconds() / 3600:.2f} hours")
        
        schedule.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(schedule)
        
        logger.info(f"=== SCHEDULE UPDATE COMPLETE ===")
        logger.info(f"Final state: enabled={schedule.enabled}, interval={schedule.interval_hours}h, next_run={schedule.next_run}")
        logger.info(f"Schedule {schedule_id} successfully updated")
        return schedule
    
    def delete_schedule(self, db: Session, schedule_id: int) -> bool:
        """Delete a schedule"""
        schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
        
        if not schedule:
            return False
        
        db.delete(schedule)
        db.commit()
        
        self.logger.info(f"Deleted schedule {schedule_id}")
        return True
    
    def get_schedule(self, db: Session, schedule_id: int) -> Optional[ScrapingSchedule]:
        """Get a specific schedule"""
        return db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
    
    def get_user_schedules(self, db: Session, user_id: str) -> List[ScrapingSchedule]:
        """Get all schedules for a user"""
        return db.query(ScrapingSchedule).filter_by(user_id=user_id).all()
    
    def get_schedule_history(
        self,
        db: Session,
        user_id: str,
        schedule_type: str,
        limit: int = 10
    ) -> List[ScrapingHistory]:
        """Get execution history for a schedule type"""
        return db.query(ScrapingHistory).filter(
            and_(
                ScrapingHistory.user_id == user_id,
                ScrapingHistory.schedule_type == schedule_type
            )
        ).order_by(ScrapingHistory.started_at.desc()).limit(limit).all()
    
    def trigger_immediate_run(self, db: Session, schedule_id: int) -> ScrapingSchedule:
        """Trigger a schedule to run immediately by setting next_run to now"""
        schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
        
        if not schedule:
            raise ValueError(f"Schedule {schedule_id} not found")
        
        schedule.next_run = datetime.utcnow()
        db.commit()
        db.refresh(schedule)
        
        self.logger.info(f"Triggered immediate run for schedule {schedule_id}")
        return schedule
    
    def get_daemon_status(self, db: Session) -> Dict[str, Any]:
        """Get scheduler daemon status based on recent activity"""
        # Check for recent executions
        recent_execution = db.query(ScrapingHistory).filter(
            ScrapingHistory.started_at >= datetime.utcnow() - timedelta(minutes=5)
        ).first()
        
        # Get schedule counts
        total_schedules = db.query(ScrapingSchedule).count()
        active_schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).count()
        
        return {
            "daemon_status": "running" if recent_execution else "unknown",
            "last_execution": recent_execution.started_at if recent_execution else None,
            "total_schedules": total_schedules,
            "active_schedules": active_schedules
        }


# Global instance
scheduler_service = SimpleSchedulerService()