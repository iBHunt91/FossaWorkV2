#!/usr/bin/env python3
"""Test full scheduler functionality"""

import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
import sys

# Set required env vars
os.environ['SECRET_KEY'] = 'test-secret-key'

sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal, get_db
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.scheduler_service import scheduler_service

async def test_scheduler():
    """Test the full scheduler service"""
    
    print("\n" + "="*80)
    print("TESTING FULL SCHEDULER SERVICE")
    print("="*80)
    
    # 1. Check scheduler type
    print("\n1. SCHEDULER TYPE CHECK:")
    print("-"*40)
    print(f"Service type: {type(scheduler_service).__name__}")
    print(f"Has scheduler attr: {hasattr(scheduler_service, 'scheduler')}")
    print(f"Scheduler value: {scheduler_service.scheduler}")
    print(f"Is initialized: {scheduler_service.is_initialized}")
    
    if not hasattr(scheduler_service, 'scheduler'):
        print("❌ This is the simple scheduler - cannot test automatic execution")
        return
    
    # 2. Initialize scheduler if needed
    if not scheduler_service.is_initialized:
        print("\n2. INITIALIZING SCHEDULER:")
        print("-"*40)
        try:
            database_url = os.getenv("DATABASE_URL", "sqlite:///./fossawork_v2.db")
            await scheduler_service.initialize(database_url)
            print("✅ Scheduler initialized successfully")
            print(f"   - Running: {scheduler_service.scheduler.running}")
            print(f"   - State: {scheduler_service.scheduler.state}")
        except Exception as e:
            print(f"❌ Failed to initialize: {e}")
            return
    
    # 3. Check current jobs
    print("\n3. CURRENT SCHEDULER JOBS:")
    print("-"*40)
    if scheduler_service.scheduler:
        jobs = scheduler_service.scheduler.get_jobs()
        print(f"Active jobs: {len(jobs)}")
        for job in jobs:
            print(f"\nJob: {job.id}")
            print(f"  Next run: {job.next_run_time}")
            print(f"  Trigger: {job.trigger}")
            
            # Check if job is overdue
            if job.next_run_time:
                time_diff = (datetime.now(timezone.utc) - job.next_run_time).total_seconds()
                if time_diff > 0:
                    print(f"  ⚠️  OVERDUE by {time_diff/60:.1f} minutes!")
    
    # 4. Check database schedules
    print("\n4. DATABASE SCHEDULES:")
    print("-"*40)
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).all()
        for schedule in schedules:
            print(f"\nUser: {schedule.user_id[:8]}...")
            print(f"  Enabled: {schedule.enabled}")
            print(f"  Next run (DB): {schedule.next_run}")
            
            # Find corresponding job
            job_id = f"work_order_scrape_{schedule.user_id}"
            job = scheduler_service.scheduler.get_job(job_id) if scheduler_service.scheduler else None
            if job:
                print(f"  Next run (Job): {job.next_run_time}")
                if job.next_run_time and schedule.next_run:
                    # Compare times
                    job_time = job.next_run_time.replace(tzinfo=None)
                    db_time = schedule.next_run.replace(tzinfo=None) if schedule.next_run.tzinfo else schedule.next_run
                    if abs((job_time - db_time).total_seconds()) > 60:
                        print(f"  ⚠️  MISMATCH: DB and Job times differ by {abs((job_time - db_time).total_seconds())/60:.1f} minutes")
            else:
                print(f"  ⚠️  No scheduler job found!")
    finally:
        db.close()
    
    # 5. Test job execution tracking
    print("\n5. JOB EXECUTION TRACKING:")
    print("-"*40)
    print("Event listeners registered:")
    if scheduler_service.scheduler:
        for listener in scheduler_service.scheduler._listeners:
            print(f"  - {listener}")
    
    print("\n" + "="*80)
    print("✅ Test complete")
    
    # Cleanup
    if scheduler_service.is_initialized:
        await scheduler_service.shutdown()

if __name__ == "__main__":
    asyncio.run(test_scheduler())