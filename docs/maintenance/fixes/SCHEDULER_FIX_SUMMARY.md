# Scheduler Fix Summary - Hourly Scraping

## Issue Identified
The Work Order Scraping was showing "Next run: Any moment... (10:00 AM)" and "Last run: Never", indicating the scheduler was stuck and not executing jobs.

## Root Causes Found

1. **Scheduler Not Initialized**: The scheduler service wasn't properly initialized when the FastAPI app started
2. **Job Store Persistence**: Jobs weren't being persisted properly in the SQLite job store
3. **Timezone Mismatches**: Mix of aware and naive datetime objects causing comparison issues
4. **Misfire Grace Time**: Jobs overdue by more than the grace period weren't executing
5. **Process Isolation**: Diagnostic scripts were creating separate scheduler instances

## Solutions Implemented

### 1. Enhanced Logging
Added comprehensive logging throughout the scheduler workflow:
- Job execution start/end with process IDs
- Scheduler state tracking
- Event listeners for all job events
- Automation event logging for tracking

### 2. Increased Misfire Grace Time
Changed from 5 minutes to 60 minutes to handle longer overdue periods:
```python
job_defaults = {
    'coalesce': True,
    'max_instances': 1,
    'misfire_grace_time': 3600  # 60 minutes
}
```

### 3. Timezone Handling
Fixed timezone comparison issues throughout the codebase:
- Ensured all datetime comparisons use timezone-aware objects
- Added proper UTC conversions where needed

### 4. Diagnostic Tools Created

#### `diagnose_and_fix_scheduler.py`
- Comprehensive diagnostic report showing:
  - Database schedules and their status
  - Scheduler service state
  - Job store contents
  - Recent scraping history
- Automatic fix attempts for common issues
- Forces execution of severely overdue jobs

#### `initialize_scheduler.py`
- Properly initializes the scheduler service
- Restores schedules from database
- Monitors scheduler for specified duration
- Handles job re-registration

#### `trigger_scrape_via_api.py`
- Triggers scraping through the API endpoint
- Uses the correct scheduler instance (FastAPI's)
- Shows current schedule status
- Provides authentication handling

#### `test_scheduler_edge_cases.py`
- Comprehensive test suite covering:
  - Scheduler initialization
  - Timezone handling
  - Job registration and persistence
  - Misfire handling
  - Direct job execution
  - Scheduler restart persistence
  - Concurrent execution prevention
  - Dynamic schedule updates

## How Scheduler Works

1. **On FastAPI Startup**:
   - Scheduler service initializes with SQLite job store
   - Restores all enabled schedules from database
   - Jobs run at :30 past each hour (e.g., 10:30, 11:30)

2. **Job Execution**:
   - APScheduler triggers `execute_work_order_scraping()`
   - Function runs browser automation to scrape work orders
   - Updates progress for UI monitoring
   - Saves results to database
   - Updates last_run timestamp

3. **Schedule Management**:
   - Schedules stored in `ScrapingSchedule` table
   - Jobs stored in APScheduler's SQLite job store
   - Both must be in sync for proper operation

## Edge Cases Handled

1. **Severely Overdue Jobs**: Jobs overdue by >60 minutes trigger immediate execution
2. **Scheduler Restart**: Jobs persist across FastAPI restarts
3. **Timezone Mismatches**: All comparisons use UTC
4. **Failed Executions**: Tracked in ScrapingHistory with error details
5. **Concurrent Execution**: Prevented by max_instances=1
6. **Process Isolation**: API triggers ensure correct scheduler instance

## Monitoring and Maintenance

### Check Scheduler Status
```bash
cd backend && python scripts/diagnose_and_fix_scheduler.py
```

### Trigger Manual Scrape (Recommended)
```bash
cd backend && python scripts/trigger_scrape_via_api.py
```

### Monitor Logs
- Backend logs: `/logs/backend/backend-general-{date}.jsonl`
- Automation logs: `/logs/automation/`
- Scheduler events: Look for "JOB EVENT" entries

### Key Log Patterns to Watch
- `🚀 SCHEDULED JOB STARTING` - Job execution started
- `JOB EVENT` - Scheduler events (executed, missed, error)
- `OVERDUE by X minutes` - Jobs that missed their schedule
- `Scheduler initialized successfully` - Startup confirmation

## Best Practices

1. **Always Use API**: Trigger scrapes through API endpoints, not direct scripts
2. **Monitor Overdue Jobs**: Check for jobs overdue >60 minutes
3. **Regular Health Checks**: Run diagnostic script weekly
4. **Log Monitoring**: Set up alerts for JOB_MISSED events
5. **Timezone Consistency**: Always use UTC for scheduling

## Quick Fixes

### If scheduler is stuck:
1. Run: `python scripts/diagnose_and_fix_scheduler.py`
2. Choose 'y' to apply automatic fixes
3. Monitor logs for execution

### If jobs aren't running:
1. Check if FastAPI is running: `ps aux | grep uvicorn`
2. Restart FastAPI if needed
3. Use API trigger: `python scripts/trigger_scrape_via_api.py`

### If seeing timezone errors:
1. Ensure all schedule times use UTC
2. Check database for mixed timezone data
3. Run diagnostic to identify issues

## Future Improvements

1. **Health Check Endpoint**: Add `/api/scheduler/health` endpoint
2. **Monitoring Dashboard**: Real-time scheduler status in UI
3. **Alert System**: Email/Pushover alerts for missed jobs
4. **Job Queue UI**: Visual job queue management
5. **Retry Logic**: Automatic retry for failed jobs
6. **Performance Metrics**: Track job execution times