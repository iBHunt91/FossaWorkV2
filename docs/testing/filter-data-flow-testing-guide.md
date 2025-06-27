# Filter Data Flow Testing Guide

This guide explains how to verify that the complete filter data flow from backend to frontend is working correctly in FossaWork V2.

## Overview

The filter data flow involves several components:
1. **Work Orders API** - Fetches work orders with date filtering
2. **Filter Calculation Service** - Calculates filter requirements based on work orders
3. **Frontend Dashboard** - Displays filter summaries for current and next week
4. **Data Formatting** - Ensures proper data mapping between frontend and backend

## Test Scripts

### 1. Comprehensive Filter Data Flow Test

**Location:** `/tests/integration/test_filter_data_flow.py`

**Purpose:** Tests the complete pipeline from work orders to filter calculations.

**Features:**
- Tests work orders API endpoint with date filtering
- Tests filter calculation API with real work order data
- Verifies data formatting between frontend and backend
- Tests complete end-to-end pipeline
- Validates filter data completeness

**Usage:**
```bash
# Run the comprehensive test
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/tests/integration/test_filter_data_flow.py
```

**What it tests:**
- ✅ Work Orders API endpoint functionality
- ✅ Filter calculation API with realistic data
- ✅ Data mapping and formatting validation
- ✅ Complete pipeline verification
- ✅ Error handling and edge cases

### 2. Add Test Work Orders Script

**Location:** `/scripts/testing/add_test_work_orders.py`

**Purpose:** Temporarily adds realistic test work orders to verify filter calculations.

**Features:**
- Generates realistic work orders with various service codes (2861, 2862, 3002, 3146)
- Creates work orders for different store chains (7-Eleven, Speedway, Marathon, Wawa, Circle K)
- Adds work orders to the database for testing
- Provides verification and cleanup functions

**Usage:**
```bash
# Add test work orders
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/add_test_work_orders.py
```

**Menu Options:**
1. **Add test work orders** - Adds 15 realistic test work orders
2. **Verify existing work orders** - Checks what work orders are in the database
3. **Remove test work orders** - Cleans up test data
4. **Add work orders and run verification** - Complete setup with verification

### 3. Dashboard Filter Integration Test

**Location:** `/tests/integration/test_dashboard_filter_integration.py`

**Purpose:** Simulates the exact dashboard filter fetching logic.

**Features:**
- Replicates Dashboard.tsx filter calculation logic
- Tests current week and next week filter calculations
- Validates data mapping between frontend and backend
- Tests edge cases and error scenarios

**Usage:**
```bash
# Test dashboard integration
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/tests/integration/test_dashboard_filter_integration.py
```

**What it simulates:**
- ✅ Dashboard component initialization
- ✅ Week range calculation (current week, next week)
- ✅ Work orders fetching with date filtering
- ✅ Data mapping for filter calculation API
- ✅ Filter calculation and result processing

## Complete Testing Workflow

### Step 1: Prepare Environment

1. **Start the backend:**
   ```bash
   cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
   source venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start the frontend (optional):**
   ```bash
   cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
   npm run dev
   ```

3. **Verify backend health:**
   ```bash
   curl http://localhost:8000/health
   ```

### Step 2: Add Test Data

```bash
# Add realistic test work orders
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/add_test_work_orders.py

# Choose option 4: "Add work orders and run verification"
```

This will:
- Create a test user: `test-user-filter-data`
- Add 15 realistic work orders with various service codes
- Verify the data was added correctly
- Provide the test user ID for subsequent tests

### Step 3: Run Integration Tests

```bash
# Test the complete filter data flow
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/tests/integration/test_filter_data_flow.py

# Test dashboard-specific integration
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/tests/integration/test_dashboard_filter_integration.py
```

### Step 4: Verify Results

#### Expected Success Indicators:

**Filter Data Flow Test:**
- ✅ Work Orders API returns test data
- ✅ Filter Calculation API processes data correctly
- ✅ Data formatting validation passes
- ✅ End-to-end pipeline completes successfully

**Dashboard Integration Test:**
- ✅ Current week filter calculation succeeds
- ✅ Next week filter calculation succeeds
- ✅ Data mapping works correctly
- ✅ Edge cases are handled properly

#### Sample Success Output:

```
📊 COMPREHENSIVE TEST RESULTS
================================================================================
🔍 Component Test Results:
   ✅ Work Orders API: PASS
   ✅ Filter Calculation API: PASS
   ✅ Data Formatting: PASS
   ✅ End-to-End Pipeline: PASS

📋 Filter Summary:
   Current Week: 3 work orders → 15 filters (3 boxes)
   Next Week: 2 work orders → 10 filters (2 boxes)

💡 Recommendations:
   ✅ Filter data pipeline is working correctly!
