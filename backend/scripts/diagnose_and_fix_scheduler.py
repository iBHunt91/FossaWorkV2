#!/usr/bin/env python3
"""
Comprehensive scheduler diagnostic and fix script
Identifies and resolves issues with stuck scheduled jobs
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.logging_service import get_logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor

logger = get_logger("scheduler.diagnostic")

async def diagnose_scheduler():
    """Comprehensive scheduler diagnostic"""
    print("\n" + "="*80)
    print("🔍 SCHEDULER DIAGNOSTIC REPORT")
    print("="*80)
    print(f"Time: {datetime.now()}")
    print(f"UTC Time: {datetime.now(timezone.utc)}")
    print("="*80)
    
    # 1. Check database schedules
    print("\n📊 DATABASE SCHEDULES:")
    print("-"*40)
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).all()
        print(f"Found {len(schedules)} schedules in database")
        
        for schedule in schedules:
            print(f"\n  User: {schedule.user_id}")
            print(f"  Type: {schedule.schedule_type}")
            print(f"  Enabled: {schedule.enabled}")
            print(f"  Interval: {schedule.interval_hours} hours")
            print(f"  Active Hours: {schedule.active_hours}")
            print(f"  Next Run: {schedule.next_run}")
            print(f"  Last Run: {schedule.last_run}")
            print(f"  Created: {schedule.created_at}")
            print(f"  Updated: {schedule.updated_at}")
            
            # Check if next_run is in the past
            if schedule.next_run:
                next_run_utc = schedule.next_run.replace(tzinfo=timezone.utc) if schedule.next_run.tzinfo is None else schedule.next_run
                time_diff = next_run_utc - datetime.now(timezone.utc)
                if time_diff.total_seconds() < 0:
                    print(f"  ⚠️  OVERDUE by {abs(time_diff.total_seconds() / 60):.1f} minutes!")
                else:
                    print(f"  ✅ Due in {time_diff.total_seconds() / 60:.1f} minutes")
    finally:
        db.close()
    
    # 2. Check scheduler service
    print("\n⚙️  SCHEDULER SERVICE CHECK:")
    print("-"*40)
    
    try:
        from app.services.scheduler_service import scheduler_service
        print(f"Scheduler imported successfully")
        print(f"Is initialized: {scheduler_service.is_initialized}")
        
        if scheduler_service.scheduler:
            print(f"Scheduler running: {scheduler_service.scheduler.running}")
            print(f"Scheduler state: {scheduler_service.scheduler.state}")
            
            # Get all jobs
            jobs = scheduler_service.scheduler.get_jobs()
            print(f"\nRegistered jobs: {len(jobs)}")
            
            for job in jobs:
                print(f"\n  Job ID: {job.id}")
                print(f"  Name: {job.name}")
                print(f"  Next run: {job.next_run_time}")
                print(f"  Trigger: {job.trigger}")
                print(f"  Pending: {job.pending}")
                
                # Check if job is paused
                if hasattr(job, 'paused') and job.paused:
                    print(f"  ⚠️  JOB IS PAUSED!")
                
                # Check misfire grace time
                if job.next_run_time:
                    next_run_utc = job.next_run_time
                    time_diff = next_run_utc - datetime.now(timezone.utc)
                    if time_diff.total_seconds() < -300:  # More than 5 minutes overdue
                        print(f"  ⚠️  SEVERELY OVERDUE - may have exceeded misfire grace time!")
        else:
            print("❌ Scheduler instance is None!")
            
    except Exception as e:
        print(f"❌ Error checking scheduler service: {e}")
        import traceback
        traceback.print_exc()
    
    # 3. Check APScheduler directly
    print("\n🔧 DIRECT APSCHEDULER CHECK:")
    print("-"*40)
    
    try:
        # Create a new scheduler instance to check the job store
        db_url = "sqlite:///fossawork_v2.db"
        
        jobstores = {
            'default': SQLAlchemyJobStore(url=db_url)
        }
        
        test_scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            timezone='UTC'
        )
        
        # Don't start it, just check jobs
        jobs = test_scheduler.get_jobs()
        print(f"Jobs in jobstore: {len(jobs)}")
        
        for job in jobs:
            print(f"\n  Stored Job ID: {job.id}")
            print(f"  Next run: {job.next_run_time}")
            
    except Exception as e:
        print(f"❌ Error checking jobstore: {e}")
    
    # 4. Check recent history
    print("\n📜 RECENT SCRAPING HISTORY:")
    print("-"*40)
    
    db = SessionLocal()
    try:
        recent = db.query(ScrapingHistory).order_by(
            ScrapingHistory.started_at.desc()
        ).limit(5).all()
        
        if recent:
            for history in recent:
                print(f"\n  Started: {history.started_at}")
                print(f"  Completed: {history.completed_at}")
                print(f"  Success: {history.success}")
                print(f"  Items: {history.items_processed}")
                if history.error_message:
                    print(f"  Error: {history.error_message}")
        else:
            print("No scraping history found")
            
    finally:
        db.close()
    
    # 5. Proposed fixes
    print("\n💡 DIAGNOSTIC SUMMARY & FIXES:")
    print("-"*40)
    
    issues = []
    
    # Check for common issues
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        for schedule in schedules:
            if schedule.next_run:
                # Handle both aware and naive datetimes
                if schedule.next_run.tzinfo is None:
                    next_run_utc = schedule.next_run.replace(tzinfo=timezone.utc)
                else:
                    next_run_utc = schedule.next_run
                
                if next_run_utc < datetime.now(timezone.utc):
                    issues.append(f"Schedule for user {schedule.user_id} is overdue")
                
    finally:
        db.close()
    
    if not scheduler_service.is_initialized:
        issues.append("Scheduler service not initialized")
    elif not scheduler_service.scheduler.running:
        issues.append("Scheduler not running")
    
    if issues:
        print("⚠️  Issues found:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("✅ No obvious issues found")
    
    return issues

async def fix_scheduler():
    """Attempt to fix common scheduler issues"""
    print("\n🔧 ATTEMPTING FIXES...")
    print("-"*40)
    
    # 1. Force job execution for overdue schedules
    db = SessionLocal()
    try:
        # Get enabled schedules
        enabled_schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        # Filter overdue schedules manually to handle timezone issues
        overdue_schedules = []
        for schedule in enabled_schedules:
            if schedule.next_run:
                # Handle both aware and naive datetimes
                if schedule.next_run.tzinfo is None:
                    next_run_utc = schedule.next_run.replace(tzinfo=timezone.utc)
                else:
                    next_run_utc = schedule.next_run
                
                if next_run_utc < datetime.now(timezone.utc):
                    overdue_schedules.append(schedule)
        
        if overdue_schedules:
            print(f"\nFound {len(overdue_schedules)} overdue schedules")
            
            for schedule in overdue_schedules:
                print(f"\n🚀 Triggering immediate execution for user {schedule.user_id}")
                
                # Import and run the job directly
                from app.services.scheduler_service import execute_work_order_scraping
                
                # Run it as a task
                asyncio.create_task(execute_work_order_scraping(schedule.user_id))
                
                # Update next run time
                if schedule.interval_hours:
                    schedule.next_run = datetime.now(timezone.utc) + timedelta(hours=schedule.interval_hours)
                    print(f"  Updated next run to: {schedule.next_run}")
                
            db.commit()
            print("\n✅ Triggered overdue jobs and updated schedules")
            
    except Exception as e:
        print(f"❌ Error fixing schedules: {e}")
        db.rollback()
    finally:
        db.close()
    
    # 2. Restart scheduler if needed
    try:
        from app.services.scheduler_service import scheduler_service
        
        if not scheduler_service.is_initialized or not scheduler_service.scheduler.running:
            print("\n🔄 Restarting scheduler service...")
            
            # Initialize if needed
            if not scheduler_service.is_initialized:
                db_url = "sqlite:///fossawork_v2.db"
                await scheduler_service.initialize(db_url)
                print("✅ Scheduler initialized")
            
            # Ensure it's running
            if not scheduler_service.scheduler.running:
                scheduler_service.scheduler.start()
                print("✅ Scheduler started")
                
    except Exception as e:
        print(f"❌ Error restarting scheduler: {e}")
    
    # 3. Re-register jobs
    print("\n📝 Re-registering jobs...")
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        for schedule in schedules:
            job_id = f"work_order_scrape_{schedule.user_id}"
            
            # Remove existing job if any
            try:
                scheduler_service.scheduler.remove_job(job_id)
                print(f"  Removed existing job {job_id}")
            except:
                pass
            
            # Add job again
            try:
                await scheduler_service.add_work_order_scraping_schedule(
                    user_id=schedule.user_id,
                    interval_hours=schedule.interval_hours,
                    active_hours=schedule.active_hours,
                    enabled=True,
                    is_restore=True
                )
                print(f"  ✅ Re-registered job for user {schedule.user_id}")
            except Exception as e:
                print(f"  ❌ Failed to register job for user {schedule.user_id}: {e}")
                
    finally:
        db.close()
    
    print("\n✅ Fix attempts completed")

async def main():
    """Run diagnostic and optionally fix issues"""
    issues = await diagnose_scheduler()
    
    if issues:
        print("\n" + "="*80)
        response = input("\n🔧 Issues found. Would you like to attempt automatic fixes? (y/n): ")
        
        if response.lower() == 'y':
            await fix_scheduler()
            
            # Run diagnostic again
            print("\n" + "="*80)
            print("🔍 POST-FIX DIAGNOSTIC:")
            print("="*80)
            await diagnose_scheduler()
    
    print("\n✅ Diagnostic complete")

if __name__ == "__main__":
    asyncio.run(main())