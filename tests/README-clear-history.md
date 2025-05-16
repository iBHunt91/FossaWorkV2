# Clear History Test Suite

This directory contains tests for the Clear History functionality in the FormPrep automation system.

## Test Files

### 1. `test-clear-history-manual.js`
Quick manual test to verify the API endpoint is working correctly.

```bash
npm run test:clear-history
```

Tests:
- Clear single job history
- Clear batch job history  
- Clear all job history
- Error handling (missing user ID, invalid job type)

### 2. `test-clear-history.js`
Comprehensive API test suite with mock data creation.

```bash
npm run test:clear-history-full
```

Features:
- Creates mock user data before testing
- Tests all API endpoints thoroughly
- Validates error responses
- Provides detailed test results

### 3. `test-clear-history-integration.js`
Browser-based integration test using Puppeteer.

```bash
npm run test:clear-history-integration
```

Tests:
- UI interaction for clearing single job history
- UI interaction for clearing batch job history
- Confirmation dialog handling
- Success notification verification

## Running the Tests

1. **Make sure the server is running:**
   ```bash
   npm run server
   ```

2. **Run the quick manual test:**
   ```bash
   npm run test:clear-history
   ```

3. **Run the full API test suite:**
   ```bash
   npm run test:clear-history-full
   ```

4. **Run the integration tests:**
   ```bash
   # Make sure the frontend is also running
   npm run dev
   
   # In another terminal
   npm run test:clear-history-integration
   ```

## Test Coverage

The tests cover:
- ✅ API endpoint functionality
- ✅ Error handling for invalid requests
- ✅ UI interactions in both Single and Batch automation views
- ✅ LocalStorage clearing
- ✅ State management updates
- ✅ User feedback (toasts and confirmations)

## Expected Results

All tests should pass with clear history functionality working correctly:
- Single job history can be cleared independently
- Batch job history can be cleared independently
- UI updates immediately after clearing
- Success notifications are displayed
- Error cases are handled properly