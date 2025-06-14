# Testing Scripts

This directory contains scripts for checking and validating data.

## Scripts

- `check_*.py` - Scripts that check various aspects of the system
- `test_*.py` - Standalone test scripts not part of the test suite
- `clear_users.py` - Utility to clear test user data

## Usage

Run from the backend directory:

```bash
cd backend
python ../scripts/testing/check_dispenser_results.py
```

## Purpose

These scripts are for:
- Validating data integrity
- Checking system state
- Quick testing of specific features
- Data inspection and reporting