# Context Findings

## Current Implementation Analysis

### 1. Component Architecture
- **Main Component**: `/frontend/src/components/ScrapingScheduleEnhanced.tsx` (1000+ lines)
- **Integration Point**: `/frontend/src/pages/Settings.tsx` (line ~1548)
- **Backend Routes**: 
  - `/backend/app/routes/scraping_schedules.py` - Schedule management
  - `/backend/app/routes/work_orders.py` - Scraping and progress tracking

### 2. Current Issues Identified

#### Issue 1: History Section Hidden When Empty
```javascript
// Line 804 in ScrapingScheduleEnhanced.tsx
{schedule && history.length > 0 && (
  <Card>
    {/* History content */}
  </Card>
)}
```
The history section only renders when there's existing history data.

#### Issue 2: No Immediate Feedback
When "Sync Now" is clicked, there's no immediate visual feedback until the sync completes and the next poll happens (up to 10 seconds later).

#### Issue 3: Fixed 10-Second Polling
```javascript
// Lines 93-96
const interval = setInterval(() => {
  fetchData();
}, 10000);
```
Uses a fixed 10-second interval regardless of sync state.

#### Issue 4: No Progress Tracking Integration
The component doesn't use the existing progress endpoint that the work order page uses:
- Endpoint exists: `/api/v1/work-orders/scrape/progress/{user_id}`
- Returns detailed progress: phase, percentage, message, items found/processed

### 3. Existing Progress Implementation (Work Order Page)

The work order scraping has excellent progress tracking:
```python
# backend/app/routes/work_orders.py
scraping_progress[user_id] = {
    "status": "in_progress",
    "phase": phase,  # e.g., "Logging in", "Fetching page 1 of 3"
    "percentage": percentage,
    "message": message,
    "work_orders_found": work_orders_found,
    "work_orders_processed": work_orders_processed,
    "errors": errors,
    "last_update": datetime.now(timezone.utc).isoformat()
}
```

### 4. Technical Constraints
- **No WebSocket Infrastructure**: The app uses REST APIs with polling
- **No Server-Sent Events**: Would require backend changes
- **Electron App**: Runs locally, so performance of frequent polling is less of a concern

### 5. Similar Features Analyzed

#### Work Order Page Progress (Dashboard.tsx)
The Dashboard likely polls the progress endpoint frequently during scraping to show:
- Current phase (login, navigation, processing)
- Percentage complete
- Items found/processed counters
- Error messages in real-time

#### Toast Notifications
The app has a toast system (`ToastContext.tsx`) that could show sync status updates.

### 6. Files That Need Modification

1. **Frontend**:
   - `/frontend/src/components/ScrapingScheduleEnhanced.tsx` - Main changes
   - `/frontend/src/services/api.ts` - May need progress endpoint additions

2. **Backend** (minimal changes):
   - Progress tracking already exists in work_orders.py
   - May need to ensure progress data persists for schedule-triggered syncs

### 7. Implementation Patterns to Follow

1. **State Management**: Use React hooks (useState, useEffect) for local state
2. **API Calls**: Use the existing apiClient pattern with proper error handling
3. **UI Components**: Use existing Shadcn/UI components (Card, Progress, Button)
4. **Icons**: Use lucide-react icons consistently
5. **Styling**: Follow TailwindCSS classes and dark mode support
6. **Error Handling**: Show errors in toasts and inline messages

### 8. Integration Points

1. **Progress Endpoint**: Reuse `/api/v1/work-orders/scrape/progress/{user_id}`
2. **Manual Sync Trigger**: Enhance existing `triggerManualRun` function
3. **Scheduled Sync**: Ensure scheduler also updates progress
4. **History Refresh**: Call `fetchHistory()` after sync completes

### 9. Performance Considerations

- During active sync: Poll every 1 second for smooth progress
- When idle: Keep 10-second polling for efficiency
- Clean up intervals properly to prevent memory leaks
- Consider debouncing rapid state updates

### 10. User Experience Goals

1. **Immediate Feedback**: Show "Starting sync..." instantly
2. **Granular Progress**: Display phase, percentage, and message
3. **Always Visible**: History section with empty state
4. **Real-time Feel**: 1-second updates during sync
5. **Error Visibility**: Show errors immediately with details