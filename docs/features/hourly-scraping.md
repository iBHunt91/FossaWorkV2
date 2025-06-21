# Hourly Work Order Scraping

## Overview

The hourly scraping feature automatically fetches work orders from WorkFossa at regular intervals, keeping your local database synchronized with the latest data. This eliminates the need for manual scraping and ensures you always have up-to-date work order information.

## Features

- **Automated Scheduling**: Set work orders to scrape automatically every hour (or custom interval)
- **Active Hours**: Configure specific hours when scraping should occur (e.g., 6 AM - 10 PM)
- **Manual Triggers**: Run scraping immediately when needed
- **History Tracking**: View complete history of all scraping runs
- **Error Recovery**: Automatic retry on failures with exponential backoff
- **Change Detection**: Get notified when new work orders are found

## Configuration

### Accessing Schedule Settings

1. Navigate to **Settings** in the main menu
2. Click on the **Scraping** tab
3. Configure your schedule preferences

### Schedule Options

- **Scraping Interval**: How often to scrape (0.25 to 24 hours)
  - Default: 1 hour
  - Minimum: 15 minutes (0.25 hours)
  - Maximum: 24 hours
  
- **Active Hours**: Limit scraping to business hours
  - Start Hour: When scraping should begin (e.g., 6:00 AM)
  - End Hour: When scraping should stop (e.g., 10:00 PM)
  - Disable to run 24/7

### Creating a Schedule

1. Click **Create Schedule** button
2. Set your preferred interval
3. Configure active hours (optional)
4. Schedule will start immediately

### Managing Schedules

- **Pause**: Temporarily stop scheduled scraping
- **Resume**: Restart a paused schedule
- **Update**: Change interval or active hours
- **Manual Run**: Click the refresh button to scrape immediately

## Scraping History

The history table shows:
- **Started**: When the scraping run began
- **Duration**: How long the scraping took
- **Items**: Number of work orders processed
- **Status**: Success or failure indicator

## Technical Details

### Database Schema

```sql
-- Scraping schedules configuration
CREATE TABLE scraping_schedules (
    id INTEGER PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    schedule_type VARCHAR NOT NULL,
    interval_hours FLOAT DEFAULT 1.0,
    active_hours JSON,
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraping run history
CREATE TABLE scraping_history (
    id INTEGER PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    schedule_type VARCHAR NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    success BOOLEAN DEFAULT FALSE,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    duration_seconds FLOAT
);
```

### API Endpoints

- `POST /api/scraping-schedules/` - Create a new schedule
- `GET /api/scraping-schedules/` - Get all schedules for user
- `PUT /api/scraping-schedules/{job_id}` - Update schedule
- `DELETE /api/scraping-schedules/{job_id}` - Delete schedule
- `POST /api/scraping-schedules/trigger` - Manual trigger
- `GET /api/scraping-schedules/history/{type}` - Get history

### Background Service

The scheduler service uses APScheduler to manage background tasks:

```python
# Initialize scheduler on startup
scheduler_service = SchedulerService()
await scheduler_service.initialize(database_url)

# Add hourly scraping job
job_id = await scheduler_service.add_work_order_scraping_schedule(
    user_id=user_id,
    interval_hours=1.0,
    active_hours={"start": 6, "end": 22},
    enabled=True
)
```

## Best Practices

1. **Set Reasonable Intervals**: Don't scrape too frequently to avoid overloading the system
2. **Use Active Hours**: Limit scraping to business hours when work orders are likely to change
3. **Monitor History**: Check the history regularly for failed runs
4. **Handle Failures**: The system will retry automatically, but persistent failures may need investigation

## Troubleshooting

### Schedule Not Running

1. Check if the schedule is enabled (not paused)
2. Verify active hours include current time
3. Check scraping history for error messages
4. Ensure WorkFossa credentials are valid

### Scraping Failures

Common causes:
- Invalid WorkFossa credentials
- Network connectivity issues
- WorkFossa site changes
- Browser automation failures

### Performance Issues

- Reduce scraping frequency if system is slow
- Check memory usage during scraping
- Consider running during off-peak hours

## Future Enhancements

- Email notifications for new work orders
- Customizable notification thresholds
- Multiple schedule types (dispensers, etc.)
- Schedule templates for common patterns
- Advanced filtering options