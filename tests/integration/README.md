# Integration Tests

This directory contains integration tests that verify the complete data flow between backend services and frontend components.

## Test Categories

### Filter Data Flow Tests

#### `test_filter_data_flow.py` ⭐ NEW
**Comprehensive filter data pipeline testing**

Tests the complete flow from work orders to filter calculations:
- Work Orders API endpoint with date filtering
- Filter calculation API with real work order data
- Data formatting validation between frontend and backend
- End-to-end pipeline verification

**Usage:**
```bash
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/tests/integration/test_filter_data_flow.py
```

#### `test_dashboard_filter_integration.py` ⭐ NEW
**Dashboard-specific filter integration testing**

Simulates the exact Dashboard.tsx component filter logic:
- Week range calculation (current week, next week)
- Work orders fetching with date filtering
- Data mapping for filter calculation API
- Filter calculation and result processing
- Edge case and error scenario testing

**Usage:**
```bash
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/tests/integration/test_dashboard_filter_integration.py
```

### Legacy Tests
- **End-to-End Tests**: `test_complete_*.py`, `test_full_*.py`
- **API Integration**: `test_api_*.py`
- **System Validation**: `test_*_validation.py`
- **Feature Tests**: `test_customer_*.py`, `test_day*.py`

## Prerequisites for Filter Tests

### 1. Backend Running
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 2. Test Data Available
Use the test data setup script:
```bash
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/add_test_work_orders.py
```

### 3. Health Check
Verify backend is healthy:
```bash
curl http://localhost:8000/health
```

## Running Tests

### Filter Data Flow Tests (Recommended)
```bash
# Comprehensive filter pipeline test
python3 test_filter_data_flow.py

# Dashboard integration test  
python3 test_dashboard_filter_integration.py
```

### Legacy Tests
```bash
cd backend
pytest ../tests/integration/
```

## Expected Results

### Successful Filter Test Output

```
📊 COMPREHENSIVE TEST RESULTS
================================================================================
🔍 Component Test Results:
   ✅ Work Orders API: PASS
   ✅ Filter Calculation API: PASS  
   ✅ Data Formatting: PASS
   ✅ End-to-End Pipeline: PASS

📋 Summary:
   🗓️ Current Week: 3 work orders → 15 filters (3 boxes)
   🗓️ Next Week: 2 work orders → 10 filters (2 boxes)

💡 Recommendations:
   ✅ Filter data pipeline is working correctly!
```

## Test Data Setup

The filter integration tests require realistic test work orders:

```bash
# Add test work orders (option 4 recommended)
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/add_test_work_orders.py
```

This creates:
- Test user: `test-user-filter-data`
- 15 realistic work orders with various service codes (2861, 2862, 3002, 3146)
- Work orders for different store chains (7-Eleven, Speedway, Marathon, Wawa, Circle K)
- Work orders distributed across current and next 2 weeks

## Documentation

For detailed testing procedures and troubleshooting, see:
- [Filter Data Flow Testing Guide](../../docs/testing/filter-data-flow-testing-guide.md)

## Important Notes

- Filter tests run independently without pytest
- Legacy tests may take longer to run than unit tests
- Some tests require actual WorkFossa credentials
- Tests may create/modify data in the database
- Browser automation tests require Playwright browsers installed