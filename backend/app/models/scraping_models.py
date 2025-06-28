#!/usr/bin/env python3
"""
Database models for scraping schedules and history
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, Text
from sqlalchemy.orm import relationship

from ..database import Base

class ScrapingSchedule(Base):
    """Stores configuration for scheduled scraping tasks"""
    
    __tablename__ = "scraping_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    schedule_type = Column(String, nullable=False)  # "work_orders", "dispensers", etc.
    
    # Schedule configuration
    interval_hours = Column(Float, default=1.0)
    active_hours = Column(JSON, nullable=True)  # {"start": 6, "end": 22}
    enabled = Column(Boolean, default=True)
    
    # Schedule metadata
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    
    # Configuration
    config = Column(JSON, nullable=True)  # Additional configuration options
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "schedule_type": self.schedule_type,
            "interval_hours": self.interval_hours,
            "active_hours": self.active_hours,
            "enabled": self.enabled,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "consecutive_failures": self.consecutive_failures,
            "config": self.config,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class ScrapingHistory(Base):
    """Stores history of scraping runs"""
    
    __tablename__ = "scraping_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    schedule_type = Column(String, nullable=False)
    
    # Execution details
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    success = Column(Boolean, default=False)
    
    # Results
    items_processed = Column(Integer, default=0)
    items_added = Column(Integer, default=0)
    items_updated = Column(Integer, default=0)
    items_failed = Column(Integer, default=0)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)
    
    # Performance metrics
    duration_seconds = Column(Float, nullable=True)
    memory_usage_mb = Column(Float, nullable=True)
    
    # Additional data
    run_metadata = Column(JSON, nullable=True)
    
    # Track whether this was a manual or scheduled run
    trigger_type = Column(String, nullable=True, default="scheduled")  # "manual" or "scheduled"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        # Helper to ensure UTC timezone suffix
        def format_datetime_utc(dt):
            if dt:
                iso_str = dt.isoformat()
                # Add 'Z' suffix if not already present to indicate UTC
                if not iso_str.endswith('Z') and '+' not in iso_str:
                    iso_str += 'Z'
                return iso_str
            return None
            
        return {
            "id": self.id,
            "user_id": self.user_id,
            "schedule_type": self.schedule_type,
            "started_at": format_datetime_utc(self.started_at),
            "completed_at": format_datetime_utc(self.completed_at),
            "success": self.success,
            "items_processed": self.items_processed,
            "items_added": self.items_added,
            "items_updated": self.items_updated,
            "items_failed": self.items_failed,
            "error_message": self.error_message,
            "error_details": self.error_details,
            "has_error_log": bool(self.error_details and 'error_log_path' in self.error_details),
            "duration_seconds": self.duration_seconds,
            "memory_usage_mb": self.memory_usage_mb,
            "metadata": self.run_metadata,
            "trigger_type": self.trigger_type
        }


class ScrapingStatistics(Base):
    """Aggregated statistics for scraping operations"""
    
    __tablename__ = "scraping_statistics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    schedule_type = Column(String, nullable=False)
    
    # Counters
    total_runs = Column(Integer, default=0)
    successful_runs = Column(Integer, default=0)
    failed_runs = Column(Integer, default=0)
    
    # Totals
    total_items_processed = Column(Integer, default=0)
    total_items_added = Column(Integer, default=0)
    total_items_updated = Column(Integer, default=0)
    
    # Performance averages
    avg_duration_seconds = Column(Float, default=0.0)
    avg_items_per_run = Column(Float, default=0.0)
    
    # Time tracking
    first_run = Column(DateTime, nullable=True)
    last_successful_run = Column(DateTime, nullable=True)
    last_failed_run = Column(DateTime, nullable=True)
    
    # Updated timestamp
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        # Helper to ensure UTC timezone suffix
        def format_datetime_utc(dt):
            if dt:
                iso_str = dt.isoformat()
                # Add 'Z' suffix if not already present to indicate UTC
                if not iso_str.endswith('Z') and '+' not in iso_str:
                    iso_str += 'Z'
                return iso_str
            return None
            
        return {
            "id": self.id,
            "user_id": self.user_id,
            "schedule_type": self.schedule_type,
            "total_runs": self.total_runs,
            "successful_runs": self.successful_runs,
            "failed_runs": self.failed_runs,
            "total_items_processed": self.total_items_processed,
            "total_items_added": self.total_items_added,
            "total_items_updated": self.total_items_updated,
            "avg_duration_seconds": self.avg_duration_seconds,
            "avg_items_per_run": self.avg_items_per_run,
            "first_run": format_datetime_utc(self.first_run),
            "last_successful_run": format_datetime_utc(self.last_successful_run),
            "last_failed_run": format_datetime_utc(self.last_failed_run),
            "updated_at": format_datetime_utc(self.updated_at)
        }