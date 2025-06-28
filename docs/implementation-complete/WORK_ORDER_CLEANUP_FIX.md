# Work Order Cleanup Fix

## Issue
Completed work orders were not being removed from the database even though cleanup code existed in both:
- `scheduler_service.py` (lines 206-236)
- `work_orders.py` (lines 688-708)

## Root Cause
The WorkFossa scraper was using a filtered URL that only showed work orders with "No visits completed":
```python
work_orders_url = "https://app.workfossa.com/app/work/list?work_visit_completion=none%7C%7CNo%20visits%20completed%7C%7CWork%20Visits%20Completed&order_direction=asc"
```

This meant:
1. Completed work orders were never included in the scrape results
2. The cleanup logic compared database work orders against scrape results
3. Since completed work orders weren't in the scrape results by design, the cleanup logic thought they were still active
4. No work orders were ever removed

## Solution
Changed the scraper to fetch ALL work orders (not just incomplete ones):
```python
work_orders_url = "https://app.workfossa.com/app/work/list?order_direction=asc"
```

## Impact
Now the cleanup logic will work correctly:
1. Scraper fetches ALL work orders from WorkFossa
2. Cleanup logic compares database work orders with ALL WorkFossa work orders
3. Work orders that exist in database but not in WorkFossa (i.e., completed/deleted) will be removed
4. Database stays in sync with WorkFossa

## Testing
To verify the fix works:
1. Note the current work orders in the database
2. Complete a work order in WorkFossa
3. Run a manual scrape or wait for the next scheduled scrape
4. Verify the completed work order is removed from the database

## Files Modified
- `/backend/app/services/workfossa_scraper.py` - Line 214: Removed filter from work orders URL