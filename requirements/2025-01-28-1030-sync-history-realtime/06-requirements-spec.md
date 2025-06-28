# Requirements Specification: Real-Time Sync History Updates

## Problem Statement
The sync history section in the work order sync configuration (Settings page) has several usability issues:
1. History section is completely hidden until after the first manual sync
2. No immediate feedback when sync operations start
3. Updates are delayed by up to 10 seconds due to polling
4. No granular progress information during sync operations
5. Users may attempt duplicate syncs due to lack of visible feedback

## Solution Overview
Enhance the sync history section to provide real-time updates with immediate feedback, granular progress tracking, and improved visibility. The solution will leverage existing backend progress tracking APIs and implement more responsive frontend polling during active sync operations.

## Functional Requirements

### FR1: Always Visible Sync History Section
- The sync history section must always be visible when a sync schedule exists
- Display an empty state message when no sync history is available
- Section should be collapsible to save space when not actively monitoring
- Default state: Collapsed for new users, remembers user's last preference

### FR2: Immediate Sync Feedback
- When "Sync Now" is clicked, immediately show "Starting sync..." status
- Display a progress section that appears instantly upon sync initiation
- Prevent duplicate sync attempts by disabling the button during active syncs
- Show clear visual feedback that the system is responding to user action

### FR3: Real-Time Progress Updates
- Poll progress endpoint every 1 second during active sync operations
- Display current sync phase (e.g., "Logging in", "Fetching page 1 of 3")
- Show percentage complete with visual progress bar
- Include live work order count: "Processing work order 15 of 47"
- Update history table immediately upon sync completion

### FR4: Enhanced Sync Status Visibility
- Add pulsing indicator next to "Sync Schedule" header during active syncs
- Indicator should be visible even when section is collapsed
- Use consistent visual language (colors, animations) with other loading states
- Show sync status for both manual and scheduled sync operations

### FR5: Improved Error Handling
- Display error summary in history table with brief description
- Add "View Details" button for full error logs
- Use existing modal pattern for detailed error display
- Maintain error visibility until user acknowledges or new sync starts

### FR6: Scheduled Sync Integration
- Real-time updates must work for both manual and scheduled syncs
- If settings page is open during scheduled sync, show progress automatically
- Ensure progress tracking works regardless of sync trigger source
- Maintain consistent UI behavior between manual and scheduled operations

## Technical Requirements

### TR1: Frontend Implementation Details

#### Component Updates (`ScrapingScheduleEnhanced.tsx`)
1. **State Management**
   - Add `syncProgress` state for active sync tracking
   - Add `isHistoryCollapsed` state with localStorage persistence
   - Add `isSyncActive` computed property

2. **Progress Polling**
   ```typescript
   // Adaptive polling interval
   const pollInterval = isSyncActive ? 1000 : 10000;
   
   // Progress endpoint integration
   const fetchProgress = async () => {
     const response = await apiClient.get(
       `/api/v1/work-orders/scrape/progress/${user.id}`
     );
     setSyncProgress(response.data);
   };
   ```

3. **UI Changes**
   - Remove condition: `history.length > 0` from history section rendering
   - Add empty state component with icon and helpful message
   - Add collapsible wrapper with chevron icon
   - Add progress bar component during active syncs
   - Add pulsing dot indicator to section header

#### Visual Components
1. **Empty State**
   ```jsx
   <div className="text-center py-8 text-muted-foreground">
     <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
     <p>No sync history yet</p>
     <p className="text-sm">History will appear after your first sync</p>
   </div>
   ```

2. **Progress Display**
   ```jsx
   <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border">
     <div className="flex items-center justify-between mb-2">
       <span className="text-sm font-medium">{syncProgress.phase}</span>
       <span className="text-sm">{syncProgress.percentage}%</span>
     </div>
     <Progress value={syncProgress.percentage} className="h-2" />
     <p className="text-xs mt-1 text-muted-foreground">
       Processing work order {syncProgress.work_orders_processed} of {syncProgress.work_orders_found}
     </p>
   </div>
   ```

3. **Active Sync Indicator**
   ```jsx
   {isSyncActive && (
     <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-2" />
   )}
   ```

### TR2: API Integration
- Use existing endpoint: `GET /api/v1/work-orders/scrape/progress/{user_id}`
- No backend changes required - progress tracking already implemented
- Ensure proper error handling for network failures
- Clean up polling intervals on component unmount

### TR3: Performance Considerations
- Implement proper cleanup of polling intervals
- Use `useCallback` for memoized functions
- Debounce rapid state updates if needed
- Limit progress history to last 10 entries to prevent memory growth

### TR4: Browser Compatibility
- Ensure animations work across all supported browsers
- Test collapsed state persistence in different browsers
- Verify localStorage availability before use
- Provide fallbacks for older browser versions

## Implementation Hints

### Pattern References
1. **Collapsible Sections**: Follow pattern from filter management sections
2. **Progress Bars**: Use existing Progress component from shadcn/ui
3. **Error Modals**: Reuse ErrorLogModal component pattern
4. **Toast Notifications**: Integrate with existing toast system for sync complete notifications

### File Modifications Required
1. `/frontend/src/components/ScrapingScheduleEnhanced.tsx` - Main implementation
2. No backend changes needed - reuse existing progress API
3. No new API endpoints required

### State Flow
1. User clicks "Sync Now" → Set loading state → Start progress polling
2. Backend updates progress → Frontend polls and updates UI
3. Sync completes → Stop polling → Refresh history → Show toast
4. Error occurs → Stop polling → Show error → Enable retry

## Acceptance Criteria

### AC1: History Visibility
- [ ] Sync history section appears immediately when schedule exists
- [ ] Empty state message shown when no history available
- [ ] Section can be collapsed/expanded with state persistence
- [ ] Collapsed state remembered across page refreshes

### AC2: Real-Time Updates
- [ ] Progress appears within 1 second of sync start
- [ ] Updates show every second during active sync
- [ ] Work order counts update live during processing
- [ ] History refreshes immediately upon completion

### AC3: Visual Feedback
- [ ] "Sync Now" button disabled during active sync
- [ ] Pulsing indicator visible in header during sync
- [ ] Progress bar accurately reflects sync progress
- [ ] Phase descriptions match actual sync operations

### AC4: Error Handling
- [ ] Errors show summary in history table
- [ ] "View Details" opens modal with full error log
- [ ] Failed syncs clearly marked with error icon
- [ ] Error details preserved until next sync

### AC5: Performance
- [ ] No memory leaks from polling intervals
- [ ] UI remains responsive during updates
- [ ] Polling stops when component unmounts
- [ ] No duplicate API calls

## Assumptions
1. Existing progress API returns accurate real-time data
2. User's browser supports localStorage for preference persistence
3. Backend progress tracking works for scheduled syncs
4. Current 1-second polling interval is acceptable for performance
5. Existing toast notification system will be used for completion alerts