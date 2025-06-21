# Error Boundary Manual Test Guide

## Purpose
Test that the ErrorBoundary component properly catches and displays errors in the WorkOrders page.

## Test Steps

### 1. Basic Error Boundary Display
1. Open the Work Orders page
2. If you need to trigger a test error, you can temporarily add the ErrorBoundaryTest component
3. The error boundary should display a user-friendly error page with:
   - Error icon
   - Error title
   - Error message
   - "Try Again" button
   - "Refresh Page" button

### 2. Error Recovery
1. After seeing the error page, click "Try Again"
2. The component should reset and display normally
3. Alternatively, click "Refresh Page" to reload the entire application

### 3. Development Mode Features
When running in development mode, you should see:
- An expandable "Error Details" section
- The error message and stack trace

### 4. Logging Verification
1. Check the browser console for error logs
2. Check `/logs/frontend/frontend-errors-{date}.jsonl` for the captured error
3. The error should include:
   - Error message
   - Stack trace
   - Component stack

## Expected Behavior

### Success Criteria
- ✅ Errors are caught and don't crash the entire app
- ✅ User sees a friendly error message
- ✅ User can recover from the error
- ✅ Errors are logged to console and file
- ✅ Development mode shows additional debugging info

### Error Boundary Features
- Catches JavaScript errors in component tree
- Logs error information
- Displays fallback UI
- Allows error recovery
- Work Orders specific error messages

## Notes
- The error boundary only catches errors in the component tree below it
- It doesn't catch errors in event handlers, async code, or during SSR
- For production, error details are hidden from users