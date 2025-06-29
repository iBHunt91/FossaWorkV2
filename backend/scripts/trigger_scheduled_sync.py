#!/usr/bin/env python3
"""
Manually trigger a scheduled work order sync
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.services.scheduler_service import scheduler_service
from app.database import DATABASE_URL


async def main():
    """Trigger sync for a specific user"""
    user_id = "7bea3bdb7e8e303eacaba442bd824004"  # Bruce's user ID
    
    print("Initializing scheduler service...")
    await scheduler_service.initialize(DATABASE_URL)
    
    print(f"Triggering immediate sync for user {user_id[:8]}...")
    
    # Get the job and modify its next_run_time to now
    job_id = f"work_order_scrape_{user_id}"
    job = scheduler_service.scheduler.get_job(job_id)
    
    if job:
        print(f"Found job: {job_id}")
        print(f"Current next run: {job.next_run_time}")
        
        # Reschedule to run immediately
        from datetime import datetime, timezone
        job.modify(next_run_time=datetime.now(timezone.utc))
        print("Job rescheduled to run immediately!")
        
        # Wait a bit for it to execute
        print("Waiting for job to execute...")
        await asyncio.sleep(10)
        
        # Check job status again
        job = scheduler_service.scheduler.get_job(job_id)
        if job:
            print(f"Job next run after execution: {job.next_run_time}")
    else:
        print(f"Job not found: {job_id}")
        
        # List all jobs
        jobs = scheduler_service.scheduler.get_jobs()
        print(f"\nAvailable jobs ({len(jobs)}):")
        for j in jobs:
            print(f"  - {j.id}")
    
    # Don't shutdown - let the job complete
    print("\nJob triggered. Check the logs for execution status.")


if __name__ == "__main__":
    asyncio.run(main())