# Hourly Work Order Scraping Implementation

## Overview

We have successfully implemented an automated hourly work order scraping system that runs in the background, keeping work orders synchronized with the WorkFossa platform. The system uses APScheduler for reliable task scheduling with persistence across restarts.

## Key Features

### 1. **Automated Hourly Scraping**
- Runs every hour automatically
- Configurable intervals (default: 1 hour)
- Active hours support (e.g., only scrape 8 AM - 6 PM)
- Timezone-aware scheduling

### 2. **Real-Time Status Display**
- Live status indicator in navigation sidebar
- Shows next run time with countdown
- Displays last run results
- Visual feedback with color-coded states

### 3. **Persistent Scheduling**
- Schedules survive server restarts
- SQLite-based job persistence
- Automatic recovery after crashes

### 4. **Manual Control**
- Trigger immediate scraping from UI
- Pause/resume scheduling
- Modify intervals without restart
- View complete scraping history

## Technical Architecture

### Backend Components

#### 1. **Scheduler Service** (`backend/app/services/scheduler_service.py`)
- Core scheduling engine using APScheduler
- Manages background jobs and persistence
- Handles job execution and error recovery
- Provides async interface for schedule management

#### 2. **Database Models** (`backend/app/models/scraping_models.py`)
- `ScrapingSchedule`: Stores schedule configuration
- `ScrapingHistory`: Tracks execution history
- Full audit trail with timestamps and results

#### 3. **API Endpoints** (`backend/app/routes/scraping_schedules.py`)
```
GET    /api/scraping-schedules/          # List all schedules
POST   /api/scraping-schedules/          # Create new schedule
GET    /api/scraping-schedules/{id}      # Get specific schedule
PUT    /api/scraping-schedules/{id}      # Update schedule
DELETE /api/scraping-schedules/{id}      # Delete schedule
POST   /api/scraping-schedules/{id}/trigger  # Manual trigger
GET    /api/scraping-schedules/history/{job_type}  # Get history
```

### Frontend Components

#### 1. **ScrapingStatus Component** (`frontend/src/components/ScrapingStatus.tsx`)
- Compact mode for sidebar display
- Full mode for detailed information
- Real-time updates every 30 seconds
- Synchronized styling with work orders page

#### 2. **ScrapingSchedule Component** (`frontend/src/components/ScrapingSchedule.tsx`)
- Full configuration interface
- Schedule management controls
- History viewer with filtering
- Manual trigger button

#### 3. **Navigation Integration** (`frontend/src/components/Navigation.tsx`)
- Prominent "Work Order Sync" section
- Always visible from any page
- Expandable for quick details
- Visual status indicators

## Implementation Details

### Schedule Configuration
```json
{
  "interval_hours": 1.0,
  "enabled": true,
  "active_hours": {
    "start": 8,
    "end": 18
  },
  "timezone": "America/New_York"
}
```

### Status States
- **Active** (Green): Schedule enabled and healthy
- **Running** (Blue pulse): Currently scraping
- **Paused** (Gray): Schedule disabled
- **Failed** (Red): Last run encountered errors

### Error Handling
- Automatic retry on transient failures
- Detailed error logging and history
- Email notifications for failures (if configured)
- Graceful degradation on service unavailability

## Usage Instructions

### Initial Setup

1. **Backend is Ready**
   - Scheduler service auto-initializes on startup
   - Database tables created automatically
   - No additional configuration needed

2. **Create Schedule** (Automatic)
   - First login creates default hourly schedule
   - Configurable from Settings > Scraping
   - Or use API endpoints directly

3. **Monitor Status**
   - Check sidebar indicator for current status
   - View detailed history in Settings
   - Real-time updates without refresh

### Configuration Options

#### From UI (Settings > Scraping)
- Toggle schedule on/off
- Adjust interval (0.5 - 24 hours)
- Set active hours
- View execution history
- Trigger manual runs

