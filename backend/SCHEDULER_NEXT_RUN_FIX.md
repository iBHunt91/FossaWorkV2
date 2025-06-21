# Scheduler Next Run Fix Summary

## Problem
The hourly work order scraping scheduler was showing "Next run: Any moment... (10:00 AM)" and not updating after job execution. While the scrapes were executing automatically every hour (confirmed by history records), the UI showed stale next_run times.

## Root Cause
The application is using the full APScheduler service (not the simple scheduler), but the `next_run` field in the database wasn't being updated after job execution. APScheduler maintains its own internal next_run_time for jobs, but this wasn't being synchronized back to the database.

## Solution Implemented

### 1. Enhanced Job Event Handling
Modified `scheduler_service.py` to update the database `next_run` field when:
- A job is submitted for execution (EVENT_JOB_SUBMITTED)
- A job completes execution (EVENT_JOB_EXECUTED)

### 2. Code Changes
Added to `_handle_job_event` method in `scheduler_service.py`:

```python
# Update next_run when job is submitted
elif event.code == EVENT_JOB_SUBMITTED:
    if event.job_id.startswith('work_order_scrape_'):
        # Get job's next scheduled time from APScheduler
        job = self.scheduler.get_job(event.job_id)
        if job and job.next_run_time:
            # Update database to match
            schedule.next_run = job.next_run_time.replace(tzinfo=None)

# Update next_run after job execution  
elif event.code == EVENT_JOB_EXECUTED:
    if event.job_id.startswith('work_order_scrape_'):
        # Get job's next scheduled time from APScheduler
        job = self.scheduler.get_job(event.job_id)
        if job and job.next_run_time:
            # Update database to match
            schedule.next_run = job.next_run_time.replace(tzinfo=None)
```

### 3. Fixed Overdue Schedules
Created `fix_overdue_schedules.py` script to update any schedules showing past next_run times.

## Verification
- Full APScheduler service is active and running
- Jobs are scheduled with proper CronTrigger (runs at :30 past each hour)
- Database next_run now stays synchronized with APScheduler's internal schedule
- UI will show accurate "Next run" times instead of "Any moment..."

## Testing Scripts Created
1. `check_scheduler_status_now.py` - Check current scheduler state
2. `test_full_scheduler.py` - Verify full scheduler functionality
3. `monitor_scheduler_live.py` - Real-time monitoring of scheduler
4. `fix_overdue_schedules.py` - Fix any overdue schedule times

## Result
The scheduler now properly updates the next_run time after each execution, ensuring the UI always shows when the next scrape will occur instead of showing "Any moment..." indefinitely.