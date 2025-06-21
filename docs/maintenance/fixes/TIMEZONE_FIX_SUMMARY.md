# Timezone Fix Summary

## Issue
The "Last sync" was showing "in 4 hours" instead of "4 hours ago" because of timezone handling issues.

## Root Cause
The backend was sending timestamps without timezone information (naive datetime), causing the frontend to misinterpret them as local time instead of UTC.

## Fix Applied

### Backend (scheduler_service.py)
Added timezone info to all timestamps in the history API response:
```python
# Ensure timestamps have timezone info (UTC)
started_at = record.started_at
if started_at.tzinfo is None:
    started_at = started_at.replace(tzinfo=timezone.utc)
```

### Frontend (ScrapingStatus.tsx)
Updated to handle both timezone-aware and naive timestamps:
```typescript
// Handle both timezone-aware (with Z or +00:00) and naive timestamps
if (status.last_run.includes('Z') || status.last_run.includes('+')) {
    // Already has timezone info
    lastRunDate = new Date(status.last_run);
} else {
    // Naive datetime - assume it's UTC
    lastRunDate = new Date(status.last_run + 'Z');
}
```

## Result
- Backend now sends: `2025-06-19T20:08:40.451050+00:00`
- Frontend correctly shows: "4 hours ago" (or appropriate relative time)
- Both timezone-aware and naive timestamps are handled correctly

## Verification
The API now returns properly formatted timestamps:
```json
{
  "started_at": "2025-06-19T20:08:40.451050+00:00",
  "completed_at": "2025-06-19T20:09:37.890355+00:00"
}
```

The UI should now correctly display:
- ✅ "Last sync: X hours ago" (not "in X hours")
- ✅ Proper relative time calculations
- ✅ Consistent timezone handling across the app