#!/usr/bin/env python3
"""
Check scheduler jobs and their configuration
"""

import sys
from pathlib import Path
from datetime import datetime
import asyncio

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.scheduler_service import scheduler_service
from app.core.config import settings
import os

async def check_scheduler_jobs():
    print("🔍 Checking Scheduler Jobs")
    print("=" * 80)
    
    # Initialize scheduler if needed
    if not scheduler_service.is_initialized:
        print("Initializing scheduler...")
        database_url = os.getenv("DATABASE_URL", "sqlite:///./fossawork_v2.db")
        await scheduler_service.initialize(database_url)
    
    print(f"Scheduler initialized: {scheduler_service.is_initialized}")
    print(f"Scheduler running: {scheduler_service.scheduler.running if scheduler_service.scheduler else 'N/A'}")
    print()
    
    if scheduler_service.scheduler:
        jobs = scheduler_service.scheduler.get_jobs()
        print(f"Total jobs: {len(jobs)}")
        print()
        
        for job in jobs:
            print(f"Job ID: {job.id}")
            print(f"  Name: {job.name}")
            print(f"  Next Run: {job.next_run_time}")
            print(f"  Trigger Type: {type(job.trigger).__name__}")
            print(f"  Trigger: {job.trigger}")
            
            # Get trigger details
            if hasattr(job.trigger, 'fields'):
                print(f"  Trigger Fields:")
                for field in job.trigger.fields:
                    print(f"    {field.name}: {field}")
            
            # Check if job is paused
            if hasattr(job, 'paused'):
                print(f"  Paused: {job.paused}")
            
            # Calculate time until next run
            if job.next_run_time:
                now = datetime.now(job.next_run_time.tzinfo)
                if job.next_run_time > now:
                    diff = job.next_run_time - now
                    hours = diff.total_seconds() / 3600
                    print(f"  Time until next: {hours:.1f} hours")
                else:
                    diff = now - job.next_run_time
                    hours = diff.total_seconds() / 3600
                    print(f"  ⚠️  OVERDUE by: {hours:.1f} hours")
            
            print()
    else:
        print("Scheduler not available")

if __name__ == "__main__":
    asyncio.run(check_scheduler_jobs())