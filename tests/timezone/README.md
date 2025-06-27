# Timezone Test Suite

Comprehensive testing suite to verify timezone fixes work correctly across the entire FossaWork V2 application.

## Overview

This test suite validates that the timezone fixes implemented to resolve scheduling display issues work correctly across all components:

- **Backend API**: Ensures all timestamps include 'Z' suffix for UTC
- **Frontend Utilities**: Validates date parsing and relative time calculations
- **Integration**: Tests complete backend-to-frontend flow
- **Edge Cases**: Handles DST boundaries, malformed data, and extreme scenarios

## Quick Start

Run the complete test suite:

```bash
# From project root
python3 scripts/testing/timezone_test_suite.py
```

This will:
1. Run all backend API tests
2. Open frontend tests in your browser
3. Execute integration tests
4. Test edge cases and error conditions
5. Generate a comprehensive report

## Individual Test Suites

### 1. Backend API Tests
**File**: `tests/backend/timezone/test_timezone_backend_api.py`

Tests that backend API endpoints properly format timestamps:
- Schedule API responses include 'Z' suffix
- History records have proper UTC format
- Schedule updates calculate next_run correctly
- 1-hour intervals handled properly
- API consistency across endpoints

```bash
cd backend
python3 ../tests/backend/timezone/test_timezone_backend_api.py
```

### 2. Frontend Utility Tests
**File**: `tests/frontend/timezone/test_timezone_frontend_utils.html`

Interactive browser-based tests for frontend utilities:
- `ensureUTCFormat()` function validation
- `getRelativeTime()` calculations (including "in about 1 hour")
- `formatUTCToLocal()` display formatting
- `validateTimezoneFormat()` warning system
- Critical 1-hour scenario verification

Open in browser to run interactively:
```bash
open tests/frontend/timezone/test_timezone_frontend_utils.html
```

### 3. Integration Tests
**File**: `tests/integration/timezone/test_timezone_integration.py`

End-to-end testing of complete system flow:
- Backend schedule creation → Frontend display
- Schedule update propagation
- Timezone consistency across components
- Critical 1-hour scenario end-to-end
- Performance and timing accuracy

```bash
cd backend
python3 ../tests/integration/timezone/test_timezone_integration.py
```

### 4. Edge Case Tests
**File**: `tests/edge_cases/timezone/test_timezone_edge_cases.py`

Comprehensive edge case and error condition testing:
- DST boundary transitions
- Malformed timestamp handling
- Rapid schedule updates
- Different user timezone offsets
- Extreme time values
- Concurrent access scenarios

```bash
cd backend
python3 ../tests/edge_cases/timezone/test_timezone_edge_cases.py
```

## Test Results Interpretation

### Success Criteria

**✅ ALL PASS**: All timezone fixes working correctly
- Backend formats all timestamps with 'Z' suffix
- Frontend correctly handles all timestamp variations
- 1-hour schedules consistently show "in about 1 hour"
- System handles edge cases gracefully

**✅ CRITICAL PASS**: Core functionality working
- Backend API and frontend utilities working
- Integration tests passing
- Edge case failures are non-critical

**❌ CRITICAL FAIL**: Issues need attention
- Backend API timestamp formatting issues
- Frontend utility calculation errors
- Integration flow problems

### Common Issues and Solutions

#### Backend Issues
- **Missing 'Z' suffix**: Check `_format_schedule_response()` in `scraping_schedules.py`
- **Inconsistent formats**: Verify all API endpoints use same formatting
- **Schedule update errors**: Check `SimpleSchedulerService.update_schedule()`

#### Frontend Issues
- **Relative time incorrect**: Check `getRelativeTime()` in `dateFormat.ts`
- **UTC parsing problems**: Verify `ensureUTCFormat()` implementation
- **Timezone warnings**: Check `validateTimezoneFormat()` logic

#### Integration Issues
- **End-to-end flow broken**: Check data flow from schedule update to display
- **Timing inconsistencies**: Verify timezone handling throughout pipeline

## Test Data Cleanup

All tests use isolated test user IDs and clean up their data automatically:
- `test_user_timezone_api`
- `test_user_timezone_integration` 
- `test_user_timezone_edge_cases`

No production data is affected.

## Dependencies

### Backend Tests
- Python 3.8+
- SQLAlchemy
- FastAPI
- Pydantic
- pytz (for edge case testing)

### Frontend Tests
- Modern web browser
- JavaScript ES6+ support

### Database
- SQLite (development) or PostgreSQL (production)
- `scraping_schedules` and `scraping_history` tables

## Continuous Integration

To include in CI/CD pipeline:

```yaml
# Example GitHub Actions step
- name: Run Timezone Tests
  run: |
    cd backend
    python3 ../scripts/testing/timezone_test_suite.py
```

## Troubleshooting

### Database Connection Issues
```bash
# Check database is accessible
cd backend
python3 -c "from app.database import SessionLocal; db = SessionLocal(); print('✓ DB OK'); db.close()"
```

### Import Path Issues
```bash
# Ensure backend is in Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)/backend"
```

### Browser Test Issues
- Ensure modern browser (Chrome 80+, Firefox 75+, Safari 14+)
- Check browser console for JavaScript errors
- Allow file:// protocol access if blocked

## Performance Expectations

- **Backend API Tests**: ~10-30 seconds
- **Frontend Tests**: Interactive (user-controlled)
- **Integration Tests**: ~15-45 seconds  
- **Edge Case Tests**: ~30-60 seconds
- **Total Suite**: ~2-5 minutes

## Contributing

When adding new timezone-related features:

1. Add corresponding tests to appropriate suite
2. Update this README if new test categories are added
3. Ensure all tests pass before submitting PR
4. Include timezone handling verification in PR description

## Related Documentation

- `/ai_docs/systems/batch-automation.md` - Scheduling system documentation
- `/frontend/src/utils/dateFormat.ts` - Frontend timezone utilities
- `/backend/app/routes/scraping_schedules.py` - Backend API endpoints
- `/backend/app/services/simple_scheduler_service.py` - Schedule management