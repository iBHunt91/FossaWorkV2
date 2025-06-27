# Scheduling System Test Suite

Comprehensive test coverage for the FossaWork V2 scheduling system, including backend, frontend, and integration tests.

## Test Structure

```
tests/
├── backend/scheduling/
│   ├── conftest.py                    # Shared pytest fixtures
│   ├── test_scraping_models.py        # Database model tests
│   ├── test_scraping_schedules_api.py # API endpoint tests
│   ├── test_scheduler_daemon.py       # Daemon functionality tests
│   └── run_all_tests.py              # Test runner with coverage
├── frontend/scheduling/
│   └── ScrapingSchedule.test.tsx      # React component tests
├── integration/scheduling/
│   └── test_scheduling_integration.py # Full system integration tests
└── README_SCHEDULING_TESTS.md         # This file

scripts/testing/interactive/scheduling/
├── interactive_schedule_test.py       # Interactive backend testing
└── interactive_ui_schedule_test.py    # Interactive UI testing
```

## Running Tests

### Backend Tests

#### Run All Tests with Coverage
```bash
cd backend
python tests/backend/scheduling/run_all_tests.py
```

#### Run Specific Test Suite
```bash
cd backend
# Model tests
pytest tests/backend/scheduling/test_scraping_models.py -v

# API tests
pytest tests/backend/scheduling/test_scraping_schedules_api.py -v

# Daemon tests
pytest tests/backend/scheduling/test_scheduler_daemon.py -v

# Integration tests
pytest tests/integration/scheduling/test_scheduling_integration.py -v
```

#### Run with Coverage Report
```bash
cd backend
coverage run -m pytest tests/backend/scheduling/ tests/integration/scheduling/ -v
coverage report -m
coverage html  # Generates htmlcov/index.html
```

### Frontend Tests

```bash
cd frontend
npm test -- src/components/ScrapingSchedule.test.tsx
```

### Interactive Tests

These tests allow manual step-by-step verification:

#### Backend Interactive Test
```bash
cd backend
python scripts/testing/interactive/scheduling/interactive_schedule_test.py
```

#### UI Interactive Test
```bash
# Start frontend and backend servers first
cd backend
python scripts/testing/interactive/scheduling/interactive_ui_schedule_test.py
```

## Test Coverage

### Backend Coverage

1. **Database Models (100%)**
   - ScrapingSchedule model
   - ScrapingHistory model
   - ScrapingStatistics model
   - Model relationships and conversions

2. **API Endpoints (100%)**
   - POST /api/scraping-schedules/ - Create schedule
   - GET /api/scraping-schedules/ - List schedules
   - GET /api/scraping-schedules/{id} - Get schedule
   - PUT /api/scraping-schedules/{id} - Update schedule
   - DELETE /api/scraping-schedules/{id} - Delete schedule
   - GET /api/scraping-schedules/{id}/history - Get history
   - POST /api/scraping-schedules/{id}/run - Trigger manual run
   - GET /api/scraping-schedules/status/daemon - Daemon status

3. **Scheduler Daemon (100%)**
   - Schedule eligibility checking
   - Work order scraping execution
   - Failure handling and recovery
   - Active hours enforcement
   - Concurrent execution
   - Error recovery

4. **Integration Tests**
   - Complete workflow from API to execution
   - Multi-user isolation
   - Manual run triggering
   - Enable/disable workflows
   - Failure handling
   - Statistics aggregation

### Frontend Coverage

1. **Component Rendering**
   - Authentication states
   - Schedule display
   - History display
   - Daemon status

2. **User Interactions**
   - Schedule creation
   - Schedule updates
   - Manual run triggering
   - Enable/disable toggle
   - Active hours configuration

3. **State Management**
   - Form state handling
   - API response handling
   - Error state management
   - Auto-refresh

4. **Error Handling**
   - API errors
   - Validation errors
   - Network failures

## Test Fixtures

Common test data provided by `conftest.py`:

- `test_user` - Mock authenticated user
- `active_schedule` - Enabled schedule ready to run
- `disabled_schedule` - Disabled schedule
- `failed_schedule` - Schedule with many failures
- `user_credentials` - WorkFossa credentials
- `successful_history` - Successful execution history
- `failed_history` - Failed execution history
- `mock_scraper_success` - Mock scraper returning data
- `mock_scraper_failure` - Mock scraper that fails

## Edge Cases Tested

1. **Scheduling Logic**
   - Never-run schedules
   - Recently-run schedules
   - Schedules with active hour restrictions
   - Disabled schedules
   - Failed schedules (5+ consecutive failures)

2. **Multi-User**
   - User isolation
   - Concurrent execution
   - Permission checking

3. **Error Scenarios**
   - Missing credentials
   - Scraping failures
   - Database errors
   - Invalid input data

4. **Performance**
   - Large history pagination
   - Concurrent schedule execution
   - Long-running operations

## Interactive Testing

Interactive tests provide visual verification of:

1. **Backend Behavior**
   - Schedule creation and updates
   - Daemon execution
   - History recording
   - Failure handling

2. **UI Behavior**
   - Form interactions
   - Real-time updates
   - Error displays
   - Status changes

## Continuous Integration

To add to CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Scheduling Tests
  run: |
    cd backend
    pip install -r requirements.txt
    pip install pytest coverage
    python tests/backend/scheduling/run_all_tests.py
```

## Debugging Tests

### Enable Test Logging
```bash
pytest -v -s --log-cli-level=DEBUG
```

### Run Single Test
```bash
pytest tests/backend/scheduling/test_scraping_schedules_api.py::TestCreateSchedule::test_create_basic_schedule -v
```

### Interactive Debugging
```python
import pdb; pdb.set_trace()  # Add to test code
```

## Known Issues

1. **Async Tests**: Some async tests may need longer timeouts on slower systems
2. **Database Isolation**: Each test creates its own database to prevent conflicts
3. **Mock Timing**: Interactive tests use delays to simulate real-world timing

## Future Improvements

1. Add performance benchmarks
2. Add load testing for concurrent schedules
3. Add E2E browser automation tests
4. Add mutation testing for better coverage
5. Add contract testing for API