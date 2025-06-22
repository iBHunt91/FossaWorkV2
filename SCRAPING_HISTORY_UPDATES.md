# Scraping History API Updates

## Summary

Added delete functionality to the scraping history API and enhanced it to track manual vs automatic scrapes.

## Changes Made

### 1. Database Schema Update
- Added `trigger_type` column to `ScrapingHistory` model
  - Values: "manual" or "scheduled" 
  - Default: "scheduled" for backward compatibility
  - Migration script: `backend/scripts/migrations/add_trigger_type_to_history.py`

### 2. New API Endpoints

#### Delete Single History Record
```
DELETE /api/scraping-schedules/history/{history_id}
```
- Deletes a specific history record
- User can only delete their own records
- Returns 404 if record not found

#### Delete All History Records
```
DELETE /api/scraping-schedules/history
```
- Deletes all history records for the current user
- Returns count of deleted records

### 3. History Tracking for Manual Scrapes
- Updated `perform_scrape` function in `work_orders.py` to create history records
- Manual scrapes now create history with `trigger_type="manual"`
- Both successful and failed manual scrapes are recorded
- Tracks metrics: items_processed, items_added, items_updated, duration

### 4. Enhanced History Response
- History records now include `trigger_type` field
- Allows frontend to distinguish between manual and scheduled runs
- Backward compatible with existing records (defaults to "scheduled")

### 5. Test Script
- Created `backend/scripts/test_scraping_history_api.py` for testing all functionality
- Tests getting history, deleting records, and verifying trigger types

## Usage Examples

### Get History with Trigger Type
```bash
GET /api/scraping-schedules/history/work_orders

Response:
[
  {
    "id": 1,
    "started_at": "2025-01-22T10:30:00Z",
    "completed_at": "2025-01-22T10:31:00Z", 
    "success": true,
    "items_processed": 25,
    "error_message": null,
    "duration_seconds": 60.5,
    "trigger_type": "manual"  // New field
  },
  ...
]
```

### Delete Single Record
```bash
DELETE /api/scraping-schedules/history/123

Response:
{
  "success": true,
  "message": "History record 123 deleted successfully",
  "timestamp": "2025-01-22T10:45:00Z"
}
```

### Delete All Records
```bash
DELETE /api/scraping-schedules/history

Response:
{
  "success": true,
  "message": "Deleted 15 history records",
  "timestamp": "2025-01-22T10:46:00Z"
}
```

## Frontend Integration

The frontend can now:
1. Show different icons/labels for manual vs scheduled scrapes
2. Allow users to delete individual history records
3. Provide a "Clear History" button to delete all records
4. Filter history by trigger type if desired

## Migration Instructions

1. Stop the backend server
2. Run the migration script:
   ```bash
   cd backend
   python3 scripts/migrations/add_trigger_type_to_history.py
   ```
3. Restart the backend server

The migration is safe to run multiple times - it will skip if the column already exists.

## Testing

Run the test script to verify functionality:
```bash
cd backend
python3 scripts/test_scraping_history_api.py
```

This will test:
- Getting history with trigger_type field
- Deleting individual records
- Deleting all records
- Manual vs scheduled scrape differentiation