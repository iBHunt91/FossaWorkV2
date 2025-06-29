# Work Order Scheduler Simplification Plan

## Overview
Simplify the hourly work order scraping scheduler to be more reliable and provide accurate timing information to users.

## Current Issues

### 1. Timing Inaccuracy
- **Problem**: 60-second polling interval means jobs can run up to 1 minute late
- **Impact**: Users see "in 5 minutes" but it might run in 6 minutes
- **Root Cause**: Using simple polling instead of proper scheduling

### 2. Complex Architecture
- **Problem**: Separate daemon process with database polling
- **Impact**: Additional process to manage, more failure points
- **Root Cause**: Over-engineered solution for simple hourly scheduling

### 3. Credential Handling Issues
- **Problem**: Multiple fallback attempts, environment variable workarounds
- **Impact**: Failures when credentials aren't properly loaded
- **Root Cause**: Complex encryption flow without proper validation

### 4. UX Confusion
- **Problem**: Relative time display ("in 45 minutes") can be inaccurate
- **Impact**: Users don't know exact run time
- **Root Cause**: Frontend calculating from potentially stale data

## Proposed Solution

### 1. Use APScheduler Instead of Polling
```python
# Replace polling daemon with APScheduler cron trigger
scheduler.add_job(
    execute_work_order_scraping,
    CronTrigger(minute=0),  # Run every hour on the hour
    id=f"work_orders_{user_id}",
    args=[user_id],
    misfire_grace_time=300  # Allow 5 minutes late
)
```

**Benefits:**
- Runs exactly on the hour (no polling delay)
- Built-in misfire handling
- Simpler architecture (no separate daemon)

### 2. Simplify Credential Flow
```python
# Pre-flight credential check
async def validate_credentials(user_id: str) -> bool:
    """Validate credentials are available and decryptable"""
    try:
        creds = credential_manager.retrieve_credentials(user_id)
        return creds and creds.username and creds.password
    except Exception:
        return False

# Run validation before scheduling
if not await validate_credentials(user_id):
    raise ValueError("Invalid credentials - cannot schedule")
```

### 3. Improve UX Timing Display
```typescript
// Show exact time instead of relative
const formatNextRun = (nextRun: string) => {
  const date = new Date(nextRun);
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  } else if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d at h:mm a');
};
```

**Display Examples:**
- "Today at 2:00 PM" instead of "in 45 minutes"
- "Tomorrow at 9:00 AM" instead of "in 18 hours"
- Shows exact expectations to users

### 4. Maintain Progress Updates
The existing progress update system works well and will be preserved:
- Real-time progress tracking in glow card
- Phase updates (login, navigation, extraction)
- Success/failure counts
- No changes needed to this system

## Implementation Steps

### Phase 1: Backend Scheduler Update
1. Add APScheduler configuration to existing scheduler service
2. Create cron-based job registration
3. Implement pre-flight credential validation
4. Add health check endpoint for monitoring

### Phase 2: Frontend Timing Display
1. Update ScrapingStatus component to show exact times
2. Add timezone handling for correct local time display
3. Improve error messages for credential issues
4. Keep existing progress tracking unchanged

### Phase 3: Migration & Testing
1. Create migration script for existing schedules
2. Test exact hourly execution
3. Verify timezone handling across different regions
4. Ensure backward compatibility

## Benefits

1. **Reliability**: Jobs run exactly on the hour, every hour
2. **Clarity**: Users see "at 2:00 PM" not "in ~45 minutes"
3. **Simplicity**: Fewer moving parts, easier to debug
4. **Maintainability**: Standard scheduling library instead of custom daemon

## Risks & Mitigation

1. **Risk**: APScheduler process crashes
   - **Mitigation**: Supervisor/systemd auto-restart
   
2. **Risk**: Database connection issues
   - **Mitigation**: Connection pooling with retry

3. **Risk**: Timezone confusion
   - **Mitigation**: Store all times as UTC, convert in UI

## Success Metrics

1. Jobs run within 10 seconds of scheduled time (currently up to 60s late)
2. Zero credential-related failures after validation
3. Users report clearer understanding of when scraping occurs
4. Reduced support tickets about "sync not running"

## Timeline

- Week 1: Implement APScheduler backend
- Week 2: Update frontend timing display
- Week 3: Testing and migration
- Week 4: Monitor and refine

## Conclusion

This simplification will make the hourly work order scraping more reliable and user-friendly while reducing code complexity. The key improvement is moving from approximate polling to exact scheduling with clear user communication.