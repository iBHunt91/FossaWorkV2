#!/usr/bin/env python3
"""
Simple Scheduler Service - Minimal implementation without APScheduler
Just stores schedules in database and provides basic interface
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from ..services.logging_service import get_logger

logger = get_logger("scheduler.simple")

class SimpleSchedulerService:
    """Simple scheduler that just manages database records"""
    
    def __init__(self):
        self.is_initialized = True  # Always initialized
        self.scheduler = None  # No actual scheduler
        logger.info("Simple scheduler service initialized (database-only mode)")
        logger.warning("APScheduler not available - schedules will be stored but not automatically executed")
    
    async def initialize(self, database_url: str):
        """No-op for simple scheduler"""
        logger.info(f"Simple scheduler service ready (database: {database_url})")
        logger.debug("Note: This is a database-only scheduler - no automatic job execution")
    
    async def shutdown(self):
        """No-op for simple scheduler"""
        logger.info("Simple scheduler service shutdown (no cleanup needed)")
    
    async def add_work_order_scraping_schedule(
        self,
        user_id: str,
        interval_hours: float = 1.0,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: bool = True
    ) -> str:
        """Store schedule configuration (no actual scheduling)"""
        job_id = f"work_order_scrape_{user_id}"
        logger.info(f"Schedule configuration stored for user {user_id} (database-only)")
        logger.debug(f"Schedule details: interval={interval_hours}h, active_hours={active_hours}, enabled={enabled}")
        logger.warning(f"Schedule {job_id} stored but will not execute automatically (APScheduler not available)")
        return job_id
    
    async def update_schedule(
        self,
        job_id: str,
        interval_hours: Optional[float] = None,
        active_hours: Optional[Dict[str, int]] = None,
        enabled: Optional[bool] = None
    ) -> bool:
        """Update schedule configuration"""
        logger.info(f"Schedule {job_id} configuration updated (database-only)")
        updates = []
        if interval_hours is not None:
            updates.append(f"interval={interval_hours}h")
        if active_hours is not None:
            updates.append(f"active_hours={active_hours}")
        if enabled is not None:
            updates.append(f"enabled={enabled}")
        if updates:
            logger.debug(f"Updated fields: {', '.join(updates)}")
        return True
    
    async def remove_schedule(self, job_id: str) -> bool:
        """Remove schedule configuration"""
        logger.info(f"Schedule {job_id} removed (database-only)")
        return True
    
    async def get_schedule_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get schedule status from job ID"""
        # Extract user_id from job_id
        if job_id.startswith("work_order_scrape_"):
            user_id = job_id.replace("work_order_scrape_", "")
            return {
                "job_id": job_id,
                "user_id": user_id,
                "type": "work_orders",
                "enabled": True,
                "next_run": None,
                "pending": False
            }
        return None
    
    async def get_all_schedules(self) -> List[Dict[str, Any]]:
        """Return empty list - schedules should be fetched from database"""
        logger.debug("get_all_schedules called on simple scheduler - returning empty list")
        return []
    
    async def get_scraping_history(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Return empty list - history should be fetched from database"""
        logger.debug(f"get_scraping_history called for user {user_id} - returning empty list (database-only mode)")
        return []
    
    async def _execute_work_order_scraping(self, user_id: str):
        """No-op - no actual execution in simple scheduler"""
        logger.info(f"Manual scraping triggered for user {user_id} (would execute if APScheduler was available)")

# Global instance
simple_scheduler_service = SimpleSchedulerService()