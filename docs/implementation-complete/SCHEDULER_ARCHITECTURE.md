# Standalone Scheduler Architecture

## Overview

The FossaWork V2 scheduler has been redesigned as a standalone daemon process that runs independently of the main FastAPI application. This architecture simplifies the codebase, improves reliability, and makes debugging easier.

## Architecture Components

### 1. Scheduler Daemon (`scheduler_daemon.py`)
- Standalone Python process that polls the database for scheduled tasks
- Executes jobs at the appropriate times based on schedule configuration
- Handles retries and failure tracking
- Runs independently of the web application

### 2. Simple Scheduler Service (`app/services/simple_scheduler_service.py`)
- Database-only service for managing schedule configurations
- No APScheduler dependencies
- Provides CRUD operations for schedules
- Used by API endpoints to manage schedules

### 3. API Routes (`app/routes/scraping_schedules.py`)
- RESTful endpoints for schedule management
- Create, update, delete, and query schedules
- Get execution history and daemon status
- Trigger manual runs by updating next_run time

### 4. Database Models
- `ScrapingSchedule`: Stores schedule configurations
- `ScrapingHistory`: Stores execution history

## How It Works

1. **Schedule Creation**: Users create schedules via the API, which are stored in the database
2. **Daemon Polling**: The scheduler daemon checks the database every 60 seconds
3. **Job Execution**: When a schedule is due, the daemon executes the job
4. **Status Updates**: Execution results are written to the database
5. **UI Updates**: Frontend polls the API for status updates (no WebSockets)

## Running the Scheduler

### Development

```bash
# Start the scheduler daemon
./start_scheduler.sh

# Monitor logs
tail -f logs/scheduler_daemon.log

# Stop the scheduler
./stop_scheduler.sh
```

### Production (systemd)

```bash
# Copy service file
sudo cp fossawork-scheduler.service /etc/systemd/system/

# Enable and start service
sudo systemctl enable fossawork-scheduler
sudo systemctl start fossawork-scheduler

# Check status
sudo systemctl status fossawork-scheduler
```

## Benefits of This Architecture

1. **Simplicity**: No complex APScheduler configuration or job serialization
2. **Reliability**: Daemon can be restarted independently of the web app
3. **Debugging**: Clear separation of concerns, easy to trace issues
4. **Scalability**: Can run multiple daemons if needed
5. **Flexibility**: Easy to add new job types or modify scheduling logic

## Schedule Configuration

Schedules support:
- **Interval**: Run every X hours (0.5 to 24)
- **Active Hours**: Limit execution to specific hours (e.g., 6 AM to 10 PM)
- **Enable/Disable**: Pause schedules without deleting them
- **Manual Triggers**: Run immediately via API

## Error Handling

- Consecutive failure tracking
- Automatic disable after 5 consecutive failures
- Error details stored in history
- Notifications sent on failures (if configured)

## Frontend Changes

The frontend has been simplified:
- No WebSocket connections
- Polling-based status updates (every 30 seconds)
- Simplified state management
- Clear status indicators

## Migration from APScheduler

The backup of the original implementation is stored in:
`backend/backup/scheduler_backup_2025_01_26/`

To restore the old implementation, follow the instructions in the backup README.

## Future Enhancements

1. Add support for more schedule types (dispensers, filters)
2. Implement cron-style scheduling
3. Add job queuing for concurrent execution
4. Support for distributed scheduling
5. Enhanced monitoring and metrics