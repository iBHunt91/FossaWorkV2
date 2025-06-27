# Dashboard Filter Display Fix Guide

## Issue Summary

The Dashboard was not displaying filter calculations correctly, even though the Filters page was working properly. The root cause was that work orders didn't have dispenser data attached, which is required for filter calculations.

## Root Cause Analysis

### 1. Filter Calculation Requirements
The filter calculation system requires:
- Work orders with service codes (2861, 2862, 3002, 3146)
- **Dispenser data** attached to those work orders
- Proper data transformation before API calls

### 2. Why Filters Page Worked but Dashboard Didn't
Both components use identical code, but:
- The Filters page might have been getting fresher data
- The Dashboard was using React Query cached data
- Work orders were missing dispenser data

### 3. Backend Service Logic
From `filter_calculator.py`:
```python
# When no dispensers are found, it returns 0 filters with a warning
if requires_filters and not store_dispensers:
    logger.warning(f"No dispenser data found for store {store_number}")
    # Returns 0 filters
```

## Solution Implemented

### 1. Added Test Dispensers
Created and ran `scripts/testing/add_test_dispensers.py` to:
- Add realistic test dispensers to all 44 work orders
- Create appropriate fuel grade configurations
- Properly store dispensers in the database

### 2. Dashboard Improvements
Updated `Dashboard.tsx` to:
- Use `useQueryClient` for cache management
- Add query invalidation when work orders change
- Change query key from `['work-orders', token]` to `['work-orders', currentUserId]`
- Add manual refresh button for testing
- Force refresh filter calculations when component mounts

### 3. Code Changes

```typescript
// Added imports
import { useQuery, useQueryClient } from '@tanstack/react-query'

// Added in component
const queryClient = useQueryClient()

// Force refresh filter calculations when work orders change
useEffect(() => {
  if (workOrders && workOrders.length > 0) {
    console.log('[DASHBOARD] Work orders updated, invalidating filter queries')
    queryClient.invalidateQueries({ queryKey: ['filters'] })
  }
}, [workOrders, queryClient])

// Added refresh button
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    console.log('[DASHBOARD] Manual refresh triggered')
    refetchWorkOrders()
    queryClient.invalidateQueries({ queryKey: ['filters'] })
  }}
  className="flex items-center gap-2"
>
  <RefreshCw className="h-4 w-4" />
  Refresh Data
</Button>
```

## How Filter Display Works

### Filters Page Display Chain
1. `FiltersContent.tsx` fetches work orders
2. Extracts dispensers from work orders
3. Calls `/api/v1/filters/calculate` API
4. Receives `FilterCalculationResult` with `details` array
5. `FilterDetailsPanel` displays the details
6. When clicking dispenser icon, passes filter data to `DispenserInfoModal`

### Dashboard Display Chain
1. `Dashboard.tsx` fetches work orders
2. Filters by current/next week
3. Calls same calculation function
4. Displays filter summary in weekly cards
5. Shows total filters and boxes for each week

### DispenserInfoModal Display
- Expects `dispenserData.filters` object
- Displays filter requirements with visual styling
- Shows part numbers, quantities, and filter types

## Testing the Fix

1. **Verify Dispensers Were Added:**
   ```bash
   cd backend
   python3 scripts/check_dispenser_data.py
   ```

2. **Check Dashboard:**
   - Navigate to Dashboard
   - Click "Refresh Data" button
   - Verify filter counts appear in weekly cards
   - Check console logs for calculation details

3. **Compare with Filters Page:**
   - Navigate to Filters page
   - Verify same filter calculations
   - Test dispenser modal displays

## Future Improvements

1. **Real Dispenser Data:**
   - Replace test dispensers with actual scraped data
   - Implement dispenser scraping automation

2. **Performance:**
   - Consider server-side filter calculation caching
   - Optimize React Query cache settings

3. **UI Enhancements:**
   - Add loading states for filter calculations
   - Show filter details on hover in Dashboard
   - Add filter summary export functionality

## Troubleshooting

If filters still don't appear:

1. **Check Console Logs:**
   - Look for `[FILTER_CALC]` entries
   - Verify dispensers are being extracted
   - Check API response data

2. **Verify Data:**
   - Ensure work orders have `dispensers` array
   - Check service codes are correct
   - Verify dispenser fuel grades are populated

3. **Clear Cache:**
   - Hard refresh browser (Cmd+Shift+R)
   - Clear React Query cache
   - Restart development server