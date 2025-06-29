# Work Order Sync - Comprehensive Guide

**Last Updated:** January 29, 2025  
**Status:** Active  
**Consolidates:** HOURLY_SCRAPING_QUICKSTART.md, HOURLY_SCRAPING_SETUP.md, hourly-scraping.md

## Table of Contents
1. [Quick Start](#quick-start)
2. [Feature Overview](#feature-overview)
3. [Configuration](#configuration)
4. [Progress Tracking](#progress-tracking)
5. [Technical Implementation](#technical-implementation)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)

## Quick Start

### 🚀 Get Started in 3 Minutes

1. **Start the Backend**
   ```bash
   cd backend
   python3 -m uvicorn app.main:app --reload --port 8000
   ```

2. **Start the Frontend**
   ```bash
   npm run dev
   ```

3. **Login and Check Status**
   - Navigate to http://localhost:5173
   - Login with WorkFossa credentials
   - Look for "Work Order Sync" in the sidebar

That's it! Your work orders will sync automatically every hour.

### Visual Status Indicators
- 🟢 **Green** - Active and healthy
- 🔵 **Blue (animated)** - Currently syncing with progress
- 🔴 **Red** - Sync failed (check credentials)
- ⚪ **Gray** - Paused or disabled

## Feature Overview

The Work Order Sync system automatically fetches work orders from WorkFossa at regular intervals, keeping your local database synchronized with the latest data.

### Key Features

- **Automated Scheduling**: Sync work orders automatically (default: every hour)
- **Active Hours**: Configure business hours for syncing (e.g., 6 AM - 10 PM)
- **Real-Time Progress**: Visual progress tracking during sync operations
- **Manual Sync**: Trigger immediate sync when needed
- **History Tracking**: Complete audit trail of all sync operations
- **Smart Cleanup**: Automatic removal of completed work orders
- **Error Recovery**: Automatic retry with exponential backoff
- **Change Detection**: Notifications for new or updated work orders

### Progress Tracking Features (NEW)

- **GlowCard Progress Display**: Beautiful animated progress card during sync
  - Circular progress indicator with percentage
  - Current phase display (initializing, scraping, saving)
  - Work orders found counter
  - Linear progress bar
  
- **Sidebar Progress Widget**: Compact progress indicator in navigation
  - Live percentage updates
  - Click to view full work orders page
  - Auto-hide when sync completes

## Configuration

### Access Settings

1. Navigate to **Settings** in the main menu
2. Click on the **Automation** tab
3. Find the **Work Order Sync Schedule** section

### Schedule Options

#### Sync Interval
- **Range**: 0.25 to 24 hours
- **Default**: 1 hour
- **Recommended**: 1-2 hours for most users

#### Active Hours (Optional)
- **Start Hour**: When syncing should begin (e.g., 6:00 AM)
- **End Hour**: When syncing should stop (e.g., 10:00 PM)
- **24/7 Mode**: Leave disabled for round-the-clock syncing

### Creating Your First Schedule

1. Click **"Enable Auto-Sync"** or **"Create Schedule"**
2. Set your preferred interval
3. Configure active hours (optional)
4. Click **Save**
5. Schedule starts immediately

### Managing Your Schedule

- **Pause/Resume**: Toggle sync without losing settings
- **Update Settings**: Change interval or hours anytime
- **Manual Sync**: Click "Sync Now" for immediate update
- **View History**: See all past sync operations

## Progress Tracking

### How It Works

1. **Sync Initiated**: Click "Sync Now" or wait for scheduled run
2. **Progress Display**: GlowCard appears with real-time updates
3. **Phases**:
   - Initializing (5%) - Setting up browser session
   - Logging In (15%) - Authenticating with WorkFossa
   - Scraping (25-90%) - Fetching work order data
   - Saving (90-100%) - Updating local database
4. **Completion**: Progress clears after 10 seconds

### Progress Components

#### Main Progress Card (GlowCard)
```
┌─────────────────────────────────┐
│ 🔄 Syncing Work Orders          │
│                                 │
│        ┌─────────┐             │
│        │   75%   │             │
│        └─────────┘             │
│                                 │
│ Phase: Scraping                 │
│ Found: 23 work orders           │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░ 75%           │
│                                 │
│ [View Work Orders]              │
└─────────────────────────────────┘
```

#### Sidebar Progress Widget
```
┌─────────────────────────┐
│ 🔄 Syncing... 75%       │
│ ▓▓▓▓▓▓▓▓░░░            │
│ Scraping work orders... │
└─────────────────────────┘
```

## Technical Implementation

### Architecture

- **Backend**: Python/FastAPI with APScheduler
- **Frontend**: React with real-time progress polling
- **Scheduler**: APScheduler with AsyncIO executor
- **Database**: SQLAlchemy models for schedules and history
- **Progress Tracking**: Shared memory dict with WebSocket-style polling

### Key Components

#### Backend Services
- `scheduler_service.py` - APScheduler management
- `workfossa_scraper.py` - Scraping logic
- `simple_scheduler_service.py` - Schedule CRUD operations

#### Frontend Components
- `ScrapingScheduleEnhanced.tsx` - Main schedule UI
- `ScrapingStatus.tsx` - Sidebar status widget
- `CompactSyncProgress.tsx` - Progress indicator
- `useProgressPolling.ts` - Progress tracking hook

#### API Endpoints
- `GET /api/scraping-schedules/` - List schedules
- `POST /api/scraping-schedules/` - Create schedule
- `PUT /api/scraping-schedules/{id}` - Update schedule
- `DELETE /api/scraping-schedules/{id}` - Delete schedule
- `POST /api/scraping-schedules/{id}/run` - Manual trigger
- `GET /api/scraping-schedules/{id}/sync-progress` - Progress updates
- `GET /api/scraping-schedules/{id}/history` - Sync history

### Database Schema

#### ScrapingSchedule Table
- `id`: Primary key
- `user_id`: User reference
- `schedule_type`: Always "work_orders"
- `interval_hours`: Sync frequency
- `active_start_hour`: Optional start time
- `active_end_hour`: Optional end time
- `enabled`: Active/paused state
- `next_run`: Next scheduled execution
- `last_run`: Last execution time
- `consecutive_failures`: Error tracking

#### ScrapingHistory Table
- `id`: Primary key
- `user_id`: User reference
- `started_at`: Execution start
- `completed_at`: Execution end
- `success`: Success/failure flag
- `items_processed`: Work orders count
- `error_message`: Failure details
- `trigger_type`: scheduled/manual

## Troubleshooting

### Common Issues

#### "Syncing..." Status Persists
**Fixed in latest version** - Progress now clears automatically after 10 seconds

#### No Progress in Sidebar
**Fixed in latest version** - Event propagation improved for reliable display

#### Sync Fails Immediately
- **Cause**: Invalid WorkFossa credentials
- **Solution**: Update credentials in Settings → Credentials

#### Schedule Not Running
- **Check**: Is the schedule enabled?
- **Check**: Are you within active hours?
- **Check**: Backend server running?

#### Missing Work Orders
- **Note**: Completed work orders are automatically removed
- **Check**: WorkFossa session active?
- **Try**: Manual sync to refresh

### Debug Commands

```bash
# Check scheduler status
curl http://localhost:8000/api/scraping-schedules/simple-status

# View sync progress
curl http://localhost:8000/api/scraping-schedules/1/sync-progress

# Check error logs
tail -f backend/logs/automation/scheduled_tasks.log
```

### Testing Scripts

```bash
# Test basic functionality
python3 backend/scripts/test_scraping_endpoints_simple.py

# Test scheduler operations
python3 backend/scripts/simple_schedule_test.py

# Test sync progress tracking
python3 backend/scripts/test_sync_progress.py
```

## API Reference

### Create Schedule
```http
POST /api/scraping-schedules/
Content-Type: application/json

{
  "schedule_type": "work_orders",
  "interval_hours": 1,
  "active_hours": {
    "start": 6,
    "end": 22
  },
  "enabled": true
}
```

### Update Schedule
```http
PUT /api/scraping-schedules/{schedule_id}
Content-Type: application/json

{
  "interval_hours": 2,
  "enabled": true
}
```

### Trigger Manual Sync
```http
POST /api/scraping-schedules/{schedule_id}/run
```

### Get Sync Progress
```http
GET /api/scraping-schedules/{schedule_id}/sync-progress

Response:
{
  "status": "in_progress",
  "phase": "scraping",
  "percentage": 45,
  "message": "Scraping work orders page 1 of 2...",
  "work_orders_found": 15,
  "started_at": "2025-01-29T10:00:00Z"
}
```

## Related Documentation

- [Work Order System Overview](/ai_docs/systems/work-orders.md)
- [Authentication System](/docs/security/authentication-complete.md)
- [Notification Configuration](/docs/features/notifications.md)
- [Troubleshooting Guide](/docs/troubleshooting/README.md)