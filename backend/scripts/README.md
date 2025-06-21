# Backend Scripts

This directory contains utility scripts for development, debugging, and maintenance of the FossaWork V2 backend.

## Directory Structure

### `/debug/`
Debug scripts for troubleshooting issues (22 scripts):
- API debugging (`debug_api_*.py`)
- Scheduler debugging (`debug_scheduler_*.py`)
- Database debugging (`debug_*.py`)
- Work order debugging

### `/monitoring/`
Scripts for checking system status (45 scripts):
- Database checks (`check_db_*.py`)
- Authentication checks (`check_auth_*.py`)
- Dispenser data checks (`check_dispenser_*.py`)
- Scheduler status checks (`check_scheduler_*.py`)
- Work order checks (`check_work_order_*.py`)

### `/maintenance/`
Scripts for fixing issues and maintaining the system (19 scripts):
- Database fixes (`fix_db_*.py`)
- Scheduler fixes (`fix_scheduler_*.py`)
- Configuration fixes (`fix_*.py`)
- Service fixes

### `/migrations/`
Database migration scripts

### `/testing/`
Testing utility scripts and interactive tests

## Other Scripts

The root scripts directory also contains various utility scripts:
- Data analysis scripts
- Scraping utilities
- Monitoring tools
- Setup and configuration scripts

## Usage Examples

### Debug a scheduler issue:
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2-hourly-scrape/backend
python scripts/debug/debug_scheduler_import.py
```

### Check system status:
```bash
python scripts/monitoring/check_scheduler_status.py
python scripts/monitoring/check_db_schedules.py
```

### Fix a known issue:
```bash
python scripts/maintenance/fix_scheduler_init.py
```

### Run interactive tests:
```bash
python scripts/testing/interactive_dispenser_test.py
```

## Script Categories

- **Dispenser Scripts**: Scripts for scraping and managing dispenser data
- **Work Order Scripts**: Scripts for managing work orders
- **Scheduler Scripts**: Scripts for the APScheduler system
- **Database Scripts**: Scripts for database operations
- **Authentication Scripts**: Scripts for testing authentication
- **Monitoring Scripts**: Scripts for system monitoring and logging

## Best Practices

1. Use descriptive names that indicate the script's purpose
2. Add a docstring at the top of each script explaining what it does
3. Include example usage in the docstring
4. Handle errors gracefully and provide helpful output
5. Use logging instead of print statements where appropriate