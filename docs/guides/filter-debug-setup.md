# Filter Debug Tools Setup Guide

This guide explains how to use the comprehensive filter debug tools to identify and resolve filter data issues.

## Debug Tools Overview

### 1. Frontend Debug Utilities (`frontend/src/utils/filterDebug.ts`)

**Features:**
- Work order data validation
- API connectivity testing
- Filter calculation simulation
- Debug logging with levels (info, warn, error, debug)
- Data inspection at each step
- Export debug data functionality

**Key Functions:**
```typescript
import { validateWorkOrders, testAPIConnectivity, simulateFilterCalculation } from '../utils/filterDebug';

// Validate work order data structure
const result = validateWorkOrders(workOrders);

// Test API endpoints
const apiStatus = await testAPIConnectivity();

// Simulate filter calculations
const filters = simulateFilterCalculation(workOrders);
```

### 2. Frontend Debug Component (`frontend/src/components/debug/FilterDebugPanel.tsx`)

**Features:**
- Tabbed interface for different debug functions
- Real-time validation of work order data
- API connectivity testing with detailed results
- Live filter calculation testing
- Raw data inspection
- Debug log viewer with filtering
- Export functionality

**Integration:**
```tsx
import { FilterDebugPanel } from '../components/debug/FilterDebugPanel';

// Add to dashboard temporarily for debugging
<FilterDebugPanel className="mt-4" />
```

### 3. Backend Debug Script (`backend/scripts/debug_filter_flow.py`)

**Features:**
- Complete filter calculation pipeline testing
- Work order validation with detailed error reporting
- Performance testing with multiple data sizes
- Edge case testing
- Detailed logging and results export

**Usage:**
```bash
# Run the complete debug suite
python3 scripts/debug_filter_flow.py

# Results saved to: backend/logs/debug/filter_debug_[timestamp].json
```

## Environment Setup

### 1. Enable Debug Mode

**Backend (.env):**
```bash
DEBUG_MODE=true
LOG_LEVEL=DEBUG
```

**Frontend (.env.local):**
```bash
VITE_DEBUG_MODE=true
VITE_ENABLE_FILTER_DEBUG=true
```

### 2. Debugging Workflow

**Step 1: Enable Debug Logging**
```typescript
import { setDebugMode } from '../utils/filterDebug';
setDebugMode(true); // Enable comprehensive logging
```

**Step 2: Add Debug Panel (Temporarily)**
```tsx
// In Dashboard.tsx or Filters.tsx
import { FilterDebugPanel } from '../components/debug/FilterDebugPanel';

return (
  <div>
    {/* Existing content */}
    
    {/* Temporary debug panel */}
    {process.env.NODE_ENV === 'development' && (
      <FilterDebugPanel className="mt-8 border-2 border-yellow-500" />
    )}
  </div>
);
```

**Step 3: Run Backend Tests**
```bash
cd backend
python3 scripts/debug_filter_flow.py
```

## Debug Process

### 1. Data Validation Issues

**Symptoms:**
- Missing filter data
- Incorrect calculations
- API errors

**Debug Steps:**
1. Open FilterDebugPanel → Validation tab
2. Click "Validate Work Orders"
3. Review errors and warnings
4. Check raw data in Data tab

**Common Issues:**
- Missing `serviceCode` in work orders
- Empty `dispensers` array for AccuMeasure services
- Invalid dispenser data structure

### 2. API Connectivity Issues

**Symptoms:**
- API timeouts
- Authentication failures
- Network errors

**Debug Steps:**
1. Open FilterDebugPanel → API Tests tab
2. Click "Test API Connectivity"
3. Review response status and data
4. Test filter API with real data

**Common Issues:**
- Invalid JWT tokens
- CORS configuration
- Backend service not running

### 3. Calculation Logic Issues

**Symptoms:**
- Wrong filter quantities
- Missing filter types
- Calculation errors

**Debug Steps:**
1. Open FilterDebugPanel → Calculation tab
2. Compare simulation vs real API results
3. Review processing details
4. Check backend debug logs

**Common Issues:**
- Service code mapping errors
- Dispenser product parsing
- Filter type rules

### 4. Performance Issues

**Symptoms:**
- Slow API responses
- UI freezing
- Memory issues

**Debug Steps:**
1. Run backend performance tests
2. Check network tab in browser
3. Monitor debug logs for timing
4. Use React DevTools Profiler

## Debug Log Analysis

### Frontend Logs
Location: `/logs/frontend/frontend-general-[date].jsonl`

**Key Information:**
- API request/response timing
- Component rendering issues
- JavaScript errors
- User interactions

### Backend Logs
Location: `/logs/debug/filter_debug_[timestamp].json`

**Key Information:**
- Validation results
- Performance metrics
- Error details
- Test summaries

## Common Debugging Scenarios

### Scenario 1: No Filter Data Showing

**Steps:**
1. Check work orders are loaded: `FilterDebugPanel → Data tab`
2. Validate work order structure: `Validation tab`
3. Test filter API: `API Tests → Test Filter API`
4. Check browser console for errors
5. Review backend logs

### Scenario 2: Wrong Filter Quantities

**Steps:**
1. Compare simulation vs API: `Calculation tab`
2. Check dispenser data: `Data tab → Sample Work Order`
3. Validate service codes: `Validation tab`
4. Run backend debug script
5. Review calculation logic

### Scenario 3: API Errors

**Steps:**
1. Test connectivity: `API Tests → Test API Connectivity`
2. Check authentication token
3. Review CORS settings
4. Check backend service status
5. Review API error logs

## Removing Debug Tools

**Before Production:**
1. Remove FilterDebugPanel from components
2. Set `DEBUG_MODE=false` in environment
3. Remove debug imports
4. Clean up debug logs

**Keep:**
- Debug utilities (for future debugging)
- Backend debug script
- Environment configuration options

## Best Practices

1. **Always start with validation** before testing calculation logic
2. **Use simulation first** to understand expected behavior
3. **Compare simulation vs API** to identify calculation issues
4. **Export debug data** for detailed analysis
5. **Document findings** in development logs
6. **Clean up** debug tools before production deployment

## Troubleshooting Tips

- **No work orders?** Check authentication and user data
- **Validation errors?** Review work order structure in API response
- **API timeouts?** Check backend service and database connectivity
- **Wrong calculations?** Compare with simulation and check service codes
- **Performance issues?** Review batch processing and pagination