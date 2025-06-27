# Scheduler Manual Run Fix Documentation

## Problem Description

The scheduler daemon was ignoring the `next_run` field that gets set by the "Run Now" button in the UI. This meant that manual scraping triggers were not working - the scheduler would only run based on interval timing.

## Root Cause

The `should_run_schedule` method in `scheduler_daemon.py` was only checking interval-based timing:
- It checked if the schedule was enabled
- It checked for too many failures
- It checked active hours
- It checked if enough time had passed since last_run

However, it completely ignored the `next_run` field, which is specifically designed for manual triggers.

## Solution

### 1. Enhanced `should_run_schedule` Method

The method now follows this priority order:

1. **Check if enabled** - Skip disabled schedules
2. **Check failures** - Skip if too many consecutive failures (>= 5)
3. **Check manual trigger (NEW)** - If `next_run` is set and in the past, run immediately
4. **Check active hours** - Only for automatic runs
5. **Check interval** - Standard interval-based scheduling

### 2. Improved Next Run Calculation

After a schedule runs, the system now:
- Detects if it was a manual run (next_run was in the past)
- For manual runs: Calculates next automatic run based on last_run + interval
- For automatic runs: Sets next run to current time + interval

This ensures manual runs don't disrupt the regular schedule.

### 3. Enhanced Logging

Added comprehensive logging to show:
- Why each schedule runs or doesn't run
- Manual vs automatic run detection
- Current time vs next_run comparisons
- Schedule status at startup
- Debug-level details when DEBUG=true

## Testing the Fix

### 1. Enable Debug Logging
```bash
export DEBUG=true
```

### 2. Use the Test Script
```bash
cd backend
python scripts/test_manual_schedule_trigger.py
```

This script allows you to:
- View all schedules and their current state
- Manually trigger a schedule by setting next_run
- Test the schedule logic without running the daemon

### 3. Monitor the Daemon
```bash
# In one terminal
cd backend
python scheduler_daemon.py

# In another terminal, trigger a manual run
python scripts/test_manual_schedule_trigger.py
```

## Expected Behavior

### Before Fix
- "Run Now" button updates next_run in database
- Scheduler ignores next_run field
- Schedule only runs based on interval timing
- Manual runs effectively don't work

### After Fix
- "Run Now" button updates next_run to current time
- Scheduler checks next_run FIRST
- If next_run <= now, schedule runs immediately
- After manual run, next automatic run is properly calculated
- Clear logging shows "triggered manually" for manual runs

## Edge Cases Handled

1. **Timezone Issues**
   - Properly handles timezone-aware datetimes
   - Converts to UTC for comparison

2. **First Run**
   - If no last_run exists, calculates next_run from current time

3. **Concurrent Runs**
   - Existing protection against duplicate executions remains

4. **Failure Handling**
   - Manual runs still respect the failure limit (5 consecutive failures)

## Configuration

### Environment Variables
- `DEBUG=true` - Enable debug logging to see detailed schedule checks

### Database Fields
- `next_run` - When set to current/past time, triggers immediate execution
- `last_run` - Updated after each successful execution
- `interval_hours` - Regular interval for automatic runs
- `enabled` - Must be true for any execution
- `consecutive_failures` - Incremented on failure, reset on success

## Monitoring

Watch the logs for these key messages:

**Manual Run Detection:**
```
Schedule X triggered manually (next_run: 2024-01-15 10:30:00, now: 2024-01-15 10:31:00)
This is a manual run for schedule X
```

**Automatic Run:**
```
Schedule X interval reached (24.5 >= 24.0 hours)
```

**Schedule Skip Reasons:**
```
Schedule X is disabled, skipping
Schedule X has too many failures (5), skipping  
Schedule X outside active hours (22 not in 8-17)
Schedule X not ready (12.3 < 24.0 hours)
```

## Integration with UI

The UI's "Run Now" button should:
1. Set `next_run` to current UTC time
2. Save to database
3. The daemon will pick it up within 60 seconds (check interval)

No other UI changes are needed - the fix is entirely in the daemon.