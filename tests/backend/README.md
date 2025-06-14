# Backend Tests

This directory contains unit and functional tests for the backend API and services.

## Test Categories

- **Authentication Tests**: `test_auth_*.py`, `test_login.py`
- **API Tests**: `test_api.py`, `test_route_*.py`, `test_backend_startup.py`
- **Scraping Tests**: `test_scraping_*.py`, `test_scraper_*.py`
- **Dispenser Tests**: `test_dispenser_*.py`
- **Service Tests**: `test_*_service.py`, `test_notification_*.py`
- **Data Tests**: `test_address_*.py`, `test_structure.py`

## Running Tests

```bash
cd backend
pytest ../tests/backend/
```

Or run specific test:
```bash
pytest ../tests/backend/test_auth_quick.py
```

## Test Dependencies

Most tests require:
- Python virtual environment activated
- Backend dependencies installed (`pip install -r requirements.txt`)
- Some tests may require running backend server