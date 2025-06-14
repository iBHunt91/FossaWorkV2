# Manual Tests

This directory contains manual test scripts and browser automation tests that require visual inspection.

## Test Categories

- **Visual Tests**: `test_*visual*.py`, `test_step_by_step*.py`
- **Browser Tests**: `test_browser_*.py`, `test_direct_playwright.py`
- **HTML Test Pages**: `*.html` files for testing specific features

## Running Tests

These tests are meant to be run individually:

```bash
cd backend
python ../tests/manual/test_visual_simple.py
```

## Important Notes

- These tests often keep the browser open for inspection
- Some tests take screenshots for debugging
- HTML files can be opened directly in a browser
- Tests may require manual interaction or verification