# Integration Tests

This directory contains integration tests that test multiple components working together.

## Test Categories

- **End-to-End Tests**: `test_complete_*.py`, `test_full_*.py`
- **API Integration**: `test_api_*.py`
- **System Validation**: `test_*_validation.py`
- **Feature Tests**: `test_customer_*.py`, `test_day*.py`

## Running Tests

```bash
cd backend
pytest ../tests/integration/
```

## Important Notes

- These tests may take longer to run than unit tests
- Some tests require actual WorkFossa credentials
- Tests may create/modify data in the database
- Browser automation tests require Playwright browsers installed