#### Via API
```bash
# Create schedule
curl -X POST http://localhost:8000/api/scraping-schedules/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "interval_hours": 1.0,
    "enabled": true,
    "active_hours": {"start": 8, "end": 18}
  }'

# Trigger manual run
curl -X POST http://localhost:8000/api/scraping-schedules/{id}/trigger \
  -H "Authorization: Bearer $TOKEN"
```

## Testing

### Quick Validation
1. Run test script: `python3 backend/scripts/test_scraping_endpoints_simple.py`
2. Check for 401 responses (auth required = working)
3. Login to frontend and check sidebar indicator

### Full Testing
1. Create schedule via UI or API
2. Wait for next scheduled run
3. Check history for results
4. Verify work orders updated

### Manual Testing
```python
# Use provided test scripts
backend/scripts/test_scraping_endpoints.py  # Full endpoint test
backend/scripts/test_scraping_endpoints_simple.py  # Quick check
```

## Troubleshooting

### Common Issues

1. **"No scraping schedule" in sidebar**
   - Schedule not created yet
   - Create via Settings > Scraping
   - Or wait for auto-creation on login

2. **Status not updating**
   - Check backend is running
   - Verify API endpoints accessible
   - Check browser console for errors

3. **Scraping not running**
   - Check if schedule is enabled
   - Verify within active hours
   - Check scraping history for errors

4. **Backend won't start**
   - Check APScheduler installed: `pip install apscheduler`
   - Verify database accessible
   - Check logs for initialization errors

### Debug Commands

```bash
# Check scheduler status
curl http://localhost:8000/api/scraping-schedules/ -H "Authorization: Bearer $TOKEN"

# View recent history
curl http://localhost:8000/api/scraping-schedules/history/work_orders?limit=10 \
  -H "Authorization: Bearer $TOKEN"

# Check scheduler logs
tail -f backend/logs/scheduler.log
```

## Next Steps

### Immediate Actions
1. Restart backend to activate new endpoints
2. Login to frontend to auto-create schedule
3. Monitor sidebar indicator for status
4. Adjust settings as needed

### Future Enhancements
1. **Multiple Schedule Types**
   - Separate schedules for dispensers
   - Different intervals for different data
   - Priority-based scheduling

2. **Advanced Notifications**
   - Discord/Slack integration
   - Custom alert thresholds
   - Summary reports

3. **Performance Optimization**
   - Incremental scraping (only changes)
   - Parallel processing options
   - Smart retry strategies

4. **Analytics Dashboard**
   - Success rate graphs
   - Processing time trends
   - Work order growth charts

## Files Modified/Created

### Backend
- `/backend/requirements.txt` - Added APScheduler
- `/backend/app/services/scheduler_service.py` - Core scheduler
- `/backend/app/models/scraping_models.py` - Database models
- `/backend/app/routes/scraping_schedules.py` - API endpoints
- `/backend/app/main.py` - Integrated scheduler lifecycle
- `/backend/scripts/test_scraping_endpoints*.py` - Test scripts

### Frontend
- `/frontend/src/components/ScrapingStatus.tsx` - Status display
- `/frontend/src/components/ScrapingSchedule.tsx` - Config UI
- `/frontend/src/components/Navigation.tsx` - Sidebar integration
- `/frontend/src/pages/Settings.tsx` - Added Scraping tab
- `/frontend/src/pages/WorkOrders.tsx` - Added status display

### Documentation
- `/docs/implementation-complete/HOURLY_SCRAPING_PLAN.md` - Initial plan
- `/docs/implementation-complete/HOURLY_SCRAPING_IMPLEMENTATION.md` - This file
- `/SCRAPING_STATUS_UI.md` - UI implementation details
- `/NAVIGATION_REORGANIZATION.md` - Navigation updates

## Summary

The hourly work order scraping system is fully implemented and ready for use. It provides automated background synchronization with manual control options, real-time status monitoring, and comprehensive error handling. The system is designed to be reliable, user-friendly, and maintainable.