```

### Step 5: Test in Frontend (Optional)

1. **Open the dashboard:** http://localhost:5173
2. **Check filter cards:** Should show current and next week filter totals
3. **Verify data:** Numbers should match the test results

### Step 6: Cleanup Test Data

```bash
# Remove test work orders when done
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/add_test_work_orders.py

# Choose option 3: "Remove test work orders"
```

## Understanding Test Results

### Common Issues and Solutions

#### 1. Work Orders API Fails
**Symptoms:** `❌ Work Orders API: FAIL`

**Possible Causes:**
- Backend not running
- Database connection issues
- Authentication problems

**Solutions:**
- Check backend status: `curl http://localhost:8000/health`
- Verify database file exists: `/backend/fossawork_v2.db`
- Check backend logs for errors

#### 2. Filter Calculation API Fails
**Symptoms:** `❌ Filter Calculation API: FAIL`

**Possible Causes:**
- Invalid work order data format
- Missing service codes in filter calculator
- API endpoint errors

**Solutions:**
- Check work order data format in logs
- Verify service codes are supported (2861, 2862, 3002, 3146)
- Review filter calculator configuration

#### 3. Data Formatting Issues
**Symptoms:** `❌ Data Formatting: FAIL`

**Possible Causes:**
- Field mapping issues between frontend and backend
- Missing required fields in work order data
- Date format inconsistencies

**Solutions:**
- Review data mapping in test logs
- Check required fields: `jobId`, `storeNumber`, `customerName`, `serviceCode`, `scheduledDate`
- Verify date format is ISO 8601

#### 4. No Filter Results
**Symptoms:** `totalFilters: 0, totalBoxes: 0`

**Possible Causes:**
- No matching dispensers for work orders
- Service codes not configured in filter calculator
- Work orders missing required data

**Solutions:**
- Check service code configuration in filter calculator
- Verify work order data includes valid service codes
- Review filter calculation logic for the specific store chains

## Test Data Details

### Generated Work Orders

The test scripts generate realistic work orders with:

**Service Codes:**
- `2861` - AccuMeasure - All Dispensers
- `2862` - AccuMeasure - Specific Dispensers  
- `3002` - AccuMeasure - All Dispensers (Alt)
- `3146` - Open Neck Prover

**Store Chains:**
- 7-Eleven (stores #1234, #1235, #1236)
- Speedway (stores #2001, #2002, #2003)
- Marathon (stores #3100, #3101, #3102)
- Wawa (stores #4500, #4501, #4502)
- Circle K (stores #5200, #5201, #5202)

**Date Distribution:**
- Work orders spread across current and next 2 weeks
- Enables testing of both current and next week calculations

### Expected Filter Results

Based on the filter calculator configuration:

**7-Eleven:**
- Gas filters: `400MB-10` (Electronic/HD), `40510A-AD` (Ecometer)
- Diesel filter: `400HS-10`
- High flow diesel: `800HS-30`

**Other chains:** Similar configurations with same part numbers

## Advanced Testing

### Manual API Testing

You can also test the APIs directly:

```bash
# Test work orders API
curl -X GET "http://localhost:8000/api/v1/work-orders/?user_id=test-user-filter-data&skip=0&limit=10"

# Test filter calculation API
curl -X POST "http://localhost:8000/api/v1/filters/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "workOrders": [
      {
        "jobId": "W-50000",
        "storeNumber": "1234",
        "customerName": "7-Eleven",
        "serviceCode": "2861",
        "scheduledDate": "2025-01-15T10:00:00",
        "address": "123 Test St, Test City, TX 75001"
      }
    ],
    "dispensers": [],
    "overrides": {}
  }'
```

### Debugging Tips

1. **Enable verbose logging:** Set log level to DEBUG in test scripts
2. **Check backend logs:** Monitor uvicorn output for API errors
3. **Verify database content:** Query the database directly if needed
4. **Test individual components:** Run specific test functions for isolated debugging

## Integration with Development Workflow

### Before Committing Changes

Run the filter data flow tests to ensure:
- Backend API changes don't break frontend integration
- Filter calculation logic still works correctly
- Data formatting remains consistent

### After Filter Calculator Changes

1. Add test work orders
2. Run integration tests  
3. Verify filter calculations are correct
4. Test in frontend dashboard
5. Clean up test data

### Continuous Integration

These tests can be integrated into CI/CD pipelines:
- Run on every pull request
- Validate API compatibility
- Ensure filter calculations remain accurate

## Troubleshooting Common Problems

### "No work orders found"
- Check date ranges in test
- Verify test data was added successfully
- Confirm user ID matches between scripts

### "Filter calculation returns zero"
- Check service codes are supported
- Verify store chain names match filter calculator config
- Review dispenser data (if required)

### "API authentication errors"
- Currently tests run without authentication
- If auth is enabled, update scripts with valid tokens

### "Database connection errors"
- Ensure backend is running
- Check database file permissions
- Verify virtual environment is activated

This comprehensive testing guide should help you verify that the filter data flow is working correctly and identify any issues in the pipeline.