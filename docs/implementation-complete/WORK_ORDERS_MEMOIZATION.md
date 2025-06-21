# Work Orders Component Memoization Improvements

## Summary
Added comprehensive memoization to the WorkOrders.tsx component to improve performance by preventing expensive recalculations and unnecessary re-renders.

## Changes Made

### 1. Import Updates
- Added `useCallback` to the React imports

### 2. Memoized Expensive Calculations
- **Work Orders with Dispensers Count**: `workOrdersWithDispensersCount` - Caches the count of work orders that have dispensers
- **Work Orders without Dispensers Count**: `workOrdersWithoutDispensersCount` - Caches the count of work orders without dispensers
- **Group Statistics**: Added memoization within the render loop for group dispenser totals

### 3. Memoized Utility Functions with useCallback
- `getCleanStoreName` - Extracts clean store names from site names
- `getBrand` - Detects brand from site name
- `getBrandStyling` - Returns brand-specific styling
- `getStatusIcon` - Returns status icons based on work order status
- `formatAddress` - Formats addresses for display
- `getDispenserCount` - New helper function to calculate dispenser count for a work order

### 4. Memoized Event Handlers with useCallback
- `handleOpenVisit` - Opens work order visit URL
- `handleWeekChange` - Handles week navigation changes
- `handleScrape` - Initiates work order scraping
- `handleDispenserScrape` - Initiates dispenser scraping
- `handleStatusUpdate` - Updates work order status
- `toggleWorkOrderSelection` - Toggles work order selection
- `selectAllWorkOrders` - Selects all filtered work orders
- `deselectAllWorkOrders` - Clears all selections
- `handleBatchDispenserScrape` - Handles batch dispenser scraping
- `handleScrapeDispensers` - Scrapes dispensers for a single work order
- `handleClearDispensers` - Clears dispensers for a work order

### 5. Memoized Component Callbacks
- WorkOrderWeeklyView `onWorkOrderClick` callback
- WorkOrderWeeklyView `onViewDispensers` callback
- Clear all work orders button click handler
- Clear all dispensers button click handler
- Weekend mode dismiss button handler
- View mode switcher handlers (list/weekly)
- Show all jobs toggle handler

### 6. Optimized Render Logic
- Extracted dispenser count calculation into a reusable memoized function
- Added memoization to dispenser count display within work order cards
- Fixed dependency arrays for all memoized values

## Performance Benefits

1. **Reduced Recalculations**: Expensive operations like filtering, grouping, and counting are only recalculated when their dependencies change
2. **Stable Function References**: Event handlers maintain stable references across renders, preventing child component re-renders
3. **Optimized Loops**: Group statistics are calculated once per group rather than on every render
4. **Improved Responsiveness**: Less computation on each render means faster UI updates

## Notes

- The WorkOrders component itself was not wrapped in React.memo as it has many state updates and would not benefit significantly
- All dependency arrays have been properly configured to ensure correct behavior
- The memoization focuses on the most expensive operations: array filtering, grouping, and transformations