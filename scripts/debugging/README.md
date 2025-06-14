# Debugging Scripts

This directory contains debugging utilities for troubleshooting specific issues.

## Scripts

- `debug_auth.py` - Debug authentication issues
- `debug_customer_url_*.py` - Debug customer URL extraction
- `debug_dispenser_*.py` - Debug dispenser scraping issues

## Usage

Run from the backend directory:

```bash
cd backend
python ../scripts/debugging/debug_auth.py
```

## Purpose

These scripts are for development and debugging only. They may:
- Output detailed logs
- Save screenshots
- Print sensitive information
- Bypass normal error handling

**Do not use in production!**