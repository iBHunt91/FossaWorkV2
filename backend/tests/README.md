# Backend Tests

This directory contains all test files for the FossaWork V2 backend.

## Directory Structure

### `/unit/`
Contains unit tests for individual components and functions:
- API endpoint tests (test_api_*.py)
- Authentication tests (test_auth_*.py)
- Service tests (test_*_service.py)
- Model tests
- Utility tests

Total: 74 test files

### `/integration/`
Contains integration tests that test multiple components working together:
- End-to-end workflow tests
- Database integration tests
- External service integration tests

Currently empty - tests can be moved here as needed.

### `/manual/`
Contains manual test artifacts:
- HTML captures from scraping tests
- Test data files
- Manual testing scripts

Total: 4 HTML files

## Running Tests

### Run all tests:
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2-hourly-scrape/backend
python -m pytest tests/
```

### Run specific test category:
```bash
python -m pytest tests/unit/
python -m pytest tests/integration/
```

### Run specific test file:
```bash
python -m pytest tests/unit/test_api_response.py
```

### Run with coverage:
```bash
python -m pytest --cov=app tests/
```

## Test Naming Convention

- `test_api_*.py` - API endpoint tests
- `test_auth_*.py` - Authentication tests
- `test_*_service.py` - Service layer tests
- `test_*_scraper.py` - Scraper tests
- `test_scheduler_*.py` - Scheduler tests

## Notes

- Tests were moved from `/backend/scripts/` to proper test directories
- Each test should be self-contained and not depend on external state
- Use fixtures for common test data and setup
- Mock external services to ensure tests run offline