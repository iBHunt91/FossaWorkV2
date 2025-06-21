# Work Order Cleanup Implementation

## Problem
Work orders that have been completed on WorkFossa were still showing up in the UI/database because the scraper only added or updated work orders but never removed completed ones.

## Solution
Modified both the scheduled scraper and manual scraping endpoints to remove work orders that are no longer present in the latest scrape from WorkFossa.

## Implementation Details

### 1. Scheduler Service (`scheduler_service.py`)
Added logic to the `execute_work_order_scraping` function:
- Get all work order external IDs from the current scrape
- Get all existing work orders for the user from the database
- Find work orders that exist in the database but not in the current scrape
- Delete these completed/removed work orders
- Log the removal for tracking

### 2. Manual Scraping Endpoint (`work_orders.py`)
Added the same logic to the `perform_scrape` function:
- Tracks removed work orders during manual scraping
- Includes removed count in the completion message
- Stores removed count in the progress tracking

## How It Works

1. **During Scraping:**
   - WorkFossa URL filters for work orders with no visits completed:
     ```
     https://app.workfossa.com/app/work/list?work_visit_completion=none||No visits completed||Work Visits Completed&order_direction=asc
     ```
   - This means completed work orders won't appear in the scrape results

2. **Database Cleanup:**
   - Before saving new/updated work orders, the system compares:
     - Current scrape results (active work orders)
     - Database records (all previously scraped work orders)
   - Any work order in the database but not in the current scrape is removed

3. **Cascade Delete:**
   - Work orders have `cascade="all, delete-orphan"` relationship with dispensers
   - When a work order is deleted, all associated dispensers are automatically deleted
   - This ensures no orphaned dispenser data remains

## Testing
Use `scripts/test_work_order_cleanup.py` to check current work orders in the database and verify cleanup is working.

## Result
- Only active work orders from the most recent scrape are shown in the UI
- Completed work orders are automatically removed
- Database stays clean and reflects current WorkFossa state
- Users see accurate, up-to-date work order information