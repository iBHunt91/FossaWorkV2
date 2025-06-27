# Filter Calculation Logging Improvements

This document outlines the comprehensive logging improvements added to the filter calculation system to help debug issues with filter data not appearing.

## Overview

Added detailed logging to all components of the filter calculation pipeline:
- Filter API routes (`/api/v1/filters/*`)
- Filter calculation service (`FilterCalculator`)
- Work order retrieval routes (`/api/v1/work-orders/*`)
- Dispenser scraping endpoints

## Logging Locations

### 1. Filter Routes (`backend/app/routes/filters.py`)

**Added logging tags: `[FILTER_CALC]`, `[FILTER_VALIDATE]`**

#### `/calculate` endpoint:
- Logs incoming request parameters (work orders count, dispensers count, overrides)
- Logs work order IDs and sample data
- Logs dispenser store coverage
- Logs calculation results (summary items, warnings, totals)
- Logs detailed filter breakdown for debugging

#### `/validate` endpoint:
- Logs validation process for each work order
- Logs missing fields and validation errors
- Logs service code validation
- Logs date format validation results

### 2. Filter Calculator Service (`backend/app/services/filter_calculator.py`)

**Added logging tag: `[FILTER_CALC_SERVICE]`**

#### Main calculation method:
- Logs input validation (work order count, dispenser count)
- Logs work order validation results
- Logs dispenser grouping by store
- Logs processing progress for each work order
- Logs final calculation results

#### Work order processing:
- Logs each work order being processed
- Logs service code requirements
- Logs store chain determination
- Logs dispenser filtering for specific service codes
- Logs filter calculations per dispenser

#### Dispenser filter calculation:
- Logs individual dispenser processing
- Logs fuel grade analysis
- Logs filter type determination
- Logs part number lookups
- Logs filter rule applications

#### Summary generation:
- Logs summary compilation from filter data
- Logs individual summary items
- Logs total calculations

### 3. Work Order Routes (`backend/app/routes/work_orders.py`)

**Added logging tag: `[WORK_ORDERS]`**

#### Work order retrieval:
- Logs query parameters (user, pagination, date filters)
- Logs database query construction
- Logs total work order count
- Logs final result count
- Logs sample work order data for debugging

#### Dispenser scraping:
**Added logging tags: `[DISPENSER_SCRAPE]`, `[DISPENSER_SCRAPE_BG]`**

- Logs scraping initiation requests
- Logs work order validation
- Logs existing dispenser checks
- Logs credential retrieval
- Logs customer URL usage
- Logs background task execution
- Logs scraping results and database updates
- Logs error conditions with detailed context

## Log Message Format

All log messages follow a consistent format:
```
[LOG_TAG] Message with relevant data
```

### Log Levels Used:
- **INFO**: Normal operation flow, key milestones
- **DEBUG**: Detailed step-by-step processing (only visible when debug logging enabled)
- **WARNING**: Data issues, missing information, validation problems
- **ERROR**: Failures, exceptions, critical errors

## Example Log Output

```
[FILTER_CALC] Starting filter calculation for user demo_user
[FILTER_CALC] Received 5 work orders
[FILTER_CALC] Received 12 dispensers
[FILTER_CALC_SERVICE] Starting filter calculation
[FILTER_CALC_SERVICE] Input: 5 work orders, 12 dispensers
[FILTER_CALC_SERVICE] Valid work orders: 5/5
[FILTER_CALC_SERVICE] Dispensers grouped for 3 stores
[FILTER_CALC_SERVICE] Processing work order 1/5: 12345
[FILTER_CALC_SERVICE] Job 12345 total filters: {'400MB-10': 4, '400HS-10': 2}
[FILTER_CALC_SERVICE] Generated summary with 2 items, total filters: 6
[FILTER_CALC] Calculation completed successfully
[FILTER_CALC] Total filters: 6
```

## Debugging Workflow

When filter data isn't appearing, check logs for:

1. **Request Reception**: Look for `[FILTER_CALC]` messages showing incoming data
2. **Data Validation**: Check for `[FILTER_CALC_SERVICE]` validation messages
3. **Work Order Processing**: Verify work orders are being processed individually
4. **Dispenser Data**: Confirm dispensers are grouped correctly by store
5. **Filter Calculation**: Check individual dispenser filter calculations
6. **Summary Generation**: Verify summary compilation from calculated filters

## Common Issues to Look For

### No Filter Data Appearing:
- Check if work orders have valid service codes requiring filters
- Verify dispensers exist for the work order store numbers
- Look for validation warnings about missing data
- Check if fuel grades are being processed correctly

### Missing Dispensers:
- Look for `[DISPENSER_SCRAPE]` messages about scraping attempts
- Check if customer URLs are available for scraping
- Verify scraping completion and database updates
- Look for scraping errors in background tasks

### Calculation Errors:
- Check for service code validation warnings
- Look for fuel grade rule application messages
- Verify store chain determination
- Check part number lookup results

## Testing

Use the test script to verify logging is working:
```bash
cd backend
python scripts/testing/test_filter_logging.py
```

This script simulates filter calculations with sample data and displays all log output for verification.

## Configuration

Logging levels can be controlled through the application's logging configuration. To see debug messages, ensure the logging level is set to DEBUG for the filter calculation components.

The logging uses the application's standard logging service and will output to both console and log files as configured in the main application.