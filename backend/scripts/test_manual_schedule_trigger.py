#!/usr/bin/env python3
"""
Test script to verify manual schedule triggers work correctly
"""
import sys
import os
from datetime import datetime, timedelta
import asyncio

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.logging_service import get_logger

logger = get_logger("test.manual_trigger")


def test_manual_trigger():
    """Test setting next_run to trigger immediate execution"""
    db = SessionLocal()
    try:
        # Get all schedules
        schedules = db.query(ScrapingSchedule).all()
        
        if not schedules:
            logger.error("No schedules found in database")
            return
        
        logger.info(f"Found {len(schedules)} schedules")
        
        # Display current state
        for schedule in schedules:
            logger.info(f"\nSchedule {schedule.id}:")
            logger.info(f"  User: {schedule.user_id}")
            logger.info(f"  Enabled: {schedule.enabled}")
            logger.info(f"  Interval: {schedule.interval_hours} hours")
            logger.info(f"  Last run: {schedule.last_run}")
            logger.info(f"  Next run: {schedule.next_run}")
            logger.info(f"  Failures: {schedule.consecutive_failures}")
        
        # Ask user which schedule to trigger
        schedule_id = input("\nEnter schedule ID to trigger manually (or 'q' to quit): ")
        if schedule_id.lower() == 'q':
            return
        
        try:
            schedule_id = int(schedule_id)
        except ValueError:
            logger.error("Invalid schedule ID")
            return
        
        # Find the schedule
        schedule = db.query(ScrapingSchedule).filter_by(id=schedule_id).first()
        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            return
        
        # Set next_run to current time to trigger immediate execution
        old_next_run = schedule.next_run
        schedule.next_run = datetime.utcnow()
        db.commit()
        
        logger.info(f"\n✅ Manual trigger set for schedule {schedule_id}")
        logger.info(f"  Old next_run: {old_next_run}")
        logger.info(f"  New next_run: {schedule.next_run}")
        logger.info(f"\nThe scheduler daemon should pick this up within 60 seconds")
        logger.info("Watch the scheduler logs to see it execute!")
        
        # Option to reset
        reset = input("\nReset next_run to automatic schedule? (y/n): ")
        if reset.lower() == 'y':
            if schedule.last_run:
                schedule.next_run = schedule.last_run + timedelta(hours=schedule.interval_hours)
            else:
                schedule.next_run = datetime.utcnow() + timedelta(hours=schedule.interval_hours)
            db.commit()
            logger.info(f"Reset next_run to: {schedule.next_run}")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        db.rollback()
    finally:
        db.close()


def test_schedule_logic():
    """Test the schedule logic without actually running the daemon"""
    from scheduler_daemon import SchedulerDaemon
    
    db = SessionLocal()
    daemon = SchedulerDaemon()
    
    try:
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        logger.info(f"\nTesting should_run_schedule logic for {len(schedules)} enabled schedules:")
        
        for schedule in schedules:
            should_run = daemon.should_run_schedule(schedule)
            logger.info(f"\nSchedule {schedule.id}: {should_run}")
            if schedule.next_run:
                logger.info(f"  next_run: {schedule.next_run}")
                logger.info(f"  current UTC: {datetime.utcnow()}")
                if schedule.next_run <= datetime.utcnow():
                    logger.info(f"  -> Manual trigger detected!")
            
    finally:
        db.close()


if __name__ == "__main__":
    print("Manual Schedule Trigger Test")
    print("=" * 40)
    
    while True:
        print("\n1. Trigger manual schedule run")
        print("2. Test schedule logic")
        print("q. Quit")
        
        choice = input("\nChoice: ")
        
        if choice == '1':
            test_manual_trigger()
        elif choice == '2':
            test_schedule_logic()
        elif choice.lower() == 'q':
            break
        else:
            print("Invalid choice")