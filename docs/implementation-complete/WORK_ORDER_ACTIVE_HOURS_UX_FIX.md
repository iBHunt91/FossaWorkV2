# Work Order Active Hours UX Update Fix

## Issue
The Work Order scrape UX (ScrapingStatus component) was not updating when active hours were changed in the settings. Users would change the active hours but the UI wouldn't reflect the updated schedule until a page refresh.

## Root Cause
The ScrapingSchedule component was dispatching a custom 'scraping-schedule-updated' event when settings were changed, but the ScrapingStatus component wasn't listening for this event. The components were only connected through the ScrapingStatusContext which required manual calls to refreshStatus().

## Solution Implemented

### 1. Added Event Listener in ScrapingStatus Component
Added a window event listener for the 'scraping-schedule-updated' event in the ScrapingStatus component's useEffect hook:

```typescript
// Listen for custom event from ScrapingSchedule component
const handleScheduleUpdate = () => {
  console.log('ScrapingStatus: Received scraping-schedule-updated event');
  // Add a small delay to ensure backend has processed changes
  setTimeout(() => {
    fetchStatus();
  }, 100);
};

window.addEventListener('scraping-schedule-updated', handleScheduleUpdate);
```

### 2. Enhanced Event Dispatching in ScrapingSchedule
Updated the ScrapingSchedule component to include the active hours in the dispatched event for immediate UI feedback:

```typescript
const scheduleWithActiveHours = {
  ...updatedSchedule,
  interval_hours: intervalHours,
  active_hours: useActiveHours ? { start: activeHoursStart, end: activeHoursEnd } : null
};
window.dispatchEvent(new CustomEvent('scraping-schedule-updated', { 
  detail: { schedule: scheduleWithActiveHours }
}));
```

### 3. Improved Local State Updates
Enhanced the local state updates to immediately reflect active hours changes:

```typescript
// Update schedule with new active hours and interval even if enabled state doesn't change
setSchedule(prev => prev ? { 
  ...prev, 
  active_hours: activeHours, 
  interval_hours: intervalHours 
} : null);
```

## Impact
- The ScrapingStatus component in the Navigation bar now updates immediately when active hours are changed
- The ScrapingStatus component in the Work Orders page also updates immediately
- Users get instant visual feedback when changing schedule settings
- The UI stays in sync with the backend schedule configuration

## Files Modified
1. `/frontend/src/components/ScrapingStatus.tsx` - Added event listener for schedule updates
2. `/frontend/src/components/ScrapingSchedule.tsx` - Enhanced event dispatching and local state management

## Testing
To test the fix:
1. Navigate to Settings > Scraping
2. Change the active hours start/end times
3. Click "Update"
4. Observe that the ScrapingStatus components in both the navbar and Work Orders page update immediately without requiring a page refresh